'use client'

import { Toaster } from 'sonner'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ALUNO_CONFIG } from '@/lib/aluno-config'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AlunoLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        const id = ALUNO_CONFIG.getAlunoId()
        if (!id) {
            router.push('/login')
        } else {
            setIsChecking(false)
        }
    }, [router])

    if (isChecking) return null

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b bg-white">
                <div className="container h-16 flex items-center justify-between px-4 mx-auto">
                    <div className="flex items-center gap-8">
                        <Link href="/eventos" className="font-bold text-xl text-primary">
                            Eventos FAZAG
                        </Link>
                        <nav className="hidden md:flex gap-6 text-sm font-medium">
                            <Link href="/eventos" className="hover:text-primary transition-colors">Eventos</Link>
                            <Link href="/minhas-inscricoes" className="hover:text-primary transition-colors">Minhas Inscrições</Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-red-600"
                            onClick={() => ALUNO_CONFIG.logout()}
                        >
                            <LogOut size={16} className="mr-2" /> Sair
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 bg-slate-50/50">
                {children}
            </main>

            <footer className="border-t py-6 text-center text-sm text-muted-foreground bg-white">
                © {new Date().getFullYear()} Sistema de Eventos
            </footer>
            <Toaster richColors />
        </div>
    )
}
