const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const permissions = require('../src/lib/admin-permissions.ts')
process.env.ADMIN_JWT_SECRET = 'test-only-admin-access-secret'

function environment(overrides = {}) {
    let admin = { id: 'user-1', nome: 'Operador', email: 'operador@example.com', role: 'NUPPEX', ativo: true,
        permissoes: { areas: ['eventos'], eventos: 'ESPECIFICOS', eventoIds: ['event-1'], acesso: 'VISUALIZAR' }, ...overrides }
    const db = {
        admin: { findUnique: async () => admin },
        evento: { findFirst: async ({ where }) => {
            const [target, filter] = where.AND
            if (filter.id && !filter.id.in.includes(target.id)) return null
            if (filter.status && target.id === 'draft-event') return null
            return { id: target.id }
        } },
        subevento: { findUnique: async ({ where }) => ({ eventoId: where.id === 'sub-1' ? 'event-1' : 'event-2' }) },
        inscricao: { findUnique: async ({ where }) => ({ eventoId: where.id === 'reg-1' ? 'event-1' : 'event-2' }) },
    }
    const cache = new Map()
    function load(file) {
        const filename = path.resolve(__dirname, '../src', file)
        if (cache.has(filename)) return cache.get(filename).exports
        const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths; cache.set(filename, loaded)
        const original = loaded.require.bind(loaded)
        loaded.require = id => {
            if (id === './db' || id === '@/lib/db') return { __esModule: true, default: db }
            if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
            if (id.startsWith('./')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id + '.ts')))
            return original(id)
        }
        loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
        return loaded.exports
    }
    const auth = load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: admin.id, role: 'SUPER_ADMIN' })
    const call = (url, method = 'GET', permission, body) => auth.getAdminFromHeader(new Request('http://localhost' + url, {
        method, headers: { authorization: 'Bearer ' + token }, ...(body ? { body: JSON.stringify(body) } : {}),
    }), permission)
    return { call, admin, db, load }
}
const forbidden = error => error.statusCode === 403

test('configuração individual separa áreas e bloqueia a gestão de usuários', () => {
    const { admin } = environment()
    assert.equal(permissions.canAccessAdminPage(admin, '/admin/eventos'), true)
    for (const url of ['/admin/usuarios', '/admin/financeiro', '/admin/inscricoes/pendentes', '/admin/tipos-atividade', '/admin/eventos/event-2/inscricoes', '/admin/eventos/event-1/editar']) assert.equal(permissions.canAccessAdminPage(admin, url), false, url)
    assert.equal(permissions.adminHome(admin), '/admin/eventos')
    assert.deepEqual(permissions.adminEventWhere(admin), { id: { in: ['event-1'] } })
})

test('servidor aceita consulta autorizada e bloqueia outro evento e alterações diretas', async () => {
    const { call } = environment()
    await call('/api/admin/eventos/event-1')
    await call('/api/admin/eventos/event-1/inscricoes')
    await assert.rejects(call('/api/admin/eventos/event-2'), forbidden)
    await assert.rejects(call('/api/admin/eventos/event-1', 'PUT'), forbidden)
    await assert.rejects(call('/api/admin/eventos', 'POST'), forbidden)
    await assert.rejects(call('/api/r2/presign', 'POST', undefined, { eventoId: 'event-1' }), forbidden)
})

test('escopo também protege subeventos, inscrições e uploads', async () => {
    const { call } = environment({ permissoes: { areas: ['eventos', 'financeiro'], eventos: 'ESPECIFICOS', eventoIds: ['event-1'], acesso: 'EDITAR' } })
    await call('/api/admin/subeventos/sub-1', 'PUT')
    await call('/api/admin/inscricoes/reg-1/checkin', 'POST')
    await assert.rejects(call('/api/admin/subeventos/sub-2', 'PUT'), forbidden)
    await assert.rejects(call('/api/admin/inscricoes/reg-2/checkin', 'POST'), forbidden)
    await assert.rejects(call('/api/admin/inscricoes/reg-2/financeiro', 'POST', 'FINANCEIRO'), forbidden)
    await assert.rejects(call('/api/r2/presign', 'POST', undefined, { eventoId: 'event-2' }), forbidden)
    await assert.rejects(call('/api/r2/presign', 'POST', undefined, {}), forbidden)
})

