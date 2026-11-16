import { useEffect, useMemo, useState } from 'react'
import { Inbox, Mail, Plus, Trash2, X } from 'lucide-react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { getApiUrl } from '@/config/api'
import { useRBAC } from '@/contexts/RBACContext'
import { QubeCharacter } from '@/components/ui/QubeCharacter'
import { FilePicker } from '@/components/FilePicker'

interface QuoteRequest {
  id: string
  name: string
  email: string
  projectName: string
  note: string
  drawingName: string | null
  modelName: string | null
  hasDrawing: boolean
  hasModel: boolean
  source: 'WEB' | 'MANUAL'
  status: 'NEW' | 'IN_REVIEW' | 'STARTED'
  projectId: number | null
  createdAt: string
}

type Tab = 'quotes' | 'newsletters'

const STATUS = { NEW: 'New', IN_REVIEW: 'In review', STARTED: 'Started' }

const STATUS_PILL = {
  NEW: 'bg-[var(--uq-yellow-soft)] text-[var(--uq-ink)] border border-[var(--uq-yellow)]/40',
  IN_REVIEW: 'bg-sky-50 text-sky-700 border border-sky-100',
  STARTED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
}

function isNewsletter(row: QuoteRequest) {
  return /^newsletter\s*signup/i.test(row.projectName.trim()) || /newsletter form/i.test(row.note)
}

