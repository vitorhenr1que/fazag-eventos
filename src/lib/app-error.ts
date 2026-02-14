import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class AppError extends Error {
    public readonly statusCode: number
    public readonly code: string

    constructor(message: string, statusCode = 400, code = 'APP_ERROR') {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

export function handleApiError(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json(
            { success: false, error: { message: error.message, code: error.code } },
            { status: error.statusCode }
        )
    }

    if (error instanceof ZodError) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    message: 'Erro de validação',
                    code: 'VALIDATION_ERROR',
                    details: error.flatten().fieldErrors,
                },
            },
            { status: 400 }
        )
    }

    console.error('SERVER_ERROR:', error)
    return NextResponse.json(
        { success: false, error: { message: 'Erro interno do servidor', code: 'INTERNAL_SERVER_ERROR' } },
        { status: 500 }
    )
}
