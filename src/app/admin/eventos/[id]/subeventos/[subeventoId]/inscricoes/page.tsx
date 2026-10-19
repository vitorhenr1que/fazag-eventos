'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Search, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

interface Aluno { id: string; nome: string; email: string | null }
interface Inscrito {
    id: string
    inscricaoId: string
    dataInscricao: string
    checkIn: { dataHora: string } | null
    inscricao: { status: string; aluno: Aluno }
}
interface Candidato { id: string; aluno: Aluno; _count: { subeventosEscolhidos: number } }
interface Dados {
    subevento: { id: string; nome: string; eventoId: string; totalVagas: number; evento: { nome: string; limiteSubeventosPorAluno: number | null } }
    inscritos: Inscrito[]
    candidatos: Candidato[]
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const corresponde = (aluno: Aluno, busca: string) => normalizar(`${aluno.nome} ${aluno.id} ${aluno.email || ''}`).includes(normalizar(busca))

export default function InscritosSubeventoPage() {
    const { id: eventoId, subeventoId } = useParams<{ id: string; subeventoId: string }>()
    const [dados, setDados] = useState<Dados | null>(null)
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState('')
    const [processando, setProcessando] = useState<string | null>(null)
    const [buscaInscritos, setBuscaInscritos] = useState('')
    const [buscaAdicionar, setBuscaAdicionar] = useState('')
    const [mostrarAdicionar, setMostrarAdicionar] = useState(false)
    const endpoint = `/api/admin/subeventos/${subeventoId}/inscricoes`

    const carregar = useCallback(async (signal?: AbortSignal) => {
        const res = await apiFetch(endpoint, { isAdmin: true, signal, cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message || 'Não foi possível carregar os inscritos')
        if (json.data.subevento.eventoId !== eventoId) throw new Error('Subevento não pertence a este evento')
        if (signal?.aborted) return
        setDados(json.data)
        setErro('')
    }, [endpoint, eventoId])

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setDados(null)
        carregar(controller.signal)
            .catch(error => { if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Erro de conexão') })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [carregar])

    async function alterar(inscricaoId: string, nome: string, metodo: 'POST' | 'DELETE') {
        if (processando) return
        if (metodo === 'DELETE' && !window.confirm(`Remover ${nome} deste subevento? A presença neste subevento também será removida. A inscrição no evento principal e certificados já emitidos serão mantidos.`)) return
        setProcessando(inscricaoId)
        try {
            const res = await apiFetch(endpoint, { isAdmin: true, method: metodo, body: JSON.stringify({ inscricaoId }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Não foi possível alterar a inscrição')
            toast.success(metodo === 'POST' ? 'Aluno adicionado ao subevento' : 'Aluno removido do subevento')
            await carregar().catch(() => setErro('Alteração salva, mas não foi possível atualizar a lista. Tente carregar novamente.'))
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro de conexão')
            await carregar().catch(() => setErro('Não foi possível atualizar a lista. Tente carregar novamente.'))
        } finally { setProcessando(null) }
    }

    const inscritos = dados?.inscritos.filter(item => corresponde(item.inscricao.aluno, buscaInscritos)) ?? []
    const candidatos = dados?.candidatos.filter(item => corresponde(item.aluno, buscaAdicionar)) ?? []
    const limite = dados?.subevento.evento.limiteSubeventosPorAluno
    const lotado = Boolean(dados && dados.inscritos.length >= dados.subevento.totalVagas)

    return <div className="max-w-5xl mx-auto space-y-6">
        <Link href={`/admin/eventos/${eventoId}/subeventos`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary">
            <ArrowLeft size={16} /> Voltar aos subeventos
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <p className="text-sm text-slate-500">{dados?.subevento.evento.nome}</p>
                <h1 className="text-2xl font-bold">Inscritos{dados ? `: ${dados.subevento.nome}` : ' no subevento'}</h1>
                {dados && <p className="mt-1 text-sm text-slate-500" aria-live="polite">{dados.inscritos.length} de {dados.subevento.totalVagas} vagas ocupadas</p>}
            </div>
            <Button disabled={!dados || Boolean(processando) || Boolean(erro)} onClick={() => setMostrarAdicionar(!mostrarAdicionar)} aria-expanded={mostrarAdicionar} aria-controls="adicionar-aluno">
                <Plus size={18} className="mr-2" /> {mostrarAdicionar ? 'Fechar inclusão' : 'Adicionar aluno'}
            </Button>
        </div>

        {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {erro}
            <Button variant="link" disabled={Boolean(processando)} onClick={() => carregar().catch(error => setErro(error instanceof Error ? error.message : 'Erro de conexão'))}>Tentar novamente</Button>
        </div>}
        {loading && <p role="status" className="flex items-center justify-center gap-2 p-12 text-slate-500"><Loader2 className="animate-spin" size={20} /> Carregando inscritos...</p>}

        {dados && !loading && <>
            {mostrarAdicionar && <Card id="adicionar-aluno" className="border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg">Adicionar aluno</CardTitle>
                    <p className="text-sm text-slate-500">Selecione um aluno com inscrição confirmada no evento principal{limite ? `. Limite de ${limite} subevento(s) por aluno.` : '.'}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <label htmlFor="busca-adicionar" className="block text-sm font-medium">Buscar aluno para adicionar</label>
                    <input id="busca-adicionar" type="search" value={buscaAdicionar} onChange={e => setBuscaAdicionar(e.target.value)} placeholder="Nome, matrícula ou e-mail" className="w-full rounded-md border p-2 text-sm" />
                    {lotado && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Todas as vagas estão ocupadas. Remova um inscrito para liberar uma vaga.</p>}
                    <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
                        {candidatos.map(candidato => {
                            const limiteAtingido = Boolean(limite && candidato._count.subeventosEscolhidos >= limite)
                            return <li key={candidato.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold break-words">{candidato.aluno.nome}</p>
                                    <p className="text-xs text-slate-500 break-words">{candidato.aluno.id}{candidato.aluno.email ? ` · ${candidato.aluno.email}` : ''}</p>
                                    {limiteAtingido && <p className="text-xs text-amber-800">Limite de subeventos atingido</p>}
                                </div>
                                <Button size="sm" variant="outline" disabled={lotado || limiteAtingido || Boolean(processando) || Boolean(erro)} aria-label={`Adicionar ${candidato.aluno.nome} ao subevento`} onClick={() => alterar(candidato.id, candidato.aluno.nome, 'POST')}>
                                    {processando === candidato.id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Plus size={14} className="mr-2" />} Adicionar
                                </Button>
                            </li>
                        })}
                        {candidatos.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{buscaAdicionar ? 'Nenhum aluno encontrado nesta busca.' : 'Não há outros alunos confirmados disponíveis para adicionar.'}</li>}
                    </ul>
                </CardContent>
            </Card>}

            <Card>
                <CardHeader className="gap-3">
                    <CardTitle className="flex items-center gap-2 text-lg"><Users size={20} /> Alunos inscritos ({dados.inscritos.length})</CardTitle>
                    <label htmlFor="busca-inscritos" className="text-sm font-medium">Buscar nos inscritos</label>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-3 text-slate-400" aria-hidden="true" />
                        <input id="busca-inscritos" type="search" value={buscaInscritos} onChange={e => setBuscaInscritos(e.target.value)} placeholder="Nome, matrícula ou e-mail" className="w-full rounded-md border py-2 pl-9 pr-3 text-sm" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr>
                                <th scope="col" className="p-3">Aluno</th><th scope="col" className="p-3">Inscrição</th><th scope="col" className="p-3">Presença</th><th scope="col" className="p-3 text-right">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {inscritos.map(item => <tr key={item.id}>
                                    <td className="p-3"><p className="font-semibold">{item.inscricao.aluno.nome}</p><p className="text-xs text-slate-500">{item.inscricao.aluno.id}</p>{item.inscricao.aluno.email && <p className="text-xs text-slate-500 break-all">{item.inscricao.aluno.email}</p>}</td>
                                    <td className="p-3"><p className="whitespace-nowrap">{formatDate(item.dataInscricao, 'dd/MM/yyyy HH:mm')}</p>{item.inscricao.status !== 'CONFIRMADA' && <p className="text-xs text-amber-800">Evento: {item.inscricao.status}</p>}</td>
                                    <td className="p-3"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${item.checkIn ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{item.checkIn ? 'Confirmada' : 'Não registrada'}</span></td>
                                    <td className="p-3 text-right"><Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" disabled={Boolean(processando) || Boolean(erro)} aria-label={`Remover ${item.inscricao.aluno.nome} deste subevento`} onClick={() => alterar(item.inscricaoId, item.inscricao.aluno.nome, 'DELETE')}>
                                        {processando === item.inscricaoId ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Trash2 size={14} className="mr-2" />} Remover
                                    </Button></td>
                                </tr>)}
                                {inscritos.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">{dados.inscritos.length === 0 ? 'Nenhum aluno inscrito neste subevento.' : 'Nenhum inscrito encontrado nesta busca.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </>}
    </div>
}
