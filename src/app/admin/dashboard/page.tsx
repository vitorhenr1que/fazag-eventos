'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { Calendar, Users, CheckCircle, FileText } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalEventos: 0,
        totalInscricoes: 0,
        eventosAtivos: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            try {
                const res = await apiFetch('/api/eventos') // Usando o endpoint existente para simular stats
                if (res.ok) {
                    const json = await res.json()
                    const total = json.data.length
                    const inscricoes = json.data.reduce((acc: number, curr: any) => acc + (curr._count?.inscricoes || 0), 0)
                    setStats({
                        totalEventos: total,
                        totalInscricoes: inscricoes,
                        eventosAtivos: json.data.filter((e: any) => e.status === 'PUBLISHED').length
                    })
                }
            } finally {
                setLoading(false)
            }
        }
        loadStats()
    }, [])

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-slate-800">Visão Geral</h1>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Total de Eventos</CardTitle>
                        <Calendar className="text-primary" size={20} />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mb-1" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.totalEventos}</div>
                        )}
                        <p className="text-xs text-slate-400">Na base de dados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Inscrições Realizadas</CardTitle>
                        <Users className="text-green-500" size={20} />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mb-1" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.totalInscricoes}</div>
                        )}
                        <p className="text-xs text-slate-400">Total acumulado</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Publicados</CardTitle>
                        <CheckCircle className="text-blue-500" size={20} />
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mb-1" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.eventosAtivos}</div>
                        )}
                        <p className="text-xs text-slate-400">Visíveis para alunos</p>
                    </CardContent>
                </Card>
            </div>

            <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white shadow-sm">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>Relatórios detalhados serão exibidos aqui.</p>
            </div>
        </div>
    )
}
