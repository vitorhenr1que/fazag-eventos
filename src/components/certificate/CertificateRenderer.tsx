'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
    CertificateTemplate,
    CertificateElement,
    DEFAULT_TEMPLATE,
    renderMockText
} from '@/lib/certificate-utils'
import { cn } from '@/lib/utils'

interface CertificateRendererProps {
    template: any
    data: {
        NOME_ALUNO: string
        NOME_EVENTO: string
        CARGA_HORARIA: string
        DATA: string
        CODIGO_VALIDACAO?: string
        [key: string]: string | undefined
    }
    width?: number
}

export default function CertificateRenderer({ template: rawTemplate, data, width }: CertificateRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    // Parse template if string, or use default
    const template: CertificateTemplate = useMemo(() => {
        let loaded = rawTemplate
        if (typeof loaded === 'string') {
            try {
                loaded = JSON.parse(loaded)
            } catch (e) {
                loaded = null
            }
        }
        if (loaded && typeof loaded === 'object' && loaded.elements) {
            return {
                ...loaded,
                background: {
                    ...loaded.background,
                    url: loaded.background?.url || ''
                }
            } as CertificateTemplate
        }
        return DEFAULT_TEMPLATE
    }, [rawTemplate])

    // Auto-scale based on container width
    useEffect(() => {
        // Se width for explicitamente passado (ex: impressão), usa ele para cálculo imediato
        if (typeof width === 'number') {
            setScale(width / template.page.width)
            return
        }

        if (!containerRef.current) return

        const updateScale = () => {
            if (containerRef.current) {
                const currentWidth = containerRef.current.offsetWidth
                // Evita divisão por zero ou escala zero se estiver oculto
                if (currentWidth > 0) {
                    const newScale = currentWidth / template.page.width
                    setScale(newScale)
                }
            }
        }

        updateScale()
        window.addEventListener('resize', updateScale)
        return () => window.removeEventListener('resize', updateScale)
    }, [template.page.width, width])

    // Use responsive width if provided, otherwise 100%
    const containerStyle = width ? { width: `${width}px` } : { width: '100%' }

    return (
        <div ref={containerRef} style={containerStyle} className="mx-auto shadow-2xl relative bg-white overflow-hidden">
            <div
                className="relative bg-white origin-top-left"
                style={{
                    width: template.page.width,
                    height: template.page.height,
                    transform: `scale(${scale})`,
                    marginBottom: `-${(template.page.height * (1 - scale))}px`, // Compensate for scale space
                    marginRight: `-${(template.page.width * (1 - scale))}px`
                }}
            >
                {/* Background - Usando img para garantir impressão */}
                {template.background.url && (
                    <img
                        src={template.background.url}
                        alt="Fundo do Certificado"
                        loading="eager"
                        className="absolute inset-0 w-full h-full pointer-events-none select-none object-cover print:block"
                        style={{
                            objectFit: template.background.fit || 'cover',
                            zIndex: 0
                        }}
                    />
                )}

                {/* Fallback visual se não tiver imagem */}
                {!template.background.url && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-100 font-bold text-6xl rotate-45 select-none pointer-events-none">
                        PROVA
                    </div>
                )}

                {/* Elements */}
                {template.elements.map((el) => {
                    return (
                        <div
                            key={el.id}
                            className="absolute pointer-events-none select-none flex items-center"
                            style={{
                                left: el.x * template.page.width,
                                top: el.y * template.page.height,
                                width: el.w * template.page.width,
                                height: el.h * template.page.height,
                                fontFamily: el.style.fontFamily,
                                fontSize: el.style.fontSize,
                                fontWeight: el.style.fontWeight,
                                color: el.style.color,
                                textAlign: el.style.align,
                                lineHeight: el.style.lineHeight,
                                letterSpacing: el.style.letterSpacing,
                                whiteSpace: 'pre-wrap',
                                justifyContent: el.style.align === 'center' ? 'center' : el.style.align === 'right' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            {renderMockText(el.text, {
                                ...data,
                            } as Record<string, string>)}
                        </div>
                    )
                })}
            </div>

            {/* Validation Code Watermark */}
            {data.CODIGO_VALIDACAO && (
                <div
                    className="absolute bottom-1 right-2 text-[8px] text-gray-400 opacity-50 pointer-events-none select-all z-50 transform origin-bottom-right"
                    style={{ transform: `scale(${scale})` }}
                >
                    Validação: {data.CODIGO_VALIDACAO}
                </div>
            )}
        </div>
    )
}
