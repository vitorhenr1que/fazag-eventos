import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { handleApiError } from '@/lib/app-error'
import { ExclusaoEventoService } from '@/services/exclusao-evento.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await getAdminFromHeader(request, 'ADMINISTRADOR')
        const { id } = await params
        const data = await new ExclusaoEventoService().resumo(id)
        return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}
