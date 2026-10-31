import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { adminAuth, getAdminFromHeader } from '@/lib/auth-admin'
import { AppError, handleApiError } from '@/lib/app-error'
import { adminUserSchema } from '@/lib/admin-user-schema'
import { adminUserSelect, validateUserEvents, userWriteError } from '@/lib/admin-users'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await getAdminFromHeader(request, 'ADMINISTRADOR')
        const { id } = await params
        const data = adminUserSchema.parse(await request.json())
        const existing = await prisma.admin.findUnique({ where: { id }, select: adminUserSelect })
        if (!existing) throw new AppError('Usuário não encontrado.', 404)
        if (id === admin.id && (!data.ativo || data.role !== admin.role || data.permissoes !== null)) throw new AppError('Você não pode desativar ou restringir sua própria conta.', 400)
        await validateUserEvents(data)
        const { senha, ...values } = data
        const usuario = await prisma.admin.update({ where: { id }, data: {
            ...values, permissoes: values.permissoes ?? Prisma.DbNull,
            ...(senha ? { senha: await adminAuth.hashPassword(senha) } : {}),
        }, select: adminUserSelect }).catch(userWriteError)
        return NextResponse.json({ success: true, data: usuario })
    } catch (error) { return handleApiError(error) }
}
