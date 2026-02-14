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
                _count: {
                    select: {
                        inscricoes: {
                            where: { status: 'CONFIRMADA' }
                        }
                    }
                }
            },
        })
    }

    async create(data: Prisma.EventoCreateInput) {
        return prisma.evento.create({ data })
    }

    async update(id: string, data: Prisma.EventoUpdateInput) {
        return prisma.evento.update({ where: { id }, data })
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
