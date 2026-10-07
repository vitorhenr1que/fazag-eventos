const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } })
const { hasAdminPermission, canAccessAdminPage, adminHome } = require('../src/lib/admin-permissions.ts')

test('FINANCEIRO só acessa Pendentes e Financeiro', () => {
    assert.equal(hasAdminPermission('FINANCEIRO', 'FINANCEIRO'), true)
    assert.equal(hasAdminPermission('FINANCEIRO', 'GESTAO'), false)
    assert.equal(canAccessAdminPage('FINANCEIRO', '/admin/financeiro'), true)
    assert.equal(canAccessAdminPage('FINANCEIRO', '/admin/inscricoes/pendentes'), true)
    for (const page of ['/admin/dashboard', '/admin/eventos', '/admin/eventos/123/editar', '/admin/tipos-atividade']) {
        assert.equal(canAccessAdminPage('FINANCEIRO', page), false)
    }
    assert.equal(adminHome('FINANCEIRO'), '/admin/inscricoes/pendentes')
})

test('NUPPEX mantém gestão e não acessa funcionalidades financeiras', () => {
    assert.equal(hasAdminPermission('NUPPEX', 'FINANCEIRO'), false)
    assert.equal(hasAdminPermission('NUPPEX', 'GESTAO'), true)
    assert.equal(canAccessAdminPage('NUPPEX', '/admin/eventos'), true)
    assert.equal(canAccessAdminPage('NUPPEX', '/admin/financeiro'), false)
    assert.equal(canAccessAdminPage('NUPPEX', '/admin/inscricoes/pendentes'), false)
})

test('administradores têm acesso a todas as áreas; perfis desconhecidos não têm acesso', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN']) {
        for (const permission of ['GESTAO', 'FINANCEIRO', 'SESSAO']) assert.equal(hasAdminPermission(role, permission), true)
    }
    for (const permission of ['GESTAO', 'FINANCEIRO', 'SESSAO']) assert.equal(hasAdminPermission('ALUNO', permission), false)
})

test('todas as rotas administrativas protegidas validam o perfil no servidor', () => {
    const root = path.resolve(__dirname, '../src/app/api/admin')
    function verificar(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const target = path.join(dir, entry.name)
            if (entry.isDirectory()) verificar(target)
            else if (entry.name === 'route.ts' && !target.endsWith(path.join('auth', 'login', 'route.ts'))) {
                const source = fs.readFileSync(target, 'utf8')
                const handlers = (source.match(/export async function (GET|POST|PUT|DELETE|PATCH)/g) || []).length
                const guards = (source.match(/await getAdminFromHeader\(request/g) || []).length
                assert.equal(guards, handlers, `Proteção ausente em ${path.relative(root, target)}`)
            }
        }
    }
    verificar(root)
})
