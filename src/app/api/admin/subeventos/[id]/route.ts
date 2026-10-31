import { getAdminFromHeader } from '@/lib/auth-admin'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'
import { EventoService } from '@/services/evento.service'
import { z } from 'zod'

const updateSchema = z.object({
    nome: z.string().min(1).max(160), descricao: z.string().nullable(), local: z.string().max(160).nullable(),
    dataInicio: z.string().datetime({ offset: true }), dataFim: z.string().datetime({ offset: true }),
    totalVagas: z.number().int().positive(), cargaHoraria: z.number().nonnegative(),
}).partial().strict()

const service = new EventoService()

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const body = updateSchema.parse(await request.json())

        const updated = await service.atualizarSubevento(id, body)

        return NextResponse.json({ success: true, data: updated })
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
        await prisma.subevento.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error)
    }
}

