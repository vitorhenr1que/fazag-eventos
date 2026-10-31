import { z } from 'zod'

export const adminCheckinSchema = z.object({
    tipo: z.enum(['EVENTO', 'SUBEVENTO']).default('EVENTO'),
    subeventoId: z.string().min(1).max(25).optional(),
}).strict().superRefine((data, ctx) => {
    if (data.tipo === 'SUBEVENTO' && !data.subeventoId) ctx.addIssue({ code: 'custom', path: ['subeventoId'], message: 'Informe o subevento para fazer check-in.' })
})
