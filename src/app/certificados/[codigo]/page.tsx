'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'

import { Skeleton } from '@/components/ui/skeleton'

export default function CertificadoPage() {
    const params = useParams()
    const [certificado, setCertificado] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch(`/api/certificados/validar/${params.codigo}`)
                if (res.ok) {
                    const json = await res.json()
                    setCertificado(json.data)
                } else {
                    setError('Certificado inválido ou não encontrado.')
                }
            } catch (err) {
                setError('Erro ao validar certificado.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.codigo])

    if (!loading && error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-4 text-red-500 tracking-tighter">ERRO DE VALIDAÇÃO</h1>
                <p className="text-slate-400">{error}</p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="max-w-3xl w-full border-4 border-double border-yellow-600 bg-[#fffdf5] shadow-2xl overflow-hidden relative">
                {loading ? (
                    <CardContent className="p-12 text-center space-y-8">
                        <div className="border-b-2 border-yellow-600 pb-4 mb-8">
                            <Skeleton className="h-10 w-3/4 mx-auto" />
                        </div>
                        <div className="space-y-6 pt-4">
                            <Skeleton className="h-4 w-24 mx-auto" />
                            <Skeleton className="h-12 w-2/3 mx-auto" />
                            <div className="space-y-2 py-6">
                                <Skeleton className="h-4 w-full max-w-lg mx-auto" />
                                <Skeleton className="h-4 w-full max-w-md mx-auto" />
                            </div>
                        </div>
                        <div className="mt-12 flex justify-between items-end border-t pt-8">
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                            <div className="space-y-2 flex flex-col items-end">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-12 text-center space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-9xl font-serif">
                            Certificate
                        </div>

                        <div className="border-b-2 border-yellow-600 pb-4 mb-8">
                            <h1 className="text-4xl font-serif font-bold text-gray-800 uppercase tracking-widest">
                                Certificado de Participação
                            </h1>
                        </div>

                        <div className="space-y-6">
                            <p className="text-lg text-gray-600">Certificamos que</p>
                            <h2 className="text-3xl font-bold text-gray-900 font-serif border-b inline-block pb-1 min-w-[300px]">
                                {certificado.aluno}
                            </h2>

                            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                                Participou do evento <strong>{certificado.evento}</strong>,
                                Realizado em {formatDate(certificado.metadadosEvento?.dataInicio || new Date(), 'dd/MM/yyyy')},
                                com carga horária total de <strong>{certificado.cargaHoraria} horas</strong>.
                            </p>

                            {certificado.metadadosEvento?.subeventos?.length > 0 && (
                                <div className="mt-6 text-sm text-gray-500">
                                    <p className="font-semibold mb-2">Atividades Complementares:</p>
                                    <ul className="list-disc list-inside inline-block text-left">
                                        {certificado.metadadosEvento.subeventos.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="mt-12 flex justify-between items-end border-t pt-8 text-xs text-gray-400">
                            <div className="text-left">
                                <p>Código de Validação:</p>
                                <p className="font-mono text-base text-gray-600 select-all">{certificado.codigo}</p>
                            </div>
                            <div className="text-right">
                                <p>Emitido em: {formatDate(certificado.dataEmissao, 'dd/MM/yyyy')}</p>
                                <p>FAZAG Eventos</p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}
