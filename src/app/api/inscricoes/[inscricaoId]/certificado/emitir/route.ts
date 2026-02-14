import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'

const inscricaoService = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        await getAlunoFromHeader(request)

        const certificado = await inscricaoService.emitirCertificado(inscricaoId)

        return NextResponse.json({ success: true, data: certificado })
    } catch (error) {
        return handleApiError(error)
    }
}
