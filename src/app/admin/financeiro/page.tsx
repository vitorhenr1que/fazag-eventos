'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api-client'
import { celulaCsv, resumirFinanceiro, situacaoDoRegistro, situacoesFinanceiras, type RegistroFinanceiro, type RegistroReembolso, type PagamentoMantido } from '@/lib/relatorio-financeiro'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminSession } from '@/components/admin/AdminSessionContext'
import { hasAdminPermission } from '@/lib/admin-permissions'

interface Cancelado extends RegistroFinanceiro { alunoNome: string; createdAt: string; responsavelCancelamento: string; motivo: string | null }
interface ReservaFinanceira { id: string; inscricaoId: string; valor: string; txid: string; createdAt: string; expiresAt: string }
interface EventoFinanceiro { reservasPix: ReservaFinanceira[]; pagamentosCancelados: Cancelado[]; id: string; nome: string; preco: string | null; tipo: string; inscricoes: RegistroFinanceiro[]; reembolsos: RegistroReembolso[]; pagamentosMantidos: PagamentoMantido[]; exclusoesEmProcessamento: number }
const moeda = (valor: string | number | null) => valor === null ? 'Não registrado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))
const data = (valor: string | null | undefined) => valor ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

export default function FinanceiroPage() {
    const session = useAdminSession()
    const [eventos, setEventos] = useState<{ id: string; nome: string }[]>([])
    const [eventoId, setEventoId] = useState('')
    const [evento, setEvento] = useState<EventoFinanceiro | null>(null)
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState('')
    const [busca, setBusca] = useState('')
    const [situacao, setSituacao] = useState('TODOS')
    const [revisao, setRevisao] = useState(0)
    const [acao, setAcao] = useState<{ tipo: 'REEMBOLSO' | 'CANCELAMENTO'; id: string; nome: string; valor: string | number | null } | null>(null)
    const [motivo, setMotivo] = useState('')
    const [valorHistorico, setValorHistorico] = useState('')
    const [processando, setProcessando] = useState(false)
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => { if (acao) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [acao])

    useEffect(() => {
        setEventoId(new URLSearchParams(window.location.search).get('eventoId') || '')
    }, [])

    useEffect(() => {
        let ativo = true
        setLoading(true); setErro(''); setEvento(null)
        async function carregar() {
            try {
                const res = await apiFetch(`/api/admin/financeiro${eventoId ? `?eventoId=${encodeURIComponent(eventoId)}` : ''}`, { isAdmin: true })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error?.message || 'Não foi possível carregar o relatório')
                if (ativo) { setEventos(json.data.eventos); setEvento(json.data.evento) }
            } catch (error) { if (ativo) setErro(error instanceof Error ? error.message : 'Erro de conexão') }
            finally { if (ativo) setLoading(false) }
        }
        carregar()
        return () => { ativo = false }
    }, [eventoId, revisao])

    const registros = evento?.inscricoes ?? []
    const reembolsos = evento?.reembolsos ?? []
    const mantidos = evento?.pagamentosMantidos ?? []
    const resumo = resumirFinanceiro(registros, Number(evento?.preco ?? 0), reembolsos, mantidos)
    const mantidosFiltrados = mantidos.filter(i => (situacao === 'TODOS' || situacaoDoRegistro(i) === situacao)
        && `${i.aluno.nome} ${i.aluno.email ?? ''} ${i.aluno.id}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
    const filtrados = registros.filter(i => (situacao === 'TODOS' || situacaoDoRegistro(i) === situacao)
        && `${i.aluno.nome} ${i.aluno.email ?? ''} ${i.aluno.id}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
    const reembolsosFiltrados = reembolsos.filter(r => `${r.alunoNome} ${r.alunoEmail ?? ''} ${r.alunoId}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))

    function abrirAcao(tipo: 'REEMBOLSO' | 'CANCELAMENTO', id: string, nome: string, valor: string | number | null) {
        setMotivo(''); setValorHistorico(''); setAcao({ tipo, id, nome, valor })
    }

    async function confirmarAcao() {
        if (!acao || processando) return
        const valor = Number(valorHistorico.replace(',', '.'))
        if (acao.tipo === 'REEMBOLSO' && acao.valor === null && (!valorHistorico.trim() || !Number.isFinite(valor) || valor <= 0)) {
            toast.error('Informe o valor pago nesta inscrição antiga'); return
        }
        setProcessando(true)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${acao.id}/financeiro`, {
                method: 'POST', isAdmin: true, body: JSON.stringify({ acao: acao.tipo, motivo,
                    ...(acao.tipo === 'REEMBOLSO' && acao.valor === null ? { valorHistorico: valor } : {}) }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Não foi possível concluir a operação')
            toast.success(acao.tipo === 'REEMBOLSO' ? 'Reembolso registrado e inscrição excluída' : 'Pagamento cancelado. Inscrição voltou para Pendentes')
            setAcao(null)
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro de conexão') }
        finally { setProcessando(false); setRevisao(r => r + 1) }
    }

    function auditoria(registro: { reservaPixId?: string | null; dataTransferencia?: string | null }) {
        const reserva = evento?.reservasPix.find(r => r.id === registro.reservaPixId)
        return <div className="text-xs mt-2 break-all">Transferência: {data(registro.dataTransferencia)}<br />Reserva: {registro.reservaPixId || 'Sem reserva'}
            {reserva && <><br />txid: {reserva.txid}<br />Valor reservado: {moeda(reserva.valor)}<br />Prazo: {data(reserva.createdAt)} até {data(reserva.expiresAt)}</>}
        </div>
    }

    function exportar() {
        if (!evento) return
        const linhas: unknown[][] = [
            ['Evento', evento.nome], ['Inscritos', resumo.inscritos], ['Confirmados', resumo.confirmados], ['Pagos', resumo.pagos],
            ['Isentos', resumo.isentos], ['Pendentes', resumo.pendentes], ['Sem registro financeiro', resumo.semRegistro],
            ['Arrecadado (R$)', resumo.recebido.toFixed(2)], ['Descontos (R$)', resumo.descontos.toFixed(2)],
            ['Total reembolsado (R$)', resumo.reembolsado.toFixed(2)], ['Saldo após reembolsos (R$)', resumo.saldo.toFixed(2)],
            ['Reembolsos concluídos', resumo.qtdReembolsos], ['Reembolsos em processamento', resumo.reembolsosEmProcessamento],
            ['Isenções (R$)', resumo.isencoes.toFixed(2)], ['Pendente estimado (R$)', resumo.aReceber.toFixed(2)],
            ['Observação', 'Arrecadação inclui somente valores registrados. Aprovações antigas sem valores não entram na receita.'],
            ['Estimativa de pendências', 'Preço atual; reservas são reconhecidas mediante conferência do comprovante.'],
            ['Pendências sem valor de referência', resumo.pendentesSemValor],
            ['Detalhamento conforme filtros', filtrados.length], [],
            ['Aluno', 'ID aluno', 'Email', 'Status inscrição', 'Situação financeira', 'Referência (R$)', 'Pago (R$)', 'Desconto / isenção (R$)', 'Inscrição', 'Aprovação', 'Responsável', 'Observação', 'Reserva usada', 'Transferência'],
            ...filtrados.map(i => [i.aluno.nome, i.aluno.id, i.aluno.email, i.status, situacoesFinanceiras[situacaoDoRegistro(i)],
                i.valorReferencia === null ? 'Não registrado' : Number(i.valorReferencia).toFixed(2),
                i.valorPago === null ? 'Não registrado' : Number(i.valorPago).toFixed(2),
                i.valorDesconto === null ? 'Não registrado' : Number(i.valorDesconto).toFixed(2),
                data(i.dataInscricao), data(i.dataPagamento), i.responsavel, i.observacaoFinanceira, i.reservaPixId, data(i.dataTransferencia)]),
            [], ['Histórico de reembolsos (conforme busca por aluno)'],
            ['Aluno', 'ID aluno', 'Email', 'Valor reembolsado (R$)', 'Estado', 'Pagamento original', 'Data reembolso', 'Responsável', 'Motivo', 'Reserva usada', 'Transferência', 'Referência', 'Desconto', 'Aprovado por'],
            ...reembolsosFiltrados.map(r => [r.alunoNome, r.alunoId, r.alunoEmail, Number(r.valorPago).toFixed(2),
                r.estado, data(r.dataPagamento), data(r.dataReembolso), r.responsavelReembolso, r.motivo, r.reservaPixId, data(r.dataTransferencia), r.valorReferencia, r.valorDesconto, r.responsavel]),
            [], ['Pagamentos mantidos sem inscrição (conforme filtros)'],
            ['Aluno', 'ID aluno', 'Email', 'Situação', 'Referência (R$)', 'Recebido (R$)', 'Desconto / isenção (R$)', 'Pagamento', 'Aprovado por', 'Observação pagamento', 'Exclusão', 'Excluído por', 'Motivo', 'Reserva usada', 'Transferência'],
            ...mantidosFiltrados.map(i => [i.aluno.nome, i.aluno.id, i.aluno.email, situacoesFinanceiras[situacaoDoRegistro(i)],
                i.valorReferencia, i.valorPago, i.valorDesconto, data(i.dataPagamento), i.responsavel, i.observacaoFinanceira,
                data(i.dataExclusao), i.responsavelExclusao, i.motivo, i.reservaPixId, data(i.dataTransferencia)]),
            [], ['Pagamentos cancelados (fora dos totais)'],
            ['Aluno', 'Referência', 'Recebido', 'Desconto', 'Reserva', 'Transferência', 'Aprovação', 'Aprovado por', 'Observação', 'Cancelamento', 'Cancelado por', 'Motivo'],
            ...(evento.pagamentosCancelados ?? []).map(p => [p.alunoNome, p.valorReferencia, p.valorPago, p.valorDesconto, p.reservaPixId,
                data(p.dataTransferencia), data(p.dataPagamento), p.responsavel, p.observacaoFinanceira, data(p.createdAt), p.responsavelCancelamento, p.motivo]),
            [], ['Histórico de reservas Pix'], ['Reserva', 'Inscrição original', 'Valor', 'txid', 'Geração', 'Vencimento'],
            ...(evento.reservasPix ?? []).map(r => [r.id, r.inscricaoId, r.valor, r.txid, data(r.createdAt), data(r.expiresAt)]),
        ]
        const url = URL.createObjectURL(new Blob(['\uFEFF' + linhas.map(linha => linha.map(celulaCsv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = `financeiro-${evento.id}.csv`; link.click(); URL.revokeObjectURL(url)
    }

    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-bold text-slate-800">Relatório financeiro</h1><p className="mt-2 text-slate-600">Recebimentos e benefícios por aluno, com valores históricos preservados.</p></div>
            <Button variant="outline" onClick={exportar} disabled={!evento || loading || processando}><Download size={16} className="mr-2" />Exportar CSV</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5">
            <div className="flex-1 min-w-48"><label htmlFor="evento-financeiro" className="block text-sm font-semibold mb-2">Evento</label>
                <select id="evento-financeiro" disabled={processando} className="w-full border rounded-md p-2" value={eventoId} onChange={e => { setEventoId(e.target.value); setBusca(''); setSituacao('TODOS') }}>
                    <option value="">Selecione um evento</option>{eventos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
            </div>
            <Button variant="outline" disabled={loading || processando} onClick={() => setRevisao(r => r + 1)}>Atualizar</Button>
        </div>
        {loading ? <p role="status" className="flex gap-2 text-slate-600"><Loader2 size={20} className="animate-spin" />Carregando relatório...</p>
        : erro ? <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{erro}</p>
        : !evento ? <p className="p-8 text-center text-slate-500">Selecione um evento para consultar os inscritos e os recebimentos.</p>
        : <>
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold text-slate-800">{evento.nome}</h2>
                {hasAdminPermission(session.role, 'GESTAO') && <Link href={`/admin/eventos/${evento.id}/inscricoes`} className="text-blue-700 underline">Ver inscrições</Link>}</div>
            <p className="text-sm text-slate-500">Preço atual: {moeda(evento.preco)}. Os recebimentos usam os valores registrados na aprovação.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ['Total de inscritos', resumo.inscritos], ['Confirmados', resumo.confirmados], ['Pagos (inclui descontos)', resumo.pagos],
                    ['Pagos com desconto', resumo.comDesconto], ['Isentos', resumo.isentos], ['Gratuitos', resumo.gratuitos],
                    ['Pendentes', resumo.pendentes], ['Sem registro financeiro', resumo.semRegistro],
                    ['Arrecadado bruto', moeda(resumo.recebido)], ['Descontos de inscrições atuais', moeda(resumo.descontos)],
                    ['Valor das isenções', moeda(resumo.isencoes)], ['A receber (estimativa)', moeda(resumo.aReceber)],
                    ['Reembolsos concluídos', resumo.qtdReembolsos], ['Total reembolsado', moeda(resumo.reembolsado)],
                    ['Saldo após reembolsos', moeda(resumo.saldo)], ['Reembolsos em processamento', resumo.reembolsosEmProcessamento],
                    ['Recebimentos mantidos sem inscrição', moeda(resumo.valorMantido)], ['Registros mantidos sem inscrição', resumo.pagamentosMantidos],
                ].map(([titulo, valor]) => <div key={titulo} className={`rounded-xl border bg-white p-5 ${titulo === 'Saldo após reembolsos' ? 'border-green-300 bg-green-50' : ''}`}>
                    <p className="text-sm text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-bold text-slate-800 tabular-nums">{valor}</p>
                </div>)}
            </div>
            <p className="text-sm text-slate-600">O bruto inclui pagamentos posteriormente reembolsados e pagamentos mantidos após excluir a inscrição. O saldo desconta as devoluções. Exclusões completas e cancelamentos de pagamento saem dos totais sem gerar reembolso. Os inscritos e pagos contam somente as inscrições atuais.</p>
            {evento.exclusoesEmProcessamento > 0 && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">Há exclusão em processamento. O ADMINISTRADOR deve concluí-la na lista de inscritos antes de considerar os totais definitivos.</p>}
            {resumo.reembolsosEmProcessamento > 0 && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">Há reembolso(s) em processamento. Use “Concluir reembolso” no histórico para finalizar a exclusão e atualizar os totais.</p>}
            <p className="text-sm text-slate-600">O valor a receber estima as pendências pelo preço atual, preservando ajustes financeiros explícitos. Reservas serão reconhecidas na conferência do comprovante. {resumo.pendentesSemValor > 0 && `${resumo.pendentesSemValor} pendência(s) ainda não possuem referência registrada.`} {resumo.semRegistro > 0 && 'Aprovações antigas sem valores registrados não entram na arrecadação.'}</p>
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-48"><label htmlFor="busca-aluno" className="block text-sm font-medium mb-1">Buscar aluno, email ou ID</label><Input id="busca-aluno" value={busca} onChange={e => setBusca(e.target.value)} /></div>
                <div><label htmlFor="filtro-situacao" className="block text-sm font-medium mb-1">Situação financeira</label>
                    <select id="filtro-situacao" className="border rounded-md p-2 bg-white" value={situacao} onChange={e => setSituacao(e.target.value)}>
                        <option value="TODOS">Todas</option>{Object.entries(situacoesFinanceiras).map(([valor, titulo]) => <option key={valor} value={valor}>{titulo}</option>)}
                    </select>
                </div>
            </div>
            <p className="text-sm text-slate-500" aria-live="polite">{filtrados.length} de {registros.length} inscritos exibidos. Os totais acima são do evento inteiro.</p>
            <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-left text-sm">
                    <caption className="sr-only">Detalhamento financeiro dos inscritos em {evento.nome}</caption>
                    <thead className="bg-slate-50 text-slate-600"><tr>{['Aluno', 'Situação / inscrição', 'Valor de referência', 'Recebido', 'Desconto / isenção', 'Datas', 'Responsável / observação', 'Ações'].map(t => <th key={t} scope="col" className="px-4 py-3 whitespace-nowrap">{t}</th>)}</tr></thead>
                    <tbody className="divide-y">{filtrados.map(i => <tr key={i.id} className="hover:bg-slate-50">
                        <td className="p-4"><p className="font-semibold">{i.aluno.nome}</p><p className="text-xs text-slate-500">{i.aluno.email || i.aluno.id}</p></td>
                        <td className="p-4"><span className={`rounded px-2 py-1 text-xs font-semibold ${['PAGO', 'DESCONTO'].includes(situacaoDoRegistro(i)) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>{situacoesFinanceiras[situacaoDoRegistro(i)]}</span><p className="mt-2 text-xs text-slate-500">{i.status}</p></td>
                        <td className="p-4 tabular-nums whitespace-nowrap">{moeda(i.valorReferencia)}</td>
                        <td className="p-4 tabular-nums whitespace-nowrap font-semibold">{moeda(i.valorPago)}</td>
                        <td className="p-4 tabular-nums whitespace-nowrap">{moeda(i.valorDesconto)}</td>
                        <td className="p-4 text-xs whitespace-nowrap">Inscrição: {data(i.dataInscricao)}<br />Aprovação: {data(i.dataPagamento)}{auditoria(i)}</td>
                        <td className="p-4"><p>{i.responsavel || '—'}</p><p className="text-xs text-slate-500 break-words max-w-xs">{i.observacaoFinanceira || '—'}</p></td>
                        <td className="p-4">
                            {i.exclusaoEmProcessamento ? <span className="text-xs text-amber-700">Exclusão em processamento</span>
                            : i.reembolsoEmProcessamento ? <span className="text-xs text-amber-700">Reembolso em processamento</span>
                            : i.status === 'CONFIRMADA' && i.situacaoFinanceira !== 'GRATUITO' && (evento.tipo === 'PAGO' || ['PAGO', 'DESCONTO', 'ISENTO'].includes(i.situacaoFinanceira || '')) ? <div className="flex flex-col gap-2">
                                {(i.valorPago === null || Number(i.valorPago) > 0) && <Button size="sm" variant="outline" className="text-red-700" disabled={processando}
                                    onClick={() => abrirAcao('REEMBOLSO', i.id, i.aluno.nome, i.valorPago)}>Reembolsar</Button>}
                                <Button size="sm" variant="outline" disabled={processando} onClick={() => abrirAcao('CANCELAMENTO', i.id, i.aluno.nome, i.valorPago)}>Cancelar pagamento</Button>
                            </div> : <span className="text-slate-400">—</span>}
                        </td>
                    </tr>)}{filtrados.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">Nenhuma inscrição encontrada.</td></tr>}</tbody>
                </table>
            </div>
            <section className="space-y-3" aria-labelledby="mantidos-titulo">
                <h2 id="mantidos-titulo" className="text-xl font-bold text-slate-800">Pagamentos mantidos sem inscrição</h2>
                <p className="text-sm text-slate-500">Os valores registrados continuam na arrecadação, sem contar o aluno como inscrito e sem registrar reembolso. A busca e o filtro de situação também se aplicam aqui.</p>
                {resumo.mantidosSemValor > 0 && <p className="text-sm text-amber-800">{resumo.mantidosSemValor} aprovação(ões) antiga(s) sem valor registrado não entra(m) na arrecadação.</p>}
                <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
                    <thead className="bg-slate-50"><tr>{['Aluno', 'Situação', 'Referência', 'Recebido', 'Desconto / isenção', 'Pagamento / responsável', 'Exclusão / responsável', 'Observações'].map(t => <th key={t} scope="col" className="p-4 whitespace-nowrap">{t}</th>)}</tr></thead>
                    <tbody className="divide-y">{mantidosFiltrados.map(i => <tr key={i.id}>
                        <td className="p-4"><p className="font-semibold">{i.aluno.nome}</p><p className="text-xs text-slate-500">{i.aluno.email || i.aluno.id}</p></td>
                        <td className="p-4">{situacoesFinanceiras[situacaoDoRegistro(i)]}</td><td className="p-4 whitespace-nowrap">{moeda(i.valorReferencia)}</td>
                        <td className="p-4 font-semibold whitespace-nowrap">{moeda(i.valorPago)}</td><td className="p-4 whitespace-nowrap">{moeda(i.valorDesconto)}</td>
                        <td className="p-4">{data(i.dataPagamento)}<p className="text-xs text-slate-500">{i.responsavel || '—'}</p>{auditoria(i)}</td>
                        <td className="p-4">{data(i.dataExclusao)}<p className="text-xs text-slate-500">{i.responsavelExclusao || '—'}</p></td>
                        <td className="p-4"><p>{i.observacaoFinanceira || '—'}</p><p className="text-xs text-slate-500">Motivo da exclusão: {i.motivo || '—'}</p></td>
                    </tr>)}{mantidosFiltrados.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nenhum pagamento mantido sem inscrição.</td></tr>}</tbody>
                </table></div>
            </section>
            <section className="space-y-3" aria-labelledby="reembolsos-titulo">
                <h2 id="reembolsos-titulo" className="text-xl font-bold text-slate-800">Histórico de reembolsos</h2>
                <p className="text-sm text-slate-500">O histórico permanece após excluir a inscrição. A busca por aluno também filtra esta lista.</p>
                <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
                    <thead className="bg-slate-50"><tr>{['Aluno', 'Valor devolvido', 'Estado', 'Data', 'Responsável', 'Motivo', 'Ação'].map(t => <th key={t} scope="col" className="p-4 whitespace-nowrap">{t}</th>)}</tr></thead>
                    <tbody className="divide-y">{reembolsosFiltrados.map(r => <tr key={r.id}>
                        <td className="p-4"><p className="font-semibold">{r.alunoNome}</p><p className="text-xs text-slate-500">{r.alunoEmail || r.alunoId}</p></td>
                        <td className="p-4 font-semibold whitespace-nowrap">{moeda(r.valorPago)}</td><td className="p-4">{r.estado === 'CONCLUIDO' ? 'Reembolsado' : 'Em processamento'}</td>
                        <td className="p-4 whitespace-nowrap">Reembolso: {data(r.dataReembolso)}<br />Aprovação: {data(r.dataPagamento)}<br />Aprovado por: {r.responsavel || '—'}{auditoria(r)}<p>Referência: {moeda(r.valorReferencia)} · Desconto: {moeda(r.valorDesconto)}</p></td><td className="p-4">{r.responsavelReembolso || '—'}</td><td className="p-4">{r.motivo || '—'}</td>
                        <td className="p-4">{r.estado !== 'CONCLUIDO' ? <Button size="sm" variant="outline" disabled={processando}
                            onClick={() => abrirAcao('REEMBOLSO', r.inscricaoOriginalId, r.alunoNome, r.valorPago)}>Concluir reembolso</Button> : '—'}</td>
                    </tr>)}{reembolsosFiltrados.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Nenhum reembolso registrado.</td></tr>}</tbody>
                </table></div>
            </section>
            <section className="space-y-3" aria-labelledby="cancelados-titulo">
                <h2 id="cancelados-titulo" className="text-xl font-bold">Histórico de pagamentos cancelados</h2>
                <p className="text-sm text-slate-500">Registros preservados para auditoria, fora dos totais financeiros.</p>
                {(evento.pagamentosCancelados ?? []).map(p => <div key={p.id} className="rounded border bg-white p-4">
                    <p className="font-semibold">{p.alunoNome} · Referência: {moeda(p.valorReferencia)} · Recebido: {moeda(p.valorPago)} · Desconto: {moeda(p.valorDesconto)}</p>
                    <p className="text-sm">Aprovação: {data(p.dataPagamento)} · {p.responsavel || '—'} · {p.observacaoFinanceira || '—'}</p>
                    {auditoria(p)}<p className="text-sm">Cancelamento: {data(p.createdAt)} · {p.responsavelCancelamento} · {p.motivo || '—'}</p>
                </div>)}
            </section>
        </>}
        <dialog ref={dialogRef} aria-labelledby="acao-financeira-titulo" className="m-auto w-full max-w-lg rounded-xl p-6 backdrop:bg-slate-900/50"
            onCancel={e => { if (processando) e.preventDefault(); else setAcao(null) }}>
            {acao && <form className="space-y-4" onSubmit={e => { e.preventDefault(); confirmarAcao() }}>
                <h2 id="acao-financeira-titulo" className="text-xl font-bold">{acao.tipo === 'REEMBOLSO' ? 'Registrar reembolso e excluir inscrição' : 'Cancelar pagamento'}</h2>
                <p className="font-semibold">{acao.nome}</p>
                {acao.tipo === 'REEMBOLSO' ? <>
                    <p className="text-sm text-slate-600">O registro confirma a devolução integral do valor pago. A inscrição, atividades escolhidas, presenças e certificado vinculados serão excluídos. O reembolso permanecerá no relatório.</p>
                    {acao.valor === null ? <div><label htmlFor="valor-historico" className="block text-sm font-semibold mb-1">Valor efetivamente pago nesta inscrição antiga (R$)</label>
                        <Input id="valor-historico" inputMode="decimal" required value={valorHistorico} onChange={e => setValorHistorico(e.target.value)} autoFocus />
                        <p className="mt-1 text-xs text-amber-700">O pagamento antigo não possui valor registrado. Informe o valor real, considerando o lote e eventual desconto da época.</p>
                    </div> : <p className="rounded bg-red-50 p-3 font-semibold text-red-700">Valor a reembolsar: {moeda(acao.valor)}</p>}
                    <label htmlFor="motivo-reembolso" className="block text-sm font-semibold">Motivo (opcional)</label>
                    <Input id="motivo-reembolso" maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
                </> : <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">O pagamento ou isenção será removido dos totais. O aluno voltará a Pendentes aguardando nova aprovação, com nova conferência pelo preço atual. O histórico do pagamento cancelado será preservado. Esta ação não registra reembolso.</p>}
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={processando} onClick={() => setAcao(null)}>Voltar</Button>
                    <Button type="submit" className={acao.tipo === 'REEMBOLSO' ? 'bg-red-600 hover:bg-red-700' : ''} disabled={processando}>
                        {processando ? 'Processando...' : acao.tipo === 'REEMBOLSO' ? 'Confirmar reembolso e exclusão' : 'Confirmar cancelamento'}
                    </Button></div>
            </form>}
        </dialog>
    </div>
}
