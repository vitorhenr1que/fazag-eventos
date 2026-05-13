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

export async function GET(request: NextRequest) {
    try {
        await getAdminFromHeader(request)

        const tipos = await prisma.tipoAtividade.findMany({
            orderBy: { nome: 'asc' },
            include: {
                _count: {
                    select: { eventos: true }
                }
            }
        })

        return NextResponse.json({ success: true, data: tipos })
    } catch (error) {
        return handleApiError(error)
    }
}

export async function POST(request: NextRequest) {
    try {
        await getAdminFromHeader(request)

        const body = await request.json()
        const data = tipoAtividadeSchema.parse(body)
        const tipo = await prisma.tipoAtividade.create({ data })

        return NextResponse.json({ success: true, data: tipo }, { status: 201 })
    } catch (error) {
        return handleApiError(error)
    }
}