test('somente publicados é validado no servidor e impede criar eventos', async () => {
    const { call, admin } = environment({ permissoes: { areas: ['eventos'], eventos: 'PUBLICADOS', eventoIds: [], acesso: 'EDITAR' } })
    assert.deepEqual(permissions.adminEventWhere(admin), { status: 'PUBLISHED' })
    await call('/api/admin/eventos/event-1')
    await assert.rejects(call('/api/admin/eventos/draft-event'), forbidden)
    await assert.rejects(call('/api/admin/eventos', 'POST'), forbidden)
})

test('áreas financeiras são independentes e o perfil do token não concede privilégios', async () => {
    const { call } = environment({ permissoes: { areas: ['pendentes'], eventos: 'TODOS', eventoIds: [], acesso: 'EDITAR' } })
    await call('/api/admin/inscricoes/pendentes', 'GET', 'FINANCEIRO')
    await call('/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO')
    await assert.rejects(call('/api/admin/financeiro', 'GET', 'FINANCEIRO'), forbidden)
    await assert.rejects(call('/api/admin/inscricoes/reg-1/financeiro', 'POST', 'FINANCEIRO'), forbidden)
    await assert.rejects(call('/api/admin/usuarios', 'GET', 'ADMINISTRADOR'), forbidden)
})

test('desativação e remoção de privilégios valem em sessões já abertas', async () => {
    const { call, admin } = environment({ role: 'ADMIN', permissoes: null })
    await call('/api/admin/usuarios', 'GET', 'ADMINISTRADOR')
    admin.role = 'FINANCEIRO'
    await assert.rejects(call('/api/admin/usuarios', 'GET', 'ADMINISTRADOR'), forbidden)
    admin.ativo = false
    await assert.rejects(call('/api/admin/auth/me', 'GET', 'SESSAO'), error => error.statusCode === 401)
})

test('schema rejeita privilégios inválidos e evento específico sem seleção', () => {
    const { adminUserSchema } = require('../src/lib/admin-user-schema.ts')
    const data = { nome: 'Operador', email: ' OPERADOR@example.com ', role: 'NUPPEX', ativo: true, senha: 'senha-segura', permissoes: { areas: ['eventos'], eventos: 'TODOS', eventoIds: [], acesso: 'VISUALIZAR' } }
    assert.equal(adminUserSchema.parse(data).email, 'operador@example.com')
    assert.equal(adminUserSchema.safeParse({ ...data, role: 'ADMIN' }).success, false)
    assert.equal(adminUserSchema.safeParse({ ...data, permissoes: { ...data.permissoes, eventos: 'ESPECIFICOS' } }).success, false)
    assert.equal(adminUserSchema.safeParse({ ...data, senha: 'curta' }).success, false)
})

test('criação salva senha com hash e a resposta não revela a senha', async () => {
    const env = environment({ role: 'ADMIN', permissoes: null })
    let saved
    env.db.admin.create = async ({ data, select }) => {
        saved = { id: 'new-user', ...data }
        return Object.fromEntries(Object.keys(select).map(key => [key, saved[key]]))
    }
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: 'ADMIN' })
    const route = env.load('app/api/admin/usuarios/route.ts')
    const res = await route.POST(new Request('http://localhost/api/admin/usuarios', {
        method: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify({
            nome: 'Novo usuário', email: 'novo@example.com', senha: 'senha-teste-segura', role: 'NUPPEX', ativo: true,
            permissoes: { areas: ['eventos'], eventos: 'TODOS', eventoIds: [], acesso: 'PERSONALIZAR', acoes: ['CHECKIN_GERAL', 'LIBERAR_CERTIFICADO'] },
        }),
    }))
    assert.equal(res.status, 201)
    assert.equal(await auth.adminAuth.comparePassword('senha-teste-segura', saved.senha), true)
    assert.equal(saved.permissoes.acesso, 'PERSONALIZAR')
    assert.deepEqual(saved.permissoes.acoes, ['CHECKIN_GERAL', 'LIBERAR_CERTIFICADO'])
    assert.equal('senha' in (await res.json()).data, false)
})

test('edição preserva senha omitida e impede desativar ou rebaixar a própria conta', async () => {
    const env = environment({ role: 'ADMIN', permissoes: null })
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: 'ADMIN' })
    let update
    env.db.admin.update = async ({ data }) => { update = data; return { ...env.admin, ...data } }
    const route = env.load('app/api/admin/usuarios/[id]/route.ts')
    const data = { nome: 'Administrador', email: 'admin@example.com', role: 'ADMIN', ativo: true, permissoes: null }
    const request = body => new Request('http://localhost/api/admin/usuarios/user-1', { method: 'PUT', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const context = { params: Promise.resolve({ id: 'user-1' }) }
    assert.equal((await route.PUT(request(data), context)).status, 200)
    assert.equal('senha' in update, false)
    assert.equal((await route.PUT(request({ ...data, ativo: false }), context)).status, 400)
    assert.equal((await route.PUT(request({ ...data, role: 'FINANCEIRO' }), context)).status, 400)
})

