'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Calendar, LogOut, CreditCard, Tags } from 'lucide-react'
import { Toaster } from 'sonner'
import { apiFetch } from '@/lib/api-client'
import { adminHome, adminRoleLabels, canAccessAdminPage, type AdminSession } from '@/lib/admin-permissions'
import { AdminSessionContext } from '@/components/admin/AdminSessionContext'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [session, setSession] = React.useState<AdminSession | null>(null)
    const [verifiedPath, setVerifiedPath] = React.useState('')
    const [error, setError] = React.useState('')
    const [retry, setRetry] = React.useState(0)

    useEffect(() => {
        let active = true
        setVerifiedPath(''); setError('')
        if (pathname === '/admin/login') { setSession(null); return }
        if (!localStorage.getItem('admin-token')) { router.replace('/admin/login'); return }
        async function verify() {
            try {
                const res = await apiFetch('/api/admin/auth/me', { isAdmin: true })
                const json = await res.json()
                if (!active) return
                if (res.status === 401) { localStorage.removeItem('admin-token'); router.replace('/admin/login'); return }
                if (!res.ok) throw new Error(json.error?.message || 'Não foi possível verificar seu acesso')
                const profile: AdminSession = json.data
                setSession(profile)
                if (!canAccessAdminPage(profile.role, pathname)) { router.replace(adminHome(profile.role)); return }
                setVerifiedPath(pathname)
            } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Erro de conexão') }
        }
        verify()
        return () => { active = false }
    }, [router, pathname, retry])

    // Se for a página de login, renderiza apenas o conteúdo (sem sidebar)
    if (pathname === '/admin/login') {
        return (
            <div className="min-h-screen bg-slate-100">
                {children}
                <Toaster richColors />
            </div>
        )
    }

    if (error) return <div className="p-8 space-y-4"><p role="alert">{error}</p><Button onClick={() => setRetry(r => r + 1)}>Tentar novamente</Button></div>
    if (!session || verifiedPath !== pathname || !canAccessAdminPage(session.role, pathname)) return <p role="status" className="p-8 text-slate-500">Verificando acesso...</p>

    const handleLogout = () => {
        localStorage.removeItem('admin-token')
        router.push('/admin/login')
    }

    return (
        <AdminSessionContext.Provider value={session}>
        <div className="flex min-h-screen bg-slate-100">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 text-xl font-bold border-b border-slate-800">
                    Admin FAZAG
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                        { href: '/admin/eventos', label: 'Eventos', icon: Calendar },
                        { href: '/admin/tipos-atividade', label: 'Tipos de Atividade', icon: Tags },
                        { href: '/admin/inscricoes/pendentes', label: 'Pendentes', icon: CreditCard },
                        { href: '/admin/financeiro', label: 'Financeiro', icon: CreditCard },
                    ].filter(item => canAccessAdminPage(session.role, item.href)).map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} className={`flex items-center gap-3 p-2 rounded transition ${pathname === href ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}>
                            <Icon size={20} /> {label}
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white" onClick={handleLogout}>
                        <LogOut size={20} className="mr-3" /> Sair
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 bg-white border-b flex items-center px-8 justify-between shadow-sm">
                    <h2 className="font-semibold text-slate-700">Painel de Controle</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{session.nome} · {adminRoleLabels[session.role]}</span>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
            <Toaster richColors />
        </div>
        </AdminSessionContext.Provider>
    )
}
