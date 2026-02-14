'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Users, CheckCircle, CreditCard, Check } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export default function InscricoesEventoPage() {
    const params = useParams()
    const [evento, setEvento] = useState<any>(null)
    const [inscricoes, setInscricoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                // Buscar detalhes do evento
                const evRes = await apiFetch(`/api/eventos/${params.id}`)
                if (evRes.ok) {
                    const evJson = await evRes.json()
                    setEvento(evJson.data)
                }

                // Buscar inscrições (Admin)
                const res = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                if (res.ok) {
                    const json = await res.json()
                    setInscricoes(json.data)
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    async function handleCheckInSub(inscricaoId: string, subeventoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/checkin`, {
                method: 'POST',
                body: JSON.stringify({ tipo: 'SUBEVENTO', subeventoId }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Check-in no subevento realizado!')
                // Refresh data
                const resList = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                const json = await resList.json()
                setInscricoes(json.data)
            }
        } catch (err) {
            toast.error('Erro ao processar check-in')
        }
    }

    async function handleCheckIn(inscricaoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/checkin`, {
                method: 'POST',
                body: JSON.stringify({ tipo: 'EVENTO' }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Check-in realizado com sucesso!')
                setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, checkIn: { id: 'temp' } } : i))
            }
        } catch (err) {
            toast.error('Erro ao processar check-in')
        }
    }

    const [emittingId, setEmittingId] = useState<string | null>(null)

    async function handleAprovarPagamento(inscricaoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/aprovar`, {
                method: 'POST',
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Pagamento aprovado!')
                setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, status: 'CONFIRMADA' } : i))
            }
        } catch (err) {
            toast.error('Erro ao aprovar pagamento')
        }
    }

    async function handleEmitirCertificado(inscricaoId: string, atualCarga?: number) {
        // Cálculo automático sugerido
        const insc = inscricoes.find(i => i.id === inscricaoId)
        let sugerido = atualCarga
        if (sugerido === undefined) {
            if (!evento.temSubeventos) {
                sugerido = evento.cargaHorariaBase || 0
            } else {
                sugerido = insc.subeventosEscolhidos.filter((se: any) => se.checkIn).reduce((acc: number, curr: any) => acc + curr.subevento.cargaHoraria, 0)
            }
        }

        const novaCargaStr = prompt('Defina a carga horária para este certificado:', sugerido?.toString() || '0')
        if (novaCargaStr === null) return

        const novaCarga = parseFloat(novaCargaStr)
        if (isNaN(novaCarga)) {
            toast.error('Valor inválido')
            return
        }

        setEmittingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/certificado`, {
                method: 'POST',
                body: JSON.stringify({ cargaHoraria: novaCarga }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Certificado processado com sucesso!')
                // Refresh list
                const resList = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                if (resList.ok) {
                    const json = await resList.json()
                    setInscricoes(json.data)
                }
            }
        } catch (err) {
            toast.error('Erro ao emitir certificado')
        } finally {
            setEmittingId(null)
        }
    }

    return (
        <div className="space-y-6 container py-8 mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link href="/admin/eventos" className="flex items-center text-xs text-slate-500 hover:text-primary transition mb-2">
                        <ArrowLeft size={14} className="mr-1" /> Lista de Eventos
                    </Link>
                    {loading ? (
                        <Skeleton className="h-8 w-64" />
                    ) : (
                        <h1 className="text-2xl font-bold text-slate-800">Inscritos: {evento?.nome}</h1>
                    )}
                    {loading ? (
                        <Skeleton className="h-4 w-32" />
                    ) : (
                        <p className="text-sm text-slate-500">Total: {inscricoes.length} inscritos</p>
                    )}
                </div>
                {!loading && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">Exportar CSV</Button>
                    </div>
                )}
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Aluno / Matrícula</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Inscrição</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Presença Geral</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Subeventos (Grade)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Certificado</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-sm">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-4 space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-20" />
                                            </td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-5 w-24 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-5 w-20 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : (
                                    inscricoes.map(insc => (
                                        <tr key={insc.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-800">{insc.aluno.nome}</p>
                                                <p className="text-[10px] text-slate-400">ID: {insc.aluno.id}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600">
                                                {formatDate(insc.dataInscricao, 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    {insc.status === 'PENDENTE' ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                            <CreditCard size={12} /> AGUARDANDO
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                            <Check size={12} /> CONFIRMADA
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    {insc.checkIn ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                                            <CheckCircle size={14} /> PRESENTE
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                            AUSENTE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {insc.subeventosEscolhidos?.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {insc.subeventosEscolhidos.map((se: any) => (
                                                            <div key={se.id} className="flex items-center justify-between gap-2 p-1 px-2 bg-slate-50 rounded border text-[10px]">
                                                                <span className="truncate max-w-[120px]" title={se.subevento.nome}>
                                                                    {se.subevento.nome}
                                                                </span>
                                                                {se.checkIn ? (
                                                                    <span className="text-green-600 font-bold flex items-center gap-0.5"><Check size={10} /> Ok</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleCheckInSub(insc.id, se.subeventoId)}
                                                                        className="text-primary hover:underline font-bold"
                                                                    >
                                                                        Check-in
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">
                                                        {evento?.temSubeventos ? 'Nenhum selecionado' : 'Evento s/ subeventos'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    {insc.certificado ? (
                                                        <>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                {insc.certificado.cargaHorariaTotal}h
                                                            </span>
                                                            <button
                                                                onClick={() => handleEmitirCertificado(insc.id, insc.certificado.cargaHorariaTotal)}
                                                                className="text-[10px] text-slate-500 hover:underline"
                                                                disabled={emittingId === insc.id}
                                                            >
                                                                Editar Carga
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-[10px] text-primary hover:bg-primary/5 border border-primary/20"
                                                            disabled={emittingId === insc.id || insc.status !== 'CONFIRMADA'}
                                                            onClick={() => handleEmitirCertificado(insc.id)}
                                                        >
                                                            {emittingId === insc.id ? <Loader2 className="animate-spin" size={12} /> : 'Liberar'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                {insc.status === 'PENDENTE' && (
                                                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50 h-8 text-[11px]" onClick={() => handleAprovarPagamento(insc.id)}>
                                                        Aprovar
                                                    </Button>
                                                )}
                                                {insc.status === 'CONFIRMADA' && !insc.checkIn && (
                                                    <Button size="sm" onClick={() => handleCheckIn(insc.id)} className="h-8 text-[11px]">
                                                        Check-in Geral
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!loading && inscricoes.length === 0 && (
                        <div className="p-10 text-center text-slate-400 italic">
                            Nenhum aluno inscrito neste evento ainda.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
