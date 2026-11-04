const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const { resumirFinanceiro } = require('../src/lib/relatorio-financeiro.ts')

function carregarRota() {
    const inscricoes = [
        { id: 'pago', alunoId: 'ausente', status: 'CONFIRMADA', situacaoFinanceira: 'PAGO', valorPago: '30.00', aprovadoPor: 'admin' },
        { id: 'pendente', alunoId: 'existente', status: 'PENDENTE', situacaoFinanceira: 'PENDENTE', valorPago: null },
    ]
    const vazio = { findMany: async () => [] }
    const db = {
        evento: {
            findMany: async () => [{ id: 'evento', nome: 'Evento' }],
            findUnique: async ({ select }) => {
                // Reproduz a falha do Prisma ao materializar uma relação obrigatória órfã.
                if (select.inscricoes.include?.aluno) throw new Error('Field aluno is required to return data, got null')
                return { id: 'evento', nome: 'Evento', preco: '50.00', inscricoes }
            },
        },
        aluno: { findMany: async () => [{ id: 'existente', nome: 'Aluno atual', email: 'aluno@example.com' }] },
        admin: { findMany: async () => [{ id: 'admin', nome: 'Financeiro' }] },
        reembolso: vazio, exclusaoInscricao: vazio, reservaPix: vazio, pagamentoCancelado: vazio,
    }
    const filename = path.resolve(__dirname, '../src/app/api/admin/financeiro/route.ts')
    const loaded = new Module(filename, module)
    loaded.filename = filename; loaded.paths = module.paths
    const originalRequire = loaded.require.bind(loaded)
    loaded.require = id => {
        if (id === '@/lib/db') return { __esModule: true, default: db }
        if (id === '@/lib/auth-admin') return { getAdminFromHeader: async () => ({ id: 'admin' }) }
        if (id === '@/lib/admin-permissions') return { adminEventWhere: () => ({}) }
        if (id === '@/lib/app-error') return require('../src/lib/app-error.ts')
        return originalRequire(id)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename)
    return loaded.exports.GET
}

test('relatório preserva pagamentos de inscrições sem aluno e mostra cadastros existentes', async () => {
    const GET = carregarRota()
    const response = await GET({ nextUrl: new URL('http://localhost/api/admin/financeiro?eventoId=evento') })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /no-store/)
    const { data: { evento } } = await response.json()
    assert.equal(evento.inscricoes.length, 2)
    assert.deepEqual(evento.inscricoes[0].aluno, { id: 'ausente', nome: 'Cadastro de aluno não encontrado', email: null })
    assert.equal(evento.inscricoes[0].responsavel, 'Financeiro')
    assert.equal(evento.inscricoes[1].aluno.nome, 'Aluno atual')
    const resumo = resumirFinanceiro(evento.inscricoes, Number(evento.preco))
    assert.equal(resumo.recebido, 30)
    assert.equal(resumo.pendentes, 1)
})

test('lista de eventos também impede armazenamento em cache', async () => {
    const response = await carregarRota()({ nextUrl: new URL('http://localhost/api/admin/financeiro') })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    assert.equal((await response.json()).data.evento, null)
})
