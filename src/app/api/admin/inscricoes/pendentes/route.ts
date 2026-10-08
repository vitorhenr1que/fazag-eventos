import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'
import { getAdminFromHeader } from '@/lib/auth-admin'

export async function GET(request: NextRequest) {
    try {
        await getAdminFromHeader(request, 'FINANCEIRO')
        const pendentes = await prisma.inscricao.findMany({
            where: {
                status: 'PENDENTE',
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

        const reservas = await prisma.reservaPix.findMany({
            where: { inscricaoId: { in: pendentes.map(i => i.id) } }, orderBy: { createdAt: 'desc' },
            select: { id: true, inscricaoId: true, valor: true, txid: true, createdAt: true, expiresAt: true, invalidadaAt: true },
        })
        return NextResponse.json({ success: true, serverNow: Date.now(), data: pendentes.map(i => ({
            ...i, reservasPix: reservas.filter(r => r.inscricaoId === i.id),
        })) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return handleApiError(error)
    }
}
