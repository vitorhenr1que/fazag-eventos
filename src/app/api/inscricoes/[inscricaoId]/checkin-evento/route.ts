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
        // Check-in pode ser feito pelo próprio aluno via QR Code (autenticado) ou Admin
        // Se for Aluno, validar header.
        // Se for Admin, validar token.
        // Vamos assumir aqui rota de Aluno (self-checkin se permitido geolocalização etc)
        // OU rota que o Admin chama mas está em /api/inscricoes...
        // O requisito diz: "POST /api/inscricoes/:inscricaoId/checkin-evento" em "Rotas do aluno".
        // Então é o aluno fazendo check-in (ex: lendo QR Code na entrada).

        await getAlunoFromHeader(request)

        const result = await inscricaoService.checkIn('EVENTO', inscricaoId)

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        return handleApiError(error)
    }
}
