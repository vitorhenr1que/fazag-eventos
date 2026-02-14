'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Download, Printer, Share2 } from 'lucide-react'
import CertificateRenderer from '@/components/certificate/CertificateRenderer'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function CertificadoPage() {
    const params = useParams()
    const [certificado, setCertificado] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const res = await apiFetch(`/api/certificados/validar/${params.codigo}`)
                if (res.ok) {
                    const json = await res.json()
                    setCertificado(json.data)
                } else {
                    setError('Certificado inválido ou não encontrado.')
                }
            } catch (err) {
                setError('Erro ao validar certificado.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.codigo])

    const handleShare = async () => {
        if (!certificado) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Certificado - ${certificado.evento}`,
                    text: `Veja meu certificado de participação no evento ${certificado.evento}`,
                    url: window.location.href,
                });
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Erro ao compartilhar:', error);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success('Link do certificado copiado para a área de transferência!');
            } catch (err) {
                toast.error('Erro ao copiar link.');
            }
        }
    };

    if (!loading && error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
            <div className="text-center">
                <h1 className="text-3xl font-bold mb-4 text-red-500 tracking-tighter">ERRO DE VALIDAÇÃO</h1>
                <p className="text-slate-400">{error}</p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 pb-24 sm:pb-4">
            <style jsx global>{`
                /* Esconde versão de impressão da tela, mas mantém renderizada para carregar imagens */
                .only-print { 
                    position: fixed;
                    left: -9999px;
                    top: 0;
                    width: 1px;
                    height: 1px;
                    overflow: hidden;
                    opacity: 0;
                    pointer-events: none;
                }
                
                @media print {
                    @page {
                        margin: 0;
                        size: landscape;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        background: white;
                    }
                    .no-print { display: none !important; }
                    .only-print {
                        opacity: 1;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: white;
                        z-index: 9999;
                        display: flex !important;
                        align-items: center;
                        justify-content: center;
                        overflow: visible;
                    }
                    /* Força o conteúdo a caber na página A4 landscape */
                    .print-content {
                        width: 297mm;
                        height: 210mm;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                }
            `}</style>

            <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
                <h1 className="text-xl font-bold text-slate-700">Visualização do Certificado</h1>
                <div className="hidden sm:flex items-center gap-2">
                    <Button onClick={handleShare} variant="outline" className="gap-2">
                        <Share2 size={16} /> Compartilhar
                    </Button>
                    <Button onClick={() => setTimeout(() => window.print(), 100)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Download size={16} /> Salvar PDF
                    </Button>
                </div>
            </div>

            {/* Mobile Fixed Actions */}
            <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-50 sm:hidden no-print">
                <Button
                    onClick={handleShare}
                    className="flex-1 rounded-full shadow-2xl gap-2 h-14 bg-white text-slate-800 border-slate-200 hover:bg-slate-50 border font-bold"
                >
                    <Share2 size={20} /> Compartilhar
                </Button>
                <Button
                    onClick={() => setTimeout(() => window.print(), 100)}
                    className="flex-1 rounded-full shadow-2xl gap-2 h-14 bg-blue-600 hover:bg-blue-700 font-bold"
                >
                    <Download size={20} /> Salvar PDF
                </Button>
            </div>

            <div className="w-full max-w-5xl bg-white shadow-2xl overflow-hidden no-print">
                {loading ? (
                    <div className="p-12 space-y-8 text-center bg-white">
                        <Skeleton className="h-12 w-3/4 mx-auto" />
                        <Skeleton className="h-48 w-full mx-auto" />
                        <Skeleton className="h-8 w-1/2 mx-auto" />
                    </div>
                ) : (
                    <CertificateRenderer
                        template={{
                            ...certificado.template,
                            background: {
                                ...certificado.template?.background,
                                url: certificado.fundoUrl || certificado.template?.background?.url || ''
                            }
                        }}
                        data={{
                            NOME_ALUNO: certificado.aluno,
                            NOME_EVENTO: certificado.evento,
                            CARGA_HORARIA: Math.round(Number(certificado.cargaHoraria) || 0).toString(),
                            DATA: formatDate(certificado.metadados?.dataInicio || new Date(), 'dd/MM/yyyy'),
                            CODIGO_VALIDACAO: certificado.codigo
                        }}
                    />
                )}
            </div>

            {/* Versão Exclusiva para Impressão */}
            {!loading && certificado && (
                <div className="only-print">
                    <div className="print-content">
                        <CertificateRenderer
                            template={{
                                ...certificado.template,
                                background: {
                                    ...certificado.template?.background,
                                    url: certificado.fundoUrl || certificado.template?.background?.url || ''
                                }
                            }}
                            width={1122} // A4 width @ 96dpi
                            data={{
                                NOME_ALUNO: certificado.aluno,
                                NOME_EVENTO: certificado.evento,
                                CARGA_HORARIA: Math.round(Number(certificado.cargaHoraria) || 0).toString(),
                                DATA: formatDate(certificado.metadados?.dataInicio || new Date(), 'dd/MM/yyyy'),
                                CODIGO_VALIDACAO: certificado.codigo
                            }}
                        />
                    </div>
                </div>
            )}

            {!loading && !error && (
                <div className="mt-8 text-center text-sm text-slate-500 no-print">
                    <p>Documento assinado digitalmente. A validade deste documento pode ser verificada através do código: <strong>{certificado.codigo}</strong></p>
                </div>
            )}
        </div>
    )
}
