'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Clock, CheckCircle, Loader2, CreditCard } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function GerenciarInscricaoPage() {
    const params = useParams()
    const router = useRouter()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [selectedSubs, setSelectedSubs] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [checkingIn, setCheckingIn] = useState(false)
    const [emittingCert, setEmittingCert] = useState(false)

    async function handleEmitirCertificado() {
        setEmittingCert(true)
        try {
            const res = await apiFetch(`/api/inscricoes/${params.id}/certificado/emitir`, {
                method: 'POST'
            })
            if (res.ok) {
                toast.success('Certificado gerado com sucesso!')
                loadInscricao()
            } else {
                const err = await res.json()
                toast.error(err.error?.message || 'Erro ao gerar certificado')
            }
        } finally {
            setEmittingCert(false)
        }
    }

    // Função interna simples de checkbox já que não instalei o do shadcn ainda
    const SimpleCheckbox = ({ checked, onCheckedChange, disabled }: any) => (
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
        />
    )

    useEffect(() => {
        loadInscricao()
    }, [])

    async function loadInscricao() {
        try {
            const res = await apiFetch(`/api/inscricoes/${params.id}`)
            if (res.ok) {
                const json = await res.json()
                setData(json.data)
                if (json.data.subeventosEscolhidos) {
                    setSelectedSubs(json.data.subeventosEscolhidos.map((s: any) => s.subeventoId))
                }
            } else {
                toast.error('Não foi possível carregar os dados da inscrição')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveSubeventos() {
        setSaving(true)
        try {
            const res = await apiFetch(`/api/inscricoes/${params.id}/subeventos`, {
                method: 'POST',
                body: JSON.stringify({ subeventoIds: selectedSubs })
            })
            if (res.ok) {
                toast.success('Subeventos selecionados com sucesso!')
                router.push('/minhas-inscricoes')
            } else {
                const err = await res.json()
                toast.error(err.error?.message || 'Erro ao salvar')
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleCheckIn() {
        setCheckingIn(true)
        try {
            const res = await apiFetch(`/api/inscricoes/${params.id}/checkin`, {
                method: 'POST'
            })
            if (res.ok) {
                toast.success('Check-in realizado com sucesso!')
                loadInscricao()
            } else {
                const err = await res.json()
                toast.error(err.error?.message || 'Erro ao realizar check-in')
            }
        } finally {
            setCheckingIn(false)
        }
    }

    async function handleCheckInSubevento(subId: string) {
        setCheckingIn(true)
        try {
            const res = await apiFetch(`/api/inscricoes/${params.id}/checkin-subevento/${subId}`, {
                method: 'POST'
            })
            if (res.ok) {
                toast.success('Check-in realizado com sucesso!')
                loadInscricao()
            } else {
                const err = await res.json()
                toast.error(err.error?.message || 'Erro ao realizar check-in')
            }
        } finally {
            setCheckingIn(false)
        }
    }

    if (!loading && !data) return <div className="container py-12 text-center">Inscrição não encontrada</div>

    if (!loading && data.status === 'PENDENTE') {
        const { evento } = data
        return (
            <div className="container py-12 max-w-2xl mx-auto text-center space-y-6">
                <Card className="p-8 border-amber-200 bg-amber-50/50 shadow-sm">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                            <Clock size={48} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Inscrição em Análise</h1>
                    <p className="text-slate-600 mt-4">
                        Sua solicitação de inscrição para <strong>{evento.nome}</strong> foi recebida com sucesso.
                    </p>
                    <div className="bg-white p-4 rounded-lg border border-amber-100 mt-6 text-left text-sm text-slate-500">
                        <p className="font-semibold text-slate-700 mb-2">Próximos Passos:</p>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>Realize o pagamento conforme as instruções da instituição.</li>
                            <li>O administrador irá validar seu pagamento no painel.</li>
                            <li>Após a aprovação, você poderá retornar aqui para escolher seus workshops e palestras.</li>
                        </ul>
                    </div>
                    <Button asChild className="mt-8 w-full md:w-auto">
                        <Link href="/minhas-inscricoes">Ir para Minhas Inscrições</Link>
                    </Button>
                </Card>
            </div>
        )
    }

    const { evento } = data || {}
    const agora = new Date()
    const inicioEvento = evento ? new Date(evento.dataInicio) : new Date()
    const trintaMinAntes = new Date(inicioEvento.getTime() - 30 * 60000)
    const umaHoraETreintaDepois = new Date(inicioEvento.getTime() + 90 * 60000)

    const podeFazerCheckInGeral = agora >= trintaMinAntes && agora <= umaHoraETreintaDepois
    const jaFezCheckInGeral = !!data?.checkIn

    return (
        <div className="container py-8 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    {loading ? (
                        <>
                            <Skeleton className="h-8 w-64 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-slate-800">Sua Inscrição: {evento.nome}</h1>
                            <p className="text-slate-500 text-sm">Status: <span className="text-green-600 font-bold uppercase">Confirmada</span></p>
                        </>
                    )}
                </div>
                {!loading && <Button variant="outline" asChild><Link href="/minhas-inscricoes">Voltar</Link></Button>}
            </div>

            <div className={`grid gap-6 ${evento?.temSubeventos || loading ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
                {loading ? (
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {!evento.temSubeventos && (
                            <Card className="border-green-100 bg-green-50/30">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CheckCircle size={20} className="text-green-600" /> Presença no Evento
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {jaFezCheckInGeral ? (
                                        <div className="bg-white p-4 rounded border border-green-200 flex items-center gap-3 text-green-700">
                                            <CheckCircle size={24} />
                                            <div>
                                                <p className="font-bold">Presença Confirmada!</p>
                                                <p className="text-xs">Sua participação no evento principal já foi registrada.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-slate-600">
                                                O check-in automático está disponível apenas no dia do evento, a partir de 30 minutos antes do início.
                                            </p>
                                            <div className="p-3 bg-white rounded border border-slate-200 text-xs text-slate-500">
                                                <p><strong>Início:</strong> {formatDate(inicioEvento, 'dd/MM/yyyy HH:mm')}</p>
                                                <p><strong>Janela de Check-in:</strong> {formatDate(trintaMinAntes, 'HH:mm')} até {formatDate(umaHoraETreintaDepois, 'HH:mm')}</p>
                                            </div>
                                            <Button
                                                className="w-full h-12 text-lg font-bold"
                                                disabled={!podeFazerCheckInGeral || checkingIn}
                                                onClick={handleCheckIn}
                                            >
                                                {checkingIn ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
                                                Realizar Check-in Agora
                                            </Button>
                                            {!podeFazerCheckInGeral && (
                                                <p className="text-[10px] text-center text-amber-600 font-medium">
                                                    Fora do horário permitido para check-in automático.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {evento.temSubeventos && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Grade de Subeventos e Check-in</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Selecione suas atividades e realize o check-in em cada uma no horário previsto.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-4">
                                        {evento.subeventos?.map((sub: any) => {
                                            const estaNaGrade = selectedSubs.includes(sub.id)
                                            const relacaoSalva = data.subeventosEscolhidos?.find((s: any) => s.subeventoId === sub.id)
                                            const jaFezCheckInSub = !!relacaoSalva?.checkIn

                                            const subInicio = new Date(sub.dataInicio)
                                            const subTrintaAntes = new Date(subInicio.getTime() - 30 * 60000)
                                            const subUmaHoraDepois = new Date(subInicio.getTime() + 90 * 60000)
                                            const podeCheckInSub = agora >= subTrintaAntes && agora <= subUmaHoraDepois

                                            return (
                                                <div key={sub.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg transition ${estaNaGrade ? 'border-primary/30 bg-primary/5' : 'bg-slate-50'}`}>
                                                    <div className="flex items-start space-x-3 mb-3 md:mb-0">
                                                        <SimpleCheckbox
                                                            checked={estaNaGrade}
                                                            disabled={!!relacaoSalva || (!estaNaGrade && sub._count?.inscricoesSubevento >= sub.totalVagas)}
                                                            onCheckedChange={(checked: boolean) => {
                                                                if (checked) {
                                                                    if (evento.limiteSubeventosPorAluno && selectedSubs.length >= evento.limiteSubeventosPorAluno) {
                                                                        toast.error('Limite de atividades atingido')
                                                                        return
                                                                    }
                                                                    setSelectedSubs([...selectedSubs, sub.id])
                                                                } else {
                                                                    setSelectedSubs(selectedSubs.filter(id => id !== sub.id))
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <label className="font-bold text-slate-800 block text-sm">{sub.nome}</label>
                                                            <p className="text-[11px] text-slate-500">
                                                                {formatDate(subInicio, 'dd/MM/yyyy HH:mm')} • {sub.local} • {sub.cargaHoraria}h
                                                            </p>
                                                            <p className={`text-[10px] mt-1 ${sub._count?.inscricoesSubevento >= sub.totalVagas ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                                {sub._count?.inscricoesSubevento || 0} / {sub.totalVagas} vagas ocupadas
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {estaNaGrade && (
                                                        <div className="w-full md:w-auto flex items-center gap-2">
                                                            {jaFezCheckInSub ? (
                                                                <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-100 px-3 py-1.5 rounded-full">
                                                                    <CheckCircle size={14} /> Presença Confirmada
                                                                </span>
                                                            ) : relacaoSalva ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant={podeCheckInSub ? "default" : "secondary"}
                                                                    disabled={!podeCheckInSub || checkingIn}
                                                                    onClick={() => handleCheckInSubevento(sub.id)}
                                                                    className="w-full md:w-auto h-9 font-bold text-xs"
                                                                >
                                                                    {checkingIn ? <Loader2 className="animate-spin mr-2" size={14} /> : <CreditCard size={14} className="mr-2" />}
                                                                    Check-in
                                                                </Button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">Salve a grade para liberar check-in</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="border-t pt-6">
                                        {(() => {
                                            const temNovos = selectedSubs.some(id => !data.subeventosEscolhidos?.some((s: any) => s.subeventoId === id));
                                            return (
                                                <>
                                                    <Button
                                                        onClick={handleSaveSubeventos}
                                                        disabled={saving || !temNovos}
                                                        className="w-full h-11 font-bold"
                                                    >
                                                        {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                                                        Confirmar Seleção de Grade
                                                    </Button>
                                                    <p className="text-[10px] text-center text-slate-400 mt-2">
                                                        * Uma vez confirmado, você não poderá remover atividades da sua grade, apenas adicionar novas.
                                                    </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {(evento.status === 'FINISHED' || agora > new Date(evento.dataFim) || data.certificado) && (
                            <Card className="border-blue-100 bg-blue-50/30">
                                <CardHeader>
                                    <CardTitle className="text-blue-700">Certificado Digital</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {data.certificado ? (
                                        <div className="bg-white p-6 rounded-lg border border-blue-200 text-center space-y-4">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Carga Horária Total</p>
                                                <p className="text-4xl font-bold text-blue-600">{data.certificado.cargaHorariaTotal}h</p>
                                            </div>
                                            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                                <Link href={`/certificados/${data.certificado.codigoValidacao}`} target="_blank">
                                                    Visualizar Certificado
                                                </Link>
                                            </Button>
                                            <p className="text-[10px] text-slate-400">
                                                Código: {data.certificado.codigoValidacao}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-4">
                                            <p className="text-sm text-slate-600">
                                                O evento foi concluído. Você já pode gerar seu certificado de participação.
                                            </p>
                                            <Button
                                                onClick={handleEmitirCertificado}
                                                disabled={emittingCert}
                                                className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                                            >
                                                {emittingCert ? <Loader2 className="animate-spin mr-2" /> : null}
                                                Gerar Certificado Agora
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
