import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { AppError, handleApiError } from '@/lib/app-error'

export async function GET(request: NextRequest) {
    try {
        await getAdminFromHeader(request, 'FINANCEIRO')
        const eventoId = request.nextUrl.searchParams.get('eventoId')
        const eventos = await prisma.evento.findMany({ select: { id: true, nome: true }, orderBy: { dataInicio: 'desc' } })
        if (!eventoId) return NextResponse.json({ success: true, data: { eventos, evento: null } })
        const evento = await prisma.evento.findUnique({
            where: { id: eventoId },
            select: { id: true, nome: true, preco: true, tipo: true, inscricoes: {
                orderBy: { dataInscricao: 'asc' },
                include: { aluno: { select: { id: true, nome: true, email: true } } }
            } }
        })
        if (!evento) throw new AppError('Evento não encontrado', 404)
        const reembolsos = await prisma.reembolso.findMany({ where: { eventoId }, orderBy: { dataReembolso: 'desc' } })
        const exclusoes = await prisma.exclusaoInscricao.findMany({ where: { eventoId, modalidade: 'MANTER_PAGAMENTO', estado: 'CONCLUIDO' }, orderBy: { dataExclusao: 'desc' } })
        const emProcessamento = await prisma.exclusaoInscricao.findMany({ where: { eventoId, estado: 'PROCESSANDO' }, select: { inscricaoOriginalId: true } })
        const reservasPix = await prisma.reservaPix.findMany({ where: { eventoId }, orderBy: { createdAt: 'desc' },
            select: { id: true, inscricaoId: true, valor: true, txid: true, createdAt: true, expiresAt: true, invalidadaAt: true },
        })
        const pagamentosCancelados = await prisma.pagamentoCancelado.findMany({ where: { eventoId }, orderBy: { createdAt: 'desc' } })
        const adminIds = Array.from(new Set([
            ...pagamentosCancelados.flatMap(p => [p.canceladoPor, ...(p.aprovadoPor ? [p.aprovadoPor] : [])]),
            ...evento.inscricoes.flatMap(i => i.aprovadoPor ? [i.aprovadoPor] : []),
            ...reembolsos.flatMap(r => [r.reembolsadoPor, ...(r.aprovadoPor ? [r.aprovadoPor] : [])]),
            ...exclusoes.flatMap(e => [e.excluidoPor, ...(e.aprovadoPor ? [e.aprovadoPor] : [])]),
        ]))
        const admins = await prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, nome: true } })
        const nomes = new Map(admins.map(a => [a.id, a.nome]))
        return NextResponse.json({ success: true, data: { eventos, evento: { ...evento,
            reservasPix,
            pagamentosCancelados: pagamentosCancelados.map(p => ({ ...p,
                responsavel: p.aprovadoPor ? nomes.get(p.aprovadoPor) ?? p.aprovadoPor : null,
                responsavelCancelamento: nomes.get(p.canceladoPor) ?? p.canceladoPor,
            })),
            inscricoes: evento.inscricoes.map(i => ({ ...i, responsavel: i.aprovadoPor ? nomes.get(i.aprovadoPor) ?? i.aprovadoPor : null,
                exclusaoEmProcessamento: emProcessamento.some(e => e.inscricaoOriginalId === i.id),
                reembolsoEmProcessamento: reembolsos.some(r => r.inscricaoOriginalId === i.id && r.estado === 'PROCESSANDO') })),
            reembolsos: reembolsos.map(r => ({ ...r, responsavel: r.aprovadoPor ? nomes.get(r.aprovadoPor) ?? r.aprovadoPor : null, responsavelReembolso: nomes.get(r.reembolsadoPor) ?? r.reembolsadoPor })),
            exclusoesEmProcessamento: emProcessamento.length,
            pagamentosMantidos: exclusoes.map(e => ({ ...e, status: 'CONFIRMADA',
                aluno: { id: e.alunoId, nome: e.alunoNome, email: e.alunoEmail },
                responsavel: e.aprovadoPor ? nomes.get(e.aprovadoPor) ?? e.aprovadoPor : null,
                responsavelExclusao: nomes.get(e.excluidoPor) ?? e.excluidoPor,
            })),
        } } }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}
