import { getAdminFromHeader } from '@/lib/auth-admin'
import { NextRequest, NextResponse } from 'next/server'
import { EventoService } from '@/services/evento.service'
import { handleApiError } from '@/lib/app-error'
import prisma from '@/lib/db'
import { z } from 'zod'
import { exclusaoEventoSchema } from '@/lib/exclusao-evento'
import { ExclusaoEventoService } from '@/services/exclusao-evento.service'

export const maxDuration = 300

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await getAdminFromHeader(request, 'ADMINISTRADOR')
        const { id } = await params
        const body = exclusaoEventoSchema.parse(await request.json())
        const result = await new ExclusaoEventoService().excluir(id, body.certificados === 'MANTER', admin.id, body.certificadosEsperados)
        return NextResponse.json({ success: true, data: result })
    } catch (error) { return handleApiError(error) }
}

const updateSchema = z.object({
    nome: z.string().min(1).max(160), slug: z.string().min(1).max(120),
    descricao: z.string().nullable(), local: z.string().max(160).nullable(),
    bannerUrl: z.string().max(255).nullable(), tipoAtividadeId: z.string().max(25).nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'FINISHED', 'CANCELLED']), tipo: z.enum(['GRATUITO', 'PAGO']),
    dataInicio: z.string().datetime({ offset: true }), dataFim: z.string().datetime({ offset: true }),
    totalVagas: z.number().int().positive(), temSubeventos: z.boolean(), cargaHorariaBase: z.number().nonnegative().nullable(),
    limiteSubeventosPorAluno: z.number().int().positive().nullable(), preco: z.number().nonnegative().nullable(), chavePix: z.string().max(255).nullable(),
    certificado: z.object({ fundoUrl: z.string().max(255).nullable().optional(), template: z.unknown().optional(), ativo: z.boolean().optional() }).strip(),
}).partial().strip()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const evento = await prisma.evento.findUnique({ where: { id }, include: { tipoAtividade: true, certificado: true, subeventos: true, _count: { select: { inscricoes: true } } } })
        return NextResponse.json({ success: true, data: evento }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}

const service = new EventoService()

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getAdminFromHeader(request)
        const { id } = await params
        const body = updateSchema.parse(await request.json())

        const updated = await service.atualizarEvento(id, body)

        return NextResponse.json({ success: true, data: updated })
    } catch (error) {
        return handleApiError(error)
    }
}
