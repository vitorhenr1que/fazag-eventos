const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node', target: 'ES2020' } })
const { AppError } = require('../src/lib/app-error.ts')
const { hasAdminPermission } = require('../src/lib/admin-permissions.ts')

function ambiente() {
    const evento = { id: 'evento-1', nome: 'Semana acadêmica', temSubeventos: true, limiteSubeventosPorAluno: 2 }
    const subeventos = [
        { id: 'sub-1', nome: 'Palestra', eventoId: evento.id, totalVagas: 3 },
        { id: 'sub-2', nome: 'Oficina', eventoId: evento.id, totalVagas: 3 },
        { id: 'outro-sub', nome: 'Outro evento', eventoId: 'outro-evento', totalVagas: 3 },
    ]
    const inscricoes = [1, 2, 3].map(n => ({
        id: `insc-${n}`, eventoId: evento.id, alunoId: `aluno-${n}`, status: 'CONFIRMADA',
        aluno: { id: `aluno-${n}`, nome: `Aluno ${n}`, email: `aluno${n}@example.com` },
        valorPago: 50,
    }))
    const vinculos = []
    const presencas = []
    const historicos = new Set()
    const consultas = []
    let failCheckIn = false
    const snapshot = value => value ? structuredClone(value) : null
    const relacoes = id => vinculos.filter(v => v.inscricaoId === id).map(v => ({ ...v, subevento: subeventos.find(s => s.id === v.subeventoId) }))
    const db = {
        subevento: { findUnique: async ({ where }) => {
            const sub = subeventos.find(s => s.id === where.id)
            return snapshot(sub && { ...sub, evento })
        } },
        evento: { findUnique: async ({ where }) => where.id === evento.id ? snapshot({ ...evento, subeventos: subeventos.filter(s => s.eventoId === evento.id).map(s => ({ ...s, _count: { inscricoesSubevento: vinculos.filter(v => v.subeventoId === s.id).length } })) }) : null },
        inscricao: {
            findUnique: async ({ where }) => {
                const inscricao = inscricoes.find(i => i.id === where.id)
                return snapshot(inscricao && { ...inscricao, evento: { ...evento, subeventos: subeventos.filter(s => s.eventoId === inscricao.eventoId) }, subeventosEscolhidos: relacoes(inscricao.id) })
            },
            findMany: async ({ where }) => {
                consultas.push(where)
                return snapshot(inscricoes.filter(i => i.eventoId === where.eventoId && i.status === where.status && !vinculos.some(v => v.inscricaoId === i.id && v.subeventoId === where.subeventosEscolhidos.none.subeventoId))
                    .map(i => ({ id: i.id, aluno: i.aluno, _count: { subeventosEscolhidos: relacoes(i.id).length } })))
            },
        },
        inscricaoSubevento: {
            findUnique: async ({ where }) => {
                const vinculo = vinculos.find(v => Object.entries(where.inscricaoId_subeventoId).every(([k, value]) => v[k] === value))
                return snapshot(vinculo && { ...vinculo, subevento: subeventos.find(s => s.id === vinculo.subeventoId), inscricao: inscricoes.find(i => i.id === vinculo.inscricaoId) })
            },
            findMany: async ({ where }) => snapshot(vinculos.filter(v => v.subeventoId === where.subeventoId).map(v => ({ ...v, checkIn: presencas.find(p => p.inscricaoSubeventoId === v.id) ?? null, inscricao: inscricoes.find(i => i.id === v.inscricaoId) }))),
            count: async ({ where }) => vinculos.filter(v => Object.entries(where).every(([k, value]) => v[k] === value)).length,
            create: async ({ data }) => {
                assert.ok(!vinculos.some(v => v.inscricaoId === data.inscricaoId && v.subeventoId === data.subeventoId))
                const row = { id: `vinculo-${vinculos.length + 1}`, dataInscricao: new Date(), ...data }
                vinculos.push(row)
                return snapshot(row)
            },
            createMany: async ({ data }) => { for (const row of data) await db.inscricaoSubevento.create({ data: row }); return { count: data.length } },
            delete: async ({ where }) => { const index = vinculos.findIndex(v => v.id === where.id); assert.notEqual(index, -1); return vinculos.splice(index, 1)[0] },
        },
        checkIn: { create: async ({ data }) => { presencas.push(data); return snapshot(data) }, deleteMany: async ({ where }) => {
            if (failCheckIn) throw new AppError('Falha simulada ao excluir presença', 503)
            for (let i = presencas.length - 1; i >= 0; i--) if (presencas[i].inscricaoSubeventoId === where.inscricaoSubeventoId) presencas.splice(i, 1)
        } },
        exclusaoInscricao: { findUnique: async ({ where }) => historicos.has(where.inscricaoOriginalId) ? { estado: 'PROCESSANDO' } : null },
        reembolso: { findUnique: async () => null },
        certificado: { deleteMany: async () => assert.fail('Não deve excluir certificado emitido') },
        $transaction: async callback => callback({ $queryRaw: async () => [{ adquirido: 1 }] }),
    }
    const cache = new Map()
    const lock = require('./helpers/load-lock.cjs')(db)
    function load(relativePath) {
        const file = path.resolve(__dirname, '../src', relativePath)
        if (cache.has(file)) return cache.get(file).exports
        const loaded = new Module(file, module); loaded.filename = file; loaded.paths = module.paths
        cache.set(file, loaded)
        const original = loaded.require.bind(loaded)
        loaded.require = id => {
            if (id === '@/lib/db') return { __esModule: true, default: db }
            if (id === '@/lib/app-error') return require('../src/lib/app-error.ts')
            if (id === '@/lib/financeiro-lock') return lock
            if (id === '@/lib/auth-admin') return { getAdminFromHeader: async request => {
                const role = request.headers.get('authorization')
                if (!role) throw new AppError('Token não fornecido', 401)
                if (!hasAdminPermission(role, 'GESTAO')) throw new AppError('Acesso negado', 403)
                return { id: 'admin-1', role }
            } }
            if (id === '@/lib/auth-aluno') return { getAlunoFromHeader: async request => ({ id: request.headers.get('x-aluno-id') }) }
            if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`)
            return original(id)
        }
        loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
        return loaded.exports
    }
    const service = new (load('services/inscricao.service.ts').InscricaoService)()
    const subeventosService = new (load('services/subevento-inscricoes.service.ts').SubeventoInscricoesService)()
    return {
        api: load('app/api/admin/subeventos/[id]/inscricoes/route.ts'),
        lista: load('app/api/admin/eventos/[id]/subeventos/route.ts').GET,
        aluno: load('app/api/inscricoes/[inscricaoId]/subeventos/route.ts').POST,
        checkIn: (inscricaoId, subeventoId) => service.realizarCheckInSubevento(inscricaoId, subeventoId, true),
        remover: () => subeventosService.remover('sub-1', 'insc-1'),
        evento, subeventos, inscricoes, vinculos, presencas, historicos, consultas,
        falharPresenca: value => { failCheckIn = value },
    }
}

const context = id => ({ params: Promise.resolve({ id }) })
const request = (method = 'GET', body, role = 'ADMIN') => new Request('http://localhost/api/admin/subeventos/sub-1/inscricoes', {
    method, headers: role ? { authorization: role, 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
})
const add = (a, inscricaoId = 'insc-1', subId = 'sub-1') => a.api.POST(request('POST', { inscricaoId }), context(subId))
const remove = (a, inscricaoId = 'insc-1', subId = 'sub-1') => a.api.DELETE(request('DELETE', { inscricaoId }), context(subId))
const selecionar = (a, inscricaoId, alunoId, subeventoIds) => a.aluno(new Request('http://localhost/api/inscricoes/x/subeventos', {
    method: 'POST', headers: { 'x-aluno-id': alunoId, 'Content-Type': 'application/json' }, body: JSON.stringify({ subeventoIds }),
}), { params: Promise.resolve({ inscricaoId }) })

test('todas as operações exigem perfil de gestão; rejeitam corpo inválido e subevento ausente', async () => {
    const a = ambiente()
    for (const method of ['GET', 'POST', 'DELETE']) {
        const body = method === 'GET' ? undefined : { inscricaoId: 'insc-1' }
        assert.equal((await a.api[method](request(method, body, null), context('sub-1'))).status, 401)
        assert.equal((await a.api[method](request(method, body, 'FINANCEIRO'), context('sub-1'))).status, 403)
        assert.equal((await a.api[method](request(method, body), context('inexistente'))).status, 404)
    }
    for (const method of ['POST', 'DELETE']) for (const body of [{}, { inscricaoId: '' }, { inscricaoId: 42 }, { inscricaoId: 'insc-1', alunoId: 'outro' }]) {
        assert.equal((await a.api[method](request(method, body), context('sub-1'))).status, 400)
    }
    assert.equal((await a.lista(request(), context('evento-1'))).status, 200)
    assert.equal((await a.lista(request('GET', undefined, null), context('evento-1'))).status, 401)
    assert.equal((await a.lista(request(), context('inexistente'))).status, 404)
})

test('lista inscritos com presença e candidatos somente confirmados do evento, sem duplicados', async () => {
    const a = ambiente()
    await add(a)
    a.presencas.push({ inscricaoSubeventoId: a.vinculos[0].id, dataHora: new Date() })
    a.inscricoes[1].status = 'PENDENTE'
    a.inscricoes.push({ id: 'outro', eventoId: 'outro-evento', status: 'CONFIRMADA' })
    const response = await a.api.GET(request('GET', undefined, 'NUPPEX'), context('sub-1'))
    const { data } = await response.json()
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(data.inscritos.length, 1)
    assert.equal(data.inscritos[0].inscricao.aluno.nome, 'Aluno 1')
    assert.ok(data.inscritos[0].checkIn)
    assert.deepEqual(data.candidatos.map(c => c.id), ['insc-3'])
    assert.deepEqual(a.consultas[0], { eventoId: 'evento-1', status: 'CONFIRMADA', subeventosEscolhidos: { none: { subeventoId: 'sub-1' } } })
})

test('adiciona apenas vínculo; rejeita duplicado, outro evento, pendente e exclusão em andamento', async () => {
    const a = ambiente()
    assert.equal((await add(a)).status, 201)
    assert.equal(a.vinculos.length, 1)
    assert.equal(a.inscricoes[0].valorPago, 50)
    assert.equal((await add(a)).status, 409)
    assert.equal((await add(a, 'inexistente')).status, 400)
    assert.equal((await add(a, 'insc-2', 'outro-sub')).status, 400)
    a.inscricoes[1].status = 'PENDENTE'
    assert.equal((await add(a, 'insc-2')).status, 400)
    a.historicos.add('insc-3')
    assert.equal((await add(a, 'insc-3')).status, 409)
    assert.equal(a.vinculos.length, 1)
})

test('respeita vagas e limite de subeventos por aluno', async () => {
    const a = ambiente()
    a.subeventos[0].totalVagas = 1
    assert.equal((await add(a)).status, 201)
    assert.equal((await add(a, 'insc-2')).status, 409)
    a.evento.limiteSubeventosPorAluno = 1
    assert.equal((await add(a, 'insc-1', 'sub-2')).status, 409)
    a.evento.limiteSubeventosPorAluno = null
    assert.equal((await add(a, 'insc-1', 'sub-2')).status, 201)
})

test('remoção apaga somente vínculo e presença selecionados e libera vaga para outro aluno', async () => {
    const a = ambiente()
    a.subeventos[0].totalVagas = 1
    await add(a)
    await add(a, 'insc-1', 'sub-2')
    const removido = a.vinculos[0].id
    const mantido = a.vinculos[1].id
    a.presencas.push({ inscricaoSubeventoId: removido }, { inscricaoSubeventoId: mantido }, { inscricaoId: 'insc-1' })
    assert.equal((await remove(a)).status, 200)
    assert.deepEqual(a.vinculos.map(v => v.id), [mantido])
    assert.deepEqual(a.presencas, [{ inscricaoSubeventoId: mantido }, { inscricaoId: 'insc-1' }])
    assert.equal(a.inscricoes.length, 3)
    assert.equal(a.inscricoes[0].valorPago, 50)
    assert.equal((await remove(a)).status, 404)
    assert.equal((await add(a, 'insc-2')).status, 201)
})

test('não apaga vínculo quando a exclusão da presença falha; permite repetir a remoção', async () => {
    const a = ambiente()
    await add(a)
    a.falharPresenca(true)
    assert.equal((await remove(a)).status, 503)
    assert.equal(a.vinculos.length, 1)
    a.falharPresenca(false)
    assert.equal((await remove(a)).status, 200)
    assert.equal(a.vinculos.length, 0)
})

test('admin e aluno disputando a última vaga não excedem a capacidade', async () => {
    const a = ambiente()
    a.subeventos[0].totalVagas = 1
    const responses = await Promise.all([add(a), selecionar(a, 'insc-2', 'aluno-2', ['sub-1'])])
    assert.equal(responses.filter(r => r.ok).length, 1)
    assert.equal(a.vinculos.length, 1)
})

test('contrato dos apps mantém payload, header e resposta anteriores, sem campos novos obrigatórios', async () => {
    const a = ambiente()
    const enviar = body => a.aluno(new Request('http://localhost/api/inscricoes/insc-1/subeventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-aluno-id': 'aluno-1' },
        body: JSON.stringify(body),
    }), { params: Promise.resolve({ inscricaoId: 'insc-1' }) })

    let response = await enviar({ subeventoIds: ['sub-1'] })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { success: true, added: 1, removed: 0 } })

    response = await enviar({ subeventoIds: ['sub-1', 'sub-2'] })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { success: true, added: 1, removed: 0 } })

    response = await enviar({ subeventoIds: ['sub-1', 'sub-2'] })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { success: true, added: 0, removed: 0 } })
    assert.equal(a.vinculos.length, 2)

    // Campos adicionais continuam sendo ignorados como no schema anterior.
    response = await enviar({ subeventoIds: ['sub-1', 'sub-2'], appVersion: '1.0', alunoId: 'valor-ignorado' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, data: { success: true, added: 0, removed: 0 } })
})

test('seleção pelo aluno valida propriedade e relê escolhas feitas pelo administrador', async () => {
    const a = ambiente()
    assert.equal((await selecionar(a, 'insc-1', 'aluno-2', ['sub-1'])).status, 403)
    await add(a)
    assert.equal((await selecionar(a, 'insc-1', 'aluno-1', ['sub-2'])).status, 400)
    assert.equal((await selecionar(a, 'insc-1', 'aluno-1', ['sub-1', 'sub-2'])).status, 200)
    assert.equal(a.vinculos.length, 2)
})

test('remoção e check-in simultâneos não deixam presença órfã', async () => {
    for (const checkInPrimeiro of [true, false]) {
        const a = ambiente()
        await add(a)
        if (checkInPrimeiro) {
            const results = await Promise.allSettled([a.checkIn('insc-1', 'sub-1'), a.remover()])
            assert.equal(results[0].status, 'fulfilled')
            assert.equal(results[1].value.removed, true)
        } else {
            const results = await Promise.allSettled([a.remover(), a.checkIn('insc-1', 'sub-1')])
            assert.equal(results[0].value.removed, true)
            assert.equal(results[1].status, 'rejected')
            assert.equal(results[1].reason.statusCode, 404)
        }
        assert.equal(a.vinculos.length, 0)
        assert.equal(a.presencas.length, 0)
    }
})
