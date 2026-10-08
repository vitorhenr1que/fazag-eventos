import { randomBytes } from 'node:crypto'
import prisma from '@/lib/db'
import type { ReservaPix } from '@prisma/client'
import { comLockFinanceiro } from '@/lib/financeiro-lock'
import { AppError } from '@/lib/app-error'
import { gerarCodigoPix, PRAZO_PIX_MS, validarChavePix, valorPix } from '@/lib/pix'

export function payloadReserva(reserva: ReservaPix) {
    return { quoteId: reserva.id, eventoId: reserva.eventoId, inscricaoId: reserva.inscricaoId,
        amount: Number(reserva.valor).toFixed(2), code: reserva.codigo, txid: reserva.txid,
        createdAt: reserva.createdAt.getTime(), expiresAt: reserva.expiresAt.getTime() }
}

export class PixService {
    async obter(inscricaoId: string, alunoId: string, gerar = false) {
        // Esta leitura serve somente para descobrir o lock, nunca para decidir elegibilidade.
        const inicial = await prisma.inscricao.findUnique({ where: { id: inscricaoId } })
        if (!inicial) throw new AppError('Inscrição não encontrada', 404)
        if (inicial.alunoId !== alunoId) throw new AppError('Acesso negado', 403)
        return comLockFinanceiro(inicial.eventoId, async tx => {
            const inscricao = await tx.inscricao.findUnique({ where: { id: inscricaoId }, include: { evento: true } })
            if (!inscricao) throw new AppError('Inscrição não encontrada', 404)
            if (inscricao.alunoId !== alunoId) throw new AppError('Acesso negado', 403)
            const bloqueada = await tx.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
                || await tx.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
            if (inscricao.status !== 'PENDENTE' || inscricao.evento.tipo !== 'PAGO' || bloqueada
                || (inscricao.situacaoFinanceira && !['PENDENTE', 'DESCONTO', 'ISENTO'].includes(inscricao.situacaoFinanceira))) {
                if (!gerar) return null
                throw new AppError('Esta inscrição não possui pagamento Pix pendente', 409, 'PIX_NAO_PENDENTE')
            }
            const agora = new Date()
            const ativa = await tx.reservaPix.findFirst({
                where: { inscricaoId, invalidadaAt: null, expiresAt: { gt: agora } }, orderBy: { createdAt: 'desc' },
            })
            if (ativa) return payloadReserva(ativa)
            if (!gerar) return null
            const amount = valorPix(inscricao.evento.preco)
            const chavePix = validarChavePix(inscricao.evento.chavePix)
            const txid = randomBytes(12).toString('hex')
            const reserva = await tx.reservaPix.create({ data: {
                inscricaoId, eventoId: inscricao.eventoId, valor: amount, chavePix, txid,
                codigo: gerarCodigoPix(chavePix, amount, txid), createdAt: agora,
                expiresAt: new Date(agora.getTime() + PRAZO_PIX_MS),
            } })
            return payloadReserva(reserva)
        })
    }
}
