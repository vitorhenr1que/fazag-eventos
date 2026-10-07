import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { AppError, handleApiError } from '@/lib/app-error'
import { exclusaoInscricaoSchema } from '@/lib/exclusao-inscricao'
import { ExclusaoInscricaoService } from '@/services/exclusao-inscricao.service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ inscricaoId: string }> }) {
    try {
        const admin = await getAdminFromHeader(request, 'ADMINISTRADOR')
        const { inscricaoId } = await params
        let body: unknown
        try { body = await request.json() } catch { throw new AppError('JSON inválido') }
        const result = await new ExclusaoInscricaoService().excluir(inscricaoId, exclusaoInscricaoSchema.parse(body), admin.id)
        return NextResponse.json({ success: true, data: result })
    } catch (error) { return handleApiError(error) }
}
