const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node', target: 'ES2020' } })

function ambiente() {
    const state = {
        evento: [{ id: 'e1', nome: 'Evento excluído', status: 'PUBLISHED', dataInicio: new Date('2026-10-01'), certificado: { template: { elementos: ['modelo-atual'] }, fundoUrl: 'https://example.com/fundo.png' } }, { id: 'e2', nome: 'Outro evento' }],
        inscricao: [{ id: 'i1', eventoId: 'e1', alunoId: 'a1', status: 'CONFIRMADA', aluno: { nome: 'Aluno 1' } }, { id: 'i2', eventoId: 'e2', alunoId: 'a2', status: 'CONFIRMADA', aluno: { nome: 'Aluno 2' } }],
        subevento: [{ id: 's1', eventoId: 'e1' }, { id: 's2', eventoId: 'e2' }],
        inscricaoSubevento: [{ id: 'v1', inscricaoId: 'i1', subeventoId: 's1' }, { id: 'v2', inscricaoId: 'i2', subeventoId: 's2' }],
        checkIn: [{ id: 'p1', inscricaoId: 'i1' }, { id: 'ps1', inscricaoSubeventoId: 'v1' }, { id: 'p2', inscricaoId: 'i2' }, { id: 'ps2', inscricaoSubeventoId: 'v2' }],
        certificado: [{ id: 'cfg1', eventoId: 'e1', inscricaoId: null, codigoValidacao: null }, { id: 'cert1', inscricaoId: 'i1', eventoId: null, codigoValidacao: 'CODIGO1', cargaHorariaTotal: 4, metadadosEvento: { template: { elementos: ['antigo'] } } }, { id: 'cert2', inscricaoId: 'i2', eventoId: null, codigoValidacao: 'CODIGO2' }],
        reservaPix: [{ id: 'pix1', eventoId: 'e1' }, { id: 'pix2', eventoId: 'e2' }],
        reembolso: [{ id: 'r1', eventoId: 'e1' }, { id: 'r2', eventoId: 'e2' }],
        exclusaoInscricao: [{ id: 'x1', eventoId: 'e1' }, { id: 'x2', eventoId: 'e2' }],
        pagamentoCancelado: [{ id: 'pc1', eventoId: 'e1' }, { id: 'pc2', eventoId: 'e2' }],
        exclusaoEvento: [],
        aluno: [{ id: 'a1', nome: 'Aluno 1' }, { id: 'a2', nome: 'Aluno 2' }],
        admin: [{ id: 'op1', permissoes: { areas: ['eventos'], eventos: 'ESPECIFICOS', eventoIds: ['e1'], acesso: 'VISUALIZAR' } }],
    }
    let failTable = null
    const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
        if (key === 'OR') return value.some(filter => matches(row, filter))
        if (key === 'AND') return value.every(filter => matches(row, filter))
        if (key === 'inscricao') return state.inscricao.some(i => i.id === row.inscricaoId && matches(i, value))
        if (key === 'metadadosEvento' && value.path) return value.path.slice(2).split('.').reduce((current, field) => current?.[field], row.metadadosEvento) === value.equals
        if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key])
        if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not
        return row[key] === value
    })
    const db = { $transaction: async fn => fn(db), $queryRaw: async () => [{ adquirido: 1 }] }
    for (const table of Object.keys(state)) db[table] = {
        findUnique: async ({ where }) => state[table].find(row => matches(row, where)) || null,
        findMany: async ({ where } = {}) => state[table].filter(row => matches(row, where)),
        count: async ({ where }) => state[table].filter(row => matches(row, where)).length,
        create: async ({ data }) => { const row = { estado: 'PROCESSANDO', ...data }; state[table].push(row); return row },
        update: async ({ where, data }) => { const row = state[table].find(row => matches(row, where)); Object.assign(row, data); return row },
        deleteMany: async ({ where }) => {
            if (failTable === table) { failTable = null; throw new Error('Falha simulada sem rollback') }
            const removed = state[table].filter(row => matches(row, where)); state[table] = state[table].filter(row => !matches(row, where)); return { count: removed.length }
        },
        delete: async ({ where }) => { const row = state[table].find(row => matches(row, where)); state[table] = state[table].filter(row => !matches(row, where)); return row },
    }
    const cache = new Map()
    function load(file) {
        const filename = path.resolve(__dirname, '../src', file)
        if (cache.has(filename)) return cache.get(filename).exports
        const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths; cache.set(filename, loaded)
        const original = loaded.require.bind(loaded)
        loaded.require = id => {
            if (id === '@/lib/db' || id === './db') return { __esModule: true, default: db }
            if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
            if (id.startsWith('./')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id + '.ts')))
            return original(id)
        }
        loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename)
        return loaded.exports
    }
    return { state, db, load, service: new (load('services/exclusao-evento.service.ts').ExclusaoEventoService)(), fail: table => { failTable = table } }
}

