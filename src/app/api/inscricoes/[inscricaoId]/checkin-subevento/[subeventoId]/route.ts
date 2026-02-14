import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'

const inscricaoService = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string; subeventoId: string }> }
) {
    try {
        const { inscricaoId, subeventoId } = await params
        await getAlunoFromHeader(request)

        const result = await inscricaoService.realizarCheckInSubevento(inscricaoId, subeventoId)

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        return handleApiError(error)
    }
}
