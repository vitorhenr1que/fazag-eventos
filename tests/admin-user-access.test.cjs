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
        $transaction: async callback => callback(db),
        $queryRaw: async () => [{ adquirido: 1 }],
        exclusaoEvento: { findUnique: async () => null },
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

test('excluir eventos é exclusivo de administradores, inclusive com todas as ações personalizadas', async () => {
    for (const values of [
        { role: 'NUPPEX', permissoes: null },
        { role: 'FINANCEIRO', permissoes: null },
        { role: 'NUPPEX', permissoes: { areas: ['eventos'], eventos: 'TODOS', eventoIds: [], acesso: 'EDITAR' } },
        { role: 'NUPPEX', permissoes: { areas: ['eventos'], eventos: 'TODOS', eventoIds: [], acesso: 'PERSONALIZAR', acoes: Object.keys(permissions.adminActions) } },
    ]) {
        const { call } = environment(values)
        await assert.rejects(call('/api/admin/eventos/event-1', 'DELETE', 'ADMINISTRADOR'), forbidden)
        await assert.rejects(call('/api/admin/eventos/event-1/exclusao', 'GET', 'ADMINISTRADOR'), forbidden)
    }
    for (const role of ['ADMIN', 'SUPER_ADMIN']) await environment({ role, permissoes: null }).call('/api/admin/eventos/event-1', 'DELETE', 'ADMINISTRADOR')
})

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

test('aprovação personalizada funciona sem edição geral e respeita área, escopo e revogação', async () => {
    for (const area of ['pendentes', 'financeiro']) {
        const { call, admin } = environment({ permissoes: customConfig(['APROVAR_INSCRICAO'], { areas: [area] }) })
        assert.equal(permissions.canEditAdmin(admin), false)
        assert.equal(permissions.canAdminAction(admin, 'APROVAR_INSCRICAO'), true)
        await call('/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO')
        await assert.rejects(call('/api/admin/inscricoes/reg-2/aprovar', 'POST', 'FINANCEIRO'), forbidden)
        await assert.rejects(call('/api/admin/inscricoes/reg-1/aprovar', 'DELETE', 'FINANCEIRO'), forbidden)
        await assert.rejects(call('/api/admin/inscricoes/reg-1/financeiro', 'POST', 'FINANCEIRO'), forbidden)
        admin.permissoes.acoes = []
        assert.equal(permissions.canAdminAction(admin, 'APROVAR_INSCRICAO'), false)
        await assert.rejects(call('/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO'), forbidden)
        admin.permissoes.acoes = ['APROVAR_INSCRICAO']
        admin.permissoes.acesso = 'VISUALIZAR'
        assert.equal(permissions.canAdminAction(admin, 'APROVAR_INSCRICAO'), false)
        await assert.rejects(call('/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO'), forbidden)
        admin.permissoes.acesso = 'PERSONALIZAR'
        admin.permissoes.areas = ['eventos']
        assert.equal(permissions.canAdminAction(admin, 'APROVAR_INSCRICAO'), false)
        await assert.rejects(call('/api/admin/inscricoes/reg-1/aprovar', 'POST', 'FINANCEIRO'), forbidden)
    }
})

const operations = [
    { action: 'REMOVER_INSCRICAO_SUBEVENTO', method: 'DELETE', path: '/api/admin/subeventos/sub-1/inscricoes', body: { inscricaoId: 'reg-1' } },
    { action: 'REMOVER_CHECKIN_SUBEVENTO', method: 'DELETE', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'SUBEVENTO', subeventoId: 'sub-1' } },
    { action: 'REMOVER_CHECKIN_GERAL', method: 'DELETE', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'EVENTO' } },
    { action: 'EXCLUIR_CERTIFICADO', method: 'DELETE', path: '/api/admin/inscricoes/reg-1/certificado' },
    { action: 'CHECKIN_SUBEVENTO', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'SUBEVENTO', subeventoId: 'sub-1' } },
    { action: 'LIBERAR_CERTIFICADO', path: '/api/admin/inscricoes/reg-1/certificado', body: { cargaHoraria: 4 } },
    { action: 'CHECKIN_GERAL', path: '/api/admin/inscricoes/reg-1/checkin', body: { tipo: 'EVENTO' } },
    { action: 'EXCLUIR_INSCRICAO', path: '/api/admin/inscricoes/reg-1/excluir', permission: 'EXCLUIR_INSCRICAO', body: { modalidade: 'EXCLUIR_TUDO' } },
]

