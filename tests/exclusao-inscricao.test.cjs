const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const { exclusaoInscricaoSchema } = require('../src/lib/exclusao-inscricao.ts')

function ambiente(overrides = {}) {
    const state = { inscricao: { id: 'i1', eventoId: 'e1', alunoId: 'a1', status: 'CONFIRMADA',
        valorReferencia: 30, valorPago: 20, valorDesconto: 10, situacaoFinanceira: 'DESCONTO',
        dataInscricao: new Date(), dataPagamento: new Date(), aprovadoPor: 'original', observacaoFinanceira: 'desconto',
        aluno: { nome: 'Teste', email: 'teste@example.com' }, evento: { tipo: 'PAGO' }, ...overrides },
        exclusao: null, reembolso: null, checkins: [1], certificados: [1], subeventos: [{ id: 's1' }], refundCalls: [] }
    const db = {
        inscricao: { findUnique: async () => state.inscricao, deleteMany: async () => { state.inscricao = null } },
        reembolso: { findUnique: async () => state.reembolso },
        exclusaoInscricao: { findUnique: async () => state.exclusao,
            create: async ({ data }) => { assert.equal(state.exclusao, null); return state.exclusao = { id: 'x1', estado: 'PROCESSANDO', ...data } },
            update: async ({ data }) => state.exclusao = { ...state.exclusao, ...data } },
        inscricaoSubevento: { findMany: async () => state.subeventos, deleteMany: async () => { state.subeventos = [] } },
        checkIn: { deleteMany: async () => { state.checkins = [] } },
        certificado: { deleteMany: async () => { state.certificados = [] } },
        $queryRaw: async () => [{ adquirido: 1 }], $transaction: async callback => callback(db),
    }
    const filename = path.resolve(__dirname, '../src/services/exclusao-inscricao.service.ts')
    const loaded = new Module(filename, module)
    loaded.filename = filename; loaded.paths = module.paths
    const original = loaded.require.bind(loaded)
    loaded.require = id => {
        if (id === '@/lib/db') return { __esModule: true, default: db }
        if (id === '@/lib/app-error') return require('../src/lib/app-error.ts')
        if (id === './financeiro.service') return { FinanceiroService: class { async realizarAcao(...args) { state.refundCalls.push(args); return { acao: 'REEMBOLSO' } } } }
        return original(id)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename)
    return { state, db, service: new loaded.exports.ExclusaoInscricaoService() }
}

test('manter pagamento arquiva valores originais e apaga inscrição e todos os vínculos', async () => {
    const { state, service } = ambiente()
    await service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO', motivo: 'desistência' }, 'admin1')
    assert.equal(state.inscricao, null)
    for (const key of ['checkins', 'certificados', 'subeventos']) assert.deepEqual(state[key], [])
    assert.equal(state.exclusao.estado, 'CONCLUIDO')
    assert.equal(state.exclusao.valorPago, 20)
    assert.equal(state.exclusao.valorReferencia, 30)
    assert.equal(state.exclusao.valorDesconto, 10)
    assert.equal(state.exclusao.aprovadoPor, 'original')
    assert.equal(state.exclusao.excluidoPor, 'admin1')
    assert.equal(state.reembolso, null)
    await service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO' }, 'admin2')
    assert.equal(state.exclusao.excluidoPor, 'admin1')
})

test('excluir tudo apaga pagamento sem criar reembolso, inclusive em evento gratuito', async () => {
    for (const overrides of [{}, { evento: { tipo: 'GRATUITO' }, situacaoFinanceira: 'GRATUITO' }]) {
        const { state, service } = ambiente(overrides)
        await service.excluir('i1', { modalidade: 'EXCLUIR_TUDO' }, 'admin1')
        assert.equal(state.inscricao, null)
        assert.equal(state.exclusao.valorPago, undefined)
        assert.equal(state.exclusao.valorReferencia, undefined)
        assert.equal(state.reembolso, null)
        assert.equal(state.exclusao.estado, 'CONCLUIDO')
    }
})

test('retoma exclusão interrompida após apagar inscrição e impede mudar opção ou responsável', async () => {
    const { state, db, service } = ambiente()
    const update = db.exclusaoInscricao.update
    db.exclusaoInscricao.update = async () => { throw new Error('falha na conclusão') }
    await assert.rejects(service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO' }, 'admin1'), /falha na conclusão/)
    assert.equal(state.inscricao, null)
    assert.equal(state.exclusao.estado, 'PROCESSANDO')
    await assert.rejects(service.excluir('i1', { modalidade: 'EXCLUIR_TUDO' }, 'admin2'), /outra opção/)
    db.exclusaoInscricao.update = update
    await service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO' }, 'admin2')
    assert.equal(state.exclusao.estado, 'CONCLUIDO')
    assert.equal(state.exclusao.valorPago, 20)
    assert.equal(state.exclusao.excluidoPor, 'admin1')
})

test('rejeita manter pagamento pendente ou gratuito e não inventa valor de aprovação antiga', async () => {
    for (const overrides of [{ status: 'PENDENTE' }, { situacaoFinanceira: 'GRATUITO' }]) {
        const { state, service } = ambiente(overrides)
        await assert.rejects(service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO' }, 'admin1'))
        assert.equal(state.exclusao, null)
        assert.notEqual(state.inscricao, null)
    }
    const { state, service } = ambiente({ valorPago: null, situacaoFinanceira: null })
    await service.excluir('i1', { modalidade: 'MANTER_PAGAMENTO' }, 'admin1')
    assert.equal(state.exclusao.valorPago, null)
})

test('exclusão com reembolso usa o fluxo financeiro existente e rejeita conflito de histórico', async () => {
    const { state, service } = ambiente()
    await service.excluir('i1', { modalidade: 'REEMBOLSO', motivo: 'teste', valorHistorico: 25 }, 'admin1')
    assert.deepEqual(state.refundCalls, [['i1', { acao: 'REEMBOLSO', motivo: 'teste', valorHistorico: 25 }, 'admin1']])
    assert.equal(state.exclusao, null)
    state.reembolso = { id: 'r1' }
    await assert.rejects(service.excluir('i1', { modalidade: 'EXCLUIR_TUDO' }, 'admin1'), /reembolso registrado/)
    assert.notEqual(state.inscricao, null)
})

test('schema exige escolha explícita e valida motivo e valores', () => {
    for (const value of [{}, { modalidade: 'OUTRO' }, { modalidade: 'REEMBOLSO', valorHistorico: 0 }, { modalidade: 'REEMBOLSO', valorHistorico: 1.234 }, { modalidade: 'EXCLUIR_TUDO', motivo: 'x'.repeat(501) }]) {
        assert.equal(exclusaoInscricaoSchema.safeParse(value).success, false)
    }
})
