'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Calendar, LogOut, Users, CreditCard } from 'lucide-react'
import { Toaster } from 'sonner'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [authorized, setAuthorized] = React.useState(false)

    useEffect(() => {
        const token = localStorage.getItem('admin-token')
        const isLoginPage = pathname === '/admin/login'

        if (!token && !isLoginPage) {
            router.push('/admin/login')
        } else {
            setAuthorized(true)
        }
    }, [router, pathname])

    // Se for a página de login, renderiza apenas o conteúdo (sem sidebar)
    if (pathname === '/admin/login') {
        return (
            <div className="min-h-screen bg-slate-100">
                {children}
                <Toaster richColors />
            </div>
        )
    }

    if (!authorized) return null

    const handleLogout = () => {
        localStorage.removeItem('admin-token')
        router.push('/admin/login')
    }

    return (
        <div className="flex min-h-screen bg-slate-100">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 text-xl font-bold border-b border-slate-800">
                    Admin FAZAG
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin/dashboard" className={`flex items-center gap-3 p-2 rounded transition ${pathname === '/admin/dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}>
                        <LayoutDashboard size={20} /> Dashboard
                    </Link>
                    <Link href="/admin/eventos" className={`flex items-center gap-3 p-2 rounded transition ${pathname === '/admin/eventos' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}>
                        <Calendar size={20} /> Eventos
                    </Link>
                    <Link href="/admin/inscricoes/pendentes" className={`flex items-center gap-3 p-2 rounded transition ${pathname === '/admin/inscricoes/pendentes' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}>
                        <CreditCard size={20} /> Pendentes
                    </Link>
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
                        <span className="text-sm text-slate-500 italic">Administrador</span>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
            <Toaster richColors />
        </div>
    )
}