test('remover inscrição de subevento não permite incluir alunos, excluir subeventos ou inscrições principais', async () => {
    const { call, admin } = environment({ permissoes: customConfig(['REMOVER_INSCRICAO_SUBEVENTO']) })
    const endpoint = '/api/admin/subeventos/sub-1/inscricoes'
    await call(endpoint, 'GET')
    await call(endpoint, 'DELETE', undefined, { inscricaoId: 'reg-1' })
    await assert.rejects(call(endpoint, 'POST', undefined, { inscricaoId: 'reg-1' }), forbidden)
    await assert.rejects(call('/api/admin/subeventos/sub-1', 'DELETE'), forbidden)
    await assert.rejects(call('/api/admin/inscricoes/reg-1/excluir', 'POST', 'EXCLUIR_INSCRICAO', { modalidade: 'EXCLUIR_TUDO' }), forbidden)
    admin.permissoes.acoes = ['REMOVER_CHECKIN_SUBEVENTO']
    assert.equal(permissions.canAdminAction(admin, 'REMOVER_INSCRICAO_SUBEVENTO'), false)
    await assert.rejects(call(endpoint, 'DELETE', undefined, { inscricaoId: 'reg-1' }), forbidden)
    const { userPermissionsSchema } = require('../src/lib/admin-user-schema.ts')
    assert.equal(userPermissionsSchema.safeParse(customConfig(Object.keys(permissions.adminActions))).success, true)
})

test('modo Personalizar concede cada ação de forma independente, na interface e no servidor', async () => {
    for (const selected of operations) {
        const { call, admin } = environment({ permissoes: customConfig([selected.action]) })
        assert.equal(permissions.canEditAdmin(admin), false)
        for (const operation of operations) {
            assert.equal(permissions.canAdminAction(admin, operation.action), operation.action === selected.action)
            const request = call(operation.path, operation.method || 'POST', operation.permission, operation.body)
            if (operation.action === selected.action) await request
            else await assert.rejects(request, forbidden)
        }
    }
})

test('ações personalizadas respeitam área, evento e revogação em sessão aberta', async () => {
    const { call, admin } = environment({ permissoes: customConfig(Object.keys(permissions.adminActions)) })
    for (const operation of operations) {
        await assert.rejects(call(operation.path.replace('reg-1', 'reg-2').replace('sub-1', 'sub-2'), operation.method || 'POST', operation.permission, operation.body), forbidden)
    }
    admin.permissoes.areas = []
    for (const operation of operations) {
        assert.equal(permissions.canAdminAction(admin, operation.action), false)
        await assert.rejects(call(operation.path, operation.method || 'POST', operation.permission, operation.body), forbidden)
    }
    admin.permissoes.areas = ['eventos']
    admin.permissoes.acoes = []
    for (const operation of operations) await assert.rejects(call(operation.path, operation.method || 'POST', operation.permission, operation.body), forbidden)
})

