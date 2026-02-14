import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'

const inscricaoService = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: eventoId } = await params
        const aluno = await getAlunoFromHeader(request)

        const inscricao = await inscricaoService.realizarInscricao(aluno.id, eventoId)

        return NextResponse.json({ success: true, data: inscricao }, { status: 201 })
    } catch (error) {
        return handleApiError(error)
    }
}
