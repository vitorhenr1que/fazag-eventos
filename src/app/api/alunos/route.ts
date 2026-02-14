import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { handleApiError } from '@/lib/app-error'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, nome, email } = body

        if (!id || !nome) {
            return NextResponse.json({ error: { message: 'ID (Matrícula) e Nome são obrigatórios' } }, { status: 400 })
        }

        const cleanId = String(id).trim()
        const cleanNome = String(nome).trim()
        const cleanEmail = email ? String(email).trim() : null

        // Realiza o UPSERT (Cria se não existe, atualiza se já existe)
        const aluno = await prisma.aluno.upsert({
            where: { id: cleanId },
            update: {
                nome: cleanNome,
                email: cleanEmail || undefined
            },
            create: {
                id: cleanId,
                nome: cleanNome,
                email: cleanEmail || null
            }
        })

        return NextResponse.json({ success: true, data: aluno })
    } catch (error) {
        return handleApiError(error)
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: { message: 'ID não fornecido' } }, { status: 400 })
        }

        const cleanId = String(id).trim()

        const aluno = await prisma.aluno.findUnique({
            where: { id: cleanId }
        })

        if (!aluno) {
            return NextResponse.json({ error: { message: 'Aluno não encontrado ou matrícula inválida' } }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: aluno })
    } catch (error) {
        return handleApiError(error)
    }
}
