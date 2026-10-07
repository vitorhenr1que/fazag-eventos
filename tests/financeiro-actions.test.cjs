const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })

function ambiente(overrides = {}, falharUmaVez = false) {
    const state = {
        inscricao: { id: 'inscricao-1', eventoId: 'evento-1', alunoId: 'aluno-1', status: 'CONFIRMADA',
            situacaoFinanceira: 'DESCONTO', valorReferencia: 30, valorPago: 20, valorDesconto: 10,
            dataInscricao: new Date('2026-10-01'), dataPagamento: new Date('2026-10-02'), aprovadoPor: 'admin-original',
            observacaoFinanceira: 'desconto autorizado', aluno: { nome: 'Aluno de teste', email: 'teste@example.com' },
            evento: { tipo: 'PAGO' }, ...overrides },
        reembolso: null, subeventos: [{ id: 'sub-1' }], checkins: ['check-1'], certificados: ['cert-1'],
    }
    const db = {
        exclusaoInscricao: { findUnique: async () => null },
        inscricao: {
            findUnique: async () => state.inscricao,
            update: async ({ data }) => (state.inscricao = { ...state.inscricao, ...data }),
            deleteMany: async () => { state.inscricao = null; return { count: 1 } },
        },
        reembolso: {
            findUnique: async () => state.reembolso,
            create: async ({ data }) => {
                assert.equal(state.reembolso, null, 'não deve duplicar o histórico')
                return (state.reembolso = { id: 'reembolso-1', estado: 'PROCESSANDO', ...data })
            },
            update: async ({ data }) => (state.reembolso = { ...state.reembolso, ...data }),
        },
        inscricaoSubevento: {
            findMany: async () => state.subeventos,
            deleteMany: async () => { state.subeventos = []; return { count: 1 } },
        },
        checkIn: { deleteMany: async () => { state.checkins = []; return { count: 1 } } },
        certificado: { deleteMany: async () => {
            if (falharUmaVez) { falharUmaVez = false; throw new Error('falha simulada na exclusão') }
            state.certificados = []; return { count: 1 }
        } },
        $queryRaw: async () => [{ adquirido: 1 }],
        $transaction: async callback => callback(db), // simula MyISAM sem rollback
    }
    const filename = path.resolve(__dirname, '../src/services/financeiro.service.ts')
    const loaded = new Module(filename, module)
    loaded.filename = filename; loaded.paths = module.paths
    const originalRequire = loaded.require.bind(loaded)
    loaded.require = id => {
        if (id === '@/lib/db') return { __esModule: true, default: db }
        if (id === '@/lib/app-error') return require('../src/lib/app-error.ts')
        if (id === '@/lib/financeiro') return require('../src/lib/financeiro.ts')
        return originalRequire(id)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename)
    return { state, db, service: new loaded.exports.FinanceiroService() }
}

test('reembolso arquiva o valor pago com desconto, exclui vínculos e inscrição e aceita repetição sem duplicar', async () => {
    const { state, service } = ambiente()
    await service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO', valorHistorico: 999, motivo: 'desistência' }, 'admin-reembolso')
    assert.equal(state.inscricao, null)
    assert.deepEqual(state.checkins, [])
    assert.deepEqual(state.certificados, [])
    assert.deepEqual(state.subeventos, [])
    assert.equal(state.reembolso.estado, 'CONCLUIDO')
    assert.equal(state.reembolso.valorPago, 20)
    assert.equal(state.reembolso.valorReferencia, 30)
    assert.equal(state.reembolso.aprovadoPor, 'admin-original')
    assert.equal(state.reembolso.reembolsadoPor, 'admin-reembolso')
    await service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'outro-admin')
    assert.equal(state.reembolso.reembolsadoPor, 'admin-reembolso')
})

test('cancelamento limpa aprovação e pagamento, mantém inscrição e referência sem criar reembolso', async () => {
    const { state, service } = ambiente()
    await service.realizarAcao('inscricao-1', { acao: 'CANCELAMENTO' }, 'admin-1')
    assert.equal(state.inscricao.status, 'PENDENTE')
    assert.equal(state.inscricao.situacaoFinanceira, 'PENDENTE')
    assert.equal(state.inscricao.valorReferencia, 30)
    for (const field of ['valorPago', 'valorDesconto', 'dataPagamento', 'aprovadoPor', 'observacaoFinanceira']) assert.equal(state.inscricao[field], null)
    assert.equal(state.reembolso, null)
    assert.equal(state.subeventos.length, 1)
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'CANCELAMENTO' }, 'admin-1'))
})

test('falha após arquivar histórico pode ser retomada sem perder ou duplicar reembolso no MyISAM', async () => {
    const { state, service } = ambiente({}, true)
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'admin-1'), /falha simulada/)
    assert.equal(state.reembolso.estado, 'PROCESSANDO')
    assert.notEqual(state.inscricao, null)
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'CANCELAMENTO' }, 'admin-1'))
    await service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'admin-2')
    assert.equal(state.reembolso.estado, 'CONCLUIDO')
    assert.equal(state.reembolso.reembolsadoPor, 'admin-1')
    assert.equal(state.inscricao, null)
})

test('valor histórico é obrigatório em reembolso antigo e não altera dados quando ausente', async () => {
    const { state, service } = ambiente({ valorPago: null, situacaoFinanceira: null, valorReferencia: null })
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'admin-1'))
    assert.notEqual(state.inscricao, null)
    assert.equal(state.reembolso, null)
    await service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO', valorHistorico: 25 }, 'admin-1')
    assert.equal(state.reembolso.valorPago, 25)
})

test('retoma reembolso mesmo quando a inscrição já foi excluída antes de uma falha na conclusão', async () => {
    const { state, db, service } = ambiente()
    const update = db.reembolso.update
    db.reembolso.update = async () => { throw new Error('falha na conclusão') }
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'admin-1'), /falha na conclusão/)
    assert.equal(state.inscricao, null)
    assert.equal(state.reembolso.estado, 'PROCESSANDO')
    db.reembolso.update = update
    await service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO' }, 'admin-2')
    assert.equal(state.reembolso.estado, 'CONCLUIDO')
    assert.equal(state.reembolso.reembolsadoPor, 'admin-1')
})

test('não reembolsa pendentes ou isentos e não cancela gratuitos', async () => {
    for (const overrides of [{ status: 'PENDENTE' }, { valorPago: 0, situacaoFinanceira: 'ISENTO' }]) {
        const { state, service } = ambiente(overrides)
        await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'REEMBOLSO', valorHistorico: 30 }, 'admin-1'))
        assert.equal(state.reembolso, null)
        assert.notEqual(state.inscricao, null)
    }
    const { service } = ambiente({ situacaoFinanceira: 'GRATUITO', valorPago: 0 })
    await assert.rejects(service.realizarAcao('inscricao-1', { acao: 'CANCELAMENTO' }, 'admin-1'))
})
