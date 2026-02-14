import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

export class EventoRepository {
    async findAllPublished() {
        return prisma.evento.findMany({
            where: {
                status: 'PUBLISHED'
            },
            include: {
                subeventos: true,
                _count: {
                    select: {
                        inscricoes: {
                            where: { status: 'CONFIRMADA' }
                        }
                    }
                }
            },
            orderBy: { dataInicio: 'asc' }
        })
    }

    async findById(id: string) {
        return prisma.evento.findUnique({
            where: { id },
            include: {
                subeventos: true,
                certificado: true,
                _count: {
                    select: {
                        inscricoes: {
                            where: { status: 'CONFIRMADA' }
                        }
                    }
                }
            } as any,
        })
    }

    async create(data: any) {
        const { certificado, ...eventData } = data

        return prisma.$transaction(async (tx) => {
            const evento = await tx.evento.create({
                data: eventData
            })

            if (certificado) {
                await tx.certificado.create({
                    data: {
                        ...certificado,
                        eventoId: evento.id
                    }
                })
            }

            return tx.evento.findUnique({
                where: { id: evento.id },
                include: { certificado: true }
            })
        })
    }

    async update(id: string, data: any) {
        // Remover campos que não devem ser atualizados diretamente ou que são relações carregadas
        const {
            id: _id,
            createdAt,
            updatedAt,
            subeventos,
            inscricoes,
            _count,
            certificado,
            ...eventData
        } = data

        return prisma.$transaction(async (tx) => {
            // Se houver dados de certificado, faz o upsert separadamente para evitar erros de validação
            // caso o cliente Prisma esteja com cache de tipos antigo.
            if (certificado) {
                await tx.certificado.upsert({
                    where: { eventoId: id },
                    create: {
                        ...certificado,
                        eventoId: id
                    },
                    update: certificado
                })
            }

            return tx.evento.update({
                where: { id },
                data: {
                    ...eventData
                },
                include: { certificado: true }
            })
        })
    }
}

export class SubeventoRepository {
    async create(data: Prisma.SubeventoCreateInput) {
        return prisma.subevento.create({ data })
    }

    async update(id: string, data: Prisma.SubeventoUpdateInput) {
        return prisma.subevento.update({ where: { id }, data })
    }
}
