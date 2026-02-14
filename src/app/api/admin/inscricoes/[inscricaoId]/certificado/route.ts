import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'
import { getAdminFromHeader } from '@/lib/auth-admin'

const inscricaoService = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        await getAdminFromHeader(request)

        const body = await request.json()
        const { cargaHoraria } = body

        const certificado = await inscricaoService.adminEmitirCertificado(inscricaoId, cargaHoraria)

        return NextResponse.json({ success: true, data: certificado })
    } catch (error) {
        return handleApiError(error)
    }
}
