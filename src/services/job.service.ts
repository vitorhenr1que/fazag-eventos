import prisma from '@/lib/db'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export class JobService {
    /**
     * Finaliza eventos que já passaram da data de término no horário de Brasília
     * Regra: status = PUBLISHED AND dataFim <= now (UTC)
     */
    async expireEventos() {
        const timeZone = 'America/Sao_Paulo'

        // 1. Obter o "agora" no fuso de Brasília (independente do fuso do servidor)
        const now = new Date()
        const nowInBr = toZonedTime(now, timeZone)

        // 2. Converter esse "agora" de Brasília para UTC para comparar com o banco
        // Isso garante que estamos usando o ponto no tempo correto baseado no fuso SP
        const nowUtc = fromZonedTime(nowInBr, timeZone)

        // No Prisma, ao passar um objeto Date, ele é tratado como UTC.
        // O MySQL + Prisma armazena DateTime em UTC, então a comparação é direta.
        const result = await prisma.evento.updateMany({
            where: {
                status: 'PUBLISHED',
                dataFim: {
                    lte: nowUtc
                }
            },
            data: {
                status: 'FINISHED'
            }
        })

        return {
            updatedCount: result.count,
            nowUtc: nowUtc.toISOString(),
            nowBr: nowInBr.toISOString(),
            timeZone
        }
    }
}
