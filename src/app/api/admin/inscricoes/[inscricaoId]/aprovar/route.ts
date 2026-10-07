import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { AppError, handleApiError } from '@/lib/app-error'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { aprovacaoFinanceiraSchema } from '@/lib/financeiro'

const service = new InscricaoService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const admin = await getAdminFromHeader(request, 'FINANCEIRO')
        const { inscricaoId } = await params
        const text = await request.text()
        let body = {}
        try { body = text.trim() ? JSON.parse(text) : {} } catch { throw new AppError('JSON inválido') }
        const dados = aprovacaoFinanceiraSchema.parse(body)
        const updated = await service.aprovarInscricao(inscricaoId, dados, admin.id)

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        return handleApiError(error)
    }
}
