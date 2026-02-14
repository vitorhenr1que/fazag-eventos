import prisma from '@/lib/db'
import { InscricaoRepository } from '@/repositories/inscricao.repository'
import { EventoRepository } from '@/repositories/evento.repository'
import { AppError } from '@/lib/app-error'

const inscricaoRepo = new InscricaoRepository()
const eventoRepo = new EventoRepository()

export class InscricaoService {

    async realizarInscricao(alunoId: string, eventoId: string) {
        // 1. Validar disponibilidade
        const evento = await eventoRepo.findById(eventoId)
        if (!evento) throw new AppError('Evento não encontrado', 404)
        if (evento.status !== 'PUBLISHED') throw new AppError('Evento não está aceitando inscrições')

        // Contagem de vagas (Apenas inscrições CONFIRMADAS contam)
        const ocupadas = (evento as any)._count?.inscricoes || 0
        if (ocupadas >= evento.totalVagas && evento.tipo !== 'PAGO') {
            throw new AppError('Vagas esgotadas', 400)
        }

        // 2. Verificar duplicidade
        const jaInscrito = await inscricaoRepo.findByAlunoAndEvento(alunoId, eventoId)
        if (jaInscrito) throw new AppError('Aluno já inscrito neste evento', 400)

        // 3. Criar inscrição
        const status = evento.tipo === 'PAGO' ? 'PENDENTE' : 'CONFIRMADA'

        return inscricaoRepo.create({
            aluno: { connect: { id: alunoId } },
            evento: { connect: { id: eventoId } },
            status: status
        } as any)
    }

    async selecionarSubeventos(inscricaoId: string, subeventoIds: string[]) {
        // Transação para garantir consistência
        return prisma.$transaction(async (tx) => {
            const inscricao = await inscricaoRepo.findById(inscricaoId) as any
            if (!inscricao) throw new AppError('Inscrição não encontrada', 404)

            if (inscricao.status !== 'CONFIRMADA') {
                throw new AppError('Sua inscrição precisa ser confirmada para selecionar subeventos', 400)
            }

            if (!inscricao.evento.temSubeventos) {
                throw new AppError('Este evento não possui subeventos', 400)
            }

            if (inscricao.evento.limiteSubeventosPorAluno && subeventoIds.length > inscricao.evento.limiteSubeventosPorAluno) {
                throw new AppError(`Limite de subeventos excedido (Máx: ${inscricao.evento.limiteSubeventosPorAluno})`)
            }

            const subeventosValidos = (inscricao.evento.subeventos as any[]).filter((s: any) => subeventoIds.includes(s.id))

            if (subeventosValidos.length !== subeventoIds.length) {
                throw new AppError('Um ou mais subeventos inválidos ou de outro evento')
            }

            // --- LÓGICA DE SINCRONIZAÇÃO ---
            const selecionadosAtualmente = inscricao.subeventosEscolhidos as any[]
            const idsAtuais = selecionadosAtualmente.map(s => s.subeventoId)

            const idsParaAdicionar = subeventoIds.filter(id => !idsAtuais.includes(id))
            const idsParaRemover = idsAtuais.filter(id => !subeventoIds.includes(id))

            // 1. Validar se algum que será removido já existia (Bloquear remoção após confirmar)
            if (idsParaRemover.length > 0) {
                const subeventosRemovidos = selecionadosAtualmente.filter(s => idsParaRemover.includes(s.subeventoId))
                throw new AppError(`Não é possível remover atividades já confirmadas: ${subeventosRemovidos.map(s => s.subevento.nome).join(', ')}`)
            }

            // 2. Remover desmarcados
            if (idsParaRemover.length > 0) {
                await tx.inscricaoSubevento.deleteMany({
                    where: {
                        inscricaoId,
                        subeventoId: { in: idsParaRemover }
                    }
                })
            }

            // 3. Adicionar novos (Validando vagas)
            if (idsParaAdicionar.length > 0) {
                for (const sub of subeventosValidos.filter((s: any) => idsParaAdicionar.includes(s.id))) {
                    const ocupados = await tx.inscricaoSubevento.count({
                        where: { subeventoId: sub.id }
                    })

                    if (ocupados >= sub.totalVagas) {
                        throw new AppError(`Vagas esgotadas para a atividade: ${sub.nome}`)
                    }
                }

                await tx.inscricaoSubevento.createMany({
                    data: idsParaAdicionar.map(sid => ({
                        inscricaoId,
                        subeventoId: sid
                    }))
                })
            }

            return { success: true, added: idsParaAdicionar.length, removed: idsParaRemover.length }
        })
    }

