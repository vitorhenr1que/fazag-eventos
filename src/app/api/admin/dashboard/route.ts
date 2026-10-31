import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { adminEventWhere } from '@/lib/admin-permissions'
import { handleApiError } from '@/lib/app-error'

export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminFromHeader(request)
        const where = adminEventWhere(admin)
        const [totalEventos, totalInscricoes, eventosAtivos] = await Promise.all([
            prisma.evento.count({ where }),
            prisma.inscricao.count({ where: { evento: where } }),
            prisma.evento.count({ where: { AND: [where, { status: 'PUBLISHED' }] } }),
        ])
        return NextResponse.json({ success: true, data: { totalEventos, totalInscricoes, eventosAtivos } }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}
