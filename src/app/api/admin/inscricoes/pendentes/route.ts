import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'

export async function GET(request: NextRequest) {
    try {
        const pendentes = await prisma.inscricao.findMany({
            where: {
                status: 'PENDENTE',
                evento: {
                    tipo: 'PAGO'
                }
            },
            include: {
                aluno: true,
                evento: {
                    select: {
                        nome: true,
                        totalVagas: true,
                        preco: true,
                        _count: {
                            select: {
                                inscricoes: {
                                    where: { status: 'CONFIRMADA' }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                dataInscricao: 'asc'
            }
        })

        return NextResponse.json({ success: true, data: pendentes })
    } catch (error) {
        return handleApiError(error)
    }
}
