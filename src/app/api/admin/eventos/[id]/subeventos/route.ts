import { getAdminFromHeader } from '@/lib/auth-admin'
import { NextRequest, NextResponse } from 'next/server'
import { EventoService } from '@/services/evento.service'
import { AppError, handleApiError } from '@/lib/app-error'
import prisma from '@/lib/db'
import { z } from 'zod'
const createSchema = z.object({
    nome: z.string().min(1).max(160), descricao: z.string().nullable().optional(), local: z.string().max(160).nullable().optional(),
    dataInicio: z.string().datetime({ offset: true }), dataFim: z.string().datetime({ offset: true }),
    totalVagas: z.number().int().positive(), cargaHoraria: z.number().nonnegative(),
}).strict()

const service = new EventoService()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const evento = await prisma.evento.findUnique({
            where: { id },
            select: { id: true, nome: true, subeventos: { orderBy: { dataInicio: 'asc' }, include: { _count: { select: { inscricoesSubevento: true } } } } },
        })
        if (!evento) throw new AppError('Evento não encontrado', 404)
        return NextResponse.json({ success: true, data: evento }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const body = createSchema.parse(await request.json())
        // Validar Zod Subevento

        const subevento = await service.adicionarSubevento(id, body)

        return NextResponse.json({ success: true, data: subevento }, { status: 201 })
    } catch (error) {
        return handleApiError(error)
    }
}
