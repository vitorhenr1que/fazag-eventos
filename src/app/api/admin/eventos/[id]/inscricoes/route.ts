import { getAdminFromHeader } from '@/lib/auth-admin'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'
import { hasAdminPermission } from '@/lib/admin-permissions'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await getAdminFromHeader(request)
        const { id } = await params
        const inscricoes = await prisma.inscricao.findMany({
            where: { eventoId: id },
            include: {
                aluno: true,
                checkIn: true,
                certificado: true,
                subeventosEscolhidos: {
                    include: {
                        checkIn: true
                    }
                }
            },
            orderBy: [{ dataInscricao: 'asc' }, { id: 'asc' }],
        })

        // Vínculos antigos podem apontar para subeventos removidos no banco legado.
        // Buscar separadamente evita que um vínculo órfão impeça listar todos os alunos.
        const subeventoIds = Array.from(new Set(inscricoes.flatMap(i => i.subeventosEscolhidos.map(se => se.subeventoId))))
        const subeventos = subeventoIds.length
            ? await prisma.subevento.findMany({ where: { id: { in: subeventoIds }, eventoId: id } })
            : []
        const subeventosPorId = new Map(subeventos.map(s => [s.id, s]))
        const inscricoesComSubeventos = inscricoes.map(inscricao => ({
            ...inscricao,
            subeventosEscolhidos: inscricao.subeventosEscolhidos.flatMap(se => {
                const subevento = subeventosPorId.get(se.subeventoId)
                return subevento ? [{ ...se, subevento }] : []
            }),
        }))

        const data = hasAdminPermission(admin.role, 'FINANCEIRO') ? inscricoesComSubeventos : inscricoesComSubeventos.map(inscricao => {
            const { valorReferencia, valorPago, valorDesconto, situacaoFinanceira, dataPagamento, dataTransferencia, reservaPixId, aprovadoPor, observacaoFinanceira, ...operacional } = inscricao
            return operacional
        })
        const exclusoesEmProcessamento = hasAdminPermission(admin.role, 'ADMINISTRADOR')
            ? await prisma.exclusaoInscricao.findMany({ where: { eventoId: id, estado: 'PROCESSANDO' }, select: { inscricaoOriginalId: true, alunoNome: true, modalidade: true } }) : []
        return NextResponse.json({ success: true, count: inscricoes.length, data, exclusoesEmProcessamento }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return handleApiError(error)
    }
}
