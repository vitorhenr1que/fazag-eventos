'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

interface Evento { id: string; nome: string; descricao: string | null; local: string | null; status: string; dataInicio: string; dataFim: string; totalVagas: number; tipoAtividade: { nome: string } | null; temSubeventos: boolean }
export default function VisualizarEventoPage() {
    const { id } = useParams()
    const [evento, setEvento] = useState<Evento | null>(null)
    const [error, setError] = useState('')
    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            try {
                const res = await apiFetch(`/api/admin/eventos/${id}`, { isAdmin: true, signal: controller.signal })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error?.message || 'Não foi possível carregar o evento.')
                setEvento(json.data)
            } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Erro de conexão.') }
        }
        void load(); return () => controller.abort()
    }, [id])
    if (error) return <p role="alert">{error}</p>
    if (!evento) return <p role="status">Carregando evento...</p>
    return <div className="space-y-6"><Link href="/admin/eventos" className="text-sm text-primary underline">Voltar aos eventos</Link><h1 className="text-3xl font-bold">{evento.nome}</h1><p className="text-sm text-slate-500">Consulta do evento · {evento.status === 'PUBLISHED' ? 'Publicado' : evento.status === 'DRAFT' ? 'Rascunho' : evento.status === 'FINISHED' ? 'Encerrado' : 'Cancelado'}</p><dl className="grid gap-6 rounded-xl border bg-white p-6 sm:grid-cols-2">{[['Início', formatDate(evento.dataInicio)], ['Término', formatDate(evento.dataFim)], ['Local', evento.local || 'Não informado'], ['Vagas', evento.totalVagas], ['Tipo de atividade', evento.tipoAtividade?.nome || 'Não informado']].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><p className="whitespace-pre-wrap rounded-xl border bg-white p-6">{evento.descricao || 'Sem descrição.'}</p><div className="flex gap-4"><Link className="text-primary underline" href={`/admin/eventos/${id}/inscricoes`}>Ver inscritos</Link>{evento.temSubeventos && <Link className="text-primary underline" href={`/admin/eventos/${id}/subeventos`}>Ver subeventos</Link>}</div></div>
}
