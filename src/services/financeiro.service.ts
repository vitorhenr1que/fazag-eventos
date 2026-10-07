import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { AppError } from '@/lib/app-error'
import { valorDoReembolso, type AcaoFinanceira } from '@/lib/financeiro'

export class FinanceiroService {
    async realizarAcao(inscricaoId: string, dados: AcaoFinanceira, adminId: string) {
        const inscricaoInicial = await prisma.inscricao.findUnique({ where: { id: inscricaoId } })
        const reembolsoInicial = await prisma.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
        const eventoId = inscricaoInicial?.eventoId ?? reembolsoInicial?.eventoId
        if (!eventoId) throw new AppError('Inscrição não encontrada', 404)

        return prisma.$transaction(async tx => {
            const lockName = `financeiro:${eventoId}`
            const locks = await tx.$queryRaw<{ adquirido: number | bigint | null }[]>`SELECT GET_LOCK(${lockName}, 10) AS adquirido`
            if (Number(locks[0]?.adquirido) !== 1) throw new AppError('Outra operação está em andamento. Tente novamente.', 409)
            try {
                if (await tx.exclusaoInscricao.findUnique({ where: { inscricaoOriginalId: inscricaoId } })) throw new AppError('Esta inscrição possui uma exclusão registrada. Conclua a exclusão na lista de inscritos.', 409)
                const existente = await tx.reembolso.findUnique({ where: { inscricaoOriginalId: inscricaoId } })
                if (existente && dados.acao !== 'REEMBOLSO') throw new AppError('Esta inscrição possui um reembolso registrado', 409)
                if (existente?.estado === 'CONCLUIDO') return { acao: 'REEMBOLSO', reembolso: existente }
                const inscricao = await tx.inscricao.findUnique({ where: { id: inscricaoId }, include: { aluno: true, evento: { select: { tipo: true } } } })
                if (!existente) {
                    if (!inscricao) throw new AppError('Inscrição não encontrada', 404)
                    if (inscricao.status !== 'CONFIRMADA') throw new AppError('Somente inscrições confirmadas podem ser canceladas ou reembolsadas', 409)
                    if (inscricao.situacaoFinanceira === 'GRATUITO') throw new AppError('Esta inscrição é gratuita e não possui pagamento')
                    if (!inscricao.situacaoFinanceira && inscricao.evento.tipo !== 'PAGO') throw new AppError('Esta inscrição não possui pagamento registrado')
                }
                if (dados.acao === 'CANCELAMENTO' && inscricao) {
                    // Uma única atualização é atômica também nas tabelas MyISAM existentes.
                    await tx.inscricao.update({ where: { id: inscricaoId }, data: {
                        status: 'PENDENTE', situacaoFinanceira: 'PENDENTE', valorPago: null, valorDesconto: null,
                        dataPagamento: null, aprovadoPor: null, observacaoFinanceira: null,
                    } })
                    return { acao: 'CANCELAMENTO' }
                }

                // Salvar o histórico antes da exclusão permite retomar falhas em bancos sem rollback (MyISAM).
                const reembolso = existente ?? await tx.reembolso.create({ data: {
                    inscricaoOriginalId: inscricaoId, eventoId, alunoId: inscricao!.alunoId,
                    alunoNome: inscricao!.aluno.nome, alunoEmail: inscricao!.aluno.email,
                    valorReferencia: inscricao!.valorReferencia,
                    valorPago: valorDoReembolso(inscricao!.valorPago === null ? null : Number(inscricao!.valorPago), dados.valorHistorico),
                    valorDesconto: inscricao!.valorDesconto, modalidadeOriginal: inscricao!.situacaoFinanceira || 'SEM_REGISTRO',
                    dataInscricao: inscricao!.dataInscricao, dataPagamento: inscricao!.dataPagamento,
                    aprovadoPor: inscricao!.aprovadoPor, observacaoPagamento: inscricao!.observacaoFinanceira,
                    reembolsadoPor: adminId, motivo: dados.motivo || null,
                } })
                const subeventos = await tx.inscricaoSubevento.findMany({ where: { inscricaoId }, select: { id: true } })
                await tx.checkIn.deleteMany({ where: { OR: [
                    { inscricaoId }, { inscricaoSubeventoId: { in: subeventos.map(s => s.id) } },
                ] } })
                await tx.certificado.deleteMany({ where: { inscricaoId } })
                await tx.inscricaoSubevento.deleteMany({ where: { inscricaoId } })
                await tx.inscricao.deleteMany({ where: { id: inscricaoId } })
                const concluido = await tx.reembolso.update({ where: { id: reembolso.id }, data: { estado: 'CONCLUIDO' } })
                return { acao: 'REEMBOLSO', reembolso: concluido }
            } finally {
                await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20000 })
    }
}