function initials(name?: string) {
  const parts = (name || 'R').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function shortDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export default function RequestsPage() {
  const { hasPermission } = useRBAC()
  const canStart = hasPermission('estimate.edit')
  const canDelete = hasPermission('admin')
  const [tab, setTab] = useState<Tab>('quotes')
  const [rows, setRows] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const quotes = useMemo(() => rows.filter((row) => !isNewsletter(row)), [rows])
  const newsletters = useMemo(() => rows.filter((row) => isNewsletter(row)), [rows])
  const visible = tab === 'quotes' ? quotes : newsletters

  const load = async () => {
    setLoading(true)
    try {
      const response = await authenticatedFetch(getApiUrl('quotes'))
      if (!response.ok) throw new Error('Could not load requests')
      setRows(await response.json())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const switchTab = (next: Tab) => {
    setTab(next)
    setConfirmId(null)
    setDetailId(null)
  }

  const start = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const response = await authenticatedFetch(getApiUrl(`quotes/${id}/start`), { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not start the project')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the project')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    setError('')
    try {
      const response = await authenticatedFetch(getApiUrl(`quotes/${id}`), { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Could not delete the request')
      }
      setRows((current) => current.filter((row) => row.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the request')
    } finally {
      setBusyId(null)
    }
  }

  const createManual = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const form = event.currentTarget
    const response = await authenticatedFetch(getApiUrl('quotes/manual'), { method: 'POST', body: new FormData(form) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.message || data.error || 'Could not save the request')
      return
    }
    setOpen(false)
    form.reset()
    setTab('quotes')
    await load()
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--uq-ink)] flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Requests
          </h1>
        </div>
        {canStart && tab === 'quotes' && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> New request
          </button>
        )}
      </div>

      <div
        className="inline-flex rounded-xl bg-[var(--uq-offwhite)] p-1 border border-black/5"
        role="tablist"
        aria-label="Request type"
      >
        <TabButton active={tab === 'quotes'} onClick={() => switchTab('quotes')} count={quotes.length}>
          Quotes
        </TabButton>
        <TabButton active={tab === 'newsletters'} onClick={() => switchTab('newsletters')} count={newsletters.length}>
          Newsletters
        </TabButton>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="py-16 flex flex-col items-center">
          <QubeCharacter moment="auto" size={120} caption />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-[var(--uq-offwhite)] border border-black/5">
          <QubeCharacter mood="cute" size={120} className="mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {tab === 'quotes' ? 'No quotes yet' : 'No newsletter signups yet'}
          </h3>
          <p className="text-slate-600">
            {tab === 'quotes'
              ? 'They appear here when someone asks for an estimate.'
              : 'They appear here when someone subscribes on the website.'}
          </p>
        </div>
      ) : tab === 'quotes' ? (
        <div className="rounded-3xl bg-[var(--uq-offwhite)] p-3 sm:p-4 space-y-3">
          {visible.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-black/5 bg-[var(--uq-offwhite-card)] px-4 py-4 sm:px-5 hover:border-black/10 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="h-12 w-12 rounded-xl bg-[var(--uq-blue)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(row.projectName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-slate-400">{shortDate(row.createdAt)}</span>
                    <h3 className="text-base font-semibold text-[var(--uq-ink)] truncate">{row.projectName}</h3>
                    <span className={`uq-pill ${STATUS_PILL[row.status]}`}>{STATUS[row.status]}</span>
                    <span className="uq-pill bg-slate-100 text-slate-600">{row.source === 'WEB' ? 'Site' : 'Manual'}</span>
                  </div>
                  <p className="text-sm text-[var(--uq-muted)] truncate">
                    {row.name} · {row.email}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                  {row.note && (
                    <button
                      type="button"
                      onClick={() => setDetailId(detailId === row.id ? null : row.id)}
                      aria-expanded={detailId === row.id}
                      className="mt-1 text-xs font-semibold text-[var(--uq-blue)] hover:underline"
                    >
                      {detailId === row.id ? 'Hide details' : 'Show details'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {canDelete &&
                    (confirmId === row.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => remove(row.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-40"
                        >
                          {busyId === row.id ? 'Deleting…' : row.projectId ? 'Delete project' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => setConfirmId(null)}
                          className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-semibold border border-black/10"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(row.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-black/10 text-slate-700 hover:border-red-200 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ))}
                  {row.projectId ? (
                    <a
                      href="/estimation/rough"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-black/10 text-slate-700 hover:border-[var(--uq-blue)]/30 hover:text-[var(--uq-blue)]"
                    >
                      Rough Estimation
                    </a>
                  ) : canStart ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => start(row.id)}
                      className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                    >
                      {busyId === row.id ? 'Starting…' : 'Start project'}
                    </button>
                  ) : null}
                </div>
              </div>
              {detailId === row.id && (
                <div className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-[var(--uq-ink)]">
                  <p className="mb-2 text-[var(--uq-muted)]">
                    {row.name} ·{' '}
                    <a href={`mailto:${row.email}`} className="text-[var(--uq-blue)] hover:underline">
                      {row.email}
                    </a>
                    {row.drawingName ? ` · Drawing: ${row.drawingName}` : ''}
                  </p>
                  <p className="whitespace-pre-line break-words">{row.note}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-[var(--uq-offwhite)] p-3 sm:p-4 space-y-3">
          {visible.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-black/5 bg-[var(--uq-offwhite-card)] px-4 py-4 sm:px-5 hover:border-black/10 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-12 w-12 rounded-xl bg-orange-500/15 text-[var(--uq-ink)] flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-slate-400">{shortDate(row.createdAt)}</span>
                    <h3 className="text-base font-semibold text-[var(--uq-ink)] truncate">{row.email}</h3>
                    <span className="uq-pill bg-slate-100 text-slate-600">Newsletter</span>
                  </div>
                  <p className="text-sm text-[var(--uq-muted)] truncate">
                    {row.name && row.name !== row.email ? `${row.name} · ` : ''}
                    Website signup
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <a
                    href={`mailto:${row.email}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-black/10 text-slate-700 hover:border-[var(--uq-blue)]/30 hover:text-[var(--uq-blue)]"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                  {canDelete &&
                    (confirmId === row.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => remove(row.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-40"
                        >
                          {busyId === row.id ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => setConfirmId(null)}
                          className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-semibold border border-black/10"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(row.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-black/10 text-slate-700 hover:border-red-200 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={createManual} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New request</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ManualField label="Name" name="name" />
            <ManualField label="Email" name="email" type="email" />
            <ManualField label="Project name" name="projectName" />
            <label className="block text-sm font-medium">
              Note
              <textarea name="note" rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <FilePicker
              label="Drawing"
              name="drawing"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf"
              title="Drop a drawing here"
              hint="PDF, image, DWG, or DXF"
            />
            <FilePicker label="IFC model" name="model" accept=".ifc" title="Drop an IFC model here" hint="Optional" />
            <button type="submit" className="w-full rounded-xl bg-[#010127] text-white py-2.5 font-semibold">
              Save request
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-white text-[var(--uq-ink)] shadow-sm border border-black/5'
          : 'text-[var(--uq-muted)] hover:text-[var(--uq-ink)]'
      }`}
    >
      {children}
      <span
        className={`min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
          active ? 'bg-[var(--uq-blue)] text-white' : 'bg-black/5 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function ManualField({ label, name, type = 'text' }: { label: string; name: string; type?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input name={name} type={type} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
    </label>
  )
}
