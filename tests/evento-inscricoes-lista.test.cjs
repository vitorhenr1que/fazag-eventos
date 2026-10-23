const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { target: 'ES2020', module: 'CommonJS', moduleResolution: 'Node' } })
const { hasAdminPermission } = require('../src/lib/admin-permissions.ts')
const { AppError } = require('../src/lib/app-error.ts')

function ambiente(inscricoes, subeventos = []) {
    const db = {
        inscricao: { findMany: async ({ include }) => {
            // Reproduz o erro do Prisma ao expandir uma relação obrigatória ausente.
            if (include.subeventosEscolhidos.include.subevento && inscricoes.some(i =>
                i.subeventosEscolhidos.some(se => !subeventos.some(s => s.id === se.subeventoId)))) {
                throw new Error('Inconsistent query result: Field subevento is required to return data, got null instead.')
            }
            return inscricoes
        } },
        subevento: { findMany: async ({ where }) => subeventos.filter(s => where.id.in.includes(s.id) && s.eventoId === where.eventoId) },
        exclusaoInscricao: { findMany: async () => [] },
    }
    const filename = path.resolve(__dirname, '../src/app/api/admin/eventos/[id]/inscricoes/route.ts')
    const loaded = new Module(filename, module)
    loaded.filename = filename; loaded.paths = module.paths
    const original = loaded.require.bind(loaded)
    loaded.require = id => {
        if (id === '@/lib/db') return { __esModule: true, default: db }
        if (id === '@/lib/app-error') return require('../src/lib/app-error.ts')
        if (id === '@/lib/admin-permissions') return { hasAdminPermission }
        if (id === '@/lib/auth-admin') return { getAdminFromHeader: async request => {
            const role = request.headers.get('authorization')
            if (!role) throw new AppError('Token não fornecido', 401)
            if (!hasAdminPermission(role, 'GESTAO')) throw new AppError('Acesso negado', 403)
            return { id: 'admin-teste', role }
        } }
        return original(id)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename)
    return (role = 'ADMIN') => loaded.exports.GET(new Request('http://localhost/api/admin/eventos/evento-1/inscricoes', {
        headers: role ? { authorization: role } : {},
    }), { params: Promise.resolve({ id: 'evento-1' }) })
}

const inscricao = () => ({
    id: 'insc-1', aluno: { id: 'aluno-1', nome: 'Aluno de teste' },
    valorPago: '20', valorReferencia: '30', valorDesconto: '10', situacaoFinanceira: 'DESCONTO',
    dataPagamento: '2026-10-01', dataTransferencia: '2026-10-01', reservaPixId: 'pix-1', aprovadoPor: 'admin-1', observacaoFinanceira: 'teste',
    checkIn: { id: 'presenca-1' }, certificado: { id: 'certificado-1' },
    subeventosEscolhidos: [
        { id: 'vinculo-1', subeventoId: 'valido', checkIn: { id: 'presenca-sub-1' } },
        { id: 'vinculo-2', subeventoId: 'removido', checkIn: null },
        { id: 'vinculo-3', subeventoId: 'outro-evento', checkIn: null },
    ],
})

test('lista alunos mesmo com vínculo órfão e preserva presenças, certificados e subeventos válidos', async () => {
    const dados = inscricao()
    const snapshot = structuredClone(dados)
    const sub = { id: 'valido', eventoId: 'evento-1', nome: 'Oficina', cargaHoraria: 2 }
    const get = ambiente([dados], [sub, { id: 'outro-evento', eventoId: 'evento-2' }])
    const res = await get()
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.count, 1)
    assert.deepEqual(json.data[0].aluno, dados.aluno)
    assert.deepEqual(json.data[0].checkIn, dados.checkIn)
    assert.deepEqual(json.data[0].certificado, dados.certificado)
    assert.deepEqual(json.data[0].subeventosEscolhidos, [{ ...dados.subeventosEscolhidos[0], subevento: sub }])
    assert.equal(json.data[0].valorPago, '20')
    assert.deepEqual(dados, snapshot, 'a consulta não altera os dados legados')
})

test('perfil NUPPEX recebe a lista sem os dados financeiros restritos', async () => {
    const res = await ambiente([inscricao()])('NUPPEX')
    assert.equal(res.status, 200)
    const { data } = await res.json()
    assert.equal(data[0].aluno.nome, 'Aluno de teste')
    for (const campo of ['valorPago', 'valorReferencia', 'valorDesconto', 'situacaoFinanceira', 'dataPagamento',
        'dataTransferencia', 'reservaPixId', 'aprovadoPor', 'observacaoFinanceira']) {
        assert.equal(campo in data[0], false)
    }
})

test('lista vazia retorna sucesso e a rota mantém a autorização', async () => {
    const get = ambiente([])
    const res = await get()
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).data, [])
    assert.equal((await get(null)).status, 401)
    assert.equal((await get('FINANCEIRO')).status, 403)
})
