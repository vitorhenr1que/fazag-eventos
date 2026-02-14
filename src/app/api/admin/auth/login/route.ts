import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/auth-admin'
import prisma from '@/lib/db'
import { handleApiError, AppError } from '@/lib/app-error'
import { z } from 'zod'

const loginSchema = z.object({
    email: z.string().email(),
    senha: z.string().min(6),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, senha } = loginSchema.parse(body)

        const admin = await prisma.admin.findUnique({ where: { email } })

        if (!admin) {
            // Por segurança, tempo constante ou mensagem genérica
            throw new AppError('Credenciais inválidas', 401)
        }

        const isValid = await adminAuth.comparePassword(senha, admin.senha)
        if (!isValid) {
            throw new AppError('Credenciais inválidas', 401)
        }

        const token = adminAuth.signToken({ id: admin.id, role: admin.role })

        return NextResponse.json({ success: true, token })
    } catch (error) {
        return handleApiError(error)
    }
}
