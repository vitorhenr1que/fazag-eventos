'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

import { Skeleton } from '@/components/ui/skeleton'

export default function EventosPage() {
    const [eventos, setEventos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch('/api/eventos')
                if (res.ok) {
                    const json = await res.json()
                    setEventos(json.data)
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Eventos Disponíveis</h1>

            <div className="grid gap-6 md:grid-cols-2">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <Card key={i} className="flex flex-col h-[280px]">
                            <CardHeader className="space-y-4">
                                <div className="flex justify-between">
                                    <Skeleton className="h-5 w-20" />
                                    <Skeleton className="h-5 w-16" />
                                </div>
                                <Skeleton className="h-7 w-3/4" />
                                <Skeleton className="h-4 w-1/4" />
                            </CardHeader>
                            <CardContent className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-10 w-full" />
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    eventos.map(evento => {
                        const inscritos = evento._count?.inscricoes || 0
                        const restantes = Math.max(0, evento.totalVagas - inscritos)
                        const porcentagemOcupada = Math.min(100, (inscritos / evento.totalVagas) * 100)
                        const isEsgotado = restantes === 0

                        return (
                            <Card key={evento.id} className="group overflow-hidden flex flex-col border-none shadow-lg hover:shadow-xl transition-all duration-300 bg-white/50 backdrop-blur-sm">
                                <div className="h-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${evento.tipo === 'PAGO' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                            {evento.tipo === 'PAGO' ? `R$ ${Number(evento.preco || 0).toFixed(2)}` : 'GRATUITO'}
                                        </span>
                                        {isEsgotado && (
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-white px-2.5 py-1 bg-rose-500 rounded-full shadow-sm animate-pulse">
                                                ESGOTADO
                                            </span>
                                        )}
                                    </div>
                                    <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                                        {evento.nome}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-1.5 text-slate-500">
                                        <Calendar size={14} className="text-primary" />
                                        {formatDate(evento.dataInicio, "dd 'de' MMMM")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 pb-6">
                                    <p className="text-sm text-slate-600 line-clamp-3 mb-6 leading-relaxed">
                                        {evento.descricao || 'Explore este evento incrível e garanta sua participação para ampliar seus conhecimentos.'}
                                    </p>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Users size={14} className="text-primary" />
                                                <span>Vagas Restantes</span>
                                            </div>
                                            <span className={`text-xs font-bold ${restantes < 5 ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {restantes} de {evento.totalVagas}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                            <div
                                                className={`h-full transition-all duration-1000 ease-out rounded-full ${porcentagemOcupada > 90 ? 'bg-rose-500' :
                                                    porcentagemOcupada > 70 ? 'bg-amber-500' :
                                                        'bg-indigo-600'
                                                    }`}
                                                style={{ width: `${porcentagemOcupada}%` }}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-50/50 p-4 border-t border-slate-100">
                                    <Button asChild className="w-full shadow-md hover:shadow-lg transition-all" disabled={isEsgotado} variant={isEsgotado ? "outline" : "default"}>
                                        <Link href={`/eventos/${evento.id}`}>
                                            {isEsgotado ? 'Ver Detalhes' : 'Garantir minha vaga'}
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })
                )}

                {!loading && eventos.length === 0 && (

                    <div className="col-span-full text-center py-10 text-muted-foreground text-lg">
                        Nenhum evento disponível no momento.
                    </div>
                )}
            </div>
        </div>
    )
}
