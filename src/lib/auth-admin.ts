import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import prisma from './db'
import { AppError } from './app-error'
import { hasAdminPermission, isAdminRole, canAccessAdminPage, canEditAdmin, canAdminAction, canCreateEvento, adminEventWhere, type AdminAction, type AdminPermission, type AdminSession } from './admin-permissions'
import { userPermissionsSchema } from './admin-user-schema'
import { adminCheckinSchema } from './admin-checkin'

export interface AdminPayload { id: string; role: string; iat?: number; exp?: number }
const getSecret = () => {
    const secret = process.env.ADMIN_JWT_SECRET
    if (!secret) throw new Error('ADMIN_JWT_SECRET não configurado')
    return secret
}
export const adminAuth = {
    hashPassword: async (password: string) => bcrypt.hash(password, 10),
    comparePassword: async (password: string, hash: string) => bcrypt.compare(password, hash),
    signToken: (payload: AdminPayload) => jwt.sign(payload, getSecret(), { expiresIn: '8h', algorithm: 'HS256' }),
    verifyToken: (token: string): AdminPayload | null => {
        const secret = getSecret()
        try {
            const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
            if (typeof payload === 'string' || typeof payload.id !== 'string') return null
            return payload as AdminPayload
        } catch { return null }
    },
}

export async function getAdminFromHeader(request: Request, permission: AdminPermission = 'GESTAO'): Promise<AdminSession> {
    const header = request.headers.get('authorization')
    if (!header?.startsWith('Bearer ')) throw new AppError('Token não fornecido', 401, 'UNAUTHORIZED')
    const payload = adminAuth.verifyToken(header.slice(7))
    if (!payload) throw new AppError('Token inválido ou expirado. Faça login novamente.', 401, 'UNAUTHORIZED')
    // O perfil do banco prevalece sobre tokens antigos após mudanças de privilégios.
    const admin = await prisma.admin.findUnique({ where: { id: payload.id }, select: { id: true, nome: true, email: true, role: true, ativo: true, permissoes: true } })
    if (!admin || !admin.ativo) throw new AppError('Usuário indisponível. Faça login novamente.', 401, 'UNAUTHORIZED')
    const session: AdminSession = { ...admin, permissoes: admin.permissoes === null ? null : userPermissionsSchema.parse(admin.permissoes) }
    if (!isAdminRole(admin.role) || (!session.permissoes || permission === 'ADMINISTRADOR' || permission === 'EXCLUIR_INSCRICAO') && !hasAdminPermission(session, permission)) {
        throw new AppError('Seu perfil não tem permissão para acessar esta funcionalidade.', 403, 'FORBIDDEN')
    }
    if (permission !== 'SESSAO') await authorizeAdminRequest(request, session)
    return session
}

export async function assertAdminEvento(session: AdminSession, eventoId: string) {
    const evento = await prisma.evento.findFirst({ where: { AND: [{ id: eventoId }, adminEventWhere(session)] }, select: { id: true } })
    if (!evento) throw new AppError('Evento não encontrado ou sem permissão de acesso.', 403, 'FORBIDDEN')
}

