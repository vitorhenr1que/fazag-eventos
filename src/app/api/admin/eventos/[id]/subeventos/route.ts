import { NextRequest, NextResponse } from 'next/server'
import { EventoService } from '@/services/evento.service'
import { handleApiError } from '@/lib/app-error'

const service = new EventoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        // Validar Zod Subevento

        const subevento = await service.adicionarSubevento(id, body)

        return NextResponse.json({ success: true, data: subevento }, { status: 201 })
    } catch (error) {
        return handleApiError(error)
    }
}
