import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
        const certificado = await prisma.certificado.findUnique({
            where: { codigoValidacao: codigo },
            include: {
                inscricao: {
                    include: {
                        aluno: true,
                        evento: true
                    }
                }
            }
        })

        if (!certificado) {
            return NextResponse.json({ success: false, error: 'Certificado inválido ou não encontrado' }, { status: 404 })
        }

        // Retorna dados públicos seguros
        return NextResponse.json({
            success: true,
            data: {
                aluno: certificado.inscricao.aluno.nome,
                evento: certificado.inscricao.evento.nome,
                cargaHoraria: certificado.cargaHorariaTotal,
                dataEmissao: certificado.dataEmissao,
                codigo: certificado.codigoValidacao
            }
        })
    } catch (error) {
        return handleApiError(error)
    }
}