async function authorizeAdminRequest(request: Request, session: AdminSession) {
    const url = new URL(request.url)
    const path = url.pathname
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    const fail = () => { throw new AppError('Você não tem permissão para esta ação.', 403, 'FORBIDDEN') }
    let checkinSubId: string | undefined
    if (write && !canEditAdmin(session)) {
        if (session.permissoes?.acesso !== 'PERSONALIZAR' || !['POST', 'PUT', 'DELETE'].includes(request.method)) fail()
        let action: AdminAction | undefined
        const operation = path.match(/^\/api\/admin\/inscricoes\/[^/]+\/(checkin|certificado|excluir|aprovar)$/)?.[1]
        if (/^\/api\/admin\/subeventos\/[^/]+$/.test(path) && request.method === 'PUT') action = 'EDITAR_SUBEVENTO'
        else if (operation === 'checkin') {
            const body = adminCheckinSchema.parse(await request.clone().json())
            action = request.method === 'DELETE'
                ? body.tipo === 'SUBEVENTO' ? 'REMOVER_CHECKIN_SUBEVENTO' : 'REMOVER_CHECKIN_GERAL'
                : body.tipo === 'SUBEVENTO' ? 'CHECKIN_SUBEVENTO' : 'CHECKIN_GERAL'
            if (body.tipo === 'SUBEVENTO') checkinSubId = body.subeventoId
        } else if (operation === 'certificado') action = request.method === 'DELETE' ? 'EXCLUIR_CERTIFICADO' : 'LIBERAR_CERTIFICADO'
        else if (operation === 'excluir' && request.method === 'POST') action = 'EXCLUIR_INSCRICAO'
        else if (operation === 'aprovar' && request.method === 'POST') action = 'APROVAR_INSCRICAO'
        else if (/^\/api\/admin\/subeventos\/[^/]+\/inscricoes$/.test(path) && request.method === 'DELETE') action = 'REMOVER_INSCRICAO_SUBEVENTO'
        if (!action || !canAdminAction(session, action)) fail()
    }
    if (path.startsWith('/api/admin/usuarios')) {
        if (!hasAdminPermission(session, 'ADMINISTRADOR')) fail()
        return
    }
    // Pendentes e relatório são permissões independentes; ações financeiras podem partir de ambos.
    const financeiroAction = /^\/api\/admin\/inscricoes\/[^/]+\/(aprovar|financeiro)$/.test(path)
    const page = path === '/api/admin/financeiro' ? '/admin/financeiro'
        : path === '/api/admin/dashboard' ? '/admin/dashboard'
        : path === '/api/admin/inscricoes/pendentes' ? '/admin/inscricoes/pendentes'
        : path.startsWith('/api/admin/tipos-atividade') ? '/admin/tipos-atividade'
        : '/admin/eventos'
    // Tipos de atividade também alimentam os formulários de evento.
    const eventFormOptions = path === '/api/admin/tipos-atividade' && !write && canAccessAdminPage(session, '/admin/eventos')
    if (financeiroAction ? !(path.endsWith('/financeiro') ? canAccessAdminPage(session, '/admin/financeiro') : hasAdminPermission(session, 'FINANCEIRO')) : !eventFormOptions && !canAccessAdminPage(session, page)) fail()
    let eventoId = path.match(/^\/api\/admin\/eventos\/([^/]+)/)?.[1] || url.searchParams.get('eventoId')
    const subId = path.match(/^\/api\/admin\/subeventos\/([^/]+)/)?.[1]
    const inscricaoId = path.match(/^\/api\/admin\/inscricoes\/([^/]+)\//)?.[1]
    if (subId) {
        const sub = await prisma.subevento.findUnique({ where: { id: subId }, select: { eventoId: true } })
        if (!sub) fail()
        eventoId = sub!.eventoId
    }
    if (inscricaoId) {
        const inscricao = await prisma.inscricao.findUnique({ where: { id: inscricaoId }, select: { eventoId: true } })
        // Exclusões são retomáveis após a inscrição ter sido removida.
        const historico = !inscricao && path.endsWith('/excluir') ? await prisma.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId }, select: { eventoId: true } })
            : !inscricao && path.endsWith('/financeiro') ? await prisma.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId }, select: { eventoId: true } }) : null
        if (!inscricao && !historico) fail()
        eventoId = (inscricao || historico)!.eventoId
    }
    if (checkinSubId) {
        const subevento = await prisma.subevento.findUnique({ where: { id: checkinSubId }, select: { eventoId: true } })
        if (!subevento || subevento.eventoId !== eventoId) fail()
    }
    if (path.startsWith('/api/r2/')) {
        const body = await request.clone().json()
        eventoId = body.eventoId
        if (!eventoId && !canCreateEvento(session)) fail()
        if (path.endsWith('/object') && !eventoId) fail()
    }
    if (eventoId) {
        const exclusao = /^\/api\/admin\/eventos\/[^/]+(?:\/exclusao)?$/.test(path) && (request.method === 'DELETE' || path.endsWith('/exclusao')) && hasAdminPermission(session, 'ADMINISTRADOR')
            ? await prisma.exclusaoEvento.findUnique({ where: { eventoId }, select: { eventoId: true } }) : null
        if (!exclusao) await assertAdminEvento(session, decodeURIComponent(eventoId))
    }
    if (path === '/api/admin/eventos' && write && !canCreateEvento(session)) fail()
}
