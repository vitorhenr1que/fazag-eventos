import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromHeader } from '@/lib/auth-admin'
import { handleApiError } from '@/lib/app-error'

export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminFromHeader(request, 'SESSAO')
        return NextResponse.json({ success: true, data: admin }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return handleApiError(error) }
}
