'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { Plus, Edit2, Users, MoreVertical, Eye, Layers } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

import { Skeleton } from '@/components/ui/skeleton'

export default function AdminEventosPage() {
    const [eventos, setEventos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch('/api/admin/eventos', { isAdmin: true })
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Gerenciar Eventos</h1>
                <Button asChild>
                    <Link href="/admin/eventos/novo">
                        <Plus className="mr-2" size={20} /> Novo Evento
                    </Link>
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Evento</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Vagas</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-32" />
                                    </td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <div className="flex justify-end gap-2">
                                            <Skeleton className="h-8 w-8" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            eventos.map(e => (

                                <tr key={e.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-slate-800">{e.nome}</p>
                                        <p className="text-xs text-slate-400">{formatDate(e.dataInicio)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${e.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                                            e.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                            {e.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {e._count?.inscricoes || 0} / {e.totalVagas}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-1">
                                        {e.temSubeventos && (
                                            <Button variant="ghost" size="sm" asChild title="Gerenciar Subeventos">
                                                <Link href={`/admin/eventos/${e.id}/subeventos`}>
                                                    <Layers size={16} className="text-primary" />
                                                </Link>
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" asChild title="Ver Inscritos">
                                            <Link href={`/admin/eventos/${e.id}/inscricoes`}>
                                                <Users size={16} />
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" size="sm" asChild title="Editar Evento">
                                            <Link href={`/admin/eventos/${e.id}/editar`}>
                                                <Edit2 size={16} />
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {eventos.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                        Nenhum evento cadastrado.
                    </div>
                )}
            </div>
        </div>
    )
}
