'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { formatForInput } from '@/lib/utils'

export default function EditarEventoPage() {
    const router = useRouter()
    const params = useParams()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<any>(null)

    useEffect(() => {
        async function load() {
            const res = await apiFetch(`/api/eventos/${params.id}`)
            if (res.ok) {
                const json = await res.json()
                const ev = json.data

                setFormData({
                    ...ev,
                    dataInicio: formatForInput(ev.dataInicio),
                    dataFim: formatForInput(ev.dataFim),
                })
            }
            setLoading(false)
        }
        load()
    }, [params.id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (new Date(formData.dataInicio) >= new Date(formData.dataFim)) {
            toast.error('A data de início deve ser anterior à data de término')
            return
        }

        setSaving(true)
        try {
            const { _count, subeventos, ...payload } = formData // Remover dados computados/relacionados

            const res = await apiFetch(`/api/admin/eventos/${params.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...payload,
                    totalVagas: Number(payload.totalVagas),
                    cargaHorariaBase: payload.cargaHorariaBase ? Number(payload.cargaHorariaBase) : null,
                    limiteSubeventosPorAluno: payload.limiteSubeventosPorAluno ? Number(payload.limiteSubeventosPorAluno) : null,
                    preco: payload.tipo === 'PAGO' ? Number(payload.preco) : null,
                    dataInicio: new Date(payload.dataInicio).toISOString(),
                    dataFim: new Date(payload.dataFim).toISOString(),
                }),
                isAdmin: true
            })

            if (res.ok) {
                toast.success('Evento atualizado com sucesso!')
                router.push('/admin/eventos')
            } else {
                const error = await res.json()
                toast.error(error.error?.message || 'Erro ao atualizar evento')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Carregando dados...</div>
    if (!formData) return <div className="p-8 text-center text-red-500">Erro ao carregar os dados do evento.</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link href="/admin/eventos" className="flex items-center text-sm text-slate-500 hover:text-primary transition">
                <ArrowLeft size={16} className="mr-2" /> Cancelar edição
            </Link>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Editar Evento: {formData?.nome}</CardTitle>
                    <div className="flex gap-2">
                        {formData?.temSubeventos && (
                            <Button variant="outline" asChild>
                                <Link href={`/admin/eventos/${params.id}/subeventos`}>Gerenciar Subeventos</Link>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1 block">Nome do Evento</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Slug (URL)</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded bg-slate-50"
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Tipo de Pagamento</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={formData.tipo}
                                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                >
                                    <option value="GRATUITO">Gratuito</option>
                                    <option value="PAGO">Pago</option>
                                </select>
                            </div>

                            {formData.tipo === 'PAGO' && (
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Preço (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={formData.preco || ''}
                                        onChange={e => setFormData({ ...formData, preco: Number(e.target.value) })}
                                        placeholder="Ex: 49.90"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium mb-1 block">Local do Evento</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.local || ''}
                                    onChange={e => setFormData({ ...formData, local: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1 block">Descrição</label>
                                <textarea
                                    rows={4}
                                    className="w-full p-2 border rounded"
                                    value={formData.descricao || ''}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Data de Início</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.dataInicio}
                                    onChange={e => setFormData({ ...formData, dataInicio: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Data de Término</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.dataFim}
                                    onChange={e => setFormData({ ...formData, dataFim: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Total de Vagas</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.totalVagas}
                                    onChange={e => setFormData({ ...formData, totalVagas: Number(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1 block">Status</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="DRAFT">Rascunho (Privado)</option>
                                    <option value="PUBLISHED">Publicado (Visível)</option>
                                    <option value="FINISHED">Encerrado</option>
                                    <option value="CANCELLED">Cancelado</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 border-t pt-6 mt-2">
                                <h3 className="font-semibold mb-4 text-slate-700">Configurações de Subeventos</h3>
                                <div className="flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        id="temSubeventos"
                                        checked={formData.temSubeventos}
                                        onChange={e => setFormData({ ...formData, temSubeventos: e.target.checked })}
                                        className="h-4 w-4"
                                    />
                                    <label htmlFor="temSubeventos" className="text-sm font-medium cursor-pointer">
                                        Este evento possui subeventos (Workshops, Palestras específicas)?
                                    </label>
                                </div>

                                {!formData.temSubeventos ? (
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Carga Horária Base (horas)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            className="w-full p-2 border rounded md:w-1/2"
                                            value={formData.cargaHorariaBase || ''}
                                            onChange={e => setFormData({ ...formData, cargaHorariaBase: Number(e.target.value) })}
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Será usada no certificado final. Ex: 2 ou 1.5</p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Limite de subeventos por Aluno</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded md:w-1/2"
                                            value={formData.limiteSubeventosPorAluno || 0}
                                            onChange={e => setFormData({ ...formData, limiteSubeventosPorAluno: Number(e.target.value) })}
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Ex: O aluno pode escolher até 3 workshops. (0 = Ilimitado)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t">
                            <Button type="submit" size="lg" disabled={saving}>
                                {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={20} />}
                                Salvar Alterações
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
