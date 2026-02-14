import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-very-secret'

export interface AdminPayload {
    id: string
    role: string
}

export const adminAuth = {
    hashPassword: async (password: string) => await bcrypt.hash(password, 10),
    comparePassword: async (password: string, hash: string) => await bcrypt.compare(password, hash),

    signToken: (payload: AdminPayload) => {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    },

    verifyToken: (token: string): AdminPayload | null => {
        try {
            return jwt.verify(token, JWT_SECRET) as AdminPayload
        } catch {
            return null
        }
    }
}

import { AppError } from './app-error'
export async function getAdminFromHeader(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token não fornecido', 401, 'UNAUTHORIZED')
    }

    const token = authHeader.split(' ')[1]
    const payload = adminAuth.verifyToken(token)

    if (!payload) {
        throw new AppError('Token inválido ou expirado', 401, 'UNAUTHORIZED')
    }

    return payload
}