const customConfig = (acoes, values = {}) => ({ areas: ['eventos'], eventos: 'ESPECIFICOS', eventoIds: ['event-1'], acesso: 'PERSONALIZAR', acoes, ...values })
const operations = [
    { action: 'CHECKIN_SUBEVENTO', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'SUBEVENTO', subeventoId: 'sub-1' } },
    { action: 'LIBERAR_CERTIFICADO', path: '/api/admin/inscricoes/reg-1/certificado', body: { cargaHoraria: 4 } },
    { action: 'CHECKIN_GERAL', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'EVENTO' } },
    { action: 'EXCLUIR_INSCRICAO', path: '/api/admin/inscricoes/reg-1/excluir', permission: 'EXCLUIR_INSCRICAO', body: { modalidade: 'EXCLUIR_TUDO' } },
]

test('modo Personalizar concede cada ação de forma independente, na interface e no servidor', async () => {
    for (const selected of operations) {
        const { call, admin } = environment({ permissoes: customConfig([selected.action]) })
        assert.equal(permissions.canEditAdmin(admin), false)
        for (const operation of operations) {
            assert.equal(permissions.canAdminAction(admin, operation.action), operation.action === selected.action)
            const request = call(operation.path, 'POST', operation.permission, operation.body)
            if (operation.action === selected.action) await request
            else await assert.rejects(request, forbidden)
        }
    }
})

test('ações personalizadas respeitam área, evento e revogação em sessão aberta', async () => {
    const { call, admin } = environment({ permissoes: customConfig(Object.keys(permissions.adminActions)) })
    for (const operation of operations) {
        await assert.rejects(call(operation.path.replace('reg-1', 'reg-2'), 'POST', operation.permission, operation.body), forbidden)
    }
    admin.permissoes.areas = []
    for (const operation of operations) {
        assert.equal(permissions.canAdminAction(admin, operation.action), false)
        await assert.rejects(call(operation.path, 'POST', operation.permission, operation.body), forbidden)
    }
    admin.permissoes.areas = ['eventos']
    admin.permissoes.acoes = []
    for (const operation of operations) await assert.rejects(call(operation.path, 'POST', operation.permission, operation.body), forbidden)
})

test('Personalizar não concede edição geral, exclusão de certificado, financeiro ou gestão de usuários', async () => {
    const { call, admin } = environment({ permissoes: customConfig(Object.keys(permissions.adminActions), { areas: ['eventos', 'financeiro', 'pendentes', 'tiposAtividade'] }) })
    assert.equal(permissions.canAccessAdminPage(admin, '/admin/eventos/event-1/editar'), false)
    assert.equal(permissions.canCreateEvento(admin), false)
    for (const [path, method, permission, body] of [
        ['/api/admin/eventos/event-1', 'PUT', undefined, { nome: 'Alterado' }],
        ['/api/admin/subeventos/sub-1', 'PUT', undefined, { nome: 'Alterado' }],
        ['/api/admin/inscricoes/reg-1/certificado', 'DELETE'],
        ['/api/admin/inscricoes/reg-1/financeiro', 'POST', 'FINANCEIRO', { acao: 'REEMBOLSO' }],
        ['/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO', {}],
        ['/api/admin/usuarios', 'POST', 'ADMINISTRADOR', {}],
        ['/api/admin/tipos-atividade', 'POST', undefined, {}],
        ['/api/r2/presign', 'POST', undefined, { eventoId: 'event-1' }],
    ]) await assert.rejects(call(path, method, permission, body), forbidden)
})

