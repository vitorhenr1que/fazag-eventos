import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const evento = await prisma.evento.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        inscricoes: {
                            where: { status: 'CONFIRMADA' }
                        }
                    }
                },
                subeventos: {
                    orderBy: { dataInicio: 'asc' },
                    include: {
                        _count: {
                            select: { inscricoesSubevento: true }
                        }
                    }
                },
                certificado: true
            } as any
        })

        if (!evento) {
            return NextResponse.json({ success: false, error: 'Evento não encontrado' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: evento })
    } catch (error) {
        return handleApiError(error)
    }
}
