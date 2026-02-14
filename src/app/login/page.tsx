'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api-client'
import { ALUNO_CONFIG } from '@/lib/aluno-config'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2, LogIn, UserPlus } from 'lucide-react'

export default function LoginPage() {
    const [alunoId, setAlunoId] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        if (!alunoId) return

        setLoading(true)
        try {
            const res = await fetch(`/api/alunos?id=${alunoId}`)
            const json = await res.json()

            if (res.ok) {
                ALUNO_CONFIG.setAlunoId(alunoId)
                toast.success(`Bem-vindo, ${json.data.nome}!`)
                router.push('/eventos')
            } else {
                toast.error(json.error?.message || 'Erro ao fazer login')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Acesso do Aluno</CardTitle>
                    <CardDescription>
                        Informe sua matrícula para acessar o portal de eventos
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula / ID</Label>
                            <Input
                                id="matricula"
                                placeholder="Ex: 123456"
                                value={alunoId}
                                onChange={(e) => setAlunoId(e.target.value)}
                                disabled={loading}
                                required
                                className="h-11"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <LogIn className="mr-2" size={18} />}
                            Entrar
                        </Button>
                        <div className="text-center text-sm text-slate-500">
                            Ainda não tem cadastro?{' '}
                            <Link href="/cadastro" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
                                <UserPlus size={14} /> Cadastre-se aqui
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
