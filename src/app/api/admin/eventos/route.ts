import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { EventoService } from '@/services/evento.service'
import { handleApiError } from '@/lib/app-error'
import { z } from 'zod'

const adminCreateEventoSchema = z.object({
    nome: z.string(),
    slug: z.string(),
    descricao: z.string().optional().nullable(),
    local: z.string().optional().nullable(),
    tipo: z.enum(['GRATUITO', 'PAGO']).optional(),
    dataInicio: z.string().transform(str => new Date(str)),
    dataFim: z.string().transform(str => new Date(str)),
    totalVagas: z.number().int().positive(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'FINISHED', 'CANCELLED']).optional(),
    temSubeventos: z.boolean().optional(),
    cargaHorariaBase: z.number().optional().nullable(),
    limiteSubeventosPorAluno: z.number().int().optional().nullable(),
    preco: z.number().optional().nullable(),
    bannerUrl: z.string().url().optional().nullable().or(z.literal('')),
})

const eventoService = new EventoService()

export async function POST(request: NextRequest) {
    try {
        await getAdminFromHeader(request);

        const body = await request.json()
        const data = adminCreateEventoSchema.parse(body)

        // O Prisma create aceita o objeto retornado pelo Zod (com as datas transformadas)
        const evento = await eventoService.criarEvento(data)
        return NextResponse.json({ success: true, data: evento }, { status: 201 })
    } catch (error) {
        return handleApiError(error)
    }
}

export async function GET(request: NextRequest) {
    try {
        const eventos = await prisma.evento.findMany({
            orderBy: { dataInicio: 'desc' },
            include: {
                _count: {
                    select: { inscricoes: true }
                }
            }
        })
        return NextResponse.json({ success: true, data: eventos })
    } catch (error) {
        return handleApiError(error)
    }
}
