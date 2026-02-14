'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner' // Ensure toaster is in RootLayout

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [senha, setSenha] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await apiFetch('/api/admin/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, senha }),
                isAdmin: true // Mesmo nao tendo token ainda, flag para comportamento futuro
            })
            const json = await res.json()

            if (res.ok) {
                localStorage.setItem('admin-token', json.token)
                toast.success('Login realizado com sucesso')
                router.push('/admin/dashboard')
            } else {
                toast.error(json.error?.message || 'Credenciais inválidas')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center">Acesso Administrativo</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full p-2 border rounded"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Senha</label>
                            <input
                                type="password"
                                className="w-full p-2 border rounded"
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
