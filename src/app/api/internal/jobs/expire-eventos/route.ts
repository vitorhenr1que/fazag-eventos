import { NextResponse } from 'next/server'
import { JobService } from '@/services/job.service'

const jobService = new JobService()

async function executeJob(request: Request) {
    try {
        // Validação do segredo de segurança
        // Aceita via header (conforme solicitado) ou via query param (para facilidade no Vercel Cron)
        const authHeader = request.headers.get('x-job-secret') || new URL(request.url).searchParams.get('secret')
        const jobSecret = process.env.JOB_SECRET

        if (!jobSecret || authHeader !== jobSecret) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            )
        }

        const result = await jobService.expireEventos()

        return NextResponse.json({
            message: 'Job executado com sucesso',
            ...result
        })
    } catch (error: any) {
        console.error('[EXPIRE_EVENTOS_JOB_ERROR]:', error)
        return NextResponse.json(
            {
                error: 'Falha ao executar o job de expiração',
                details: error.message
            },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    return executeJob(request)
}

export async function POST(request: Request) {
    return executeJob(request)
}
