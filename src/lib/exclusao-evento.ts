import { z } from 'zod'

export const exclusaoEventoSchema = z.object({
    confirmacao: z.literal('EXCLUIR'),
    certificados: z.enum(['MANTER', 'EXCLUIR']),
    certificadosEsperados: z.number().int().nonnegative(),
}).strict()

export interface CertificadoPreservado {
    nomeAluno: string
    nomeEvento: string
    fundoUrl?: string | null
    template?: unknown
    preservacao: { motivo: 'EXCLUSAO_EVENTO'; eventoId: string; alunoId: string; inscricaoConfirmada: boolean }
}

export function certificadoPreservado(value: unknown): CertificadoPreservado | null {
    if (!value || typeof value !== 'object') return null
    const metadata = value as Partial<CertificadoPreservado>
    const snapshot = metadata.preservacao
    if (!snapshot || snapshot.motivo !== 'EXCLUSAO_EVENTO' || snapshot.inscricaoConfirmada !== true || typeof snapshot.eventoId !== 'string' || typeof snapshot.alunoId !== 'string' || typeof metadata.nomeAluno !== 'string' || typeof metadata.nomeEvento !== 'string') return null
    return metadata as CertificadoPreservado
}
