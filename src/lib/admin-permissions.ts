export type AdminRole = 'ADMIN' | 'SUPER_ADMIN' | 'NUPPEX' | 'FINANCEIRO'
export type AdminPermission = 'GESTAO' | 'FINANCEIRO' | 'SESSAO' | 'ADMINISTRADOR' | 'EXCLUIR_INSCRICAO'
export const adminActions = {
    APROVAR_INSCRICAO: 'Aprovar inscrições pendentes',
    CHECKIN_SUBEVENTO: 'Fazer check-in em subeventos',
    REMOVER_CHECKIN_SUBEVENTO: 'Remover check-in em subeventos',
    REMOVER_INSCRICAO_SUBEVENTO: 'Remover inscrições de subeventos',
    LIBERAR_CERTIFICADO: 'Liberar certificado',
    EXCLUIR_CERTIFICADO: 'Excluir certificado',
    CHECKIN_GERAL: 'Fazer check-in geral',
    REMOVER_CHECKIN_GERAL: 'Remover check-in geral',
    EXCLUIR_INSCRICAO: 'Excluir inscrição',
} as const
export type AdminAction = keyof typeof adminActions
export const adminAreas = {
    dashboard: 'Visão geral', eventos: 'Eventos', financeiro: 'Financeiro',
    pendentes: 'Inscrições pendentes', tiposAtividade: 'Tipos de atividade',
} as const
export type AdminArea = keyof typeof adminAreas
export interface UserPermissions {
    areas: AdminArea[]
    eventos: 'TODOS' | 'PUBLICADOS' | 'ESPECIFICOS'
    eventoIds: string[]
    acesso: 'VISUALIZAR' | 'EDITAR' | 'PERSONALIZAR'
    acoes?: AdminAction[]
}
export interface AdminSession { id: string; nome: string; email: string; role: AdminRole; permissoes?: UserPermissions | null }
type Subject = string | Pick<AdminSession, 'role' | 'permissoes'>
const roleOf = (subject: Subject) => typeof subject === 'string' ? subject : subject.role
export const permissionsOf = (subject: Subject) => typeof subject === 'string' ? null : subject.permissoes
export function canEditAdmin(subject: Subject) {
    return isAdminRole(roleOf(subject)) && (!permissionsOf(subject) || permissionsOf(subject)?.acesso === 'EDITAR')
}
export function canAdminAction(subject: Subject, action: AdminAction): boolean {
    if (!isAdminRole(roleOf(subject))) return false
    const areaAllowed = action === 'APROVAR_INSCRICAO'
        ? hasAdminPermission(subject, 'FINANCEIRO')
        : canAccessAdminPage(subject, '/admin/eventos')
    if (!areaAllowed) return false
    const config = permissionsOf(subject)
    if (config?.acesso === 'PERSONALIZAR') return config.acoes?.includes(action) ?? false
    if (action === 'EXCLUIR_INSCRICAO') return hasAdminPermission(subject, 'ADMINISTRADOR')
    return canEditAdmin(subject)
}
export function canCreateEvento(subject: Subject): boolean {
    return canEditAdmin(subject) && (!permissionsOf(subject) || permissionsOf(subject)?.eventos === 'TODOS') && canAccessAdminPage(subject, '/admin/eventos')
}
export function adminEventWhere(subject: Subject): { status?: 'PUBLISHED'; id?: { in: string[] } } {
    const config = permissionsOf(subject)
    if (config?.eventos === 'PUBLICADOS') return { status: 'PUBLISHED' }
    if (config?.eventos === 'ESPECIFICOS') return { id: { in: config.eventoIds } }
    return {}
}

export function isAdminRole(role: string): role is AdminRole {
    return ['ADMIN', 'SUPER_ADMIN', 'NUPPEX', 'FINANCEIRO'].includes(role)
}
export function hasAdminPermission(subject: Subject, permission: AdminPermission) {
    const role = roleOf(subject)
    if (!isAdminRole(role)) return false
    if (permission === 'SESSAO') return true
    if (permission === 'EXCLUIR_INSCRICAO') return canAdminAction(subject, 'EXCLUIR_INSCRICAO')
    const config = permissionsOf(subject)
    if (config) {
        if (permission === 'ADMINISTRADOR') return false
        return permission === 'FINANCEIRO' ? config.areas.some(a => a === 'financeiro' || a === 'pendentes') : config.areas.some(a => ['eventos', 'dashboard', 'tiposAtividade'].includes(a))
    }
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true
    if (permission === 'ADMINISTRADOR') return false
    return permission === 'FINANCEIRO' ? role === 'FINANCEIRO' : role === 'NUPPEX'
}
export function adminHome(subject: Subject): string {
    const role = roleOf(subject)
    if (permissionsOf(subject)) return ['/admin/dashboard', '/admin/eventos', '/admin/inscricoes/pendentes', '/admin/financeiro', '/admin/tipos-atividade'].find(path => canAccessAdminPage(subject, path)) || '/admin/acesso'
    return role === 'FINANCEIRO' ? '/admin/inscricoes/pendentes' : '/admin/dashboard'
}
export function canAccessAdminPage(subject: Subject, path: string): boolean {
    const role = roleOf(subject)
    if (!isAdminRole(role)) return false
    if (path === '/admin/acesso') return true
    if (path.startsWith('/admin/usuarios')) return hasAdminPermission(subject, 'ADMINISTRADOR')
    const config = permissionsOf(subject)
    if (config) {
        const area: AdminArea | undefined = path.startsWith('/admin/financeiro') ? 'financeiro' : path.startsWith('/admin/inscricoes/pendentes') ? 'pendentes' : path.startsWith('/admin/eventos') ? 'eventos' : path.startsWith('/admin/tipos-atividade') ? 'tiposAtividade' : path === '/admin/dashboard' ? 'dashboard' : undefined
        if (!area || !config.areas.includes(area)) return false
        if (path === '/admin/eventos/novo') return canCreateEvento(subject)
        const eventId = path.match(/^\/admin\/eventos\/([^/]+)/)?.[1]
        if (eventId && config.eventos === 'ESPECIFICOS' && !config.eventoIds.includes(eventId)) return false
        if (path.endsWith('/editar') && !canEditAdmin(subject)) return false
        return true
    }
    if (path === '/admin/financeiro' || path === '/admin/inscricoes/pendentes') return hasAdminPermission(role, 'FINANCEIRO')
    return hasAdminPermission(role, 'GESTAO')
}
export const adminRoleLabels: Record<AdminRole, string> = {
    ADMIN: 'Administrador', SUPER_ADMIN: 'Administrador', NUPPEX: 'NUPPEX', FINANCEIRO: 'Financeiro',
}
