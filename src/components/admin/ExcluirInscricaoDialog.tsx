'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import type { ExclusaoInscricao } from '@/lib/exclusao-inscricao'

export interface AlvoExclusao { id: string; nome: string; status: string; situacaoFinanceira: string | null; valorPago: string | number | null; modalidadeOriginal?: string }
export function ExcluirInscricaoDialog({ alvo, pago, fechar, atualizar }: { alvo: AlvoExclusao; pago: boolean; fechar: () => void; atualizar: () => Promise<void> }) {
    const ref = useRef<HTMLDialogElement>(null)
    const [modalidade, setModalidade] = useState<ExclusaoInscricao['modalidade'] | ''>(alvo.modalidadeOriginal as ExclusaoInscricao['modalidade'] || (pago ? '' : 'EXCLUIR_TUDO'))
    const [motivo, setMotivo] = useState('')
    const [valor, setValor] = useState('')
    const [processando, setProcessando] = useState(false)
    const [erro, setErro] = useState('')
    const iniciada = Boolean(alvo.modalidadeOriginal)
    useEffect(() => { ref.current?.showModal() }, [])
    const confirmado = alvo.status === 'CONFIRMADA' && alvo.situacaoFinanceira !== 'GRATUITO'
    const podeReembolsar = confirmado && (alvo.valorPago === null || Number(alvo.valorPago) > 0)
    async function confirmar() {
        if (!modalidade || processando) return
        setProcessando(true); setErro('')
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${alvo.id}/excluir`, { isAdmin: true, method: 'POST', body: JSON.stringify({
                modalidade, motivo, ...(modalidade === 'REEMBOLSO' && alvo.valorPago === null ? { valorHistorico: Number(valor.replace(',', '.')) } : {}),
            }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Não foi possível excluir a inscrição')
            toast.success(modalidade === 'REEMBOLSO' ? 'Inscrição excluída e reembolso registrado' : modalidade === 'MANTER_PAGAMENTO' ? 'Inscrição excluída. Pagamento mantido no relatório' : 'Inscrição e pagamento excluídos')
            await atualizar(); fechar()
        } catch (error) {
            setErro(error instanceof Error ? error.message : 'Erro de conexão')
            await atualizar().catch(() => {})
        } finally { setProcessando(false) }
    }
    const opcoes = [
        { valor: 'REEMBOLSO', titulo: 'Registrar como reembolso', descricao: 'Excluir a inscrição e registrar a devolução integral do valor pago no financeiro.', disponivel: podeReembolsar },
        { valor: 'EXCLUIR_TUDO', titulo: 'Excluir inscrição e pagamento', descricao: 'Remover a inscrição e seu pagamento dos totais, sem registrar reembolso.', disponivel: true },
        { valor: 'MANTER_PAGAMENTO', titulo: 'Excluir somente inscrição e manter pagamento', descricao: 'Remover o aluno do evento e preservar o recebimento original no relatório financeiro.', disponivel: confirmado },
    ] as const
    return <dialog ref={ref} aria-labelledby="excluir-inscricao-titulo" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl p-6 backdrop:bg-slate-900/50"
        onCancel={e => { if (processando) e.preventDefault(); else fechar() }}>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); confirmar() }}>
            <h2 id="excluir-inscricao-titulo" className="text-xl font-bold">Excluir inscrição</h2>
            <p className="font-semibold">{alvo.nome}</p>
            <p className="text-sm text-slate-600">A inscrição, as atividades escolhidas, as presenças e o certificado vinculado serão excluídos. O cadastro do aluno será preservado.</p>
            {pago && <fieldset disabled={processando || iniciada} className="space-y-2"><legend className="mb-2 font-semibold">Como deseja excluir?</legend>
                {opcoes.map(o => <label key={o.valor} className={`flex items-start gap-3 rounded-lg border p-3 ${modalidade === o.valor ? 'border-blue-500 bg-blue-50' : ''} ${!o.disponivel ? 'opacity-50' : 'cursor-pointer'}`}>
                    <input type="radio" name="modalidade-exclusao" required disabled={!o.disponivel && !alvo.modalidadeOriginal} value={o.valor} checked={modalidade === o.valor} onChange={() => setModalidade(o.valor)} className="mt-1" />
                    <span><span className="block font-semibold text-sm">{o.titulo}</span><span className="text-sm text-slate-600">{o.descricao}</span></span>
                </label>)}
                {!confirmado && !alvo.modalidadeOriginal && <p className="text-xs text-amber-800">Esta inscrição não possui pagamento confirmado. Somente a exclusão completa está disponível.</p>}
                {confirmado && !podeReembolsar && <p className="text-xs text-amber-800">Não há valor pago para reembolsar nesta inscrição.</p>}
            </fieldset>}
            {modalidade === 'REEMBOLSO' && (alvo.valorPago === null ? <label className="block text-sm font-semibold">Valor efetivamente pago nesta inscrição antiga (R$)
                <input required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={valor} disabled={processando} onChange={e => setValor(e.target.value)} className="mt-1 w-full rounded border p-2" />
                <span className="block text-xs font-normal text-amber-800">Informe o valor real pago na época. O preço atual do evento não será usado.</span>
            </label> : <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-800">Valor a reembolsar: {Number(alvo.valorPago).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>)}
            {modalidade === 'MANTER_PAGAMENTO' && alvo.valorPago === null && <p className="text-sm text-amber-800">O valor desta aprovação antiga não está registrado. O histórico continuará indicado como sem valor registrado.</p>}
            <label className="block text-sm font-semibold">Motivo (opcional)<textarea maxLength={500} value={motivo} disabled={processando || iniciada} onChange={e => setMotivo(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
            {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={processando} onClick={fechar}>Voltar</Button>
                <Button type="submit" disabled={!modalidade || processando} className="bg-red-600 hover:bg-red-700">{processando ? 'Excluindo...' : iniciada ? 'Concluir exclusão' : 'Confirmar exclusão'}</Button>
            </div>
        </form>
    </dialog>
}
