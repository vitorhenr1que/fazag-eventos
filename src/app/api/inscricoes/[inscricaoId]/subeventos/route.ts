import { NextRequest, NextResponse } from 'next/server'
import { InscricaoService } from '@/services/inscricao.service'
import { handleApiError } from '@/lib/app-error'
import { getAlunoFromHeader } from '@/lib/auth-aluno'
import { z } from 'zod'

const inscricaoService = new InscricaoService()
// Contrato dos apps: apenas subeventoIds no corpo; identidade pelo header x-aluno-id.
const bodySchema = z.object({
    subeventoIds: z.array(z.string()).min(1)
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inscricaoId: string }> }
) {
    try {
        const { inscricaoId } = await params
        // Validar aluno 
        const aluno = await getAlunoFromHeader(request)

        const body = await request.json()
        const { subeventoIds } = bodySchema.parse(body)

        // aluno.id é obtido no servidor; os apps não precisam enviar um novo campo.
        const result = await inscricaoService.selecionarSubeventos(inscricaoId, subeventoIds, aluno.id)

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        return handleApiError(error)
    }
}
