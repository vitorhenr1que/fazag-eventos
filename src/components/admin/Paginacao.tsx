'use client'

import { Button } from '@/components/ui/button'

export const ITENS_POR_PAGINA = 10

interface PaginacaoProps {
    pagina: number
    total: number
    onPaginaChange: (pagina: number) => void
}

export function Paginacao({ pagina, total, onPaginaChange }: PaginacaoProps) {
    const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA))
    if (total === 0) return null

    const inicio = (pagina - 1) * ITENS_POR_PAGINA + 1
    const fim = Math.min(pagina * ITENS_POR_PAGINA, total)

    return (
        <nav aria-label="Paginação da lista" className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
            <p className="text-sm text-slate-500" role="status">
                Mostrando {inicio}–{fim} de {total}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pagina === 1} onClick={() => onPaginaChange(1)}>
                    Primeira
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pagina === 1} onClick={() => onPaginaChange(pagina - 1)}>
                    Anterior
                </Button>
                <span className="text-sm text-slate-600">Página {pagina} de {totalPaginas}</span>
                <Button type="button" variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => onPaginaChange(pagina + 1)}>
                    Próxima
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => onPaginaChange(totalPaginas)}>
                    Última
                </Button>
            </div>
        </nav>
    )
}
