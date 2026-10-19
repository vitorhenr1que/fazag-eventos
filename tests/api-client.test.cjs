const { test } = require('node:test')
const assert = require('node:assert/strict')

require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const { apiFetch } = require('../src/lib/api-client.ts')

test('login exibe o 401 sem recarregar a página; sessão expirada limpa o token e redireciona', async () => {
    const original = { fetch: global.fetch, window: global.window, localStorage: global.localStorage }
    const tokens = new Map([['admin-token', 'expired-token']])
    const calls = []
    let href = '/admin/login'
    let redirects = 0
    global.window = { location: {
        get href() { return href },
        set href(value) { href = value; redirects++ },
    } }
    global.localStorage = {
        getItem: key => tokens.get(key) ?? null,
        removeItem: key => tokens.delete(key),
    }
    global.fetch = async (url, options) => {
        calls.push({ url, options })
        return new Response(JSON.stringify({ error: { message: 'Credenciais inválidas' } }), { status: 401 })
    }

    try {
        const response = await apiFetch('/api/admin/auth/login', {
            method: 'POST', body: JSON.stringify({ email: 'teste@example.com', senha: 'errada' }),
            isAdmin: true, redirectOnUnauthorized: false,
        })
        assert.equal(response.status, 401)
        assert.equal((await response.json()).error.message, 'Credenciais inválidas')
        assert.equal(global.window.location.href, '/admin/login')
        assert.equal(redirects, 0)
        assert.equal(tokens.get('admin-token'), 'expired-token')
        assert.equal(calls[0].options.headers.get('Content-Type'), 'application/json')
        assert.equal('isAdmin' in calls[0].options, false)
        assert.equal('redirectOnUnauthorized' in calls[0].options, false)

        href = '/admin/eventos'
        await apiFetch('/api/admin/eventos', { isAdmin: true })
        assert.equal(calls[1].options.headers.get('Authorization'), 'Bearer expired-token')
        assert.equal(global.window.location.href, '/admin/login')
        assert.equal(redirects, 1)
        assert.equal(tokens.has('admin-token'), false)
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete global[key]
            else global[key] = value
        }
    }
})
