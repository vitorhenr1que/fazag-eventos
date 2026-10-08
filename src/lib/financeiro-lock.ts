import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { AppError } from './app-error'

// GET_LOCK é da conexão, não da transação, e protege também as tabelas MyISAM.
// Uma conexão mantém o lock enquanto as operações usam autocommit no pool.
// Cada instrução termina seu commit antes da liberação; assim não há janela entre
// RELEASE_LOCK e COMMIT nem rollback de históricos InnoDB após excluir dados MyISAM.
// A transação externa apenas reserva a conexão do lock. O pool precisa de >= 2 conexões.
// Esperas pelo mesmo evento não devem consumir todas as conexões do pool local.
// A exclusão mútua entre processos continua sendo garantida pelo GET_LOCK no MySQL.
const filas = new Map<string, Promise<void>>()

export async function comLockFinanceiro<T>(eventoId: string, operacao: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const anterior = filas.get(eventoId) ?? Promise.resolve()
    let liberarFila!: () => void
    const atual = new Promise<void>(resolve => { liberarFila = resolve })
    filas.set(eventoId, atual)
    await anterior
    try {
        return await prisma.$transaction(async conexaoLock => {
            const lockName = `financeiro:${eventoId}`
            const locks = await conexaoLock.$queryRaw<{ adquirido: number | bigint | null }[]>`SELECT GET_LOCK(${lockName}, 10) AS adquirido`
            if (Number(locks[0]?.adquirido) !== 1) throw new AppError('Outra operação financeira está em andamento. Tente novamente.', 409)
            try {
                return await operacao(prisma)
            } finally { await conexaoLock.$queryRaw`SELECT RELEASE_LOCK(${lockName})` }
        }, { timeout: 35000 })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2028', 'P2024'].includes(error.code)) {
            throw new AppError('Operação financeira indisponível no momento. Tente novamente.', 409, 'FINANCEIRO_OCUPADO')
        }
        throw error
    } finally {
        liberarFila()
        if (filas.get(eventoId) === atual) filas.delete(eventoId)
    }
}