test('Somente visualizar ignora ações armazenadas e Visualizar e editar mantém as permissões anteriores', async () => {
    const read = environment({ permissoes: customConfig(Object.keys(permissions.adminActions), { acesso: 'VISUALIZAR' }) })
    for (const operation of operations) {
        assert.equal(permissions.canAdminAction(read.admin, operation.action), false)
        await assert.rejects(read.call(operation.path, 'POST', operation.permission, operation.body), forbidden)
    }
    const edit = environment({ permissoes: customConfig([], { acesso: 'EDITAR' }) })
    for (const operation of operations.filter(operation => operation.action !== 'EXCLUIR_INSCRICAO')) {
        assert.equal(permissions.canAdminAction(edit.admin, operation.action), true)
        await edit.call(operation.path, 'POST', operation.permission, operation.body)
    }
    assert.equal(permissions.canAdminAction(edit.admin, 'EXCLUIR_INSCRICAO'), false)
    await assert.rejects(edit.call('/api/admin/inscricoes/reg-1/excluir', 'POST', 'EXCLUIR_INSCRICAO', { modalidade: 'EXCLUIR_TUDO' }), forbidden)
})

test('permissões antigas continuam válidas e ações desconhecidas são recusadas', () => {
    const { userPermissionsSchema } = require('../src/lib/admin-user-schema.ts')
    const old = { areas: ['eventos'], eventos: 'TODOS', eventoIds: [], acesso: 'VISUALIZAR' }
    assert.equal(userPermissionsSchema.safeParse(old).success, true)
    assert.equal(userPermissionsSchema.safeParse(customConfig([])).success, true)
    assert.equal(userPermissionsSchema.safeParse(customConfig(['LIBERAR_CERTIFICADO'])).success, true)
    assert.equal(userPermissionsSchema.safeParse(customConfig(['ADMINISTRADOR'])).success, false)
    const admin = { role: 'NUPPEX', permissoes: { ...old, acesso: 'PERSONALIZAR' } }
    for (const action of Object.keys(permissions.adminActions)) assert.equal(permissions.canAdminAction(admin, action), false)
})

test('check-in geral não pode ser executado com a permissão de subevento', async () => {
    const { call } = environment({ permissoes: customConfig(['CHECKIN_SUBEVENTO']) })
    await assert.rejects(call('/api/admin/inscricoes/reg-1/checkin', 'POST', undefined, {}), forbidden)
    await assert.rejects(call('/api/admin/inscricoes/reg-1/checkin', 'POST', undefined, { tipo: 'SUBEVENTO', subeventoId: 'sub-2' }), forbidden)
    for (const body of [{ tipo: 'OUTRO', subeventoId: 'sub-1' }, { tipo: 'SUBEVENTO' }, { tipo: null }]) {
        await assert.rejects(call('/api/admin/inscricoes/reg-1/checkin', 'POST', undefined, body))
    }
})

test('coluna Subeventos (Grade) não mostra ação de check-in quando só o geral está liberado', () => {
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const env = environment({ permissoes: customConfig(['CHECKIN_GERAL']) })
    const { SubeventoCheckin } = env.load('components/admin/SubeventoCheckin.tsx')
    const render = (presente = false) => renderToStaticMarkup(React.createElement(SubeventoCheckin, { session: env.admin, presente, onCheckin: () => {} }))
    assert.match(render(), /Ausente/)
    assert.doesNotMatch(render(), /<button|Check-in/)
    env.admin.permissoes.acoes = ['CHECKIN_SUBEVENTO']
    assert.match(render(), /<button[^>]*>Check-in<\/button>/)
    assert.doesNotMatch(render(true), /<button/)
    env.admin.permissoes.acoes = ['CHECKIN_GERAL']
    assert.doesNotMatch(render(), /<button/)
})

test('rota real bloqueia check-in na grade sem gravar e permite somente presença geral', async () => {
    const env = environment({ permissoes: customConfig(['CHECKIN_GERAL']) })
    const writes = []
    env.db.inscricao.findUnique = async () => ({ eventoId: 'event-1', status: 'CONFIRMADA' })
    env.db.checkIn = { create: async ({ data }) => { writes.push(data); return { id: 'check-1', ...data } } }
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: env.admin.role })
    const route = env.load('app/api/admin/inscricoes/[inscricaoId]/checkin/route.ts')
    const request = body => new Request('http://localhost/api/admin/inscricoes/reg-1/checkin', {
        method: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(body),
    })
    const params = { params: Promise.resolve({ inscricaoId: 'reg-1' }) }
    const denied = await route.POST(request({ tipo: 'SUBEVENTO', subeventoId: 'sub-1' }), params)
    assert.equal(denied.status, 403)
    assert.deepEqual(writes, [])
    const allowed = await route.POST(request({ tipo: 'EVENTO' }), params)
    assert.equal(allowed.status, 200)
    assert.deepEqual(writes, [{ inscricaoId: 'reg-1' }])
})
