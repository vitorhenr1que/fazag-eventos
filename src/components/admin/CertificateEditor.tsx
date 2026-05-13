'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import R2ImageUploader from './R2ImageUploader'
import {
    Award, Eye, Settings2, Move, Type, Trash2,
    AlignCenter, AlignLeft, AlignRight,
    Bold, Minus, Plus, ChevronDown, Image as ImageIcon, PenLine, Star, Save, Pencil
} from 'lucide-react'
import {
    CertificateTemplate,
    CertificateElement,
    SavedCertificateTemplate,
    DEFAULT_TEMPLATE,
    CERTIFICATE_DEFAULT_TEMPLATE_STORAGE_KEY,
    CERTIFICATE_SAVED_TEMPLATES_STORAGE_KEY,
    formatDateLongPtBr,
    renderMockText,
    clamp
} from '@/lib/certificate-utils'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'

interface CertificateEditorProps {
    config: {
        fundoUrl?: string
        template?: any // JSON template
        ativo: boolean
    }
    onChange: (config: { fundoUrl?: string, template: any, ativo: boolean }) => void
    eventoId?: string
    eventoNome?: string
    cargaHoraria?: number
    dataInicio?: string
}

const MOCK_DATA = {
    NOME_ALUNO: "João da Silva Sauro",
    NOME_EVENTO: "I Simpósio de Tecnologia Fazag",
    DATA: "14/02/2026",
    DATA_EXTENSO: "14 de fevereiro de 2026",
    CARGA_HORARIA: "20"
}

