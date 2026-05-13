import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { handleApiError } from '@/lib/app-error'
import { z } from 'zod'

const tipoAtividadeSchema = z.object({
    nome: z.string().min(1),
    descricao: z.string().min(1),
    cargaHorariaMaxima: z.number().int().positive(),
    porcentagemAnual: z.number().int().min(0).max(100),
})

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)

        const { id } = await params
        const body = await request.json()
        const data = tipoAtividadeSchema.parse(body)
        const tipo = await prisma.tipoAtividade.update({
            where: { id },
            data
        })

        return NextResponse.json({ success: true, data: tipo })
    } catch (error) {
        return handleApiError(error)
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)

        const { id } = await params
        await prisma.tipoAtividade.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error)
    }
}
