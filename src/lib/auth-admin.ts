import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import prisma from './db'
import { AppError } from './app-error'
import { hasAdminPermission, isAdminRole, type AdminPermission, type AdminSession } from './admin-permissions'

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
    const admin = await prisma.admin.findUnique({ where: { id: payload.id }, select: { id: true, nome: true, email: true, role: true } })
    if (!admin) throw new AppError('Usuário não encontrado. Faça login novamente.', 401, 'UNAUTHORIZED')
    if (!isAdminRole(admin.role) || !hasAdminPermission(admin.role, permission)) {
        throw new AppError('Seu perfil não tem permissão para acessar esta funcionalidade.', 403, 'FORBIDDEN')
    }
    return { ...admin, role: admin.role }
}
