'use client'

import { Check } from 'lucide-react'
import { canAdminAction, type AdminSession } from '@/lib/admin-permissions'

export function SubeventoCheckin({ session, presente, onCheckin, onRemove, processing = false }: {
    session: AdminSession
    presente: boolean
    onCheckin: () => void
    onRemove: () => void
    processing?: boolean
}) {
    if (presente) return <span className="flex items-center gap-2"><span className="flex items-center gap-0.5 font-bold text-green-600"><Check size={10} /> Ok</span>
        {canAdminAction(session, 'REMOVER_CHECKIN_SUBEVENTO') && <button type="button" disabled={processing} onClick={onRemove} className="text-red-700 hover:underline disabled:opacity-50">Remover check-in</button>}
    </span>
    if (!canAdminAction(session, 'CHECKIN_SUBEVENTO')) return <span className="text-slate-500">Ausente</span>
    return <button type="button" disabled={processing} onClick={onCheckin} className="font-bold text-primary hover:underline disabled:opacity-50">Check-in</button>
}
