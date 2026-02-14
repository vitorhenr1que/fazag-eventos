import { NextRequest, NextResponse } from 'next/server'
import { EventoService } from '@/services/evento.service'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'

export const dynamic = 'force-dynamic'

const eventoService = new EventoService()

export async function GET(request: NextRequest) {
    try {
        // Validar aluno (header obrigatório conforme requisito)
        await getAlunoFromHeader(request)

        const eventos = await eventoService.listarDisponiveis()
        // console.log('DEBUG Eventos:', JSON.stringify(eventos, null, 2))
        return NextResponse.json({ success: true, data: eventos })
    } catch (error) {
        return handleApiError(error)
    }
}
