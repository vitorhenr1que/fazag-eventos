import { z } from 'zod'

export const chavePixSchema = z.string()
    .trim()
    .max(255, 'A chave Pix deve ter no máximo 255 caracteres')
    .nullable()
    .optional()
    .transform(value => value === undefined ? undefined : value || null)

