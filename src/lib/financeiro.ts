import { z } from 'zod'
import { AppError } from './app-error'

export const aprovacaoFinanceiraSchema = z.object({
    modalidade: z.enum(['PAGO', 'DESCONTO', 'ISENTO']).default('PAGO'),
    valorPago: z.number().finite().min(0).max(99999999.99).optional(),
    observacao: z.string().trim().max(500).optional(),
    quoteId: z.string().min(1).max(25).optional(),
    dataTransferencia: z.string().datetime({ offset: true }).optional(),
    semReservaConferida: z.boolean().optional(),
})
export type AprovacaoFinanceira = z.infer<typeof aprovacaoFinanceiraSchema>

export const acaoFinanceiraSchema = z.object({
    acao: z.enum(['REEMBOLSO', 'CANCELAMENTO']),
    motivo: z.string().trim().max(500).optional(),
    valorHistorico: z.number().finite().positive().max(99999999.99).optional(),
})
export type AcaoFinanceira = z.infer<typeof acaoFinanceiraSchema>

export function valorDoReembolso(valorPago: number | null, valorHistorico?: number) {
    const valor = valorPago ?? valorHistorico
    if (valor === undefined || !Number.isFinite(valor) || valor <= 0 || valor > 99999999.99) {
        throw new AppError('Informe o valor efetivamente pago para reembolsar esta inscrição antiga')
    }
    if (Math.abs(valor * 100 - Math.round(valor * 100)) > 0.00001) throw new AppError('Informe no máximo duas casas decimais')
    return Math.round(valor * 100) / 100
}

// Trabalhar em centavos evita diferenças de arredondamento em descontos e totais.
export function calcularPagamento(referencia: number, dados: AprovacaoFinanceira) {
    const base = Math.round(referencia * 100)
    const pago = dados.modalidade === 'ISENTO' ? 0 : Math.round((dados.valorPago ?? NaN) * 100)
    if (dados.modalidade === 'PAGO' && (!Number.isFinite(pago) || pago !== base)) {
        throw new AppError('O valor recebido diverge da referência. Confira o comprovante ou conceda desconto explicitamente.', 400, 'VALOR_DIVERGENTE')
    }
    if (!Number.isFinite(base) || base < 0 || base > 9999999999) throw new AppError('Valor de referência inválido')
    if (dados.modalidade === 'DESCONTO' && (!Number.isFinite(pago) || pago <= 0 || pago >= base)) {
        throw new AppError('Informe um valor pago maior que zero e menor que o valor da inscrição')
    }
    if (dados.valorPago !== undefined && Math.abs(dados.valorPago * 100 - Math.round(dados.valorPago * 100)) > 0.00001) {
        throw new AppError('Informe no máximo duas casas decimais')
    }
    return { situacaoFinanceira: dados.modalidade, valorPago: pago / 100, valorDesconto: (base - pago) / 100 }
}

// O horário é informado pelo financeiro após conferir o comprovante.
export function reconhecerReferencia(
    inscricao: { valorReferencia: unknown; situacaoFinanceira: string | null; evento: { preco: unknown } },
    reserva: { valor: unknown; createdAt: Date; expiresAt: Date; invalidadaAt: Date | null } | null,
    dados: AprovacaoFinanceira, agora = new Date(),
) {
    let transferencia: Date | null = null
    if (dados.modalidade !== 'ISENTO') {
        if (!dados.dataTransferencia || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(dados.dataTransferencia)) {
            throw new AppError('Informe a data/hora da transferência com fuso horário', 400, 'TRANSFERENCIA_OBRIGATORIA')
        }
        transferencia = new Date(dados.dataTransferencia)
        if (!Number.isFinite(transferencia.getTime()) || transferencia > agora) throw new AppError('Horário da transferência inválido ou no futuro', 400, 'TRANSFERENCIA_INVALIDA')
        if (dados.valorPago === undefined) throw new AppError('Informe o valor efetivamente recebido')
        if (!dados.quoteId && (!dados.semReservaConferida || !dados.observacao?.trim())) {
            throw new AppError('Confirme a conferência manual sem reserva e registre uma observação', 400, 'CONFERENCIA_MANUAL_OBRIGATORIA')
        }
    } else if (dados.quoteId || dados.dataTransferencia || (dados.valorPago !== undefined && dados.valorPago !== 0)) {
        throw new AppError('Isenção não deve registrar uma transferência ou reserva')
    }
    const dentro = reserva && transferencia && reserva.createdAt <= transferencia && transferencia < reserva.expiresAt
        && (!reserva.invalidadaAt || transferencia < reserva.invalidadaAt)
    if (reserva && !dentro && dados.modalidade === 'PAGO') {
        throw new AppError('Transferência fora do prazo da reserva. Confira sem reserva pelo preço atual ou conceda desconto explicitamente.', 400, 'PIX_FORA_DO_PRAZO')
    }
    if (reserva && !dentro && dados.modalidade === 'DESCONTO' && !dados.observacao?.trim()) {
        throw new AppError('Registre o motivo do desconto para a transferência fora do prazo')
    }
    const ajusteExplicito = ['DESCONTO', 'ISENTO'].includes(inscricao.situacaoFinanceira ?? '')
    const referencia = dentro ? reserva!.valor : ajusteExplicito ? inscricao.valorReferencia : inscricao.evento.preco
    if (referencia === null || referencia === undefined || !Number.isFinite(Number(referencia)) || Number(referencia) < 0) {
        throw new AppError('Defina o valor do evento antes de aprovar')
    }
    return { referencia: Number(referencia), transferencia }
}
