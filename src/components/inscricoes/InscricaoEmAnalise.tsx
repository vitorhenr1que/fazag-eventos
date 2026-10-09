'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, Copy, Loader2, MessageCircle, QrCode, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'

type ReservaPix = {
    quoteId: string
    amount: string
    code: string
    txid: string
    createdAt: number
    expiresAt: number
}

type Props = {
    inscricaoId: string
    evento: { nome: string; tipo: string; chavePix?: string | null; preco?: number | string | null }
}

const financeiroUrl = 'https://wa.me/5575982181138'
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function InscricaoEmAnalise({ inscricaoId, evento }: Props) {
    const [reserva, setReserva] = useState<ReservaPix | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState('')
    const [qrCode, setQrCode] = useState('')
    const [erroQr, setErroQr] = useState(false)
    const [agora, setAgora] = useState(() => Date.now())
    const [copiado, setCopiado] = useState(false)
    const requisicao = useRef<AbortController | null>(null)
    const pago = evento.tipo === 'PAGO'

    const carregarPix = useCallback(async (gerar = false) => {
        requisicao.current?.abort()
        const controller = new AbortController()
        requisicao.current = controller
        setCarregando(true)
        setErro('')
        setCopiado(false)
        // Uma consulta sempre substitui a reserva local pela resposta do servidor.
        setReserva(null)
        try {
            const response = await apiFetch(`/api/inscricoes/${inscricaoId}/pix`, {
                method: gerar ? 'POST' : 'GET',
                ...(gerar ? { body: JSON.stringify({}) } : {}),
                cache: 'no-store',
                signal: controller.signal,
            })
            const json = await response.json()
            if (!response.ok) throw new Error(json.error?.message || 'Não foi possível carregar o Pix. Tente novamente.')
            if (!controller.signal.aborted) {
                setReserva(json.data)
                setAgora(Date.now())
            }
        } catch (error) {
            if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Erro de conexão. Tente novamente.')
        } finally {
            if (!controller.signal.aborted) setCarregando(false)
        }
    }, [inscricaoId])

    useEffect(() => {
        if (!pago) {
            setCarregando(false)
            return
        }
        void carregarPix()
        const revalidar = () => {
            if (document.visibilityState === 'visible') void carregarPix()
        }
        document.addEventListener('visibilitychange', revalidar)
        return () => {
            requisicao.current?.abort()
            document.removeEventListener('visibilitychange', revalidar)
        }
    }, [pago, carregarPix])

    useEffect(() => {
        if (!reserva) return
        const atualizar = () => {
            const instante = Date.now()
            setAgora(instante)
            if (instante >= reserva.expiresAt) void carregarPix()
        }
        const timer = window.setInterval(atualizar, 1000)
        return () => window.clearInterval(timer)
    }, [reserva, carregarPix])

    useEffect(() => {
        let ativo = true
        setQrCode('')
        setErroQr(false)
        if (reserva) {
            import('qrcode').then(QRCode => QRCode.toDataURL(reserva.code, {
                width: 320, margin: 4, errorCorrectionLevel: 'M',
            })).then(url => {
                if (ativo) setQrCode(url)
            }).catch(() => {
                if (ativo) setErroQr(true)
            })
        }
        return () => { ativo = false }
    }, [reserva])

    async function copiarPix() {
        if (!reserva || Date.now() >= reserva.expiresAt) {
            void carregarPix()
            return
        }
        try {
            await navigator.clipboard.writeText(reserva.code)
            setCopiado(true)
            toast.success('Pix copiado! Cole o código no aplicativo do seu banco.')
        } catch {
            toast.error('Não foi possível copiar. Selecione o código e copie manualmente.')
        }
    }

    const segundos = reserva ? Math.max(0, Math.ceil((reserva.expiresAt - agora) / 1000)) : 0
    const prazo = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
    const pixAtivo = !!reserva && segundos > 0 && !carregando

    return (
        <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-12">
            <Link href="/minhas-inscricoes" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary">
                <ArrowLeft size={16} aria-hidden="true" /> Minhas inscrições
            </Link>
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><Clock size={28} aria-hidden="true" /></div>
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Aguardando aprovação</span>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Inscrição em análise</h1>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                            Sua solicitação de inscrição para <strong className="text-slate-900">{evento.nome}</strong> foi recebida com sucesso.
                            {' '}Após a aprovação do setor financeiro, suas atividades estarão disponíveis aqui.
                        </p>
                    </div>
                </div>
            </section>

            <div className={`grid items-start gap-6 ${pago ? 'lg:grid-cols-2' : ''}`}>
                {pago && (
                    <Card className="overflow-hidden rounded-2xl shadow-sm">
                        <CardHeader className="border-b border-slate-100">
                            <CardTitle className="flex items-center gap-2 text-xl"><QrCode size={22} className="text-primary" aria-hidden="true" /> Pagamento via Pix</CardTitle>
                            <p className="text-sm text-slate-500">Pague pelo QR Code ou use o Pix copia e cola no seu banco.</p>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-6">
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
                                <div><p className="text-xs font-medium text-slate-500">{reserva ? 'Valor reservado' : 'Valor da inscrição'}</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900">{moeda.format(Number(reserva?.amount ?? evento.preco ?? 0))}</p></div>
                                {pixAtivo && <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-800"><Clock size={14} aria-hidden="true" /> {prazo}</span>}
                            </div>
                            {carregando ? (
                                <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" aria-hidden="true" /> Carregando pagamento Pix…</div>
                            ) : pixAtivo && reserva ? (
                                <>
                                    <div className="text-center">
                                        {qrCode ? <img src={qrCode} alt="QR Code para pagar a inscrição via Pix" width={320} height={320} className="mx-auto h-auto w-full max-w-72 rounded-xl border border-slate-100" />
                                            : erroQr ? <p role="status" className="py-8 text-sm text-slate-500">Não foi possível exibir o QR Code. Use o código abaixo para pagar.</p>
                                                : <div role="status" className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-slate-400" aria-label="Gerando QR Code" /></div>}
                                        <p className="mt-3 text-xs text-slate-500">Abra o aplicativo do banco e escolha pagar com Pix.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="pix-codigo" className="text-sm font-semibold text-slate-700">Pix copia e cola</label>
                                        <textarea id="pix-codigo" readOnly value={reserva.code} onFocus={event => event.currentTarget.select()} rows={3} className="block w-full resize-none break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary" />
                                        <Button onClick={copiarPix} className="h-11 w-full gap-2">{copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copiado ? 'Código copiado' : 'Copiar código Pix'}</Button>
                                    </div>
                                    <div className="space-y-2 text-xs leading-relaxed text-slate-500">
                                        <p>O valor está reservado por <strong className="text-slate-700">{prazo}</strong>. Quando o prazo terminar, gere um novo Pix para consultar o valor atualizado.</p>
                                        <p>O pagamento será validado pelo setor financeiro após o envio do comprovante.</p>
                                        <p className="break-all">Referência: <span className="font-mono">{reserva.txid}</span></p>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    {erro && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{erro}</p>}
                                    {!evento.chavePix ? <p className="text-sm leading-relaxed text-slate-600">A chave Pix ainda não foi informada para este evento. Entre em contato com o setor financeiro para receber as instruções de pagamento.</p> : <>
                                        <p className="text-sm leading-relaxed text-slate-600">Gere seu Pix para reservar o valor da inscrição por 30 minutos e acessar o QR Code e o código para copiar.</p>
                                        <Button onClick={() => carregarPix(true)} className="h-11 w-full gap-2"><QrCode size={18} aria-hidden="true" /> Gerar Pix</Button>
                                    </>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-2xl shadow-sm">
                    <CardHeader><CardTitle className="text-xl">Próximos passos</CardTitle><p className="text-sm text-slate-500">Siga estas etapas para concluir sua inscrição.</p></CardHeader>
                    <CardContent className="space-y-6">
                        <ol className="space-y-5 text-sm leading-relaxed text-slate-600">
                            {[
                                <>Realize o pagamento conforme as instruções da instituição.</>,
                                <>Envie seu <strong className="text-slate-900">nome completo e o comprovante de pagamento</strong> para o setor financeiro pelo WhatsApp <a href={financeiroUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline underline-offset-4">+55 75 98218-1138</a>.</>,
                                <>O setor financeiro irá validar seu pagamento no painel.</>,
                                <>Após a aprovação, você poderá retornar aqui para escolher seus workshops e palestras.</>,
                            ].map((passo, index) => (
                                <li key={index} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600" aria-hidden="true">{index + 1}</span><span className="pt-0.5">{passo}</span></li>
                            ))}
                        </ol>
                        <Button asChild className="h-11 w-full gap-2 bg-emerald-700 hover:bg-emerald-800"><a href={financeiroUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" /> Falar com o financeiro</a></Button>
                        <Button variant="outline" onClick={() => window.location.reload()} className="w-full gap-2"><RefreshCw size={16} aria-hidden="true" /> Atualizar status da inscrição</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
