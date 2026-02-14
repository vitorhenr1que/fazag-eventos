'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, CreditCard, Check, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

import { Skeleton } from '@/components/ui/skeleton'

export default function InscricoesPendentesPage() {
    const [pendentes, setPendentes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        loadPendentes()
    }, [])

    async function loadPendentes() {
        try {
            const res = await apiFetch('/api/admin/inscricoes/pendentes', { isAdmin: true })
            if (res.ok) {
                const json = await res.json()
                setPendentes(json.data)
            }
        } finally {
            setLoading(false)
        }
    }

    async function handleAprovar(inscricaoId: string) {
        setProcessingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/aprovar`, {
                method: 'POST',
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Inscrição aprovada com sucesso!')
                setPendentes(prev => prev.filter(p => p.id !== inscricaoId))
            } else {
                const error = await res.json()
                toast.error(error.error?.message || 'Erro ao aprovar inscrição')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Aprovações Pendentes</h1>
                <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                    <AlertCircle size={16} />
                    {pendentes.length} solicitações aguardando
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Aluno</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Evento</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Valor</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Data Solicitação</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-48" />
                                    </td>
                                    <td className="px-6 py-4 space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-20" />
                                    </td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                                </tr>
                            ))
                        ) : (
                            pendentes.map(p => {
                                const vagasOcupadas = p.evento._count.inscricoes
                                const vagasTotais = p.evento.totalVagas
                                const emRisco = vagasOcupadas >= vagasTotais

                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-slate-800">{p.aluno.nome}</p>
                                            <p className="text-xs text-slate-400">ID: {p.aluno.id}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-slate-700">{p.evento.nome}</p>
                                            <p className={`text-[10px] font-bold ${emRisco ? 'text-red-500' : 'text-slate-400'}`}>
                                                Vagas: {vagasOcupadas} / {vagasTotais} {emRisco && '(LOTADO)'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-bold text-slate-700">
                                                R$ {Number(p.evento.preco || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                                            {format(new Date(p.dataInscricao), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                disabled={processingId === p.id || emRisco}
                                                onClick={() => handleAprovar(p.id)}
                                            >
                                                {processingId === p.id ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <><Check size={16} className="mr-1" /> Aprovar</>
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
                {pendentes.length === 0 && (
                    <div className="p-16 text-center text-slate-400">
                        <CreditCard size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma solicitação de pagamento pendente no momento.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
