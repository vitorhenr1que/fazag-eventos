import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { handleApiError } from '@/lib/app-error'
import { SubeventoInscricoesService } from '@/services/subevento-inscricoes.service'

const service = new SubeventoInscricoesService()
const bodySchema = z.object({ inscricaoId: z.string().trim().min(1).max(25) }).strict()
type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Context) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        return NextResponse.json({ success: true, data: await service.listar(id) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest, { params }: Context) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const { inscricaoId } = bodySchema.parse(await request.json())
        return NextResponse.json({ success: true, data: await service.adicionar(id, inscricaoId) }, { status: 201 })
    } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest, { params }: Context) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const { inscricaoId } = bodySchema.parse(await request.json())
        return NextResponse.json({ success: true, data: await service.remover(id, inscricaoId) })
    } catch (error) { return handleApiError(error) }
}
