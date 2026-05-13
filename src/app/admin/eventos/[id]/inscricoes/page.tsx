'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CheckCircle, CreditCard, Check, FileText, Download, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export default function InscricoesEventoPage() {
    const params = useParams()
    const [evento, setEvento] = useState<any>(null)
    const [inscricoes, setInscricoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                // Buscar detalhes do evento
                const evRes = await apiFetch(`/api/eventos/${params.id}`)
                if (evRes.ok) {
                    const evJson = await evRes.json()
                    setEvento(evJson.data)
                }

                // Buscar inscrições (Admin)
                const res = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                if (res.ok) {
                    const json = await res.json()
                    setInscricoes(json.data)
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    async function handleCheckInSub(inscricaoId: string, subeventoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/checkin`, {
                method: 'POST',
                body: JSON.stringify({ tipo: 'SUBEVENTO', subeventoId }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Check-in no subevento realizado!')
                // Refresh data
                const resList = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                const json = await resList.json()
                setInscricoes(json.data)
            }
        } catch (err) {
            toast.error('Erro ao processar check-in')
        }
    }

    async function handleCheckIn(inscricaoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/checkin`, {
                method: 'POST',
                body: JSON.stringify({ tipo: 'EVENTO' }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Check-in realizado com sucesso!')
                setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, checkIn: { id: 'temp' } } : i))
            }
        } catch (err) {
            toast.error('Erro ao processar check-in')
        }
    }

    const [emittingId, setEmittingId] = useState<string | null>(null)

    async function handleAprovarPagamento(inscricaoId: string) {
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/aprovar`, {
                method: 'POST',
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Pagamento aprovado!')
                setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, status: 'CONFIRMADA' } : i))
            }
        } catch (err) {
            toast.error('Erro ao aprovar pagamento')
        }
    }

    async function handleEmitirCertificado(inscricaoId: string, atualCarga?: number) {
        // Cálculo automático sugerido
        const insc = inscricoes.find(i => i.id === inscricaoId)
        let sugerido = atualCarga
        if (sugerido === undefined) {
            if (!evento.temSubeventos) {
                sugerido = evento.cargaHorariaBase || 0
            } else {
                sugerido = insc.subeventosEscolhidos.filter((se: any) => se.checkIn).reduce((acc: number, curr: any) => acc + curr.subevento.cargaHoraria, 0)
            }
        }

        const novaCargaStr = prompt('Defina a carga horária para este certificado:', sugerido?.toString() || '0')
        if (novaCargaStr === null) return

        const novaCarga = parseFloat(novaCargaStr)
        if (isNaN(novaCarga)) {
            toast.error('Valor inválido')
            return
        }

        setEmittingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/certificado`, {
                method: 'POST',
                body: JSON.stringify({ cargaHoraria: novaCarga }),
                isAdmin: true
            })
            if (res.ok) {
                toast.success('Certificado processado com sucesso!')
                // Refresh list
                const resList = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                if (resList.ok) {
                    const json = await resList.json()
                    setInscricoes(json.data)
                }
            }
        } catch (err) {
            toast.error('Erro ao emitir certificado')
        } finally {
            setEmittingId(null)
        }
    }

    async function handleExcluirCertificado(inscricaoId: string) {
        const confirmar = confirm('Tem certeza que deseja excluir o certificado deste inscrito? O aluno poderá gerar um novo certificado se cumprir os requisitos.')
        if (!confirmar) return

        setEmittingId(inscricaoId)
        try {
            const res = await apiFetch(`/api/admin/inscricoes/${inscricaoId}/certificado`, {
                method: 'DELETE',
                isAdmin: true
            })

            if (res.ok) {
                toast.success('Certificado excluído com sucesso!')
                const resList = await apiFetch(`/api/admin/eventos/${params.id}/inscricoes`, { isAdmin: true })
                if (resList.ok) {
                    const json = await resList.json()
                    setInscricoes(json.data)
                }
            } else {
                const json = await res.json()
                toast.error(json.error?.message || 'Erro ao excluir certificado')
            }
        } catch (err) {
            toast.error('Erro ao excluir certificado')
        } finally {
            setEmittingId(null)
        }
    }

    function sanitizeFileName(value: string) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'evento'
    }

    function escapeHtml(value: unknown) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    function csvCell(value: unknown) {
        const text = String(value ?? '').replace(/\r?\n|\r/g, ' ')
        return `"${text.replace(/"/g, '""')}"`
    }

    function getSubeventosResumo(insc: any) {
        if (!insc.subeventosEscolhidos?.length) return ''

        return insc.subeventosEscolhidos
            .map((se: any) => `${se.subevento.nome} (${se.checkIn ? 'Presente' : 'Ausente'})`)
            .join('; ')
    }

    function getEventoPeriodo() {
        if (!evento?.dataInicio || !evento?.dataFim) return ''
        return `${formatDate(evento.dataInicio, 'dd/MM/yyyy HH:mm')} a ${formatDate(evento.dataFim, 'dd/MM/yyyy HH:mm')}`
    }

    function downloadFile(content: string, fileName: string, type: string) {
        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }

    function handleExportCsv() {
        if (!inscricoes.length) {
            toast.info('Nenhuma inscricao para exportar.')
            return
        }

        setExporting('csv')
        try {
            const headers = [
                'Nome',
                'Matricula/ID',
                'E-mail',
                'Data da inscricao',
                'Status',
                'Presenca geral',
                'Subeventos',
                'Carga horaria certificado',
                'Codigo certificado'
            ]

            const rows = inscricoes.map((insc) => [
                insc.aluno?.nome,
                insc.aluno?.id,
                insc.aluno?.email,
                formatDate(insc.dataInscricao, 'dd/MM/yyyy HH:mm'),
                insc.status,
                insc.checkIn ? 'Presente' : 'Ausente',
                getSubeventosResumo(insc),
                insc.certificado?.cargaHorariaTotal ?? '',
                insc.certificado?.codigoValidacao ?? ''
            ])

            const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
            const fileName = `inscricoes-${sanitizeFileName(evento?.nome || String(params.id))}.csv`

            downloadFile(`\uFEFF${csv}`, fileName, 'text/csv;charset=utf-8;')
            toast.success('CSV exportado com sucesso.')
        } finally {
            setExporting(null)
        }
    }

    function openPrintDocument(title: string, body: string) {
        const printWindow = window.open('', '_blank', 'width=1200,height=800')

        if (!printWindow) {
            toast.error('Nao foi possivel abrir a janela de impressao. Verifique o bloqueador de pop-ups.')
            return
        }

        printWindow.document.write(`
            <!doctype html>
            <html lang="pt-BR">
                <head>
                    <meta charset="utf-8" />
                    <title>${escapeHtml(title)}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            color: #0f172a;
                            margin: 32px;
                            font-size: 12px;
                        }
                        header {
                            border-bottom: 2px solid #0f172a;
                            padding-bottom: 16px;
                            margin-bottom: 20px;
                        }
                        h1 {
                            font-size: 22px;
                            margin: 0 0 8px;
                        }
                        .meta {
                            color: #475569;
                            line-height: 1.5;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            page-break-inside: auto;
                        }
                        thead {
                            display: table-header-group;
                        }
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        th, td {
                            border: 1px solid #cbd5e1;
                            padding: 8px;
                            vertical-align: top;
                            text-align: left;
                        }
                        th {
                            background: #f1f5f9;
                            font-size: 10px;
                            text-transform: uppercase;
                            letter-spacing: .04em;
                        }
                        .center {
                            text-align: center;
                        }
                        .signature {
                            height: 42px;
                            min-width: 150px;
                        }
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <header>
                        <h1>${escapeHtml(title)}</h1>
                        <div class="meta">
                            <div><strong>Evento:</strong> ${escapeHtml(evento?.nome || '-')}</div>
                            <div><strong>Periodo:</strong> ${escapeHtml(getEventoPeriodo() || '-')}</div>
                            <div><strong>Local:</strong> ${escapeHtml(evento?.local || '-')}</div>
                            <div><strong>Total:</strong> ${inscricoes.length} inscrito(s)</div>
                        </div>
                    </header>
                    ${body}
                    <script>
                        window.onload = () => {
                            window.focus();
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    function handleExportInscricoesPdf() {
        if (!inscricoes.length) {
            toast.info('Nenhuma inscricao para exportar.')
            return
        }

        setExporting('inscricoes-pdf')
        try {
            const rows = inscricoes.map((insc, index) => `
                <tr>
                    <td class="center">${index + 1}</td>
                    <td>
                        <strong>${escapeHtml(insc.aluno?.nome)}</strong><br />
                        ID: ${escapeHtml(insc.aluno?.id)}
                        ${insc.aluno?.email ? `<br />${escapeHtml(insc.aluno.email)}` : ''}
                    </td>
                    <td>${escapeHtml(formatDate(insc.dataInscricao, 'dd/MM/yyyy HH:mm'))}</td>
                    <td class="center">${escapeHtml(insc.status)}</td>
                    <td class="center">${insc.checkIn ? 'Presente' : 'Ausente'}</td>
                    <td>${escapeHtml(getSubeventosResumo(insc) || '-')}</td>
                    <td class="center">${escapeHtml(insc.certificado?.cargaHorariaTotal ? `${insc.certificado.cargaHorariaTotal}h` : '-')}</td>
                </tr>
            `).join('')

            openPrintDocument('Lista de Inscricoes', `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Aluno / Matricula</th>
                            <th>Inscricao</th>
                            <th>Status</th>
                            <th>Presenca Geral</th>
                            <th>Subeventos</th>
                            <th>Certificado</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `)
        } finally {
            setExporting(null)
        }
    }

    function handleExportPresencaPdf() {
        if (!inscricoes.length) {
            toast.info('Nenhuma inscricao para exportar.')
            return
        }

        setExporting('presenca-pdf')
        try {
            const rows = inscricoes.map((insc, index) => `
                <tr>
                    <td class="center">${index + 1}</td>
                    <td>
                        <strong>${escapeHtml(insc.aluno?.nome)}</strong><br />
                        ID: ${escapeHtml(insc.aluno?.id)}
                    </td>
                    <td class="center">${escapeHtml(insc.status)}</td>
                    <td class="center">${insc.checkIn ? 'Presente' : 'Ausente'}</td>
                    <td class="signature"></td>
                </tr>
            `).join('')

            openPrintDocument('Lista de Presenca', `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Aluno / Matricula</th>
                            <th>Status</th>
                            <th>Check-in</th>
                            <th>Assinatura</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `)
        } finally {
            setExporting(null)
        }
    }

    return (
        <div className="space-y-6 container py-8 mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Link href="/admin/eventos" className="flex items-center text-xs text-slate-500 hover:text-primary transition mb-2">
                        <ArrowLeft size={14} className="mr-1" /> Lista de Eventos
                    </Link>
                    {loading ? (
                        <Skeleton className="h-8 w-64" />
                    ) : (
                        <h1 className="text-2xl font-bold text-slate-800">Inscritos: {evento?.nome}</h1>
                    )}
                    {loading ? (
                        <Skeleton className="h-4 w-32" />
                    ) : (
                        <p className="text-sm text-slate-500">Total: {inscricoes.length} inscritos</p>
                    )}
                </div>
                {!loading && (
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!!exporting || inscricoes.length === 0}>
                            {exporting === 'csv' ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} className="mr-2" />}
                            Exportar CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportInscricoesPdf} disabled={!!exporting || inscricoes.length === 0}>
                            {exporting === 'inscricoes-pdf' ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FileText size={14} className="mr-2" />}
                            Inscrições PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPresencaPdf} disabled={!!exporting || inscricoes.length === 0}>
                            {exporting === 'presenca-pdf' ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FileText size={14} className="mr-2" />}
                            Presença PDF
                        </Button>
                    </div>
                )}
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Aluno / Matrícula</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Inscrição</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Presença Geral</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Subeventos (Grade)</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Certificado</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-sm">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-4 space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-20" />
                                            </td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-5 w-24 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-5 w-20 mx-auto" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-10 w-full" /></td>
                                            <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : (
                                    inscricoes.map(insc => (
                                        <tr key={insc.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-800">{insc.aluno.nome}</p>
                                                <p className="text-[10px] text-slate-400">ID: {insc.aluno.id}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600">
                                                {formatDate(insc.dataInscricao, 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    {insc.status === 'PENDENTE' ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                            <CreditCard size={12} /> AGUARDANDO
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                            <Check size={12} /> CONFIRMADA
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    {insc.checkIn ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                                            <CheckCircle size={14} /> PRESENTE
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                            AUSENTE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {insc.subeventosEscolhidos?.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {insc.subeventosEscolhidos.map((se: any) => (
                                                            <div key={se.id} className="flex items-center justify-between gap-2 p-1 px-2 bg-slate-50 rounded border text-[10px]">
                                                                <span className="truncate max-w-[120px]" title={se.subevento.nome}>
                                                                    {se.subevento.nome}
                                                                </span>
                                                                {se.checkIn ? (
                                                                    <span className="text-green-600 font-bold flex items-center gap-0.5"><Check size={10} /> Ok</span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleCheckInSub(insc.id, se.subeventoId)}
                                                                        className="text-primary hover:underline font-bold"
                                                                    >
                                                                        Check-in
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">
                                                        {evento?.temSubeventos ? 'Nenhum selecionado' : 'Evento s/ subeventos'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    {insc.certificado ? (
                                                        <>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                {insc.certificado.cargaHorariaTotal}h
                                                            </span>
                                                            <button
                                                                onClick={() => handleEmitirCertificado(insc.id, insc.certificado.cargaHorariaTotal)}
                                                                className="text-[10px] text-slate-500 hover:underline"
                                                                disabled={emittingId === insc.id}
                                                            >
                                                                Editar Carga
                                                            </button>
                                                            <button
                                                                onClick={() => handleExcluirCertificado(insc.id)}
                                                                className="inline-flex items-center gap-1 text-[10px] text-red-600 hover:underline disabled:opacity-50"
                                                                disabled={emittingId === insc.id}
                                                            >
                                                                {emittingId === insc.id ? <Loader2 className="animate-spin" size={10} /> : <Trash2 size={10} />}
                                                                Excluir
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-[10px] text-primary hover:bg-primary/5 border border-primary/20"
                                                            disabled={emittingId === insc.id || insc.status !== 'CONFIRMADA'}
                                                            onClick={() => handleEmitirCertificado(insc.id)}
                                                        >
                                                            {emittingId === insc.id ? <Loader2 className="animate-spin" size={12} /> : 'Liberar'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                {insc.status === 'PENDENTE' && (
                                                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50 h-8 text-[11px]" onClick={() => handleAprovarPagamento(insc.id)}>
                                                        Aprovar
                                                    </Button>
                                                )}
                                                {insc.status === 'CONFIRMADA' && !insc.checkIn && (
                                                    <Button size="sm" onClick={() => handleCheckIn(insc.id)} className="h-8 text-[11px]">
                                                        Check-in Geral
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!loading && inscricoes.length === 0 && (
                        <div className="p-10 text-center text-slate-400 italic">
                            Nenhum aluno inscrito neste evento ainda.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