test('Personalizar não concede edição geral, exclusão de certificado, financeiro ou gestão de usuários', async () => {
    const { call, admin } = environment({ permissoes: customConfig(['CHECKIN_SUBEVENTO', 'CHECKIN_GERAL', 'LIBERAR_CERTIFICADO', 'EXCLUIR_INSCRICAO'], { areas: ['eventos', 'financeiro', 'pendentes', 'tiposAtividade'] }) })
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
        await assert.rejects(read.call(operation.path, operation.method || 'POST', operation.permission, operation.body), forbidden)
    }
    const edit = environment({ permissoes: customConfig([], { acesso: 'EDITAR' }) })
    for (const operation of operations.filter(operation => operation.action !== 'EXCLUIR_INSCRICAO')) {
        assert.equal(permissions.canAdminAction(edit.admin, operation.action), true)
        await edit.call(operation.path, operation.method || 'POST', operation.permission, operation.body)
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
    const render = (presente = false) => renderToStaticMarkup(React.createElement(SubeventoCheckin, { session: env.admin, presente, onCheckin: () => {}, onRemove: () => {} }))
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

test('remover check-in geral ou de subevento apaga apenas a presença selecionada e é repetível', async () => {
    const env = environment({ permissoes: customConfig(['REMOVER_CHECKIN_GERAL', 'REMOVER_CHECKIN_SUBEVENTO']) })
    let records = [
        { id: 'geral', inscricaoId: 'reg-1' },
        { id: 'grade', inscricaoSubeventoId: 'link-1' },
        { id: 'outra-grade', inscricaoSubeventoId: 'link-2' },
        { id: 'outro-aluno', inscricaoId: 'reg-2' },
    ]
    env.db.$transaction = async callback => callback({ $queryRaw: async () => [{ adquirido: 1 }] })
    env.db.inscricaoSubevento = { findUnique: async ({ where }) => where.inscricaoId_subeventoId.subeventoId === 'sub-1' ? { id: 'link-1' } : null }
    env.db.checkIn = { deleteMany: async ({ where }) => {
        const original = records.length
        records = records.filter(record => !Object.entries(where).every(([key, value]) => record[key] === value))
        return { count: original - records.length }
    } }
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: env.admin.role })
    const route = env.load('app/api/admin/inscricoes/[inscricaoId]/checkin/route.ts')
    const request = body => new Request('http://localhost/api/admin/inscricoes/reg-1/checkin', { method: 'DELETE', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const params = { params: Promise.resolve({ inscricaoId: 'reg-1' }) }
    assert.equal((await route.DELETE(request({ tipo: 'EVENTO' }), params)).status, 200)
    assert.deepEqual(records.map(record => record.id), ['grade', 'outra-grade', 'outro-aluno'])
    assert.equal((await route.DELETE(request({ tipo: 'EVENTO' }), params)).status, 200)
    assert.equal((await route.DELETE(request({ tipo: 'SUBEVENTO', subeventoId: 'sub-1' }), params)).status, 200)
    assert.deepEqual(records.map(record => record.id), ['outra-grade', 'outro-aluno'])
    assert.equal((await route.DELETE(request({ tipo: 'SUBEVENTO', subeventoId: 'sub-2' }), params)).status, 403)
    assert.deepEqual(records.map(record => record.id), ['outra-grade', 'outro-aluno'])
})

test('botão de remover check-in em subeventos exige permissão própria e presença existente', () => {
    const React = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const env = environment({ permissoes: customConfig(['CHECKIN_SUBEVENTO']) })
    const { SubeventoCheckin } = env.load('components/admin/SubeventoCheckin.tsx')
    const render = presente => renderToStaticMarkup(React.createElement(SubeventoCheckin, { session: env.admin, presente, onCheckin: () => {}, onRemove: () => {} }))
    assert.doesNotMatch(render(true), /<button/)
    env.admin.permissoes.acoes = ['REMOVER_CHECKIN_SUBEVENTO']
    assert.match(render(true), /Remover check-in/)
    assert.doesNotMatch(render(false), /<button/)
    env.admin.permissoes.acoes = []
    assert.doesNotMatch(render(true), /<button/)
})

test('liberar certificado não permite excluir; exclusão autorizada remove somente o certificado da inscrição', async () => {
    const env = environment({ permissoes: customConfig(['LIBERAR_CERTIFICADO']) })
    const deleted = []
    env.db.certificado = { deleteMany: async ({ where }) => { deleted.push(where); return { count: 1 } } }
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: env.admin.role })
    const route = env.load('app/api/admin/inscricoes/[inscricaoId]/certificado/route.ts')
    const request = () => new Request('http://localhost/api/admin/inscricoes/reg-1/certificado', { method: 'DELETE', headers: { authorization: 'Bearer ' + token } })
    const params = { params: Promise.resolve({ inscricaoId: 'reg-1' }) }
    assert.equal((await route.DELETE(request(), params)).status, 403)
    assert.deepEqual(deleted, [])
    env.admin.permissoes.acoes = ['EXCLUIR_CERTIFICADO']
    assert.equal((await route.DELETE(request(), params)).status, 200)
    assert.deepEqual(deleted, [{ inscricaoId: 'reg-1' }])
})

test('Pendentes exige selecionar evento, filtra a consulta e bloqueia evento não autorizado', async () => {
    const { NextRequest } = require('next/server')
    const env = environment({ permissoes: customConfig([], { areas: ['pendentes'], acesso: 'EDITAR' }) })
    const queries = []
    env.db.evento.findMany = async ({ where }) => {
        assert.deepEqual(where, { id: { in: ['event-1'] } })
        return [{ id: 'event-1', nome: 'Evento permitido' }]
    }
    env.db.inscricao.findMany = async ({ where }) => { queries.push(where); return [{ id: 'reg-1', eventoId: where.eventoId, aluno: { nome: 'Aluno' } }] }
    env.db.reservaPix = { findMany: async () => [] }
    const auth = env.load('lib/auth-admin.ts')
    const token = auth.adminAuth.signToken({ id: env.admin.id, role: env.admin.role })
    const route = env.load('app/api/admin/inscricoes/pendentes/route.ts')
    const request = (query = '') => new NextRequest('http://localhost/api/admin/inscricoes/pendentes' + query, { headers: { authorization: 'Bearer ' + token } })
    const initial = await route.GET(request())
    assert.equal(initial.status, 200)
    const json = await initial.json()
    assert.deepEqual(json.data, [])
    assert.deepEqual(json.eventos, [{ id: 'event-1', nome: 'Evento permitido' }])
    assert.equal(queries.length, 0)
    const selected = await route.GET(request('?eventoId=event-1'))
    assert.equal(selected.status, 200)
    assert.equal((await selected.json()).data[0].eventoId, 'event-1')
    assert.deepEqual(queries, [{ status: 'PENDENTE', eventoId: 'event-1', evento: { id: { in: ['event-1'] } } }])
    const denied = await route.GET(request('?eventoId=event-2'))
    assert.equal(denied.status, 403)
    assert.equal(queries.length, 1)
})
