'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatForInput } from '@/lib/utils'

export default function GerenciarSubeventosPage() {
    const params = useParams()
    const [evento, setEvento] = useState<any>(null)
    const [subeventos, setSubeventos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Estado para o formulário (Novo ou Edição)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        dataInicio: '',
        dataFim: '',
        local: '',
        totalVagas: 0,
        cargaHoraria: 1 // em horas
    })

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch(`/api/eventos/${params.id}`)
                if (res.ok) {
                    const json = await res.json()
                    setEvento(json.data)
                    setSubeventos(json.data.subeventos || [])
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (new Date(formData.dataInicio) >= new Date(formData.dataFim)) {
            toast.error('A data de início deve ser anterior à data de término')
            return
        }

        setSaving(true)

        try {
            const payload = {
                ...formData,
                totalVagas: Number(formData.totalVagas),
                cargaHoraria: Number(formData.cargaHoraria),
                dataInicio: new Date(formData.dataInicio).toISOString(),
                dataFim: new Date(formData.dataFim).toISOString(),
            }

            let res;
            if (editingId) {
                res = await apiFetch(`/api/admin/subeventos/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    isAdmin: true
                })
            } else {
                res = await apiFetch(`/api/admin/eventos/${params.id}/subeventos`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    isAdmin: true
                })
            }

            if (res.ok) {
                toast.success(editingId ? 'Subevento atualizado!' : 'Subevento criado!')
                // Recarregar lista
                const freshRes = await apiFetch(`/api/eventos/${params.id}`)
                const freshJson = await freshRes.json()
                setSubeventos(freshJson.data.subeventos || [])

                resetForm()
            } else {
                const err = await res.json()
                toast.error(err.error?.message || 'Erro ao salvar')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja remover este subevento?')) return

        try {
            const res = await apiFetch(`/api/admin/subeventos/${id}`, {
                method: 'DELETE',
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Removido com sucesso')
                setSubeventos(prev => prev.filter(s => s.id !== id))
            }
        } catch (err) {
            toast.error('Erro ao remover')
        }
    }

    function startEdit(sub: any) {
        setFormData({
            nome: sub.nome,
            descricao: sub.descricao || '',
            dataInicio: formatForInput(sub.dataInicio),
            dataFim: formatForInput(sub.dataFim),
            local: sub.local || '',
            totalVagas: sub.totalVagas,
            cargaHoraria: sub.cargaHoraria
        })
        setEditingId(sub.id)
        setShowForm(true)
    }

    function resetForm() {
        setFormData({
            nome: '',
            descricao: '',
            dataInicio: '',
            dataFim: '',
            local: '',
            totalVagas: 0,
            cargaHoraria: 1
        })
        setEditingId(null)
        setShowForm(false)
    }

    if (loading) return <div className="p-8 text-center">Carregando subeventos...</div>

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex gap-4 mb-2">
                        <Link href="/admin/eventos" className="flex items-center text-xs text-slate-500 hover:text-primary">
                            <ArrowLeft size={14} className="mr-1" /> Lista de Eventos
                        </Link>
                        <span className="text-slate-300">|</span>
                        <Link href={`/admin/eventos/${params.id}/editar`} className="flex items-center text-xs text-slate-500 hover:text-primary">
                            <Edit2 size={14} className="mr-1" /> Editar Evento Principal
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold">Subeventos: {evento?.nome || 'Carregando...'}</h1>
                    <p className="text-sm text-slate-500">Gerencie a programação e atividades específicas</p>
                </div>
                {!showForm && (
                    <Button onClick={() => setShowForm(true)}>
                        <Plus size={18} className="mr-2" /> Novo Subevento
                    </Button>
                )}
            </div>

            {showForm && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            {editingId ? 'Editar Subevento' : 'Novo Subevento'}
                            <Button variant="ghost" size="sm" onClick={resetForm}><X size={18} /></Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold uppercase text-slate-500">Nome da Atividade</label>
                                    <input type="text" required className="w-full p-2 border rounded mt-1"
                                        value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Início</label>
                                    <input type="datetime-local" required className="w-full p-2 border rounded mt-1"
                                        value={formData.dataInicio} onChange={e => setFormData({ ...formData, dataInicio: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Término</label>
                                    <input type="datetime-local" required className="w-full p-2 border rounded mt-1"
                                        value={formData.dataFim} onChange={e => setFormData({ ...formData, dataFim: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500">Local</label>
                                    <input type="text" className="w-full p-2 border rounded mt-1"
                                        value={formData.local} onChange={e => setFormData({ ...formData, local: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Vagas</label>
                                        <input type="number" required className="w-full p-2 border rounded mt-1"
                                            value={formData.totalVagas} onChange={e => setFormData({ ...formData, totalVagas: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500">Horas</label>
                                        <input type="number" step="0.5" required className="w-full p-2 border rounded mt-1"
                                            value={formData.cargaHoraria} onChange={e => setFormData({ ...formData, cargaHoraria: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                                    {editingId ? 'Atualizar' : 'Criar Subevento'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4">
                {subeventos.map(sub => (
                    <Card key={sub.id} className="hover:shadow-md transition group">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800">{sub.nome}</h3>
                                <div className="flex gap-4 text-xs text-slate-500 mt-1">
                                    <span>{formatDate(sub.dataInicio, 'dd/MM HH:mm')} - {formatDate(sub.dataFim, 'HH:mm')}</span>
                                    <span>•</span>
                                    <span>{sub.local || 'Local não definido'}</span>
                                    <span>•</span>
                                    <span className={sub._count?.inscricoesSubevento >= sub.totalVagas ? 'text-red-600 font-bold' : ''}>
                                        {sub._count?.inscricoesSubevento || 0} / {sub.totalVagas} vagas ocupadas
                                    </span>
                                    <span>•</span>
                                    <span className="font-semibold text-primary">{sub.cargaHoraria}h</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                <Button variant="outline" size="sm" onClick={() => startEdit(sub)}>
                                    <Edit2 size={14} />
                                </Button>
                                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(sub.id)}>
                                    < Trash2 size={14} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {subeventos.length === 0 && !showForm && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl bg-slate-50">
                        <p className="text-slate-400">Nenhum subevento cadastrado.</p>
                        <Button variant="link" onClick={() => setShowForm(true)}>Clique aqui para adicionar o primeiro</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
