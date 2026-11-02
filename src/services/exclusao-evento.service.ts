import prisma from '@/lib/db'
import { AppError } from '@/lib/app-error'
import { comLockFinanceiro } from '@/lib/financeiro-lock'
import { userPermissionsSchema } from '@/lib/admin-user-schema'

export class ExclusaoEventoService {
    async resumo(eventoId: string) {
        const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, nome: true } })
        const iniciada = await prisma.exclusaoEvento.findUnique({ where: { eventoId } })
        if (!evento && !iniciada) throw new AppError('Evento não encontrado', 404)
        const [subeventos, inscricoes, certificados] = await Promise.all([
            prisma.subevento.count({ where: { eventoId } }),
            prisma.inscricao.count({ where: { eventoId } }),
            prisma.certificado.count({ where: { inscricao: { eventoId } } }),
        ])
        return { id: eventoId, nome: evento?.nome ?? iniciada!.nomeEvento, subeventos, inscricoes, certificados,
            iniciada: Boolean(iniciada), manterCertificados: iniciada?.manterCertificados ?? null }
    }

    async excluir(eventoId: string, manterCertificados: boolean, adminId: string, certificadosEsperados: number) {
        return comLockFinanceiro(eventoId, async tx => {
            const anterior = await tx.exclusaoEvento.findUnique({ where: { eventoId } })
            if (anterior && anterior.manterCertificados !== manterCertificados) throw new AppError('A exclusão já foi iniciada com outra escolha de certificados. Mantenha a opção original para concluir.', 409)
            if (anterior?.estado === 'CONCLUIDO') return { excluido: true, manterCertificados }
            const evento = await tx.evento.findUnique({ where: { id: eventoId }, include: { certificado: true } })
            if (!evento && !anterior) throw new AppError('Evento não encontrado', 404)
            if (!anterior && await tx.certificado.count({ where: { inscricao: { eventoId } } }) !== certificadosEsperados) throw new AppError('Os certificados deste evento mudaram. Atualize o resumo e confirme novamente.', 409)
            if (!anterior) await tx.exclusaoEvento.create({ data: { eventoId, nomeEvento: evento!.nome, manterCertificados, excluidoPor: adminId } })
            if (evento) {
                // Bloqueia novas inscrições enquanto a limpeza é executada ou retomada.
                await tx.evento.update({ where: { id: eventoId }, data: { status: 'CANCELLED' } })
                const inscricoes = await tx.inscricao.findMany({ where: { eventoId }, select: { id: true, alunoId: true, status: true, aluno: { select: { nome: true } } } })
                const ids = inscricoes.map(i => i.id)
                const subeventos = await tx.subevento.findMany({ where: { eventoId }, select: { id: true } })
                const vinculos = await tx.inscricaoSubevento.findMany({ where: { OR: [{ inscricaoId: { in: ids } }, { subeventoId: { in: subeventos.map(s => s.id) } }] }, select: { id: true } })
                if (manterCertificados) {
                    const certificados = await tx.certificado.findMany({ where: { inscricaoId: { in: ids } } })
                    const porId = new Map(inscricoes.map(i => [i.id, i]))
                    for (const certificado of certificados) {
                        const inscricao = porId.get(certificado.inscricaoId!)!
                        const metadata = certificado.metadadosEvento && typeof certificado.metadadosEvento === 'object' && !Array.isArray(certificado.metadadosEvento) ? certificado.metadadosEvento : {}
                        // Snapshot completo antes de romper a relação; códigos e links continuam os mesmos.
                        await tx.certificado.update({ where: { id: certificado.id }, data: {
                            inscricaoId: null, eventoId: null,
                            metadadosEvento: { ...metadata, nomeAluno: inscricao.aluno.nome, nomeEvento: evento.nome,
                                dataInicio: evento.dataInicio.toISOString(), cargaHoraria: certificado.cargaHorariaTotal,
                                template: evento.certificado?.template ?? metadata.template ?? null,
                                fundoUrl: evento.certificado?.fundoUrl ?? metadata.fundoUrl ?? null,
                                preservacao: { motivo: 'EXCLUSAO_EVENTO', eventoId, alunoId: inscricao.alunoId, inscricaoConfirmada: inscricao.status === 'CONFIRMADA' },
                            },
                        } })
                    }
                } else await tx.certificado.deleteMany({ where: { inscricaoId: { in: ids } } })
                await tx.checkIn.deleteMany({ where: { OR: [{ inscricaoId: { in: ids } }, { inscricaoSubeventoId: { in: vinculos.map(v => v.id) } }] } })
                await tx.inscricaoSubevento.deleteMany({ where: { id: { in: vinculos.map(v => v.id) } } })
                await tx.inscricao.deleteMany({ where: { eventoId } })
                await tx.subevento.deleteMany({ where: { eventoId } })
                await tx.certificado.deleteMany({ where: { eventoId } })
                await tx.reservaPix.deleteMany({ where: { eventoId } })
                await tx.reembolso.deleteMany({ where: { eventoId } })
                await tx.exclusaoInscricao.deleteMany({ where: { eventoId } })
                await tx.pagamentoCancelado.deleteMany({ where: { eventoId } })
                await tx.evento.delete({ where: { id: eventoId } })
            }
            const usuarios = await tx.admin.findMany({ select: { id: true, permissoes: true } })
            for (const usuario of usuarios) {
                const config = userPermissionsSchema.safeParse(usuario.permissoes)
                if (config.success && config.data.eventoIds.includes(eventoId)) await tx.admin.update({ where: { id: usuario.id }, data: { permissoes: { ...config.data, eventoIds: config.data.eventoIds.filter(id => id !== eventoId) } } })
            }
            await tx.exclusaoEvento.update({ where: { eventoId }, data: { estado: 'CONCLUIDO' } })
            return { excluido: true, manterCertificados }
        }, true, 300000)
    }
}
