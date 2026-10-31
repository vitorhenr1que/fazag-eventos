'use client'

import { Check } from 'lucide-react'
import { canAdminAction, type AdminSession } from '@/lib/admin-permissions'

export function SubeventoCheckin({ session, presente, onCheckin }: {
    session: AdminSession
    presente: boolean
    onCheckin: () => void
}) {
    if (presente) return <span className="flex items-center gap-0.5 font-bold text-green-600"><Check size={10} /> Ok</span>
    if (!canAdminAction(session, 'CHECKIN_SUBEVENTO')) return <span className="text-slate-500">Ausente</span>
    return <button type="button" onClick={onCheckin} className="font-bold text-primary hover:underline">Check-in</button>
}
