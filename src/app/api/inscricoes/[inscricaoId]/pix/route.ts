import { NextRequest, NextResponse } from 'next/server'
import { getAlunoFromHeader } from '@/lib/auth-aluno'
import { AppError, handleApiError } from '@/lib/app-error'
import { PixService } from '@/services/pix.service'

const service = new PixService()
type Context = { params: Promise<{ inscricaoId: string }> }

export async function GET(request: NextRequest, { params }: Context) {
    try {
        const aluno = await getAlunoFromHeader(request)
        const { inscricaoId } = await params
        return NextResponse.json({ success: true, data: await service.obter(inscricaoId, aluno.id) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest, { params }: Context) {
    try {
        const aluno = await getAlunoFromHeader(request)
        const { inscricaoId } = await params
        let body: unknown
        try { body = await request.json() } catch { throw new AppError('Envie um objeto JSON vazio') }
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
            throw new AppError('Envie somente um objeto JSON vazio')
        }
        return NextResponse.json({ success: true, data: await service.obter(inscricaoId, aluno.id, true) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}