test('limpeza completa apaga somente os registros do evento escolhido, inclusive o financeiro', async () => {
    const { state, service } = ambiente()
    assert.equal((await service.resumo('e1')).certificados, 1)
    await service.excluir('e1', false, 'admin', 1)
    for (const table of ['evento', 'inscricao', 'subevento', 'reservaPix', 'reembolso', 'exclusaoInscricao', 'pagamentoCancelado']) {
        assert.equal(state[table].length, 1, table)
        assert.equal(state[table][0].eventoId || state[table][0].id, 'e2', table)
    }
    assert.deepEqual(state.inscricaoSubevento.map(row => row.id), ['v2'])
    assert.deepEqual(state.checkIn.map(row => row.id), ['p2', 'ps2'])
    assert.deepEqual(state.certificado.map(row => row.id), ['cert2'])
    assert.equal(state.exclusaoEvento[0].estado, 'CONCLUIDO')
    assert.deepEqual(state.admin[0].permissoes.eventoIds, [])
})

test('manter certificados conserva o código e a validação pública sem a inscrição ou o evento', async () => {
    const { state, service, load } = ambiente()
    await service.excluir('e1', true, 'admin', 1)
    const certificado = state.certificado.find(row => row.id === 'cert1')
    assert.equal(certificado.inscricaoId, null)
    assert.equal(certificado.codigoValidacao, 'CODIGO1')
    assert.equal(certificado.metadadosEvento.nomeAluno, 'Aluno 1')
    assert.deepEqual(certificado.metadadosEvento.template, { elementos: ['modelo-atual'] })
    const route = load('app/api/certificados/validar/[codigo]/route.ts')
    const res = await route.GET(new Request('http://localhost/api/certificados/validar/CODIGO1'), { params: Promise.resolve({ codigo: 'CODIGO1' }) })
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.data.aluno, 'Aluno 1')
    assert.equal(json.data.evento, 'Evento excluído')
    assert.equal(json.data.cargaHoraria, 4)
})

test('aluno continua encontrando apenas seus certificados preservados em Minhas Inscrições', async () => {
    const { service, load } = ambiente()
    await service.excluir('e1', true, 'admin', 1)
    const route = load('app/api/minhas-inscricoes/route.ts')
    const res = await route.GET(new Request('http://localhost/api/minhas-inscricoes', { headers: { 'x-aluno-id': 'a1' } }))
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.deepEqual(json.data, [])
    assert.deepEqual(json.certificadosPreservados.map(certificado => certificado.codigoValidacao), ['CODIGO1'])
})

test('falha parcial é retomável, mantém a escolha original e preserva certificados já desvinculados', async () => {
    const { state, service, fail, load } = ambiente()
    fail('inscricao')
    await assert.rejects(service.excluir('e1', true, 'admin', 1), /Falha simulada/)
    assert.equal(state.exclusaoEvento[0].estado, 'PROCESSANDO')
    assert.equal(state.evento.find(row => row.id === 'e1').status, 'CANCELLED')
    await assert.rejects(service.excluir('e1', false, 'admin', 1), error => error.statusCode === 409)
    await assert.rejects(load('lib/financeiro-lock.ts').comLockFinanceiro('e1', async () => assert.fail('Não deve alterar evento em exclusão')), error => error.statusCode === 409)
    await service.excluir('e1', true, 'admin', 0)
    assert.equal(state.exclusaoEvento[0].estado, 'CONCLUIDO')
    assert.equal(state.certificado.find(row => row.id === 'cert1').codigoValidacao, 'CODIGO1')
    await service.excluir('e1', true, 'admin', 0)
})

test('mudança no número de certificados exige nova confirmação antes de qualquer exclusão', async () => {
    const { state, service } = ambiente()
    await assert.rejects(service.excluir('e1', false, 'admin', 0), error => error.statusCode === 409)
    assert.equal(state.exclusaoEvento.length, 0)
    assert.equal(state.evento[0].status, 'PUBLISHED')
    assert.equal(state.inscricao.length, 2)
})

test('retoma até uma falha ao concluir o histórico depois que o evento já foi apagado', async () => {
    const { state, db, service } = ambiente()
    const update = db.exclusaoEvento.update
    let failOnce = true
    db.exclusaoEvento.update = async args => { if (failOnce) { failOnce = false; throw new Error('Falha na conclusão') } return update(args) }
    await assert.rejects(service.excluir('e1', false, 'admin', 1), /Falha na conclusão/)
    assert.equal(state.evento.some(evento => evento.id === 'e1'), false)
    assert.equal(state.exclusaoEvento[0].estado, 'PROCESSANDO')
    await service.excluir('e1', false, 'admin', 0)
    assert.equal(state.exclusaoEvento[0].estado, 'CONCLUIDO')
})

test('certificado órfão sem preservação válida continua inválido e confirmação precisa ser explícita', () => {
    const { certificadoPreservado, exclusaoEventoSchema } = ambiente().load('lib/exclusao-evento.ts')
    assert.equal(certificadoPreservado({ nomeAluno: 'Aluno', nomeEvento: 'Evento' }), null)
    assert.equal(certificadoPreservado({ nomeAluno: 'Aluno', nomeEvento: 'Evento', preservacao: { motivo: 'EXCLUSAO_EVENTO', eventoId: 'e1', alunoId: 'a1', inscricaoConfirmada: false } }), null)
    assert.equal(exclusaoEventoSchema.safeParse({ confirmacao: 'EXCLUIR', certificadosEsperados: 1 }).success, false)
    assert.equal(exclusaoEventoSchema.safeParse({ confirmacao: 'sim', certificados: 'EXCLUIR', certificadosEsperados: 1 }).success, false)
})
