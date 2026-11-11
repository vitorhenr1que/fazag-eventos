const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node', target: 'ES2020' } })
const { avaliarCertificacao } = require('../src/lib/certificacao.ts')

function inscricao() {
    return {
        id: 'inscricao-1', eventoId: 'event-1', alunoId: 'aluno-1', status: 'CONFIRMADA', checkIn: { id: 'presenca' }, certificado: null,
        aluno: { nome: 'Aluno' }, subeventosEscolhidos: [],
        evento: { nome: 'Evento', status: 'FINISHED', temSubeventos: true, cargaHorariaBase: 2,
            dataInicio: '2026-10-01T10:00:00Z', dataFim: '2099-10-01T10:00:00Z',
            certificado: { ativo: true, fundoUrl: 'https://example.com/fundo.png', template: {} } },
    }
}
function environment(record = inscricao()) {
    const created = []
    const db = {
        $transaction: async callback => callback(db),
        $queryRaw: async () => [{ adquirido: 1 }],
        exclusaoEvento: { findUnique: async () => null },
        aluno: { findUnique: async ({ where }) => ({ id: where.id }) },
        inscricao: { findUnique: async () => record, findMany: async () => [record] },
        certificado: { findMany: async () => [], findUnique: async () => record.certificado,
            create: async ({ data }) => { created.push(data); return record.certificado = { id: 'cert-1', ...data } } },
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
        loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename)
        return loaded.exports
    }
    const route = load('app/api/inscricoes/[inscricaoId]/certificado/emitir/route.ts')
    const emitir = (alunoId = 'aluno-1') => route.POST(new Request('http://localhost/api/inscricoes/inscricao-1/certificado/emitir', { method: 'POST', headers: { 'x-aluno-id': alunoId } }), { params: Promise.resolve({ inscricaoId: 'inscricao-1' }) })
    return { record, db, created, load, emitir }
}

test('evento encerrado e emissão ativa aceitam check-in geral mesmo com subeventos', async () => {
    const env = environment()
    assert.equal(avaliarCertificacao(env.record).liberado, true)
    const res = await env.emitir()
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data.cargaHorariaTotal, 2)
    assert.equal(env.created.length, 1)
    assert.equal((await env.emitir()).status, 200)
    assert.equal(env.created.length, 1)
})

test('presença nas atividades mantém as horas efetivamente cursadas sem duplicar a carga base', async () => {
    const env = environment()
    env.record.checkIn = null
    env.record.subeventosEscolhidos = [
        { checkIn: { id: 's1' }, subevento: { nome: 'Atividade 1', cargaHoraria: 3 } },
        { checkIn: { id: 's2' }, subevento: { nome: 'Atividade 2', cargaHoraria: 4 } },
        { checkIn: null, subevento: { nome: 'Sem presença', cargaHoraria: 10 } },
    ]
    assert.equal(avaliarCertificacao(env.record).cargaHoraria, 7)
    env.record.checkIn = { id: 'geral' }
    assert.equal(avaliarCertificacao(env.record).cargaHoraria, 7)
    const res = await env.emitir()
    assert.equal(res.status, 200)
    assert.equal((await res.json()).data.cargaHorariaTotal, 7)
})

test('carga base depende do limite de check-ins e vale para emissão do aluno e do administrador', async () => {
    for (const caso of [
        { limite: 2, base: 20, presencas: 2, horas: 20 },
        { limite: 2, base: 20, presencas: 1, horas: 3 },
        { limite: 2, base: null, presencas: 2, horas: 6 },
        { limite: 2, base: 0, presencas: 2, horas: 6 },
        { limite: null, base: 20, presencas: 2, horas: 6 },
        { limite: 0, base: 20, presencas: 2, horas: 6 },
        { limite: 1, base: 20, presencas: 2, horas: 20 },
        { limite: 2, base: 4, presencas: 2, horas: 4 },
    ]) {
        for (const admin of [false, true]) {
            const env = environment()
            env.record.checkIn = null
            env.record.evento.limiteSubeventosPorAluno = caso.limite
            env.record.evento.cargaHorariaBase = caso.base
            env.record.subeventosEscolhidos = [0, 1].map(i => ({
                checkIn: i < caso.presencas ? { id: `s${i}` } : null,
                subevento: { nome: `Atividade ${i}`, cargaHoraria: 3 },
            }))
            assert.equal(avaliarCertificacao(env.record).cargaHoraria, caso.horas)
            const certificado = admin
                ? await new (env.load('services/inscricao.service.ts').InscricaoService)().adminEmitirCertificado(env.record.id)
                : (await (await env.emitir()).json()).data
            assert.equal(certificado.cargaHorariaTotal, caso.horas, JSON.stringify({ ...caso, admin }))
            assert.equal(certificado.metadadosEvento.cargaHoraria, caso.horas)
        }
    }
})

test('administrador mantém a opção de informar uma carga horária personalizada', async () => {
    const env = environment()
    env.record.evento.limiteSubeventosPorAluno = 1
    env.record.evento.cargaHorariaBase = 20
    env.record.subeventosEscolhidos = [{ checkIn: { id: 's1' }, subevento: { nome: 'Atividade', cargaHoraria: 3 } }]
    const service = new (env.load('services/inscricao.service.ts').InscricaoService)()
    assert.equal((await service.adminEmitirCertificado(env.record.id, 12)).cargaHorariaTotal, 12)
})

test('recusa emissão sem presença, sem liberação, com inscrição pendente ou carga não configurada', async () => {
    for (const change of [
        record => { record.checkIn = null },
        record => { record.evento.certificado.ativo = false },
        record => { record.evento.certificado = null },
        record => { record.status = 'PENDENTE' },
        record => { record.evento.cargaHorariaBase = null },
    ]) {
        const env = environment(); change(env.record)
        assert.equal(avaliarCertificacao(env.record).liberado, false)
        assert.equal((await env.emitir()).status, 400)
        assert.equal(env.created.length, 0)
    }
})

test('status encerrado ou término do publicado liberam; rascunhos, cancelados e eventos em andamento não liberam', () => {
    const record = inscricao()
    const agora = new Date('2026-10-31T12:00:00Z')
    assert.equal(avaliarCertificacao(record, agora).liberado, true)
    record.evento.status = 'PUBLISHED'
    assert.equal(avaliarCertificacao(record, agora).liberado, false)
    record.evento.dataFim = agora.toISOString()
    assert.equal(avaliarCertificacao(record, agora).liberado, true)
    for (const status of ['DRAFT', 'CANCELLED']) {
        record.evento.status = status
        assert.equal(avaliarCertificacao(record, agora).liberado, false)
    }
})

test('aluno não pode emitir certificado da inscrição de outro aluno', async () => {
    const env = environment()
    assert.equal((await env.emitir('aluno-2')).status, 403)
    assert.equal(env.created.length, 0)
})

test('listagem e detalhe do aluno retornam a mesma liberação usada para emitir', async () => {
    const env = environment()
    const request = new Request('http://localhost/api/minhas-inscricoes', { headers: { 'x-aluno-id': 'aluno-1' } })
    const list = await env.load('app/api/minhas-inscricoes/route.ts').GET(request)
    assert.equal(list.status, 200)
    assert.equal((await list.json()).data[0].certificacao.liberado, true)
    const detail = await env.load('app/api/inscricoes/[inscricaoId]/route.ts').GET(request, { params: Promise.resolve({ inscricaoId: 'inscricao-1' }) })
    assert.equal(detail.status, 200)
    assert.equal((await detail.json()).data.certificacao.liberado, true)
})
