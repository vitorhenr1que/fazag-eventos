'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { Check, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner' // Requires adding toaster in layout

import { Skeleton } from '@/components/ui/skeleton'

export default function EventoDetalhePage() {
    const params = useParams()
    const router = useRouter()
    const [evento, setEvento] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [inscrevendo, setInscrevendo] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch(`/api/eventos/${params.id}`)
                if (res.ok) {
                    const json = await res.json()
                    setEvento(json.data)

                    const resInsc = await apiFetch('/api/minhas-inscricoes')
                    if (resInsc.ok) {
                        const jsonInsc = await resInsc.json()
                        const inscricaoExistente = jsonInsc.data.find((i: any) => i.eventoId === json.data.id)

                        if (inscricaoExistente) {
                            if (inscricaoExistente.status === 'CONFIRMADA' && json.data.temSubeventos) {
                                router.push(`/inscricoes/${inscricaoExistente.id}`)
                            } else if (inscricaoExistente.status === 'PENDENTE') {
                                router.push(`/inscricoes/${inscricaoExistente.id}`)
                            }
                        }
                    }
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id, router])

    async function handleInscricao() {
        setInscrevendo(true)
        try {
            const res = await apiFetch(`/api/eventos/${params.id}/inscricoes`, {
                method: 'POST'
            })
            const json = await res.json()

            if (res.ok) {
                toast.success('Inscrição realizada com sucesso!')
                if (evento.temSubeventos) {
                    router.push(`/inscricoes/${json.data.id}`)
                } else {
                    router.push('/minhas-inscricoes')
                }
            } else {
                toast.error(json.error?.message || 'Erro ao realizar inscrição')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setInscrevendo(false)
        }
    }

    if (!loading && !evento) return <div className="p-8 text-center">Evento não encontrado</div>

    const vagasRestantes = evento?.totalVagas - (evento?._count?.inscricoes || 0)
    const esgotado = vagasRestantes <= 0

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <Link href="/eventos" className="text-sm text-muted-foreground hover:underline mb-4 block">&larr; Voltar</Link>

            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    {loading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-[300px] w-full rounded-xl" />
                            <Skeleton className="h-12 w-full" />
                            <div className="flex gap-4">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {evento.bannerUrl && (
                                <div className="relative w-full h-[300px] rounded-xl overflow-hidden mb-6 shadow-lg border border-slate-200">
                                    <img
                                        src={evento.bannerUrl}
                                        alt={evento.nome}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-4xl font-bold mb-2 text-primary">{evento.nome}</h1>
                                <div className="flex gap-4 text-muted-foreground">
                                    <span>{formatDate(evento.dataInicio, "dd 'de' MMMM 'às' HH:mm")}</span>
                                    <span>•</span>
                                    <span>{evento.local || 'Local a definir'}</span>
                                </div>
                            </div>

                            <div className="prose max-w-none text-gray-700 pt-4">
                                <p className="whitespace-pre-wrap">{evento.descricao}</p>
                            </div>
                        </>
                    )}

                    {loading ? (
                        <div className="border rounded-lg p-6 bg-slate-50 space-y-4">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : evento.temSubeventos && evento.subeventos?.length > 0 && (
                        <div className="border rounded-lg p-6 bg-slate-50">
                            <h3 className="font-semibold text-lg mb-4">Programação (Subeventos)</h3>
                            <div className="space-y-3">
                                {evento.subeventos.map((sub: any) => (
                                    <div key={sub.id} className="flex justify-between items-center p-3 bg-white rounded border shadow-sm">
                                        <div>
                                            <p className="font-medium">{sub.nome}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(sub.dataInicio, 'dd/MM HH:mm')} - {sub.local}
                                            </p>
                                        </div>
                                        <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">
                                            {sub.cargaHoraria}h
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">
                                * Você poderá selecionar os subeventos após confirmar sua inscrição no evento principal.
                            </p>
                        </div>
                    )}
                </div>

                <div>
                    {loading ? (
                        <Card>
                            <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                                <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                                <Skeleton className="h-10 w-full" />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="sticky top-8">
                            <CardHeader>
                                <CardTitle>Inscrição</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span>Investimento</span>
                                    <span className="font-bold text-primary text-lg">
                                        {evento.tipo === 'PAGO' ? `R$ ${Number(evento.preco || 0).toFixed(2)}` : 'Grátis'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm py-2 border-y border-slate-100">
                                    <span className="text-slate-500">Disponibilidade</span>
                                    {esgotado ? (
                                        <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                                            ESGOTADO
                                        </span>
                                    ) : (
                                        <div className="text-right">
                                            <span className={`font-bold ${vagasRestantes < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {vagasRestantes} vagas
                                            </span>
                                            <p className="text-[10px] text-slate-400">Total: {evento.totalVagas}</p>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={esgotado || inscrevendo}
                                    onClick={handleInscricao}
                                >
                                    {inscrevendo ? <Loader2 className="animate-spin mr-2" /> : null}
                                    {esgotado ? 'Vagas Esgotadas' : (evento.tipo === 'PAGO' ? 'Solicitar Inscrição' : 'Confirmar Inscrição')}
                                </Button>
                                <p className="text-xs text-center text-muted-foreground">
                                    Ao confirmar, você garante sua vaga no evento principal.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

