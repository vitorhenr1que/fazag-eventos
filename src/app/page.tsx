'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import Link from 'next/link'
import { Calendar, Users, MapPin, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import { format } from 'date-fns'

export default function LandingPage() {
    const [eventos, setEventos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch('/api/eventos')
                if (res.ok) {
                    const json = await res.json()
                    setEventos(json.data.slice(0, 3)) // Mostrar apenas os 3 primeiros
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <header className="relative overflow-hidden bg-slate-900 py-24 sm:py-32">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),theme(colors.white))] opacity-20" />
                <div className="container mx-auto px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                            Portal de Eventos <span className="text-primary">FAZAG</span>
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-slate-300">
                            Participe das melhores palestras, workshops e eventos acadêmicos.
                            Garanta sua inscrição e receba seu certificado digital.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <Button asChild size="lg" className="h-12 px-8 font-bold text-lg">
                                <Link href="/cadastro">
                                    <UserPlus className="mr-2" size={20} /> Começar Agora
                                </Link>
                            </Button>
                            <Link href="/login" className="text-sm font-semibold leading-6 text-white hover:text-primary transition">
                                Já sou cadastrado <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Próximos Eventos */}
            <section className="py-24 bg-slate-50/50">
                <div className="container mx-auto px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Próximos Eventos</h2>
                        <p className="mt-4 text-lg leading-8 text-slate-600">
                            Confira o que está acontecendo na nossa instituição.
                        </p>
                    </div>

                    <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => (
                                <Card key={i} className="animate-pulse bg-slate-200 h-[400px]" />
                            ))
                        ) : (
                            eventos.map((evento) => (
                                <Card key={evento.id} className="group relative flex flex-col overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                                    <div className="aspect-[16/9] bg-slate-200 overflow-hidden">
                                        {/* Placeholder para imagem ou gradiente */}
                                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                                            <Calendar size={48} className="text-primary/40" />
                                        </div>
                                    </div>
                                    <CardContent className="flex flex-1 flex-col p-6">
                                        <div className="flex items-center gap-x-4 text-xs mb-4">
                                            <time className="text-slate-500 font-medium">
                                                {format(new Date(evento.dataInicio), 'dd/MM/yyyy')}
                                            </time>
                                            <span className={`rounded-full px-3 py-1 font-semibold ${evento.tipo === 'PAGO' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                {evento.tipo === 'PAGO' ? `R$ ${Number(evento.preco).toFixed(2)}` : 'Gratuito'}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition tracking-tight">
                                            {evento.nome}
                                        </h3>
                                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                            {evento.descricao || 'Sem descrição.'}
                                        </p>
                                        <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                                                <Users size={14} />
                                                <span>{evento.totalVagas - (evento._count?.inscricoes || 0)} vagas</span>
                                            </div>
                                            <Button variant="ghost" size="sm" asChild className="text-primary font-bold hover:bg-primary/5">
                                                <Link href="/login">
                                                    Saber mais <ArrowRight size={14} className="ml-1" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    <div className="mt-16 text-center">
                        <Button variant="outline" size="lg" asChild className="border-2">
                            <Link href="/login">Ver Todos os Eventos</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* CTA Final */}
            <section className="bg-primary py-16">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">Pronto para começar?</h2>
                    <div className="flex gap-4 justify-center">
                        <Button asChild size="lg" variant="secondary" className="font-bold">
                            <Link href="/cadastro">Criar Conta</Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white/10 font-bold">
                            <Link href="/login">Acessar Portal</Link>
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="bg-white border-t py-12">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 text-sm">
                    <div className="font-bold text-xl text-primary">FAZAG Events</div>
                    <div>© {new Date().getFullYear()} Faculdade de Guanambi. Todos os direitos reservados.</div>
                    <div className="flex gap-6">
                        <Link href="/admin/login" className="hover:text-primary">Painel Admin</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
