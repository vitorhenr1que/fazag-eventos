export type AdminRole = 'ADMIN' | 'SUPER_ADMIN' | 'NUPPEX' | 'FINANCEIRO'
export type AdminPermission = 'GESTAO' | 'FINANCEIRO' | 'SESSAO' | 'ADMINISTRADOR'
export interface AdminSession { id: string; nome: string; email: string; role: AdminRole }

export function isAdminRole(role: string): role is AdminRole {
    return ['ADMIN', 'SUPER_ADMIN', 'NUPPEX', 'FINANCEIRO'].includes(role)
}
export function hasAdminPermission(role: string, permission: AdminPermission) {
    if (!isAdminRole(role)) return false
    if (permission === 'SESSAO') return true
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true
    if (permission === 'ADMINISTRADOR') return false
    return permission === 'FINANCEIRO' ? role === 'FINANCEIRO' : role === 'NUPPEX'
}
export function adminHome(role: string) {
    return role === 'FINANCEIRO' ? '/admin/inscricoes/pendentes' : '/admin/dashboard'
}
export function canAccessAdminPage(role: string, path: string) {
    if (path === '/admin/financeiro' || path === '/admin/inscricoes/pendentes') return hasAdminPermission(role, 'FINANCEIRO')
    return hasAdminPermission(role, 'GESTAO')
}
export const adminRoleLabels: Record<AdminRole, string> = {
    ADMIN: 'Administrador', SUPER_ADMIN: 'Administrador', NUPPEX: 'NUPPEX', FINANCEIRO: 'Financeiro',
}
