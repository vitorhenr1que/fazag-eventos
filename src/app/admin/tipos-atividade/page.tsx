'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react'

type TipoAtividade = {
    id: string
    nome: string
    descricao: string
    cargaHorariaMaxima: number
    porcentagemAnual: number
    _count?: {
        eventos: number
    }
}

type TipoAtividadeForm = {
    nome: string
    descricao: string
    cargaHorariaMaxima: number
    porcentagemAnual: number
}

const emptyForm: TipoAtividadeForm = {
    nome: '',
    descricao: '',
    cargaHorariaMaxima: 1,
    porcentagemAnual: 0,
}

export default function TiposAtividadePage() {
    const [tipos, setTipos] = useState<TipoAtividade[]>([])
    const [formData, setFormData] = useState<TipoAtividadeForm>(emptyForm)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    async function loadTipos() {
        const res = await apiFetch('/api/admin/tipos-atividade', { isAdmin: true })
        if (res.ok) {
            const json = await res.json()
            setTipos(json.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadTipos()
    }, [])

    const resetForm = () => {
        setFormData(emptyForm)
        setEditingId(null)
    }

    const startEdit = (tipo: TipoAtividade) => {
        setEditingId(tipo.id)
        setFormData({
            nome: tipo.nome,
            descricao: tipo.descricao,
            cargaHorariaMaxima: tipo.cargaHorariaMaxima,
            porcentagemAnual: tipo.porcentagemAnual,
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const res = await apiFetch(editingId ? `/api/admin/tipos-atividade/${editingId}` : '/api/admin/tipos-atividade', {
                method: editingId ? 'PUT' : 'POST',
                isAdmin: true,
                body: JSON.stringify({
                    ...formData,
                    cargaHorariaMaxima: Number(formData.cargaHorariaMaxima),
                    porcentagemAnual: Number(formData.porcentagemAnual),
                })
            })

            if (res.ok) {
                toast.success(editingId ? 'Tipo de atividade atualizado!' : 'Tipo de atividade criado!')
                resetForm()
                await loadTipos()
            } else {
                const error = await res.json()
                toast.error(error.error?.message || 'Erro ao salvar tipo de atividade')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (tipo: TipoAtividade) => {
        if (!confirm(`Excluir o tipo de atividade "${tipo.nome}"? Eventos vinculados ficarão sem tipo definido.`)) return

        const res = await apiFetch(`/api/admin/tipos-atividade/${tipo.id}`, {
            method: 'DELETE',
            isAdmin: true,
        })

        if (res.ok) {
            toast.success('Tipo de atividade excluído!')
            await loadTipos()
        } else {
            const error = await res.json()
            toast.error(error.error?.message || 'Erro ao excluir tipo de atividade')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Tipos de Atividade</h1>
                <p className="mt-1 text-sm text-slate-500">Defina as categorias usadas no cadastro de eventos.</p>
            </div>

            <Card className="border-none shadow-md bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                        {editingId ? 'Editar Tipo de Atividade' : 'Novo Tipo de Atividade'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium mb-1 block">Tipo de Atividade</label>
                            <input
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-sm font-medium mb-1 block">Descrição</label>
                            <textarea
                                required
                                rows={3}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                value={formData.descricao}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Carga Horária máxima</label>
                            <input
                                required
                                type="number"
                                min={1}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                value={formData.cargaHorariaMaxima}
                                onChange={(e) => setFormData({ ...formData, cargaHorariaMaxima: Number(e.target.value) })}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Porcentagem anual</label>
                            <input
                                required
                                type="number"
                                min={0}
                                max={100}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                value={formData.porcentagemAnual}
                                onChange={(e) => setFormData({ ...formData, porcentagemAnual: Number(e.target.value) })}
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-2">
                            {editingId && (
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    <X size={16} className="mr-2" /> Cancelar
                                </Button>
                            )}
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
                                Salvar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Tipo de Atividade</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Carga</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Anual</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Eventos</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Carregando...</td>
                            </tr>
                        ) : (
                            tipos.map((tipo) => (
                                <tr key={tipo.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-slate-800">{tipo.nome}</p>
                                        <p className="mt-1 max-w-3xl text-xs text-slate-500">{tipo.descricao}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{tipo.cargaHorariaMaxima}h</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{tipo.porcentagemAnual}%</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{tipo._count?.eventos || 0}</td>
                                    <td className="px-6 py-4 text-right space-x-1">
                                        <Button variant="ghost" size="sm" type="button" onClick={() => startEdit(tipo)} title="Editar">
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button variant="ghost" size="sm" type="button" onClick={() => handleDelete(tipo)} title="Excluir">
                                            <Trash2 size={16} className="text-red-500" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!loading && tipos.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                        Nenhum tipo de atividade cadastrado.
                    </div>
                )}
            </div>
        </div>
    )
}
