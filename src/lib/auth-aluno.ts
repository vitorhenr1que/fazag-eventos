import { NextResponse } from 'next/server'
import prisma from './db'
import { AppError } from './app-error'

export async function getAlunoFromHeader(request: Request) {
    const alunoId = request.headers.get('x-aluno-id')?.trim()

    if (!alunoId) {
        throw new AppError('Header x-aluno-id inválido ou ausente', 401, 'UNAUTHORIZED')
    }

    // Upsert do aluno (garante que existe no banco e atualiza timestamp)
    // O nome inicial é o ID, depois pode ser atualizado via perfil se houver
    const aluno = await prisma.aluno.findUnique({
        where: { id: alunoId }
    })

    if (!aluno) {
        throw new AppError('Aluno não encontrado. Por favor, realize o cadastro.', 401, 'UNAUTHORIZED')
    }

    return aluno
}
