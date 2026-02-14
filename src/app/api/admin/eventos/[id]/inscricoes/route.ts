import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const inscricoes = await prisma.inscricao.findMany({
            where: { eventoId: id },
            include: {
                aluno: true,
                checkIn: true,
                certificado: true,
                subeventosEscolhidos: {
                    include: {
                        subevento: true,
                        checkIn: true
                    }
                }
            } as any
        })

        return NextResponse.json({ success: true, count: inscricoes.length, data: inscricoes })
    } catch (error) {
        return handleApiError(error)
    }
}
