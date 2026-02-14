import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'

const inscricaoService = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        // Admin fazendo check-in manual para um aluno
        // Pode passar query param ?tipo=EVENTO ou body

        const body = await request.json() // { tipo: 'EVENTO', subeventoId?: string }

        const tipo = body.tipo || 'EVENTO'

        let result;
        if (tipo === 'EVENTO') {
            result = await inscricaoService.checkIn('EVENTO', inscricaoId)
        } else {
            if (!body.subeventoId) throw new Error('subeventoId obrigatório para checkin de subevento')
            result = await inscricaoService.realizarCheckInSubevento(inscricaoId, body.subeventoId, true)
        }

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        return handleApiError(error)
    }
}
