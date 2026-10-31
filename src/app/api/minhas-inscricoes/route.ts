import { NextRequest, NextResponse } from 'next/server'
import { InscricaoRepository } from '@/repositories/inscricao.repository'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'
import { avaliarCertificacao } from '@/lib/certificacao'

const repo = new InscricaoRepository()

export async function GET(request: NextRequest) {
    try {
        const aluno = await getAlunoFromHeader(request)
        const inscricoes = await repo.listByAluno(aluno.id)

        return NextResponse.json({ success: true, data: inscricoes.map(inscricao => ({ ...inscricao, certificacao: avaliarCertificacao(inscricao) })) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return handleApiError(error)
    }
}
