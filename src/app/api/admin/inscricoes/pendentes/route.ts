import { NextRequest, NextResponse } from 'next/server'
import { adminEventWhere } from '@/lib/admin-permissions'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'
import { getAdminFromHeader } from '@/lib/auth-admin'

export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminFromHeader(request, 'FINANCEIRO')
        const eventoId = request.nextUrl.searchParams.get('eventoId')
        const eventos = await prisma.evento.findMany({
            where: adminEventWhere(admin), select: { id: true, nome: true }, orderBy: { dataInicio: 'desc' },
        })
        if (!eventoId) return NextResponse.json({ success: true, serverNow: Date.now(), eventos, data: [] }, { headers: { 'Cache-Control': 'no-store' } })
        const pendentes = await prisma.inscricao.findMany({
            where: {
                status: 'PENDENTE',
                eventoId,
                evento: adminEventWhere(admin),
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
        return NextResponse.json({ success: true, serverNow: Date.now(), eventos, data: pendentes.map(i => ({
            ...i, reservasPix: reservas.filter(r => r.inscricaoId === i.id),
        })) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return handleApiError(error)
    }
}
