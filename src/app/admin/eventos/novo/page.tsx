'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import R2ImageUploader from '@/components/admin/R2ImageUploader'
import CertificateEditor from '@/components/admin/CertificateEditor'

export default function NovoEventoPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        nome: '',
        slug: '',
        descricao: '',
        local: '',
        dataInicio: '',
        dataFim: '',
        totalVagas: 50,
        tipo: 'GRATUITO',
        status: 'PUBLISHED',
        temSubeventos: false,
        cargaHorariaBase: 2,
        limiteSubeventosPorAluno: 0,
        preco: 0,
        bannerUrl: '',
        certificado: {
            fundoUrl: undefined,
            template: null, // O editor usará o default se for null
            ativo: true
        } as any
    })

    // Auto-gerar slug simples a partir do nome
    const onNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nome = e.target.value
        const slug = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        setFormData({ ...formData, nome, slug })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (new Date(formData.dataInicio) >= new Date(formData.dataFim)) {
            toast.error('A data de início deve ser anterior à data de término')
            return
        }

        setLoading(true)
        try {
            const res = await apiFetch('/api/admin/eventos', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    totalVagas: Number(formData.totalVagas),
                    cargaHorariaBase: Number(formData.cargaHorariaBase),
                    limiteSubeventosPorAluno: Number(formData.limiteSubeventosPorAluno),
                    preco: formData.tipo === 'PAGO' ? Number(formData.preco) : null,
                    dataInicio: new Date(formData.dataInicio).toISOString(),
                    dataFim: new Date(formData.dataFim).toISOString(),
                }),
                isAdmin: true
            })

            if (res.ok) {
                toast.success('Evento criado com sucesso!')
                router.push('/admin/eventos')
            } else {
                const error = await res.json()
                toast.error(error.error?.message || 'Erro ao criar evento')
            }
        } catch (err) {
            toast.error('Erro de conexão')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <Link href="/admin/eventos" className="flex items-center text-sm text-slate-500 hover:text-primary transition">
                <ArrowLeft size={16} className="mr-2" /> Voltar para lista
            </Link>

            <Card className="border-none shadow-md bg-white">
                <CardHeader>
                    <CardTitle>Criar Novo Evento</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1 block">Nome do Evento</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={formData.nome}
                                    onChange={onNomeChange}
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
                                        value={formData.preco}
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
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={formData.local}
                                    onChange={e => setFormData({ ...formData, local: e.target.value })}
                                    placeholder="Ex: Auditório Principal"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <R2ImageUploader
                                    label="Banner do Evento"
                                    onUploadSuccess={(url) => setFormData({ ...formData, bannerUrl: url })}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm font-medium mb-1 block">Descrição</label>
                                <textarea
                                    rows={4}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={formData.descricao}
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
                                <label className="text-sm font-medium mb-1 block">Status Inicial</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="DRAFT">Rascunho (Privado)</option>
                                    <option value="PUBLISHED">Publicado (Visível)</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 border-t pt-8 mt-2">
                                <h3 className="font-bold text-lg mb-4 text-slate-800">Carga Horária e Subeventos</h3>
                                <div className="flex items-center gap-2 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <input
                                        type="checkbox"
                                        id="temSubeventos"
                                        checked={formData.temSubeventos}
                                        onChange={e => setFormData({ ...formData, temSubeventos: e.target.checked })}
                                        className="h-5 w-5 text-primary rounded"
                                    />
                                    <label htmlFor="temSubeventos" className="text-sm font-semibold cursor-pointer text-slate-700">
                                        Este evento possui subeventos (Workshops, Palestras específicas)?
                                    </label>
                                </div>

                                {!formData.temSubeventos ? (
                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <label className="text-sm font-bold mb-1 block text-slate-700">Carga Horária Base (horas)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            className="w-full p-2 border rounded md:w-1/3 outline-none focus:ring-2 focus:ring-primary/20"
                                            value={formData.cargaHorariaBase}
                                            onChange={e => setFormData({ ...formData, cargaHorariaBase: Number(e.target.value) })}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-2 italic">* Essa carga horária será impressa no certificado único do evento.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <label className="text-sm font-bold mb-1 block text-slate-700">Limite de subeventos por Aluno</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded md:w-1/3 outline-none focus:ring-2 focus:ring-primary/20"
                                            value={formData.limiteSubeventosPorAluno}
                                            onChange={e => setFormData({ ...formData, limiteSubeventosPorAluno: Number(e.target.value) })}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-2 italic">* 0 = Sem limite. O aluno pode se inscrever em todas as atividades.</p>
                                    </div>
                                )}
                            </div>

                            {/* SEÇÃO DE CERTIFICADO */}
                            <div className="md:col-span-2 pt-8 border-t">
                                <CertificateEditor
                                    config={formData.certificado}
                                    onChange={(config) => setFormData({ ...formData, certificado: config })}
                                    eventoNome={formData.nome}
                                    cargaHoraria={formData.cargaHorariaBase}
                                    dataInicio={formData.dataInicio}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-8 border-t">
                            <Button type="submit" size="lg" disabled={loading} className="w-full md:w-auto h-12 px-8 text-lg font-bold shadow-lg shadow-primary/20">
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                Criar Evento e Configurar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
