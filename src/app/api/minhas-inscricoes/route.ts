import { NextRequest, NextResponse } from 'next/server'
import { InscricaoRepository } from '@/repositories/inscricao.repository'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'
import { avaliarCertificacao } from '@/lib/certificacao'
import prisma from '@/lib/db'
import { certificadoPreservado } from '@/lib/exclusao-evento'

const repo = new InscricaoRepository()

export async function GET(request: NextRequest) {
    try {
        const aluno = await getAlunoFromHeader(request)
        const [inscricoes, preservados] = await Promise.all([
            repo.listByAluno(aluno.id),
            prisma.certificado.findMany({ where: { inscricaoId: null, codigoValidacao: { not: null }, AND: [
                { metadadosEvento: { path: '$.preservacao.alunoId', equals: aluno.id } },
                { metadadosEvento: { path: '$.preservacao.motivo', equals: 'EXCLUSAO_EVENTO' } },
            ] }, select: { id: true, codigoValidacao: true, cargaHorariaTotal: true, dataEmissao: true, metadadosEvento: true }, orderBy: { dataEmissao: 'desc' } }),
        ])
        const certificadosPreservados = preservados.flatMap(certificado => {
            const snapshot = certificadoPreservado(certificado.metadadosEvento)
            return snapshot && snapshot.preservacao.alunoId === aluno.id ? [{ id: certificado.id, codigoValidacao: certificado.codigoValidacao, cargaHorariaTotal: certificado.cargaHorariaTotal, dataEmissao: certificado.dataEmissao, nomeEvento: snapshot.nomeEvento }] : []
        })

        return NextResponse.json({ success: true, data: inscricoes.map(inscricao => ({ ...inscricao, certificacao: avaliarCertificacao(inscricao) })), certificadosPreservados }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return handleApiError(error)
    }
}
