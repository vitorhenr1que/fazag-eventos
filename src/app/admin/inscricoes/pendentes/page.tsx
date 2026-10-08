'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'

type Modalidade = 'PAGO' | 'DESCONTO' | 'ISENTO'
interface Reserva { id: string; valor: string; txid: string; createdAt: string; expiresAt: string; invalidadaAt: string | null }
interface Pendente {
    id: string; dataInscricao: string; reservasPix: Reserva[]; valorReferencia: string | null; situacaoFinanceira: string | null
    aluno: { nome: string; id: string }
    evento: { nome: string; preco: string | null; totalVagas: number; _count: { inscricoes: number } }
}
const data = (valor: string) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })
const moeda = (valor: string | null) => valor === null ? 'Não definido' : `R$ ${Number(valor).toFixed(2)}`

export default function InscricoesPendentesPage() {
    const [pendentes, setPendentes] = useState<Pendente[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [alvo, setAlvo] = useState<Pendente | null>(null)
    const [modalidade, setModalidade] = useState<Modalidade>('PAGO')
    const [quoteId, setQuoteId] = useState('')
    const [valorPago, setValorPago] = useState('')
    const [transferencia, setTransferencia] = useState('')
    const [observacao, setObservacao] = useState('')
    const [semReserva, setSemReserva] = useState(false)
    const [agora, setAgora] = useState(0)
    const relogioRef = useRef({ servidor: 0, local: 0 })
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => { if (alvo) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [alvo])
    useEffect(() => {
        let ativo = true
        async function carregar() {
            try {
                const res = await apiFetch('/api/admin/inscricoes/pendentes', { isAdmin: true })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error?.message || 'Não foi possível carregar as inscrições')
                if (ativo) {
                    setPendentes(json.data); setAgora(json.serverNow)
                    relogioRef.current = { servidor: json.serverNow, local: performance.now() }
                    const id = new URLSearchParams(window.location.search).get('inscricaoId')
                    const selecionada = json.data.find((i: Pendente) => i.id === id)
                    if (selecionada) setAlvo(selecionada)
                }
            } catch (error) { if (ativo) toast.error(error instanceof Error ? error.message : 'Erro de conexão') }
            finally { if (ativo) setLoading(false) }
        }
        carregar()
        return () => { ativo = false }
    }, [])
    useEffect(() => {
        const timer = setInterval(() => {
            const relogio = relogioRef.current
            if (relogio.servidor) setAgora(relogio.servidor + performance.now() - relogio.local)
        }, 1000)
        return () => clearInterval(timer)
    }, []) // O prazo mostrado avança a partir do relógio devolvido pelo servidor.

    function abrir(inscricao: Pendente) {
        setModalidade('PAGO'); setQuoteId(''); setValorPago(''); setTransferencia(''); setObservacao(''); setSemReserva(false); setAlvo(inscricao)
    }
    const reserva = alvo?.reservasPix.find(r => r.id === quoteId)
    const horario = transferencia ? new Date(`${transferencia}:00-03:00`).getTime() : NaN
    const dentro = reserva && horario >= Date.parse(reserva.createdAt) && horario < Date.parse(reserva.expiresAt)
        && (!reserva.invalidadaAt || horario < Date.parse(reserva.invalidadaAt))
    const ajusteExplicito = alvo && ['DESCONTO', 'ISENTO'].includes(alvo.situacaoFinanceira ?? '')
    const referencia = modalidade !== 'ISENTO' && dentro ? reserva!.valor : ajusteExplicito ? alvo!.valorReferencia : alvo?.evento.preco ?? null
    const divergente = modalidade === 'PAGO' && valorPago !== '' && Math.round(Number(valorPago.replace(',', '.')) * 100) !== Math.round(Number(referencia) * 100)

    async function aprovar() {
        if (!alvo || processing) return
        setProcessing(true)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${alvo.id}/aprovar`, {
                method: 'POST', isAdmin: true, body: JSON.stringify({ modalidade, observacao,
                    ...(modalidade !== 'ISENTO' ? {
                        valorPago: Number(valorPago.replace(',', '.')), dataTransferencia: `${transferencia}:00-03:00`,
                        ...(quoteId ? { quoteId } : { semReservaConferida: semReserva }),
                    } : {}),
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Erro ao aprovar inscrição')
            setPendentes(prev => prev.filter(p => p.id !== alvo.id)); setAlvo(null); toast.success('Inscrição aprovada')
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro de conexão') }
        finally { setProcessing(false) }
    }

    function reservas(inscricao: Pendente) {
        return inscricao.reservasPix.length ? <ul className="space-y-2">{inscricao.reservasPix.map(r => <li key={r.id} className="text-xs rounded border p-2">
            <p className="font-semibold">{moeda(r.valor)} · {r.invalidadaAt ? 'Invalidada após cancelamento' : Date.parse(r.expiresAt) > agora ? 'Prazo ativo' : 'Prazo vencido'}</p>
            <p>Geração: {data(r.createdAt)}<br />Vencimento: {data(r.expiresAt)}</p><p className="break-all">txid: {r.txid}</p>
        </li>)}</ul> : <p className="text-xs text-slate-500">Sem reservas. Conferência manual pelo preço atual.</p>
    }

    return <div className="space-y-6">
        <h1 className="text-3xl font-bold">Aprovações Pendentes</h1>
        <p className="text-sm text-slate-600">Confira o comprovante recebido pelo WhatsApp do financeiro: +55 75 98218-1138. Uma reserva vencida pode ser reconhecida se a transferência ocorreu dentro do prazo. O Pix estático copiado continua utilizável no banco após o vencimento.</p>
        <Link href="/admin/financeiro" className="text-blue-700 underline">Ver relatório financeiro</Link>
        {loading ? <p role="status">Carregando...</p> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50"><tr>{['Aluno', 'Evento / preço atual', 'Reservas Pix', 'Solicitação', 'Conferência'].map(t => <th key={t} scope="col" className="p-4">{t}</th>)}</tr></thead>
            <tbody className="divide-y">{pendentes.map(p => <tr key={p.id}>
                <td className="p-4">{p.aluno.nome}<p className="text-xs text-slate-500">{p.aluno.id}</p></td>
                <td className="p-4">{p.evento.nome}<p className="font-semibold">{moeda(p.evento.preco)}</p><p className="text-xs">Vagas: {p.evento._count.inscricoes} / {p.evento.totalVagas}</p></td>
                <td className="p-4">{reservas(p)}</td><td className="p-4">{data(p.dataInscricao)}</td>
                <td className="p-4"><Button size="sm" disabled={processing || p.evento._count.inscricoes >= p.evento.totalVagas} onClick={() => abrir(p)}>Aprovar</Button></td>
            </tr>)}{pendentes.length === 0 && <tr><td colSpan={5} className="p-10 text-center">Nenhuma aprovação pendente.</td></tr>}</tbody>
        </table></div>}
        <dialog ref={dialogRef} aria-labelledby="conferencia-titulo" className="m-auto w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl p-6 backdrop:bg-slate-900/50"
            onCancel={e => { if (processing) e.preventDefault(); else setAlvo(null) }}>
            {alvo && <form className="space-y-4" onSubmit={e => { e.preventDefault(); aprovar() }}>
                <h2 id="conferencia-titulo" className="text-xl font-bold">Conferir pagamento</h2><p>{alvo.aluno.nome} · {alvo.evento.nome}</p>
                <label htmlFor="modalidade" className="block">Modalidade</label>
                <select id="modalidade" className="w-full border rounded p-2" value={modalidade} disabled={processing} onChange={e => setModalidade(e.target.value as Modalidade)}>
                    <option value="PAGO">Pagamento integral</option><option value="DESCONTO">Conceder desconto explicitamente</option><option value="ISENTO">Isenção (sem transferência)</option>
                </select>
                {modalidade !== 'ISENTO' ? <>
                    <label htmlFor="reserva" className="block">Reserva correspondente ao comprovante</label>
                    <select id="reserva" className="w-full border rounded p-2" value={quoteId} disabled={processing} onChange={e => { setQuoteId(e.target.value); setSemReserva(false) }}>
                        <option value="">Sem reserva / pagamento antigo</option>{alvo.reservasPix.map(r => <option key={r.id} value={r.id}>{moeda(r.valor)} · {r.txid} · até {data(r.expiresAt)}</option>)}
                    </select>
                    {reservas(alvo)}
                    {!quoteId && <label className="flex gap-2"><input type="checkbox" required checked={semReserva} disabled={processing} onChange={e => setSemReserva(e.target.checked)} />Conferi manualmente o pagamento sem reserva. Aplicar o preço atual ou ajuste financeiro explícito.</label>}
                    <label htmlFor="valor-pago" className="block">Valor efetivamente recebido (R$)</label>
                    <Input id="valor-pago" inputMode="decimal" required disabled={processing} value={valorPago} onChange={e => setValorPago(e.target.value)} />
                    <label htmlFor="transferencia" className="block">Data e hora no comprovante (Bahia, UTC−03:00)</label>
                    <Input id="transferencia" type="datetime-local" required disabled={processing} value={transferencia} onChange={e => setTransferencia(e.target.value)} />
                    {reserva && transferencia && !dentro && <p role="alert" className="text-amber-800">Transferência fora do prazo. Para conceder desconto sobre o preço atual, selecione Desconto e registre o motivo. Pagamento integral com esta reserva será recusado.</p>}
                    {divergente && <p role="alert" className="text-red-700">Valor divergente. Confira os dados ou selecione Desconto explicitamente quando o valor recebido for menor.</p>}
                </> : <p>Isenção confirma sem transferência, com recebimento de R$ 0,00.</p>}
                <p>Referência reconhecida: {moeda(referencia ?? null)}</p>
                <label htmlFor="observacao" className="block">Observação / motivo</label>
                <Input id="observacao" maxLength={500} required={modalidade !== 'ISENTO' && (!quoteId || !dentro)} disabled={processing} value={observacao} onChange={e => setObservacao(e.target.value)} />
                <p className="text-xs text-slate-500">O horário da aprovação será registrado separadamente. A conferência é manual.</p>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={processing} onClick={() => setAlvo(null)}>Voltar</Button>
                    <Button type="submit" disabled={processing}>{processing ? 'Salvando...' : 'Confirmar aprovação'}</Button></div>
            </form>}
        </dialog>
    </div>
}
