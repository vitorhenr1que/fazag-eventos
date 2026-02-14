import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

export class InscricaoRepository {
    async findByAlunoAndEvento(alunoId: string, eventoId: string) {
        return prisma.inscricao.findUnique({
            where: { eventoId_alunoId: { eventoId, alunoId } },
            include: { subeventosEscolhidos: true, evento: true }
        })
    }

    async findById(id: string) {
        return prisma.inscricao.findUnique({
            where: { id },
            include: {
                evento: {
                    include: {
                        subeventos: {
                            include: {
                                _count: {
                                    select: { inscricoesSubevento: true }
                                }
                            }
                        }
                    }
                },
                subeventosEscolhidos: { include: { subevento: true, checkIn: true } },
                checkIn: true,
                certificado: true,
                aluno: true
            } as any
        })
    }

    async create(data: Prisma.InscricaoCreateInput, tx: Prisma.TransactionClient = prisma) {
        return tx.inscricao.create({ data })
    }

    async listByAluno(alunoId: string) {
        return prisma.inscricao.findMany({
            where: { alunoId },
            include: {
                evento: true,
                certificado: true,
                checkIn: true,
                subeventosEscolhidos: { include: { checkIn: true, subevento: true } }
            },
            orderBy: { dataInscricao: 'desc' }
        })
    }

    // Métodos de Subeventos
    async addSubeventos(inscricaoId: string, subeventoIds: string[], tx: Prisma.TransactionClient = prisma) {
        // Cria múltiplos registros de inscrição em subevento
        // Prisma createMany não retorna os objetos criados em todos os DBs, mas MySQL suporta.
        // Porém, para garantir integridade e retornos, vamos fazer map. 
        // Ou createMany se não precisarmos do retorno imediato.
        // Melhor fazer loop ou createMany.

        // CUIDADO: createMany ignora conflitos se usar skipDuplicates, mas queremos erro se duplicar.
        // Vamos usar createMany.
        return tx.inscricaoSubevento.createMany({
            data: subeventoIds.map(sid => ({
                inscricaoId,
                subeventoId: sid
            }))
        })
    }

    async checkInEvento(inscricaoId: string) {
        return prisma.checkIn.create({
            data: { inscricaoId }
        })
    }

    async checkInSubevento(inscricaoSubeventoId: string) {
        return prisma.checkIn.create({
            data: { inscricaoSubeventoId }
        })
    }

    async findInscricaoSubevento(inscricaoId: string, subeventoId: string) {
        return prisma.inscricaoSubevento.findUnique({
            where: { inscricaoId_subeventoId: { inscricaoId, subeventoId } }
        })
    }
}
