import { z } from 'zod'
import { AppError } from './app-error'

export const aprovacaoFinanceiraSchema = z.object({
    modalidade: z.enum(['PAGO', 'DESCONTO', 'ISENTO']).default('PAGO'),
    valorPago: z.number().finite().min(0).max(99999999.99).optional(),
    observacao: z.string().trim().max(500).optional(),
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
    const pago = dados.modalidade === 'ISENTO' ? 0 : dados.modalidade === 'PAGO' ? base : Math.round((dados.valorPago ?? NaN) * 100)
    if (!Number.isFinite(base) || base < 0 || base > 9999999999) throw new AppError('Valor de referência inválido')
    if (dados.modalidade === 'DESCONTO' && (!Number.isFinite(pago) || pago <= 0 || pago >= base)) {
        throw new AppError('Informe um valor pago maior que zero e menor que o valor da inscrição')
    }
    if (dados.valorPago !== undefined && Math.abs(dados.valorPago * 100 - Math.round(dados.valorPago * 100)) > 0.00001) {
        throw new AppError('Informe no máximo duas casas decimais')
    }
    return { situacaoFinanceira: dados.modalidade, valorPago: pago / 100, valorDesconto: (base - pago) / 100 }
}
