import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { AppError, handleApiError } from '@/lib/app-error'
import { acaoFinanceiraSchema } from '@/lib/financeiro'
import { FinanceiroService } from '@/services/financeiro.service'

const service = new FinanceiroService()
export async function POST(request: NextRequest, { params }: { params: Promise<{ inscricaoId: string }> }) {
    try {
        const admin = await getAdminFromHeader(request, 'FINANCEIRO')
        const { inscricaoId } = await params
        let body: unknown
        try { body = await request.json() } catch { throw new AppError('JSON inválido') }
        const dados = acaoFinanceiraSchema.parse(body)
        const result = await service.realizarAcao(inscricaoId, dados, admin.id)
        return NextResponse.json({ success: true, data: result })
    } catch (error) { return handleApiError(error) }
}
