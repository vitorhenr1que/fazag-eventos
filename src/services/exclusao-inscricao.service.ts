import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { AppError } from '@/lib/app-error'
import type { ExclusaoInscricao } from '@/lib/exclusao-inscricao'
import { FinanceiroService } from './financeiro.service'

export class ExclusaoInscricaoService {
    async excluir(inscricaoId: string, dados: ExclusaoInscricao, adminId: string) {
        if (dados.modalidade === 'REEMBOLSO') {
            return new FinanceiroService().realizarAcao(inscricaoId, { acao: 'REEMBOLSO', motivo: dados.motivo, valorHistorico: dados.valorHistorico }, adminId)
        }
        const inicial = await prisma.inscricao.findUnique({ where: { id: inscricaoId } })
        const historico = await prisma.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
        const eventoId = inicial?.eventoId ?? historico?.eventoId
        if (!eventoId) throw new AppError('Inscrição não encontrada', 404)
        return prisma.$transaction(async tx => {
            const lockName = `financeiro:${eventoId}`
            const locks = await tx.$queryRaw<{ adquirido: number | bigint | null }[]>`SELECT GET_LOCK(${lockName}, 10) AS adquirido`
            if (Number(locks[0]?.adquirido) !== 1) throw new AppError('Outra operação está em andamento. Tente novamente.', 409)
            try {
                if (await tx.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId } })) throw new AppError('Esta inscrição possui um reembolso registrado. Conclua o reembolso no financeiro.', 409)
                const existente = await tx.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
                if (existente && existente.modalidade !== dados.modalidade) throw new AppError('A exclusão já foi iniciada com outra opção. Conclua a opção original.', 409)
                if (existente?.estado === 'CONCLUIDO') return existente
                const inscricao = await tx.inscricao.findUnique({ where: { id: inscricaoId }, include: { aluno: true, evento: { select: { tipo: true } } } })
                if (!existente && !inscricao) throw new AppError('Inscrição não encontrada', 404)
                const manter = dados.modalidade === 'MANTER_PAGAMENTO'
                if (!existente && manter && (inscricao!.status !== 'CONFIRMADA' || inscricao!.situacaoFinanceira === 'GRATUITO' || (!inscricao!.situacaoFinanceira && inscricao!.evento.tipo !== 'PAGO'))) {
                    throw new AppError('Esta inscrição não possui pagamento ou isenção confirmado para manter', 409)
                }
                // Arquivar antes de excluir: o banco existente usa MyISAM e não oferece rollback.
                const registro = existente ?? await tx.exclusaoInscricao.create({ data: {
                    inscricaoOriginalId: inscricaoId, eventoId, alunoId: inscricao!.alunoId,
                    alunoNome: inscricao!.aluno.nome, alunoEmail: inscricao!.aluno.email,
                    modalidade: dados.modalidade, excluidoPor: adminId, motivo: dados.motivo || null,
                    dataInscricao: inscricao!.dataInscricao,
                    ...(manter ? { valorReferencia: inscricao!.valorReferencia, valorPago: inscricao!.valorPago,
                        valorDesconto: inscricao!.valorDesconto, situacaoFinanceira: inscricao!.situacaoFinanceira,
                        dataPagamento: inscricao!.dataPagamento, aprovadoPor: inscricao!.aprovadoPor,
                        observacaoFinanceira: inscricao!.observacaoFinanceira } : {}),
                } })
                const subeventos = await tx.inscricaoSubevento.findMany({ where: { inscricaoId }, select: { id: true } })
                await tx.checkIn.deleteMany({ where: { OR: [{ inscricaoId }, { inscricaoSubeventoId: { in: subeventos.map(s => s.id) } }] } })
                await tx.certificado.deleteMany({ where: { inscricaoId } })
                await tx.inscricaoSubevento.deleteMany({ where: { inscricaoId } })
                await tx.inscricao.deleteMany({ where: { id: inscricaoId } })
                return await tx.exclusaoInscricao.update({ where: { id: registro.id }, data: { estado: 'CONCLUIDO' } })
            } finally { await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})` }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20000 })
    }
}