export default function CertificateEditor({
    config,
    onChange,
    eventoId,
    eventoNome,
    cargaHoraria,
    dataInicio
}: CertificateEditorProps) {
    // Estado local do template
    const [template, setTemplate] = useState<CertificateTemplate>(() => {
        let loadedTemplate = config.template

        // Tentar parsear se for string (pode acontecer com alguns drivers de DB/ORM)
        if (typeof loadedTemplate === 'string') {
            try {
                loadedTemplate = JSON.parse(loadedTemplate)
            } catch (e) {
                console.error("Erro ao parsear template JSON:", e)
                loadedTemplate = null
            }
        }

        if (loadedTemplate && typeof loadedTemplate === 'object' && loadedTemplate.elements) {
            return {
                ...loadedTemplate,
                background: {
                    ...loadedTemplate.background,
                    url: config.fundoUrl || loadedTemplate.background?.url || ''
                }
            } as CertificateTemplate
        }
        return {
            ...DEFAULT_TEMPLATE,
            background: {
                ...DEFAULT_TEMPLATE.background,
                url: config.fundoUrl ?? DEFAULT_TEMPLATE.background.url
            }
        }
    })

    // Sincronizar quando config mudar externamente (ex: carregamento inicial assíncrono)
    useEffect(() => {
        let loadedTemplate = config.template

        // Tentar parsear se for string
        if (typeof loadedTemplate === 'string') {
            try {
                loadedTemplate = JSON.parse(loadedTemplate)
            } catch (e) {
                loadedTemplate = null
            }
        }

        if (loadedTemplate && typeof loadedTemplate === 'object' && loadedTemplate.elements) {
            setTemplate((prev) => {
                // Evitar re-render desnecessário se for igual
                if (JSON.stringify(prev) === JSON.stringify(loadedTemplate)) return prev

                return {
                    ...loadedTemplate,
                    background: {
                        ...loadedTemplate.background,
                        url: config.fundoUrl ?? loadedTemplate.background?.url ?? DEFAULT_TEMPLATE.background.url
                    }
                } as CertificateTemplate
            })
        }
    }, [config.template, config.fundoUrl])

    const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
    const [canvasScale, setCanvasScale] = useState(1)
    const [addMenuOpen, setAddMenuOpen] = useState(false)
    const [templatesMenuOpen, setTemplatesMenuOpen] = useState(false)
    const [savedTemplates, setSavedTemplates] = useState<SavedCertificateTemplate[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const canvasRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Drag/Resize State
    const interactionRef = useRef<{
        type: 'move' | 'resize' | null
        elementId: string | null
        handle: string | null
        startX: number
        startY: number
        initialX: number
        initialY: number
        initialW: number
        initialH: number
    }>({
        type: null,
        elementId: null,
        handle: null,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        initialW: 0,
        initialH: 0
    })

    // Calcular escala do canvas baseado no container usando ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry) {
                // Diminuir um pouco para margens de segurança se necessário
                const availableWidth = entry.contentRect.width
                const scale = availableWidth / template.page.width
                setCanvasScale(scale)
            }
        })

        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [template.page.width])

    useEffect(() => {
        const saved = localStorage.getItem(CERTIFICATE_SAVED_TEMPLATES_STORAGE_KEY)
        if (!saved) return

        try {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) {
                setSavedTemplates(parsed.filter((item) => item?.id && item?.name && item?.template?.elements))
            }
        } catch (err) {
            console.error('Erro ao carregar templates salvos de certificado:', err)
        }
    }, [])

    const updateTemplate = (updates: Partial<CertificateTemplate>) => {
        const newTemplate = { ...template, ...updates }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
    }

    const updateElement = (id: string, updates: Partial<CertificateElement>) => {
        const newElements = template.elements.map(el =>
            el.id === id ? { ...el, ...updates } : el
        )
        const newTemplate = { ...template, elements: newElements }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
    }

    const updateElementStyle = (id: string, styleUpdates: Partial<CertificateElement['style']>) => {
        const newElements = template.elements.map(el =>
            el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el
        )
        const newTemplate = { ...template, elements: newElements }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
    }

    const getCurrentTemplatePayload = () => {
        const currentTemplate = {
            ...template,
            background: {
                ...template.background,
                url: config.fundoUrl || template.background.url || ''
            }
        }

        return {
            fundoUrl: config.fundoUrl || currentTemplate.background.url || '',
            template: currentTemplate,
            ativo: config.ativo
        }
    }

    const persistSavedTemplates = (templates: SavedCertificateTemplate[]) => {
        setSavedTemplates(templates)
        localStorage.setItem(CERTIFICATE_SAVED_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
    }

    const addTemplateFromCurrent = () => {
        setTemplatesMenuOpen(false)
        const name = window.prompt('Nome do template:', `Template ${savedTemplates.length + 1}`)
        const trimmedName = name?.trim()

        if (!trimmedName) return

        const now = new Date().toISOString()
        const payload = getCurrentTemplatePayload()
        const id = `template-${Date.now()}`
        const nextTemplate: SavedCertificateTemplate = {
            id,
            name: trimmedName,
            ...payload,
            createdAt: now,
            updatedAt: now
        }

        const templates = [...savedTemplates, nextTemplate]
        persistSavedTemplates(templates)
        setSelectedTemplateId(id)
        toast.success('Template de certificado salvo.')
    }

    const updateSelectedTemplate = () => {
        setTemplatesMenuOpen(false)
        const selectedTemplate = savedTemplates.find((item) => item.id === selectedTemplateId)

        if (!selectedTemplate) {
            toast.error('Selecione um template salvo.')
            return
        }

        const payload = getCurrentTemplatePayload()
        const templates = savedTemplates.map((item) =>
            item.id === selectedTemplate.id
                ? { ...item, ...payload, updatedAt: new Date().toISOString() }
                : item
        )

        persistSavedTemplates(templates)
        toast.success('Template atualizado.')
    }

    const renameSelectedTemplate = () => {
        setTemplatesMenuOpen(false)
        const selectedTemplate = savedTemplates.find((item) => item.id === selectedTemplateId)

        if (!selectedTemplate) {
            toast.error('Selecione um template salvo.')
            return
        }

        const name = window.prompt('Novo nome do template:', selectedTemplate.name)
        const trimmedName = name?.trim()

        if (!trimmedName) return

        const templates = savedTemplates.map((item) =>
            item.id === selectedTemplate.id
                ? { ...item, name: trimmedName, updatedAt: new Date().toISOString() }
                : item
        )

        persistSavedTemplates(templates)
        toast.success('Template renomeado.')
    }

    const deleteSelectedTemplate = () => {
        setTemplatesMenuOpen(false)
        const selectedTemplate = savedTemplates.find((item) => item.id === selectedTemplateId)

        if (!selectedTemplate) {
            toast.error('Selecione um template salvo.')
            return
        }

        if (!window.confirm(`Excluir o template "${selectedTemplate.name}"?`)) return

        const templates = savedTemplates.filter((item) => item.id !== selectedTemplate.id)
        persistSavedTemplates(templates)
        setSelectedTemplateId('')
        toast.success('Template excluído.')
    }

    const applyTemplate = (templateId: string) => {
        setTemplatesMenuOpen(false)
        const selectedTemplate = savedTemplates.find((item) => item.id === templateId)

        if (!selectedTemplate) {
            toast.error('Selecione um template salvo.')
            return
        }

        setTemplate(selectedTemplate.template)
        onChange({
            ...config,
            fundoUrl: selectedTemplate.fundoUrl || selectedTemplate.template.background?.url || '',
            template: selectedTemplate.template,
            ativo: selectedTemplate.ativo
        })
        setSelectedElementId(null)
        toast.success('Template aplicado ao certificado.')
    }

    const applySelectedTemplate = () => {
        applyTemplate(selectedTemplateId)
    }

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId)
        if (templateId) {
            applyTemplate(templateId)
        }
    }

    const saveAsDefaultTemplate = () => {
        setTemplatesMenuOpen(false)
        const selectedTemplate = savedTemplates.find((item) => item.id === selectedTemplateId)
        const payload = selectedTemplate
            ? {
                fundoUrl: selectedTemplate.fundoUrl || selectedTemplate.template.background?.url || '',
                template: selectedTemplate.template,
                ativo: selectedTemplate.ativo
            }
            : getCurrentTemplatePayload()

        localStorage.setItem(CERTIFICATE_DEFAULT_TEMPLATE_STORAGE_KEY, JSON.stringify(payload))

        toast.success('Modelo padrão definido para novos eventos.')
    }

    const deleteR2CertificateElementImage = async (url?: string) => {
        if (!url) return

        const res = await apiFetch('/api/r2/object', {
            method: 'DELETE',
            body: JSON.stringify({
                url,
                eventoId,
                kind: 'certificado_elemento'
            }),
            isAdmin: true
        })

        if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error?.message || 'Erro ao excluir imagem do R2')
        }
    }

    const deleteElement = async (id: string) => {
        const element = template.elements.find(el => el.id === id)

        if (element?.type === 'image' && element.src) {
            try {
                await deleteR2CertificateElementImage(element.src)
            } catch (err: any) {
                console.error(err)
                toast.error(err.message || 'Erro ao excluir imagem do R2')
                return
            }
        }

        const newElements = template.elements.filter(el => el.id !== id)
        const newTemplate = { ...template, elements: newElements }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
        setSelectedElementId(null)
    }

    const addNewText = () => {
        setAddMenuOpen(false)
        const id = `text-${Date.now()}`
        const newElement: CertificateElement = {
            id,
            type: 'text',
            text: 'Novo Texto',
            x: 0.1,
            y: 0.1,
            w: 0.3,
            h: 0.05,
            style: {
                fontFamily: 'sans-serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#000000',
                align: 'left',
                lineHeight: 1.2,
                letterSpacing: 0
            }
        }
        const newTemplate = { ...template, elements: [...template.elements, newElement] }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
        setSelectedElementId(id)
    }

    const addNewImage = () => {
        setAddMenuOpen(false)
        const id = `image-${Date.now()}`
        const newElement: CertificateElement = {
            id,
            type: 'image',
            text: '',
            src: '',
            alt: 'Imagem do certificado',
            objectFit: 'contain',
            x: 0.35,
            y: 0.35,
            w: 0.3,
            h: 0.2,
            style: {
                fontFamily: 'sans-serif',
                fontSize: 16,
                fontWeight: 400,
                color: '#000000',
                align: 'center',
                lineHeight: 1,
                letterSpacing: 0
            }
        }
        const newTemplate = { ...template, elements: [...template.elements, newElement] }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
        setSelectedElementId(id)
    }

    const addNewSignature = () => {
        setAddMenuOpen(false)
        const id = `signature-${Date.now()}`
        const newElement: CertificateElement = {
            id,
            type: 'text',
            text: '______________________________\nNome da Pessoa (Opcional)\nCargo (Opcional)',
            x: 0.35,
            y: 0.7,
            w: 0.3,
            h: 0.12,
            style: {
                fontFamily: 'sans-serif',
                fontSize: 18,
                fontWeight: 400,
                color: '#000000',
                align: 'center',
                lineHeight: 1.45,
                letterSpacing: 0
            }
        }
        const newTemplate = { ...template, elements: [...template.elements, newElement] }
        setTemplate(newTemplate)
        onChange({ ...config, template: newTemplate })
        setSelectedElementId(id)
    }

    // Interaction Handlers
    const onPointerDown = (e: React.PointerEvent, element: CertificateElement, type: 'move' | 'resize', handle?: string) => {
        e.stopPropagation()
        setSelectedElementId(element.id)

        interactionRef.current = {
            type,
            elementId: element.id,
            handle: handle || null,
            startX: e.clientX,
            startY: e.clientY,
            initialX: element.x,
            initialY: element.y,
            initialW: element.w,
            initialH: element.h
        }

        const canvas = canvasRef.current
        if (canvas) {
            canvas.setPointerCapture(e.pointerId)
        }
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const { type, elementId, handle, startX, startY, initialX, initialY, initialW, initialH } = interactionRef.current
        if (!type || !elementId) return

        const dx = (e.clientX - startX) / (template.page.width * canvasScale)
        const dy = (e.clientY - startY) / (template.page.height * canvasScale)

        if (type === 'move') {
            const el = template.elements.find(e => e.id === elementId)
            if (el) {
                updateElement(elementId, {
                    x: clamp(initialX + dx, 0, 1 - el.w),
                    y: clamp(initialY + dy, 0, 1 - el.h)
                })
            }
        } else if (type === 'resize' && handle) {
            let newW = initialW
            let newH = initialH
            let newX = initialX
            let newY = initialY

            if (handle.includes('e')) newW = clamp(initialW + dx, 0.05, 1 - initialX)
            if (handle.includes('s')) newH = clamp(initialH + dy, 0.05, 1 - initialY)
            if (handle.includes('w')) {
                const possibleW = initialW - dx
                if (possibleW >= 0.05 && initialX + dx >= 0) {
                    newW = possibleW
                    newX = initialX + dx
                }
            }
            if (handle.includes('n')) {
                const possibleH = initialH - dy
                if (possibleH >= 0.05 && initialY + dy >= 0) {
                    newH = possibleH
                    newY = initialY + dy
                }
            }

            updateElement(elementId, { x: newX, y: newY, w: newW, h: newH })
        }
    }

    const onPointerUp = (e: React.PointerEvent) => {
        interactionRef.current.type = null
        interactionRef.current.elementId = null
        if (canvasRef.current) {
            canvasRef.current.releasePointerCapture(e.pointerId)
        }
    }

    const selectedElement = template.elements.find(el => el.id === selectedElementId)

    return (
        <div className="flex flex-col gap-8 lg:flex-row">
            {/* CANVAS AREA */}
            <div className="flex-1 min-w-0 space-y-4" ref={containerRef}>
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <Award className="text-primary" size={24} />
                        <h3 className="font-bold text-lg text-slate-800">Editor Visual de Certificado</h3>
                    </div>
                    <div className="relative flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAddMenuOpen((open) => !open)}
                            className="shadow-sm"
                        >
                            <Plus size={16} className="mr-1" />
                            Adicionar
                            <ChevronDown size={14} className="ml-1" />
                        </Button>
                        {addMenuOpen && (
                            <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={addNewText}
                                >
                                    <Type size={15} />
                                    Adicionar texto
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={addNewImage}
                                >
                                    <ImageIcon size={15} />
                                    Adicionar imagem
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={addNewSignature}
                                >
                                    <PenLine size={15} />
                                    Adicionar assinatura
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:flex-row md:items-center">
                    <select
                        className="h-9 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                    >
                        <option value="">Templates salvos</option>
                        {savedTemplates.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplatesMenuOpen((open) => !open)}
                            className="w-full justify-center bg-white md:w-auto"
                        >
                            Templates
                            <ChevronDown size={14} className="ml-1" />
                        </Button>
                        {templatesMenuOpen && (
                            <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={applySelectedTemplate}
                                    disabled={!selectedTemplateId}
                                >
                                    <Eye size={15} />
                                    Aplicar selecionado
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={addTemplateFromCurrent}
                                >
                                    <Plus size={15} />
                                    Adicionar template
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={updateSelectedTemplate}
                                    disabled={!selectedTemplateId}
                                >
                                    <Save size={15} />
                                    Atualizar selecionado
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={renameSelectedTemplate}
                                    disabled={!selectedTemplateId}
                                >
                                    <Pencil size={15} />
                                    Renomear template
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={saveAsDefaultTemplate}
                                >
                                    <Star size={15} />
                                    Padrão novos eventos
                                </button>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={deleteSelectedTemplate}
                                    disabled={!selectedTemplateId}
                                >
                                    <Trash2 size={15} />
                                    Excluir template
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    ref={canvasRef}
                    className="relative bg-white shadow-xl ring-1 ring-slate-200 rounded-sm overflow-hidden touch-none mx-auto"
                    style={{
                        width: template.page.width * canvasScale,
                        height: template.page.height * canvasScale,
                        transition: 'width 0.1s, height 0.1s'
                    }}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    {/* Background */}
                    <div
                        className="absolute inset-0 pointer-events-none select-none"
                        style={{
                            backgroundImage: template.background.url ? `url(${template.background.url})` : 'none',
                            backgroundSize: template.background.fit,
                            backgroundPosition: 'center',
                            backgroundColor: '#fff'
                        }}
                    >
                        {!template.background.url && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                <Award size={64} className="opacity-10" />
                                <p className="text-sm">Sem fundo definido</p>
                            </div>
                        )}
                    </div>

                    {/* Layers */}
                    {template.elements.map((el) => {
                        const isSelected = selectedElementId === el.id
                        const x = el.x * template.page.width * canvasScale
                        const y = el.y * template.page.height * canvasScale
                        const w = el.w * template.page.width * canvasScale
                        const h = el.h * template.page.height * canvasScale

                        return (
                            <div
                                key={el.id}
                                className={cn(
                                    "absolute cursor-move select-none group",
                                    isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/50"
                                )}
                                style={{
                                    left: x,
                                    top: y,
                                    width: w,
                                    height: h,
                                }}
                                onPointerDown={(e) => onPointerDown(e, el, 'move')}
                            >
                                {el.type === 'image' ? (
                                    <div className="flex h-full w-full items-center justify-center overflow-hidden">
                                        {el.src ? (
                                            <img
                                                src={el.src}
                                                alt={el.alt || 'Imagem do certificado'}
                                                className="h-full w-full"
                                                style={{ objectFit: el.objectFit || 'contain' }}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-slate-300 text-slate-400">
                                                <ImageIcon size={Math.max(16, 28 * canvasScale)} />
                                                <span className="text-[10px]">Imagem</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className="w-full h-full overflow-hidden"
                                        style={{
                                            fontFamily: el.style.fontFamily,
                                            fontSize: el.style.fontSize * canvasScale,
                                            fontWeight: el.style.fontWeight,
                                            color: el.style.color,
                                            textAlign: el.style.align,
                                            lineHeight: el.style.lineHeight,
                                            letterSpacing: el.style.letterSpacing * canvasScale,
                                            whiteSpace: 'pre-wrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: el.style.align === 'center' ? 'center' : el.style.align === 'right' ? 'flex-end' : 'flex-start'
                                        }}
                                    >
                                        {renderMockText(el.text, {
                                            ...MOCK_DATA,
                                            NOME_EVENTO: eventoNome || MOCK_DATA.NOME_EVENTO,
                                            CARGA_HORARIA: cargaHoraria?.toString() || MOCK_DATA.CARGA_HORARIA,
                                            DATA: dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : MOCK_DATA.DATA,
                                            DATA_EXTENSO: dataInicio ? formatDateLongPtBr(dataInicio) : MOCK_DATA.DATA_EXTENSO
                                        })}
                                    </div>
                                )}

                                {/* Resize Handles */}
                                {isSelected && (
                                    <>
                                        <div
                                            className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary cursor-se-resize z-20 rounded-full"
                                            onPointerDown={(e) => onPointerDown(e, el, 'resize', 'se')}
                                        />
                                        <div
                                            className="absolute -left-1 -top-1 w-3 h-3 bg-primary cursor-nw-resize z-20 rounded-full"
                                            onPointerDown={(e) => onPointerDown(e, el, 'resize', 'nw')}
                                        />
                                        <div
                                            className="absolute -right-1 -top-1 w-3 h-3 bg-primary cursor-ne-resize z-20 rounded-full"
                                            onPointerDown={(e) => onPointerDown(e, el, 'resize', 'ne')}
                                        />
                                        <div
                                            className="absolute -left-1 -bottom-1 w-3 h-3 bg-primary cursor-sw-resize z-20 rounded-full"
                                            onPointerDown={(e) => onPointerDown(e, el, 'resize', 'sw')}
                                        />
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md">
                    <p>* Arraste para mover, use os cantos para redimensionar.</p>
                    <p>Escala: {Math.round(canvasScale * 100)}% ({template.page.width}x{template.page.height})</p>
                </div>
            </div>

            {/* PROPERTIES PANEL */}
            <div className="w-full lg:w-80 space-y-4">
                <Card className="border-none shadow-md overflow-hidden sticky top-4">
                    <CardHeader className="bg-slate-900 text-white py-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Settings2 size={16} />
                            Propriedades
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                        {/* Global Config */}
                        <div className="space-y-4 pb-4 border-b">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Liberar Emissão</Label>
                                    <Switch
                                        checked={config.ativo}
                                        onCheckedChange={(val) => onChange({ ...config, ativo: val, template })}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    Se ativado, os alunos poderão gerar seus certificados assim que cumprirem os requisitos de presença.
                                </p>
                            </div>

                            <R2ImageUploader
                                label="Fundo do Certificado (A4)"
                                currentUrl={config.fundoUrl}
                                kind="certificado_fundo"
                                eventoId={eventoId}
                                aspectRatio="aspect-[1.414/1]"
                                onUploadSuccess={(url) => {
                                    const newTemplate = {
                                        ...template,
                                        background: { ...template.background, url: url || '' }
                                    }
                                    setTemplate(newTemplate)
                                    onChange({
                                        ...config,
                                        fundoUrl: url || '',
                                        template: newTemplate
                                    })
                                }}
                            />
                        </div>

                        {/* Element Config */}
                        {selectedElement ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Elemento Selecionado</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteElement(selectedElement.id)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>

                                {selectedElement.type === 'image' ? (
                                    <div className="space-y-4">
                                        <R2ImageUploader
                                            label="Imagem do Elemento"
                                            currentUrl={selectedElement.src}
                                            kind="certificado_elemento"
                                            eventoId={eventoId}
                                            aspectRatio="aspect-[3/2]"
                                            idealSize="600x400"
                                            deleteRemoteOnRemove
                                            onUploadSuccess={(url) => updateElement(selectedElement.id, { src: url || '' })}
                                        />

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Ajuste</Label>
                                            <select
                                                className="w-full text-xs p-1.5 border rounded"
                                                value={selectedElement.objectFit || 'contain'}
                                                onChange={(e) => updateElement(selectedElement.id, { objectFit: e.target.value as CertificateElement['objectFit'] })}
                                            >
                                                <option value="contain">Conter</option>
                                                <option value="cover">Preencher</option>
                                                <option value="fill">Esticar</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px]">Texto alternativo</Label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={selectedElement.alt || ''}
                                                onChange={(e) => updateElement(selectedElement.id, { alt: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                <div className="space-y-2">
                                    <Label className="text-[11px]">Texto do Elemento</Label>
                                    <Textarea
                                        className="text-xs h-24"
                                        value={selectedElement.text}
                                        onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                                        placeholder="Use {{NOME_ALUNO}}, etc."
                                    />
                                    <p className="text-[9px] text-slate-400">Variáveis: {'{{NOME_ALUNO}}'}, {'{{NOME_EVENTO}}'}, {'{{DATA}}'}, {'{{DATA_EXTENSO}}'}, {'{{CARGA_HORARIA}}'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Fonte</Label>
                                        <select
                                            className="w-full text-xs p-1.5 border rounded"
                                            value={selectedElement.style.fontFamily}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontFamily: e.target.value })}
                                        >
                                            <option value="sans-serif">Sans Serif</option>
                                            <option value="serif">Serif</option>
                                            <option value="monospace">Monospace</option>
                                            <option value="'Inter', sans-serif">Inter</option>
                                            <option value="'Playfair Display', serif">Playfair</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Tamanho (px)</Label>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            value={selectedElement.style.fontSize}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Peso</Label>
                                        <select
                                            className="w-full text-xs p-1.5 border rounded"
                                            value={selectedElement.style.fontWeight}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { fontWeight: Number(e.target.value) })}
                                        >
                                            <option value="400">Normal</option>
                                            <option value="500">Médio</option>
                                            <option value="600">Semi-Bold</option>
                                            <option value="700">Negrito</option>
                                            <option value="900">Black</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Cor</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                className="h-8 w-8 p-0 border-none"
                                                value={selectedElement.style.color}
                                                onChange={(e) => updateElementStyle(selectedElement.id, { color: e.target.value })}
                                            />
                                            <Input
                                                type="text"
                                                className="h-8 text-[10px] flex-1"
                                                value={selectedElement.style.color}
                                                onChange={(e) => updateElementStyle(selectedElement.id, { color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[11px]">Alinhamento</Label>
                                    <div className="flex border rounded-md overflow-hidden">
                                        <Button
                                            type="button"
                                            variant={selectedElement.style.align === 'left' ? 'secondary' : 'ghost'}
                                            className="flex-1 h-8 rounded-none border-r"
                                            onClick={() => updateElementStyle(selectedElement.id, { align: 'left' })}
                                        >
                                            <AlignLeft size={14} />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={selectedElement.style.align === 'center' ? 'secondary' : 'ghost'}
                                            className="flex-1 h-8 rounded-none border-r"
                                            onClick={() => updateElementStyle(selectedElement.id, { align: 'center' })}
                                        >
                                            <AlignCenter size={14} />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={selectedElement.style.align === 'right' ? 'secondary' : 'ghost'}
                                            className="flex-1 h-8 rounded-none"
                                            onClick={() => updateElementStyle(selectedElement.id, { align: 'right' })}
                                        >
                                            <AlignRight size={14} />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Altura Linha</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            className="h-8 text-xs"
                                            value={selectedElement.style.lineHeight}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { lineHeight: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px]">Spacing</Label>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            value={selectedElement.style.letterSpacing}
                                            onChange={(e) => updateElementStyle(selectedElement.id, { letterSpacing: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                    </>
                                )}

                                <div className="pt-2 border-t text-[10px] text-slate-400 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Posição</span>
                                        <span>X: {Math.round(selectedElement.x * 100)}% Y: {Math.round(selectedElement.y * 100)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Dimensões</span>
                                        <span>W: {Math.round(selectedElement.w * 100)}% H: {Math.round(selectedElement.h * 100)}%</span>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="py-12 text-center space-y-3">
                                <Move className="mx-auto text-slate-300" size={32} />
                                <p className="text-xs text-slate-500">Selecione um elemento no canvas para editar suas propriedades.</p>
                                <Button type="button" variant="outline" size="sm" onClick={addNewText}>
                                    <Plus size={14} className="mr-1" /> Criar Texto
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
