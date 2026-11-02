'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, ShieldCheck, Users, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { adminAreas, adminActions, adminRoleLabels, type AdminAction, type AdminSession, type UserPermissions } from '@/lib/admin-permissions'
import { useAdminSession } from '@/components/admin/AdminSessionContext'

type User = AdminSession & { ativo: boolean }
type Evento = { id: string; nome: string; status: string }
const initialPermissions = (): UserPermissions => ({ areas: ['eventos'], eventos: 'PUBLICADOS', eventoIds: [], acesso: 'VISUALIZAR' })
const initialForm = () => ({ nome: '', email: '', senha: '', role: 'NUPPEX' as User['role'], ativo: true, permissoes: initialPermissions() as UserPermissions | null })
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const accessOptions = [
    { value: 'VISUALIZAR', label: 'Somente visualizar', description: 'Consultar dados sem alterar registros.' },
    { value: 'EDITAR', label: 'Visualizar e editar', description: 'Modificar registros nas áreas permitidas.' },
    { value: 'PERSONALIZAR', label: 'Personalizar', description: 'Visualizar e executar somente as ações selecionadas abaixo.' },
] as const

export default function UsuariosPage() {
    const session = useAdminSession()
    const [usuarios, setUsuarios] = useState<User[]>([])
    const [eventos, setEventos] = useState<Evento[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<string | null>(null)
    const [form, setForm] = useState(initialForm)
    const [saving, setSaving] = useState(false)
    const [eventQuery, setEventQuery] = useState('')
    const ownAccount = selected === session.id

    async function load() {
        setLoading(true); setError('')
        try {
            const res = await apiFetch('/api/admin/usuarios', { isAdmin: true, cache: 'no-store' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.message || 'Não foi possível carregar os usuários.')
            setUsuarios(json.data.usuarios); setEventos(json.data.eventos)
        } catch (err) { setError(err instanceof Error ? err.message : 'Erro de conexão.') }
        finally { setLoading(false) }
    }
    useEffect(() => { void load() }, [])

    function edit(user: User) {
        setSelected(user.id); setEventQuery('')
        setForm({ nome: user.nome, email: user.email, senha: '', role: user.role, ativo: user.ativo, permissoes: user.permissoes ? structuredClone(user.permissoes) : null })
    }
    function setPermissions(values: Partial<UserPermissions>) {
        setForm(current => ({ ...current, permissoes: { ...(current.permissoes || initialPermissions()), ...values } }))
    }
    async function save(event: FormEvent) {
        event.preventDefault(); setSaving(true)
        try {
            const res = await apiFetch(`/api/admin/usuarios${selected ? `/${selected}` : ''}`, {
                isAdmin: true, method: selected ? 'PUT' : 'POST',
                body: JSON.stringify({ ...form, senha: form.senha || undefined }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error?.details ? Object.values(json.error.details).flat().join(' ') : json.error?.message || 'Não foi possível salvar.')
            setUsuarios(current => [...current.filter(user => user.id !== json.data.id), json.data].sort((a, b) => a.nome.localeCompare(b.nome)))
            edit(json.data); toast.success(selected ? 'Usuário atualizado.' : 'Usuário criado.')
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro de conexão.') }
        finally { setSaving(false) }
    }
    const matches = usuarios.filter(user => `${user.nome} ${user.email}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    const config = form.permissoes

    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck size={18} /> ADMINISTRAÇÃO</div><h1 className="text-3xl font-bold text-slate-800">Usuários e acessos</h1><p className="mt-2 text-slate-500">Defina quem entra, quais áreas acessa e o que pode modificar.</p></div>
            <Button disabled={saving} onClick={() => { setSelected(null); setForm(initialForm()); setEventQuery('') }}><Plus size={18} className="mr-2" /> Novo usuário</Button>
        </div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error} <Button variant="link" onClick={() => void load()}>Tentar novamente</Button></div>}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,1fr)_minmax(420px,1.4fr)]">
            <section className="overflow-hidden rounded-xl border bg-white shadow-sm" aria-label="Usuários cadastrados">
                <div className="border-b p-5"><h2 className="flex items-center gap-2 font-semibold"><Users size={18} /> Contas do painel <span className="ml-auto text-sm text-slate-400">{usuarios.length}</span></h2><label className="mt-4 flex items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400" /><input aria-label="Buscar usuário por nome ou e-mail" className="min-w-0 flex-1 py-2 text-sm outline-none" placeholder="Buscar nome ou e-mail" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
                <div className="max-h-[760px] overflow-y-auto divide-y">{loading ? <p role="status" className="p-6 text-slate-500">Carregando usuários...</p> : matches.length ? matches.map(user => <button key={user.id} disabled={saving} onClick={() => edit(user)} aria-pressed={selected === user.id} className={`w-full border-l-4 p-5 text-left transition hover:bg-slate-50 focus-visible:outline-primary ${selected === user.id ? 'border-l-primary bg-slate-50' : 'border-l-transparent'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-800">{user.nome}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${user.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{user.ativo ? 'Ativo' : 'Inativo'}</span></div><p className="mt-1 break-all text-sm text-slate-500">{user.email}</p><p className="mt-3 text-xs text-slate-500">{user.permissoes ? `Personalizado · ${user.permissoes.acesso === 'EDITAR' ? 'Edição' : user.permissoes.acesso === 'PERSONALIZAR' ? 'Ações selecionadas' : 'Somente leitura'}` : adminRoleLabels[user.role]}{user.id === session.id ? ' · Você' : ''}</p>
                </button>) : <p className="p-6 text-slate-500">Nenhum usuário encontrado.</p>}</div>
            </section>
            <form onSubmit={save} className="rounded-xl border bg-white shadow-sm">
                <div className="border-b p-6"><h2 className="text-xl font-bold text-slate-800">{selected ? 'Editar usuário' : 'Criar usuário'}</h2><p className="mt-1 text-sm text-slate-500">As permissões são verificadas a cada acesso ao servidor.</p></div>
                <fieldset disabled={saving || loading || !!error} className="space-y-6 p-6">
                    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Nome<input required minLength={2} maxLength={120} autoComplete="name" className={field} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label><label className="text-sm font-medium">E-mail<input type="email" required maxLength={190} autoComplete="email" className={field} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></div>
                    <label className="block text-sm font-medium">{selected ? 'Nova senha (opcional)' : 'Senha inicial'}<input type="password" required={!selected} minLength={8} maxLength={72} autoComplete="new-password" className={field} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">{selected ? 'Deixe em branco para manter a senha atual. ' : ''}Mínimo de 8 caracteres.</span></label>
                    <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={ownAccount} checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-primary" /> Conta ativa <span className="text-xs text-slate-500">Desativar bloqueia também sessões abertas.</span></label>
                    <label className="block text-sm font-medium">Perfil de acesso<select disabled={ownAccount} className={field} value={config ? 'PERSONALIZADO' : form.role} onChange={e => { const value = e.target.value; setForm({ ...form, role: value === 'PERSONALIZADO' ? 'NUPPEX' : value as User['role'], permissoes: value === 'PERSONALIZADO' ? initialPermissions() : null }) }}>
                        <option value="PERSONALIZADO">Personalizado — escolher permissões</option><option value="ADMIN">Administrador — acesso completo e gestão de usuários</option><option value="NUPPEX">NUPPEX — gestão de eventos</option><option value="FINANCEIRO">Financeiro — relatório e pendentes</option>{form.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Administrador (SUPER_ADMIN)</option>}
                    </select></label>
                    {ownAccount && <p className="text-xs text-slate-500">O perfil e a ativação da sua própria conta são protegidos para preservar seu acesso.</p>}
                    {config ? <>
                        <fieldset><legend className="mb-3 text-sm font-semibold">Áreas permitidas</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(adminAreas).map(([key, title]) => <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={config.areas.includes(key as keyof typeof adminAreas)} onChange={e => setPermissions({ areas: e.target.checked ? [...config.areas, key as keyof typeof adminAreas] : config.areas.filter(area => area !== key) })} />{title}</label>)}</div><p className="mt-2 text-xs text-slate-500">Áreas desmarcadas ficam bloqueadas. A gestão de usuários é exclusiva de administradores.</p></fieldset>
                        <label className="block text-sm font-medium">Quais eventos pode acessar?<select className={field} value={config.eventos} onChange={e => setPermissions({ eventos: e.target.value as UserPermissions['eventos'] })}><option value="TODOS">Todos os eventos</option><option value="PUBLICADOS">Somente eventos publicados</option><option value="ESPECIFICOS">Somente os eventos selecionados</option></select></label>
                        {config.eventos === 'ESPECIFICOS' && <fieldset className="rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Selecione os eventos ({config.eventoIds.length})</legend><input className={field} aria-label="Buscar evento" placeholder="Buscar evento" value={eventQuery} onChange={e => setEventQuery(e.target.value)} /><div className="mt-3 max-h-52 space-y-3 overflow-y-auto">{eventos.filter(evento => evento.nome.toLocaleLowerCase().includes(eventQuery.toLocaleLowerCase())).map(evento => <label key={evento.id} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={config.eventoIds.includes(evento.id)} onChange={e => setPermissions({ eventoIds: e.target.checked ? [...config.eventoIds, evento.id] : config.eventoIds.filter(id => id !== evento.id) })} /><span>{evento.nome}<span className="block text-xs text-slate-400">{evento.status === 'PUBLISHED' ? 'Publicado' : evento.status === 'DRAFT' ? 'Rascunho' : evento.status === 'FINISHED' ? 'Encerrado' : 'Cancelado'}</span></span></label>)}{eventos.length === 0 && <p className="text-sm text-slate-500">Nenhum evento cadastrado.</p>}</div></fieldset>}
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">O que pode fazer nas áreas liberadas?</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {accessOptions.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${option.value === 'PERSONALIZAR' ? 'sm:col-span-2' : ''} ${config.acesso === option.value ? 'border-primary bg-slate-50' : ''}`}>
                                    <input type="radio" name="acesso" value={option.value} checked={config.acesso === option.value} onChange={() => setPermissions({ acesso: option.value })} aria-controls={option.value === 'PERSONALIZAR' ? 'acoes-personalizadas' : undefined} className="mt-1 accent-primary" />
                                    <span className="text-sm font-medium">{option.label}<span className="mt-1 block text-xs font-normal text-slate-500">{option.description}</span></span>
                                </label>)}
                            </div>
                            {config.acesso === 'PERSONALIZAR' && <fieldset id="acoes-personalizadas" className="mt-4 rounded-lg border bg-slate-50 p-4">
                                <legend className="px-1 text-sm font-semibold">Ações permitidas</legend>
                                <div className="grid gap-3 sm:grid-cols-2">{Object.entries(adminActions).map(([key, label]) => <label key={key} className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm">
                                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={config.acoes?.includes(key as AdminAction) ?? false} onChange={e => setPermissions({ acoes: e.target.checked ? [...(config.acoes || []), key as AdminAction] : (config.acoes || []).filter(action => action !== key) })} />{label}
                                </label>)}</div>
                                <p className="mt-3 text-xs text-slate-500">Aprovar inscrições exige a área Inscrições pendentes ou Financeiro. As demais ações exigem a área Eventos. Todas respeitam os eventos liberados para este usuário. Ações desmarcadas ficam bloqueadas.</p>
                            </fieldset>}
                            <p className="mt-2 text-xs text-slate-500">Criar eventos exige acesso a todos os eventos e permissão de edição.</p>
                        </fieldset>
                    </> : <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{['ADMIN', 'SUPER_ADMIN'].includes(form.role) ? 'Este usuário terá acesso completo, incluindo criar usuários e alterar permissões.' : 'Este usuário seguirá as permissões padrão do perfil selecionado.'}</div>}
                    <div className="flex justify-end border-t pt-5"><Button type="submit" disabled={saving || config?.eventos === 'ESPECIFICOS' && !config.eventoIds.length}>{saving ? 'Salvando...' : selected ? 'Salvar alterações' : 'Criar usuário'}</Button></div>
                </fieldset>
            </form>
        </div>
    </div>
}
