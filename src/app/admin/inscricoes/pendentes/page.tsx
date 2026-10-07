'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
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
    const [ajuste, setAjuste] = useState<{ inscricao: any, modalidade: 'DESCONTO' | 'ISENTO' } | null>(null)
    const [valorPago, setValorPago] = useState('')
    const [observacao, setObservacao] = useState('')
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        if (ajuste) dialogRef.current?.showModal()
        else dialogRef.current?.close()
    }, [ajuste])

    useEffect(() => {
        loadPendentes()
    }, [])

    async function loadPendentes() {
        try {
            const res = await apiFetch('/api/admin/inscricoes/pendentes', { isAdmin: true })
            if (res.ok) {
                const json = await res.json()
                setPendentes(json.data)
            } else { toast.error('Não foi possível carregar as inscrições') }
        } catch { toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    async function handleAprovar(inscricaoId: string, modalidade: 'PAGO' | 'DESCONTO' | 'ISENTO' = 'PAGO') {
        if (processingId) return
        const pago = Number(valorPago.replace(',', '.'))
        if (modalidade === 'DESCONTO' && (!valorPago.trim() || !Number.isFinite(pago) || pago <= 0)) {
            toast.error('Informe o valor efetivamente pago'); return
        }
        setProcessingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/aprovar`, {
                method: 'POST',
                isAdmin: true,
                body: JSON.stringify({ modalidade, ...(modalidade === 'DESCONTO' ? { valorPago: pago } : {}), ...(modalidade !== 'PAGO' ? { observacao } : {}) })
            })
            if (res.ok) {
                toast.success('Inscrição aprovada com sucesso!')
                setPendentes(prev => prev.filter(p => p.id !== inscricaoId))
                setAjuste(null)
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
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Aprovações Pendentes</h1>
                <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                    <AlertCircle size={16} />
                    {pendentes.length} solicitações aguardando
                </div>
            </div>
            <p className="text-sm text-slate-600">Aprovar registra o pagamento integral do valor da inscrição. Use desconto para informar o valor recebido ou isenção para confirmar sem cobrança. <Link href="/admin/financeiro" className="font-semibold text-blue-700 underline">Ver relatório financeiro</Link></p>

            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
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
                                                R$ {Number(p.valorReferencia ?? p.evento.preco ?? 0).toFixed(2)}
                                            </span>
                                            {p.valorReferencia === null && <p className="text-xs text-amber-700">Preço atual (inscrição antiga)</p>}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                                            {format(new Date(p.dataInscricao), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                disabled={processingId !== null || emRisco}
                                                onClick={() => handleAprovar(p.id)}
                                            >
                                                {processingId === p.id ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <><Check size={16} className="mr-1" /> Aprovar</>
                                                )}
                                            </Button>
                                            <div className="flex gap-2 justify-end mt-2">
                                                {(['DESCONTO', 'ISENTO'] as const).map(modalidade => (
                                                    <Button key={modalidade} size="sm" variant="outline" disabled={processingId !== null || emRisco}
                                                        onClick={() => { setValorPago(''); setObservacao(''); setAjuste({ inscricao: p, modalidade }) }}>
                                                        {modalidade === 'DESCONTO' ? 'Desconto' : 'Isenção'}
                                                    </Button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
                {!loading && pendentes.length === 0 && (
                    <div className="p-16 text-center text-slate-400">
                        <CreditCard size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma solicitação de pagamento pendente no momento.</p>
                    </div>
                )}
            </div>
            <dialog ref={dialogRef} onCancel={event => { if (processingId) event.preventDefault(); else setAjuste(null) }}
                aria-labelledby="ajuste-titulo" className="m-auto w-full max-w-lg rounded-xl p-6 backdrop:bg-slate-900/50">
                {ajuste && <form className="space-y-4" onSubmit={event => { event.preventDefault(); handleAprovar(ajuste.inscricao.id, ajuste.modalidade) }}>
                    <h2 id="ajuste-titulo" className="text-xl font-bold">{ajuste.modalidade === 'DESCONTO' ? 'Aprovar com desconto' : 'Conceder isenção'}</h2>
                    <p className="text-slate-600">{ajuste.inscricao.aluno.nome} · {ajuste.inscricao.evento.nome}</p>
                    <p>Valor da inscrição: R$ {Number(ajuste.inscricao.valorReferencia ?? ajuste.inscricao.evento.preco ?? 0).toFixed(2)}</p>
                    {ajuste.modalidade === 'DESCONTO' ? <div>
                        <label htmlFor="valor-pago" className="text-sm font-semibold">Valor efetivamente pago (R$)</label>
                        <Input id="valor-pago" inputMode="decimal" value={valorPago} onChange={event => setValorPago(event.target.value)} required autoFocus />
                        <p className="text-xs text-slate-500 mt-1">Informe o valor recebido após o desconto. A aprovação confirma o pagamento.</p>
                    </div> : <p className="rounded bg-amber-50 p-3 text-sm">Esta inscrição será confirmada como isenta, com recebimento de R$ 0,00.</p>}
                    <label htmlFor="observacao-financeira" className="block text-sm font-semibold">Motivo / observação (opcional)</label>
                    <Input id="observacao-financeira" value={observacao} onChange={event => setObservacao(event.target.value)} maxLength={500} />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" disabled={processingId !== null} onClick={() => setAjuste(null)}>Cancelar</Button>
                        <Button type="submit" disabled={processingId !== null}>{processingId ? 'Salvando...' : 'Confirmar aprovação'}</Button>
                    </div>
                </form>}
            </dialog>
        </div>
    )
}
