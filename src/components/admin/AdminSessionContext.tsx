'use client'
import { createContext, useContext } from 'react'
import type { AdminSession } from '@/lib/admin-permissions'

export const AdminSessionContext = createContext<AdminSession | null>(null)
export function useAdminSession() {
    const session = useContext(AdminSessionContext)
    if (!session) throw new Error('Sessão administrativa indisponível')
    return session
}
