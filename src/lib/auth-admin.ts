import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { AppError } from './app-error'

export interface AdminPayload {
    id: string
    role: string
    iat?: number
    exp?: number
}

// Auxiliar para logar fingerprint do secret sem expô-lo
const getSecretFingerprint = (secret: string) => {
    return crypto.createHash('sha256').update(secret).digest('hex').substring(0, 12)
}

const getSecret = () => {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
        throw new Error("CRITICAL: ADMIN_JWT_SECRET is not defined in environment variables");
    }
    return secret;
}

export const adminAuth = {
    hashPassword: async (password: string) => await bcrypt.hash(password, 10),
    comparePassword: async (password: string, hash: string) => await bcrypt.compare(password, hash),

    signToken: (payload: AdminPayload) => {
        const secret = getSecret()
        console.log(`[DEBUG JWT] Assinando token. Secret Fingerprint: ${getSecretFingerprint(secret)}`)
        return jwt.sign(payload, secret, { expiresIn: '8h' })
    },

    verifyToken: (token: string): AdminPayload | null => {
        const secret = getSecret()
        try {
            console.log(`[DEBUG JWT] Verificando token. Secret Fingerprint: ${getSecretFingerprint(secret)}`)
            return jwt.verify(token, secret) as AdminPayload
        } catch (err: any) {
            console.error('[DEBUG JWT] Falha na verificação!', {
                name: err.name,
                message: err.message,
                expiredAt: err.expiredAt || 'N/A'
            });
            return null
        }
    }
}

export async function getAdminFromHeader(request: Request) {
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token não fornecido', 401, 'UNAUTHORIZED')
    }

    const token = authHeader.split(' ')[1]

    // Diagnóstico Robusto: Decodificar sem verificar
    try {
        const decoded = jwt.decode(token) as any;
        if (decoded) {
            const now = Math.floor(Date.now() / 1000);
            console.log('[DEBUG JWT] Token decodificado (unverified):', {
                id: decoded.id,
                role: decoded.role,
                iat: decoded.iat,
                exp: decoded.exp,
                isExpired: decoded.exp ? decoded.exp < now : 'unknown'
            });
        }
    } catch (e) {
        console.error('[DEBUG JWT] Erro ao decodificar token para debug');
    }

    const payload = adminAuth.verifyToken(token)

    if (!payload) {
        throw new AppError('Token inválido ou expirado. Por favor, faça login novamente.', 401, 'UNAUTHORIZED')
    }

    // Validação de Role
    const rolesPermitidas = ['ADMIN', 'SUPER_ADMIN'];
    if (!rolesPermitidas.includes(payload.role)) {
        throw new AppError('Acesso negado: Perfil sem privilégios administrativos', 403, 'FORBIDDEN');
    }

    return payload
}
