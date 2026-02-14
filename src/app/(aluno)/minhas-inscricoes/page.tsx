'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { CheckCircle, Clock, Award, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Skeleton } from '@/components/ui/skeleton'

export default function MinhasInscricoesPage() {
    const [inscricoes, setInscricoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [generatingId, setGeneratingId] = useState<string | null>(null)

    const loadInscricoes = async () => {
        const res = await apiFetch('/api/minhas-inscricoes')
        if (res.ok) {
            const json = await res.json()
            setInscricoes(json.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadInscricoes()
    }, [])

    const handleGerarCertificado = async (inscricaoId: string) => {
        setGeneratingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/inscricoes/${inscricaoId}/certificado/emitir`, {
                method: 'POST'
            })
            const json = await res.json()
            if (res.ok) {
                toast.success('Certificado gerado com sucesso!')
                loadInscricoes()
            } else {
                toast.error(json.error?.message || 'Erro ao gerar certificado')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setGeneratingId(null)
        }
    }

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Minhas Inscrições</h1>

            {loading ? (
                <div className="space-y-4">
                    {Array(3).fill(0).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                                <div className="space-y-2 w-full md:w-2/3">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                    </div>
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <Skeleton className="h-10 w-24" />
                                    <Skeleton className="h-10 w-24" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : inscricoes.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-slate-50">
                    <p className="text-muted-foreground mb-4">Você ainda não se inscreveu em nenhum evento.</p>
                    <Button asChild><Link href="/eventos">Ver Eventos Disponíveis</Link></Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {inscricoes.map((insc: any) => {
                        const temPresenca = insc.evento.temSubeventos
                            ? (insc.subeventosEscolhidos || []).some((s: any) => !!s.checkIn)
                            : !!insc.checkIn;

                        const eventoFinalizado = new Date() > new Date(insc.evento.dataFim);
                        const podeGerarCertificado = insc.status === 'CONFIRMADA' && !insc.certificado && temPresenca && eventoFinalizado;

                        return (
                            <Card key={insc.id} className="overflow-hidden border-none shadow-md bg-white">
                                <CardContent className="p-0 flex flex-col md:flex-row">
                                    <div className={`w-2 md:w-1 ${insc.status === 'CONFIRMADA' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                    <div className="p-6 flex-1 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-slate-800">{insc.evento.nome}</h3>
                                            <p className="text-sm text-slate-500 mb-3 flex items-center gap-2">
                                                <span>Realizado em {formatDate(insc.evento.dataInicio, 'dd/MM/yyyy')}</span>
                                                {insc.evento.tipo === 'PAGO' && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-semibold text-slate-700">R$ {Number(insc.evento.preco || 0).toFixed(2)}</span>
                                                    </>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {insc.status === 'PENDENTE' ? (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                        <Clock size={12} className="mr-1" /> Aguardando Pagamento
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                                                        <CheckCircle size={12} className="mr-1" /> Confirmada
                                                    </span>
                                                )}

                                                {insc.certificado ? (
                                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                                        <Award size={12} className="mr-1" /> Certificado Disponível
                                                    </span>
                                                ) : insc.status === 'CONFIRMADA' && (
                                                    <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${temPresenca ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                        {temPresenca ? 'Presença Confirmada' : 'Aguardando Presença'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                            {podeGerarCertificado && (
                                                <Button
                                                    onClick={() => handleGerarCertificado(insc.id)}
                                                    disabled={generatingId === insc.id}
                                                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                                >
                                                    {generatingId === insc.id ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Award className="mr-2 h-4 w-4" />
                                                    )}
                                                    Gerar Certificado
                                                </Button>
                                            )}

                                            {!podeGerarCertificado && temPresenca && !eventoFinalizado && (
                                                <div className="flex flex-col items-center md:items-end justify-center">
                                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                        Certificado liberado em {formatDate(insc.evento.dataFim, 'dd/MM [HH:mm]')}
                                                    </span>
                                                </div>
                                            )}

                                            {insc.certificado && (
                                                <Button asChild className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 shadow-sm">
                                                    <Link href={`/certificados/${insc.certificado.codigoValidacao}`}>
                                                        <Award className="mr-2 h-4 w-4" /> Ver Certificado
                                                    </Link>
                                                </Button>
                                            )}

                                            <Button variant="outline" asChild className="flex-1 md:flex-none">
                                                <Link href={insc.status === 'CONFIRMADA' ? `/inscricoes/${insc.id}` : '#'}>
                                                    {insc.status === 'CONFIRMADA' ? 'Detalhes' : 'Pendente'}
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