    async checkInAluno(alunoId: string, inscricaoId: string) {
        const inscricao = await inscricaoRepo.findById(inscricaoId) as any
        if (!inscricao) throw new AppError('Inscrição não encontrada', 404)
        if (inscricao.alunoId !== alunoId) throw new AppError('Acesso negado', 403)
        if (inscricao.status !== 'CONFIRMADA') throw new AppError('Inscrição não está confirmada (Pagamento pendente?)', 400)

        // Validar Janela de Tempo
        const agora = new Date()
        const inicio = new Date(inscricao.evento.dataInicio)

        const trintaMinAntes = new Date(inicio.getTime() - 30 * 60000)
        const umaHoraETreintaDepois = new Date(inicio.getTime() + 90 * 60000)

        if (agora < trintaMinAntes) {
            throw new AppError('Check-in ainda não disponível. Abre 30 min antes do evento.')
        }
        if (agora > umaHoraETreintaDepois) {
            throw new AppError('Período de check-in encerrado (Limite: 1h30 após o início).')
        }

        try {
            return await inscricaoRepo.checkInEvento(inscricaoId)
        } catch (e: any) {
            if (e.code === 'P2002') return { message: 'Check-in já realizado' }
            throw e
        }
    }

    async checkIn(tipo: 'EVENTO' | 'SUBEVENTO', idRef: string) {
        if (tipo === 'EVENTO') {
            try {
                return await inscricaoRepo.checkInEvento(idRef)
            } catch (e: any) {
                if (e.code === 'P2002') return { message: 'Check-in já realizado' }
                throw e
            }
        } else {
            throw new AppError('Use o método checkInSubevento especifico com inscricaoId')
        }
    }

    async realizarCheckInSubevento(inscricaoId: string, subeventoId: string, ignoreTimeWindow = false) {
        const relacao = await prisma.inscricaoSubevento.findUnique({
            where: { inscricaoId_subeventoId: { inscricaoId, subeventoId } },
            include: { subevento: true } as any
        }) as any

        if (!relacao) throw new AppError('Aluno não inscrito neste subevento', 404)

        // Validar Janela de Tempo do Subevento (Pula se for Admin/Manual)
        if (!ignoreTimeWindow) {
            const agora = new Date()
            const inicio = new Date(relacao.subevento.dataInicio)

            const trintaMinAntes = new Date(inicio.getTime() - 30 * 60000)
            const umaHoraETreintaDepois = new Date(inicio.getTime() + 90 * 60000)

            if (agora < trintaMinAntes) {
                throw new AppError(`Check-in para "${relacao.subevento.nome}" ainda não disponível.`)
            }
            if (agora > umaHoraETreintaDepois) {
                throw new AppError(`Período de check-in para "${relacao.subevento.nome}" encerrado.`)
            }
        }

        try {
            return await inscricaoRepo.checkInSubevento(relacao.id)
        } catch (e: any) {
            if (e.code === 'P2002') return { message: 'Check-in já realizado' }
            throw e
        }
    }

