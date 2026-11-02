'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'

interface Resumo { id: string; nome: string; inscricoes: number; subeventos: number; certificados: number; iniciada: boolean; manterCertificados: boolean | null }
export function ExcluirEventoDialog({ evento, fechar, excluido }: {
    evento: { id: string; nome: string }
    fechar: () => void
    excluido: () => void
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [resumo, setResumo] = useState<Resumo | null>(null)
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState('')
    const [processando, setProcessando] = useState(false)
    const [escolha, setEscolha] = useState<'MANTER' | 'EXCLUIR' | ''>('')
    const [confirmacao, setConfirmacao] = useState('')
    const [revisao, setRevisao] = useState(0)
    useEffect(() => { dialog.current?.showModal() }, [])
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true); setErro(''); setResumo(null); setEscolha(''); setConfirmacao('')
        async function load() {
            try {
                const res = await apiFetch(`/api/admin/eventos/${evento.id}/exclusao`, { isAdmin: true, signal: controller.signal, cache: 'no-store' })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error?.message || 'Não foi possível conferir os dados do evento')
                if (controller.signal.aborted) return
                const data: Resumo = json.data
                setResumo(data)
                setEscolha(data.iniciada ? data.manterCertificados ? 'MANTER' : 'EXCLUIR' : data.certificados ? '' : 'EXCLUIR')
            } catch (error) { if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Erro de conexão') }
            finally { if (!controller.signal.aborted) setLoading(false) }
        }
        void load(); return () => controller.abort()
    }, [evento.id, revisao])

    async function confirmar() {
        if (!resumo || !escolha || confirmacao !== 'EXCLUIR' || processando) return
        setProcessando(true); setErro('')
        try {
            const res = await apiFetch(`/api/admin/eventos/${evento.id}`, { isAdmin: true, method: 'DELETE', body: JSON.stringify({ confirmacao, certificados: escolha, certificadosEsperados: resumo.certificados }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Não foi possível concluir a exclusão. Tente novamente para retomar a limpeza.')
            toast.success(escolha === 'MANTER' ? 'Evento excluído. Certificados emitidos preservados.' : 'Evento e seus registros excluídos.')
            excluido()
        } catch (error) { setErro(error instanceof Error ? error.message : 'Erro de conexão') }
        finally { setProcessando(false) }
    }
    return <dialog ref={dialog} aria-labelledby="excluir-evento-titulo" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl p-6 backdrop:bg-slate-900/50" onCancel={e => { if (processando) e.preventDefault(); else fechar() }}>
        <form className="space-y-5" onSubmit={e => { e.preventDefault(); void confirmar() }}>
            <div><h2 id="excluir-evento-titulo" className="text-xl font-bold text-red-700">Excluir evento</h2><p className="mt-2 font-semibold">{evento.nome}</p></div>
            {loading && <p role="status">Conferindo os registros do evento...</p>}
            {resumo && <>
                <p className="text-sm text-slate-600">Esta operação é permanente. Serão excluídos o evento, seus {resumo.subeventos} subeventos, {resumo.inscricoes} inscrições, inscrições na grade e todos os check-ins. Reservas Pix e históricos financeiros desse evento também serão removidos. A exclusão não realiza reembolsos.</p>
                {(resumo.certificados > 0 || resumo.iniciada) && <fieldset disabled={processando || resumo.iniciada} className="space-y-3"><legend className="mb-3 font-semibold">{resumo.iniciada ? 'Escolha registrada ao iniciar a exclusão' : `${resumo.certificados} certificado(s) emitido(s). Deseja mantê-los?`}</legend>
                    <label className="flex items-start gap-3 rounded-lg border p-4"><input type="radio" name="certificados-evento" required value="MANTER" checked={escolha === 'MANTER'} onChange={() => setEscolha('MANTER')} className="mt-1" /><span className="text-sm"><strong>Manter certificados emitidos</strong><span className="mt-1 block text-slate-500">Os códigos, links de validação e acesso dos alunos serão preservados.</span></span></label>
                    <label className="flex items-start gap-3 rounded-lg border p-4"><input type="radio" name="certificados-evento" required value="EXCLUIR" checked={escolha === 'EXCLUIR'} onChange={() => setEscolha('EXCLUIR')} className="mt-1" /><span className="text-sm"><strong>Excluir também os certificados</strong><span className="mt-1 block text-slate-500">Os certificados deixarão de existir e seus links não serão mais válidos.</span></span></label>
                </fieldset>}
                {!resumo.certificados && !resumo.iniciada && <p className="text-sm text-slate-500">Este evento não possui certificados emitidos.</p>}
                <label className="block text-sm font-medium">Digite EXCLUIR para confirmar<input autoComplete="off" required disabled={processando} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>
            </>}
            {erro && <div role="alert" className="text-sm text-red-700">{erro} <Button type="button" variant="link" disabled={processando} onClick={() => setRevisao(v => v + 1)}>Atualizar resumo</Button></div>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={processando} onClick={fechar}>Cancelar</Button><Button type="submit" disabled={loading || !resumo || !escolha || confirmacao !== 'EXCLUIR' || processando} className="bg-red-600 hover:bg-red-700">{processando ? 'Excluindo...' : resumo?.iniciada ? 'Concluir exclusão' : 'Excluir evento'}</Button></div>
        </form>
    </dialog>
}
