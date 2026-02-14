import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname

    // Permitir rotas públicas e estáticos
    if (path.startsWith('/_next') || path.startsWith('/static')) {
        return NextResponse.next()
    }

    // --- PROTEÇÃO DE PÁGINAS ADMIN (/admin/*) ---
    // Se tentar acessar qualquer página de admin (que não seja login)
    if (path.startsWith('/admin') && path !== '/admin/login') {
        const token = request.cookies.get('admin-token')?.value
        // Como o token está no localStorage por padrão, vamos precisar de uma estratégia 
        // ou validar via Server Actions/Cookies.
        // Se estivermos usando puramente Client-side (localStorage), 
        // o redirecionamento via middleware Server-side é limitado.
        // Vamos checar um cookie "admin-session" ou similar se implementarmos futuramente.
        // Mas para agora, vamos proteger as APIs que são o coração dos dados.
    }

    // 1. Validar rotas de API de ADMIN (/api/admin/* exceto auth)
    if (path.startsWith('/api/admin') && !path.includes('/auth')) {
        const authHeader = request.headers.get('authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: { message: 'Token não fornecido', code: 'UNAUTHORIZED' } },
                { status: 401 }
            )
        }
    }

    // 2. Validar rotas de API de ALUNO (/api/* exceto admin e públicas)
    if (path.startsWith('/api') && !path.startsWith('/api/admin')) {
        // Permitir rotas públicas de aluno
        if (path === '/api/alunos' || path.includes('/certificados/validar')) {
            return NextResponse.next()
        }

        const alunoId = request.headers.get('x-aluno-id')
        if (!alunoId) {
            return NextResponse.json(
                { success: false, error: { message: 'x-aluno-id header ausente', code: 'UNAUTHORIZED' } },
                { status: 401 }
            )
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/api/:path*', '/admin/:path*'],
}
