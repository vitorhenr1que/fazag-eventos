import { ALUNO_CONFIG } from './aluno-config'

type FetchOptions = RequestInit & {
    isAdmin?: boolean
    redirectOnUnauthorized?: boolean
}

export async function apiFetch(url: string, options: FetchOptions = {}) {
    const { isAdmin, redirectOnUnauthorized = true, ...fetchOptions } = options
    const headers = new Headers(fetchOptions.headers)

    if (isAdmin) {
        // Pegar token do localStorage ou cookie
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin-token') : ''
        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
        }
    } else {
        // Injetar identidade do aluno
        const alunoId = ALUNO_CONFIG.getAlunoId()
        if (alunoId) {
            headers.set('x-aluno-id', alunoId)
        }
    }

    // Content-Type JSON por padrão se tiver body
    if (options.body && !headers.has('Content-Type')) {
        if (!(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json')
        }
    }

    const response = await fetch(url, {
        ...fetchOptions,
        headers
    })

    // Tratamento global de erro 401
    if (response.status === 401) {
        if (isAdmin && redirectOnUnauthorized && typeof window !== 'undefined') {
            localStorage.removeItem('admin-token')
            window.location.href = '/admin/login' // Redirecionar admin deslogado
        }
        // Aluno 401: Talvez header invalido ou expirado, tratar na UI
    }

    // Vamos retornar response puro para o caller lidar com .json() ou erros específicos
    return response
}