    async emitirCertificado(inscricaoId: string) {
        const inscricao = await inscricaoRepo.findById(inscricaoId) as any
        if (!inscricao) throw new AppError('Inscrição não encontrada', 404)

        // Verificar configuração do certificado
        const configCert = inscricao.evento.certificado
        if (!configCert || !configCert.ativo) {
            throw new AppError('A emissão de certificados para este evento não está aberta ou configurada.', 400)
        }

        // Verificar se já tem certificado
        if (inscricao.certificado) return inscricao.certificado

        // Verificar se evento terminou (Opcional: permitir emissão antecipada se for manual, mas aqui é automático)
        if (new Date() < new Date(inscricao.evento.dataFim)) {
            throw new AppError('O certificado só pode ser gerado após o término do evento', 400)
        }

        let cargaHoraria = 0
        let apto = false

        // Regra 1: Evento sem subeventos
        if (!inscricao.evento.temSubeventos) {
            // Exige check-in no evento pai
            if (!inscricao.checkIn) throw new AppError('Presença não confirmada no evento (Check-in obrigatório)')
            cargaHoraria = inscricao.evento.cargaHorariaBase || 0
            apto = true
        }
        // Regra 2: Evento com subeventos
        else {
            // Exige pelo menos 1 subevento com check-in
            const subeventosComPresenca = (inscricao.subeventosEscolhidos as any[]).filter((s: any) => s.checkIn)
            if (subeventosComPresenca.length === 0) throw new AppError('Nenhum check-in registrado nas atividades deste evento')

            cargaHoraria = subeventosComPresenca.reduce((acc: number, curr: any) => acc + curr.subevento.cargaHoraria, 0)
            apto = true
        }

        if (cargaHoraria === 0) throw new AppError('Carga horária insuficiente para certificação')

        const codigoValidacao = Math.random().toString(36).substring(2, 10).toUpperCase()

        const metadados = {
            nomeEvento: inscricao.evento.nome,
            nomeAluno: inscricao.aluno.nome,
            dataInicio: inscricao.evento.dataInicio,
            cargaHoraria: cargaHoraria,
            fundoUrl: configCert.fundoUrl,
            template: configCert.template,
            subeventos: (inscricao.subeventosEscolhidos as any[]).filter((s: any) => s.checkIn).map((s: any) => s.subevento.nome)
        }

        return prisma.certificado.create({
            data: {
                inscricaoId,
                codigoValidacao,
                cargaHorariaTotal: cargaHoraria,
                metadadosEvento: metadados as any,
            }
        })
    }

    async adminEmitirCertificado(inscricaoId: string, customCargaHoraria?: number) {
        const inscricao = await inscricaoRepo.findById(inscricaoId) as any
        if (!inscricao) throw new AppError('Inscrição não encontrada', 404)

        const configCert = inscricao.evento.certificado
        const existente = await prisma.certificado.findUnique({ where: { inscricaoId } })

        let cargaHoraria = customCargaHoraria ?? 0

        if (customCargaHoraria === undefined) {
            if (!inscricao.evento.temSubeventos) {
                cargaHoraria = inscricao.evento.cargaHorariaBase || 0
            } else {
                const subeventosComPresenca = (inscricao.subeventosEscolhidos as any[]).filter((s: any) => s.checkIn)
                cargaHoraria = subeventosComPresenca.reduce((acc: number, curr: any) => acc + curr.subevento.cargaHoraria, 0)
            }
        }

        const codigoValidacao = existente?.codigoValidacao || Math.random().toString(36).substring(2, 10).toUpperCase()

        const metadados = {
            nomeEvento: inscricao.evento.nome,
            nomeAluno: inscricao.aluno.nome,
            dataInicio: inscricao.evento.dataInicio,
            cargaHoraria: cargaHoraria,
            fundoUrl: configCert?.fundoUrl,
            template: configCert?.template,
            subeventos: (inscricao.subeventosEscolhidos as any[]).filter((s: any) => s.checkIn || !inscricao.evento.temSubeventos).map((s: any) => s.subevento.nome)
        }

        if (existente) {
            return prisma.certificado.update({
                where: { id: existente.id },
                data: {
                    cargaHorariaTotal: cargaHoraria,
                    metadadosEvento: metadados as any
                }
            })
        }

        return prisma.certificado.create({
            data: {
                inscricaoId,
                codigoValidacao,
                cargaHorariaTotal: cargaHoraria,
                metadadosEvento: metadados as any,
            }
        })
    }

    async aprovarInscricao(inscricaoId: string) {
        const inscricao = await inscricaoRepo.findById(inscricaoId) as any
        if (!inscricao) throw new AppError('Inscrição não encontrada', 404)

        if (inscricao.status !== 'PENDENTE') {
            throw new AppError('Esta inscrição não está pendente de aprovação')
        }

        // Verificar se ainda há vagas disponíveis no momento da aprovação
        const evento = await prisma.evento.findUnique({
            where: { id: inscricao.eventoId },
            include: { _count: { select: { inscricoes: { where: { status: 'CONFIRMADA' } } } } } as any
        }) as any

        if (evento && (evento._count.inscricoes >= evento.totalVagas)) {
            throw new AppError('Não é possível aprovar: Vagas esgotadas para este evento', 400)
        }

        return prisma.inscricao.update({
            where: { id: inscricaoId },
            data: { status: 'CONFIRMADA' }
        })
    }
}
