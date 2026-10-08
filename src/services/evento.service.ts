import prisma from '@/lib/db'
import { EventoRepository, SubeventoRepository } from '@/repositories/evento.repository'

import { AppError } from '@/lib/app-error'
import { chavePixSchema } from '@/lib/evento-pagamento'

const eventRepo = new EventoRepository()
const subEventRepo = new SubeventoRepository()

export class EventoService {
    async listarDisponiveis() {
        const eventos = await eventRepo.findAllPublished()
        return eventos
    }

    async obterDetalhes(id: string) {
        const evento = await eventRepo.findById(id)
        if (!evento) throw new AppError('Evento não encontrado', 404)
        return evento
    }

    // Admin methods
    async criarEvento(data: any) {
        if (new Date(data.dataInicio) >= new Date(data.dataFim)) {
            throw new AppError('A data de início deve ser anterior à data de término', 400)
        }
        return eventRepo.create({
            ...data,
            chavePix: data.tipo === 'PAGO' ? chavePixSchema.parse(data.chavePix) ?? null : null
        })
    }

    async atualizarEvento(id: string, data: any) {
        if (data.dataInicio && data.dataFim && new Date(data.dataInicio) >= new Date(data.dataFim)) {
            throw new AppError('A data de início deve ser anterior à data de término', 400)
        }
        const eventData = { ...data }
        if (data.chavePix !== undefined) {
            eventData.chavePix = chavePixSchema.parse(data.chavePix)
        }
        if (data.tipo === 'GRATUITO') {
            eventData.chavePix = null
        }
        return eventRepo.update(id, eventData)
    }

    async adicionarSubevento(eventoId: string, data: any) {
        if (new Date(data.dataInicio) >= new Date(data.dataFim)) {
            throw new AppError('A data de início deve ser anterior à data de término', 400)
        }
        return subEventRepo.create({
            ...data,
            evento: { connect: { id: eventoId } }
        })
    }

    async atualizarSubevento(id: string, data: any) {
        if (data.dataInicio && data.dataFim && new Date(data.dataInicio) >= new Date(data.dataFim)) {
            throw new AppError('A data de início deve ser anterior à data de término', 400)
        }
        return subEventRepo.update(id, data)
    }
}
