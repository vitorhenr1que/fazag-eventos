'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALUNO_CONFIG } from '@/lib/aluno-config'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2, UserPlus, LogIn } from 'lucide-react'

export default function CadastroPage() {
    const [formData, setFormData] = useState({
        id: '',
        nome: '',
        email: ''
    })
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/alunos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            const json = await res.json()

            if (res.ok) {
                toast.success('Cadastro realizado com sucesso!')
                ALUNO_CONFIG.setAlunoId(formData.id)
                router.push('/eventos')
            } else {
                toast.error(json.error?.message || 'Erro ao realizar cadastro')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Novo Cadastro</CardTitle>
                    <CardDescription>
                        Preencha seus dados para participar dos eventos
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula / ID Único / CPF</Label>
                            <Input
                                id="matricula"
                                placeholder="Sua matrícula da instituição"
                                value={formData.id}
                                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome Completo</Label>
                            <Input
                                id="nome"
                                placeholder="Como você quer ser chamado no certificado"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail (Opcional)</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="para receber notificações"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <UserPlus className="mr-2" size={18} />}
                            Criar Minha Conta
                        </Button>
                        <div className="text-center text-sm text-slate-500">
                            Já possui uma conta?{' '}
                            <Link href="/login" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
                                <LogIn size={14} /> Fazer Login
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
