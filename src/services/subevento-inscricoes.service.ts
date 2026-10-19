import prisma from '@/lib/db'
import { AppError } from '@/lib/app-error'
import { comLockFinanceiro } from '@/lib/financeiro-lock'

const alunoSelect = { id: true, nome: true, email: true } as const

export class SubeventoInscricoesService {
    async listar(subeventoId: string) {
        const subevento = await prisma.subevento.findUnique({
            where: { id: subeventoId },
            select: { id: true, nome: true, eventoId: true, totalVagas: true, evento: { select: { nome: true, limiteSubeventosPorAluno: true } } },
        })
        if (!subevento) throw new AppError('Subevento não encontrado', 404)

        const [inscritos, candidatos] = await Promise.all([
            prisma.inscricaoSubevento.findMany({
                where: { subeventoId },
                select: { id: true, inscricaoId: true, dataInscricao: true, checkIn: { select: { dataHora: true } }, inscricao: { select: { status: true, aluno: { select: alunoSelect } } } },
                orderBy: { inscricao: { aluno: { nome: 'asc' } } },
            }),
            prisma.inscricao.findMany({
                where: {
                    eventoId: subevento.eventoId, status: 'CONFIRMADA',
                    subeventosEscolhidos: { none: { subeventoId } },
                },
                select: { id: true, aluno: { select: alunoSelect }, _count: { select: { subeventosEscolhidos: true } } },
                orderBy: { aluno: { nome: 'asc' } },
            }),
        ])
        return { subevento, inscritos, candidatos }
    }

    async adicionar(subeventoId: string, inscricaoId: string) {
        const inicial = await prisma.subevento.findUnique({ where: { id: subeventoId }, select: { eventoId: true } })
        if (!inicial) throw new AppError('Subevento não encontrado', 404)

        // Mesmo lock usado na seleção do aluno e na exclusão da inscrição principal.
        return comLockFinanceiro(inicial.eventoId, async db => {
            const subevento = await db.subevento.findUnique({ where: { id: subeventoId }, include: { evento: true } })
            if (!subevento) throw new AppError('Subevento não encontrado', 404)
            const inscricao = await db.inscricao.findUnique({ where: { id: inscricaoId } })
            if (!inscricao || inscricao.eventoId !== subevento.eventoId) throw new AppError('Aluno não inscrito no evento principal', 400)
            if (inscricao.status !== 'CONFIRMADA') throw new AppError('A inscrição no evento principal precisa estar confirmada', 400)
            if (!subevento.evento.temSubeventos) throw new AppError('Este evento não possui subeventos', 400)
            if (await db.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId } }) ||
                await db.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId } })) {
                throw new AppError('Esta inscrição possui uma exclusão ou reembolso registrado', 409)
            }
            const existente = await db.inscricaoSubevento.findUnique({ where: { inscricaoId_subeventoId: { inscricaoId, subeventoId } } })
            if (existente) throw new AppError('Aluno já inscrito neste subevento', 409)
            const ocupadas = await db.inscricaoSubevento.count({ where: { subeventoId } })
            if (ocupadas >= subevento.totalVagas) throw new AppError('Vagas esgotadas para este subevento', 409)
            const limite = subevento.evento.limiteSubeventosPorAluno
            if (limite && await db.inscricaoSubevento.count({ where: { inscricaoId } }) >= limite) {
                throw new AppError(`O aluno atingiu o limite de ${limite} subevento(s)`, 409)
            }
            return db.inscricaoSubevento.create({ data: { inscricaoId, subeventoId } })
        })
    }

    async remover(subeventoId: string, inscricaoId: string) {
        const inicial = await prisma.subevento.findUnique({ where: { id: subeventoId }, select: { eventoId: true } })
        if (!inicial) throw new AppError('Subevento não encontrado', 404)
        return comLockFinanceiro(inicial.eventoId, async db => {
            const vinculo = await db.inscricaoSubevento.findUnique({ where: { inscricaoId_subeventoId: { inscricaoId, subeventoId } } })
            if (!vinculo) throw new AppError('Aluno não inscrito neste subevento', 404)
            // Apagar a presença antes do vínculo também funciona no banco MyISAM.
            await db.checkIn.deleteMany({ where: { inscricaoSubeventoId: vinculo.id } })
            await db.inscricaoSubevento.delete({ where: { id: vinculo.id } })
            return { removed: true }
        })
    }
}
