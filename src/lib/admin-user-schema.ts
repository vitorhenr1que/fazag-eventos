import { z } from 'zod'

export const userPermissionsSchema = z.object({
    areas: z.array(z.enum(['dashboard', 'eventos', 'financeiro', 'pendentes', 'tiposAtividade'])).max(5),
    eventos: z.enum(['TODOS', 'PUBLICADOS', 'ESPECIFICOS']),
    eventoIds: z.array(z.string().min(1).max(25)).max(500),
    acesso: z.enum(['VISUALIZAR', 'EDITAR', 'PERSONALIZAR']),
    acoes: z.array(z.enum(['CHECKIN_SUBEVENTO', 'REMOVER_CHECKIN_SUBEVENTO', 'LIBERAR_CERTIFICADO', 'EXCLUIR_CERTIFICADO', 'CHECKIN_GERAL', 'REMOVER_CHECKIN_GERAL', 'EXCLUIR_INSCRICAO'])).max(7).optional(),
}).strict().superRefine((data, ctx) => {
    if (data.eventos === 'ESPECIFICOS' && !data.eventoIds.length) ctx.addIssue({ code: 'custom', path: ['eventoIds'], message: 'Selecione ao menos um evento.' })
})
export const adminUserSchema = z.object({
    nome: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(190),
    senha: z.string().min(8).max(72).optional(),
    role: z.enum(['ADMIN', 'SUPER_ADMIN', 'NUPPEX', 'FINANCEIRO']),
    ativo: z.boolean(),
    permissoes: userPermissionsSchema.nullable(),
}).strict().superRefine((data, ctx) => {
    if (['ADMIN', 'SUPER_ADMIN'].includes(data.role) && data.permissoes) ctx.addIssue({ code: 'custom', path: ['role'], message: 'Administradores têm acesso completo. Use um perfil personalizado para restringir o acesso.' })
})
