import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'

const service = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        const alunoId = request.headers.get('x-aluno-id')

        if (!alunoId) {
            return NextResponse.json({ error: { message: 'Não autorizado' } }, { status: 401 })
        }

        const result = await service.checkInAluno(alunoId, inscricaoId)

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        return handleApiError(error)
    }
}
