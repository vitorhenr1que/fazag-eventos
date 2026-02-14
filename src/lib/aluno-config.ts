export const ALUNO_CONFIG = {
    // Em produção, isso viria de algum contexto global, cookie ou gateway.
    // Para desenvolvimento, fixamos um ID de exemplo.
    getAlunoId: () => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('x-aluno-id')
            if (stored) return stored
        }
        return process.env.NEXT_PUBLIC_ALUNO_ID || null
    },

    setAlunoId: (id: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('x-aluno-id', id)
        }
    },

    logout: () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('x-aluno-id')
            window.location.href = '/login'
        }
    }
}
