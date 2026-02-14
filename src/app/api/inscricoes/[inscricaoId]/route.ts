import { NextRequest, NextResponse } from 'next/server'
import { InscricaoRepository } from '@/repositories/inscricao.repository'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'

const repo = new InscricaoRepository()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        const aluno = await getAlunoFromHeader(request)

        const inscricao = await repo.findById(inscricaoId)

        if (!inscricao) {
            return NextResponse.json({ error: { message: 'Inscrição não encontrada' } }, { status: 404 })
        }

        if (inscricao.alunoId !== aluno.id) {
            return NextResponse.json({ error: { message: 'Não autorizado' } }, { status: 403 })
        }

        return NextResponse.json({ success: true, data: inscricao })
    } catch (error) {
        return handleApiError(error)
    }
}
