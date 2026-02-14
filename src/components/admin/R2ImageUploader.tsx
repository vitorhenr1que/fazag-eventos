'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'

interface R2ImageUploaderProps {
    currentUrl?: string
    onUploadSuccess: (url: string) => void
    eventoId?: string
    kind?: 'banner' | 'certificado_fundo'
    label?: string
    aspectRatio?: string // e.g., "aspect-[3/1]"
    idealSize?: string // e.g., "1200x400"
}

export default function R2ImageUploader({
    currentUrl,
    onUploadSuccess,
    eventoId,
    kind = 'banner',
    label,
    aspectRatio = "aspect-[3/1]",
    idealSize = "1200x400"
}: R2ImageUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState(currentUrl)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Sincronizar preview se currentUrl mudar (útil ao carregar dados)
    React.useEffect(() => {
        setPreviewUrl(currentUrl)
    }, [currentUrl])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validações client-side básicas
        if (file.size > 5 * 1024 * 1024) {
            toast.error('O arquivo deve ter no máximo 5MB')
            return
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Selecione apenas arquivos de imagem')
            return
        }

        setUploading(true)
        try {
            // 1. Obter Presigned URL
            const res = await apiFetch('/api/r2/presign', {
                method: 'POST',
                body: JSON.stringify({
                    eventoId,
                    fileName: file.name,
                    contentType: file.type,
                    fileSize: file.size,
                    kind // Passando o tipo de upload
                }),
                isAdmin: true
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error?.message || 'Erro ao gerar link de upload')
            }

            const { uploadUrl, publicUrl } = await res.json()

            // 2. Fazer Upload direto para o R2
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            })

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                console.error('[DEBUG R2] Erro na resposta do R2:', errorText);
                throw new Error('Falha ao enviar arquivo para o R2. Verifique o CORS.');
            }

            // 3. Sucesso
            setPreviewUrl(publicUrl)
            onUploadSuccess(publicUrl)
            toast.success('Imagem enviada com sucesso!')
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || 'Erro ao realizar upload')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeImage = (e: React.MouseEvent) => {
        e.stopPropagation()
        setPreviewUrl('')
        onUploadSuccess('')
    }

    return (
        <div className="space-y-2">
            {label && <label className="text-sm font-medium block text-slate-700">{label}</label>}

            <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`
                    relative rounded-lg overflow-hidden border-2 border-dashed 
                    ${previewUrl ? 'border-transparent' : 'border-slate-200 hover:border-primary/50 hover:bg-primary/5'} 
                    ${aspectRatio} bg-slate-50 transition-all cursor-pointer group
                `}
            >
                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button type="button" variant="secondary" size="sm" className="h-8">
                                Alterar
                            </Button>
                            <Button type="button" variant="destructive" size="sm" className="h-8" onClick={removeImage}>
                                <X size={14} className="mr-1" /> Remover
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                        {uploading ? (
                            <>
                                <Loader2 className="animate-spin text-primary" size={24} />
                                <span className="text-xs">Fazendo upload...</span>
                            </>
                        ) : (
                            <>
                                <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100">
                                    <Upload size={18} />
                                </div>
                                <div className="text-center px-4">
                                    <span className="text-sm font-medium block">Clique para enviar</span>
                                    <span className="text-[10px] opacity-70">Ideal: {idealSize} (Máx 5MB)</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
            />
        </div>
    )
}
