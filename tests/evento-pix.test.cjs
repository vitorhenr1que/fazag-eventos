const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })

function ambiente() {
    let evento
    const db = {
        evento: {
            create: async ({ data }) => (evento = { id: 'evento-1', ...data }),
            update: async ({ data }) => (evento = { ...evento, ...data }),
            findUnique: async () => evento,
            findMany: async () => [evento],
        },
        $transaction: async callback => callback(db),
    }
    const cache = new Map()
    function load(relativePath) {
        const filename = path.resolve(__dirname, '../src', relativePath)
        if (cache.has(filename)) return cache.get(filename).exports
        const loaded = new Module(filename, module)
        loaded.filename = filename
        loaded.paths = module.paths
        cache.set(filename, loaded)
        const originalRequire = loaded.require.bind(loaded)
        loaded.require = id => {
            if (id === '@/lib/db') return { __esModule: true, default: db }
            if (id === '@/lib/auth-admin') return { getAdminFromHeader: async () => ({ id: 'admin-1' }) }
            if (id === '@/lib/auth-aluno') return { getAlunoFromHeader: async () => ({ id: 'aluno-1' }) }
            if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`)
            return originalRequire(id)
        }
        loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
        }).outputText, filename)
        return loaded.exports
    }
    return {
        create: load('app/api/admin/eventos/route.ts').POST,
        update: load('app/api/admin/eventos/[id]/route.ts').PUT,
        detail: load('app/api/eventos/[id]/route.ts').GET,
        list: load('app/api/eventos/route.ts').GET,
    }
}

const payload = {
    nome: 'Evento pago', slug: 'evento-pago', tipoAtividadeId: 'atividade-1', tipo: 'PAGO',
    dataInicio: '2026-11-01T10:00:00Z', dataFim: '2026-11-01T12:00:00Z',
    totalVagas: 50, preco: 30,
}
const request = body => new Request('http://localhost/api/admin/eventos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const params = { params: Promise.resolve({ id: 'evento-1' }) }

test('API salva chave Pix no cadastro e retorna em detalhes e listagem', async () => {
    const api = ambiente()
    const response = await api.create(request({ ...payload, chavePix: '  pagamentos@example.com  ' }))
    assert.equal(response.status, 201)
    assert.equal((await response.json()).data.chavePix, 'pagamentos@example.com')
    assert.equal((await (await api.detail(request({}), params)).json()).data.chavePix, 'pagamentos@example.com')
    assert.equal((await (await api.list(request({}))).json()).data[0].chavePix, 'pagamentos@example.com')
})

test('API permite editar, preservar em atualização parcial e remover a chave', async () => {
    const api = ambiente()
    await api.create(request({ ...payload, chavePix: 'chave-original' }))
    let response = await api.update(request({ chavePix: '  nova-chave  ' }), params)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).data.chavePix, 'nova-chave')
    response = await api.update(request({ nome: 'Novo nome' }), params)
    assert.equal((await response.json()).data.chavePix, 'nova-chave')
    response = await api.update(request({ chavePix: '   ' }), params)
    assert.equal((await response.json()).data.chavePix, null)
})

test('API aceita evento pago sem chave e limpa chave ao mudar para gratuito', async () => {
    const api = ambiente()
    assert.equal((await (await api.create(request(payload))).json()).data.chavePix, null)
    await api.update(request({ chavePix: 'chave-pix' }), params)
    const response = await api.update(request({ tipo: 'GRATUITO' }), params)
    assert.equal((await response.json()).data.chavePix, null)
    const gratuito = await api.create(request({ ...payload, tipo: 'GRATUITO', chavePix: 'chave-pix' }))
    assert.equal((await gratuito.json()).data.chavePix, null)
})

test('API rejeita chave com tipo inválido ou acima do limite no cadastro e edição', async () => {
    const api = ambiente()
    await api.create(request(payload))
    for (const chavePix of [123, {}, 'a'.repeat(256)]) {
        assert.equal((await api.create(request({ ...payload, chavePix }))).status, 400)
        assert.equal((await api.update(request({ chavePix }), params)).status, 400)
    }
})
