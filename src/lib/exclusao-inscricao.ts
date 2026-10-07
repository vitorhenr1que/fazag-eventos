import { z } from 'zod'

export const exclusaoInscricaoSchema = z.object({
    modalidade: z.enum(['REEMBOLSO', 'EXCLUIR_TUDO', 'MANTER_PAGAMENTO']),
    motivo: z.string().trim().max(500).optional(),
    valorHistorico: z.number().positive().max(99999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Informe até duas casas decimais').optional(),
})
export type ExclusaoInscricao = z.infer<typeof exclusaoInscricaoSchema>
