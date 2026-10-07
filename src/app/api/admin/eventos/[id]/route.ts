import { getAdminFromHeader } from '@/lib/auth-admin'
import { NextRequest, NextResponse } from 'next/server'
import { EventoService } from '@/services/evento.service'
import { handleApiError } from '@/lib/app-error'
import prisma from '@/lib/db'

const service = new EventoService()

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const body = await request.json()

        const updated = await service.atualizarEvento(id, body)

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        return handleApiError(error)
    }
}
