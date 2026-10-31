import prisma from './db'
import { AppError } from './app-error'
import type { z } from 'zod'
import type { adminUserSchema } from './admin-user-schema'

export const adminUserSelect = { id: true, nome: true, email: true, role: true, ativo: true, permissoes: true, createdAt: true } as const
export async function validateUserEvents(data: z.infer<typeof adminUserSchema>) {
    const ids = Array.from(new Set(data.permissoes?.eventoIds || []))
    if (ids.length && await prisma.evento.count({ where: { id: { in: ids } } }) !== ids.length) throw new AppError('Um dos eventos selecionados não existe.', 400)
}
export function userWriteError(error: unknown): never {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') throw new AppError('Já existe um usuário com este e-mail.', 409)
    throw error
}
