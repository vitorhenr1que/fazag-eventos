import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/db'
import { adminAuth, getAdminFromHeader } from '@/lib/auth-admin'
import { AppError, handleApiError } from '@/lib/app-error'
import { adminUserSchema } from '@/lib/admin-user-schema'
import { adminUserSelect, validateUserEvents, userWriteError } from '@/lib/admin-users'

export async function GET(request: NextRequest) {
    try {
        await getAdminFromHeader(request, 'ADMINISTRADOR')
        const [usuarios, eventos] = await Promise.all([
            prisma.admin.findMany({ select: adminUserSelect, orderBy: { nome: 'asc' } }),
            prisma.evento.findMany({ select: { id: true, nome: true, status: true }, orderBy: { dataInicio: 'desc' } }),
        ])
        return NextResponse.json({ success: true, data: { usuarios, eventos } }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
    try {
        await getAdminFromHeader(request, 'ADMINISTRADOR')
        const data = adminUserSchema.parse(await request.json())
        if (!data.senha) throw new AppError('Informe uma senha com pelo menos 8 caracteres.', 400)
        await validateUserEvents(data)
        const usuario = await prisma.admin.create({ data: { ...data, senha: await adminAuth.hashPassword(data.senha), permissoes: data.permissoes ?? Prisma.DbNull }, select: adminUserSelect }).catch(userWriteError)
        return NextResponse.json({ success: true, data: usuario }, { status: 201 })
    } catch (error) { return handleApiError(error) }
}
