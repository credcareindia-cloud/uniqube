import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Plus, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { CubeLoader } from '@/components/ui/CubeLoader'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { API_BASE_URL } from '@/config/api'
import { useProjectPermissions } from '@/hooks/useProjectPermissions'
import { toast } from '@/components/ui/use-toast'
import { InputFilesPane } from './InputFilesPane'
import { EstimatePane, type NewEstimateLine } from './EstimatePane'
import type { EstimateDetail, EstimateSummary, Margins } from './types'

interface ProjectHeader {
  id: number
  displayNumber: number
  name: string
  stage: 'TENDER' | 'PROJECT'
}

/** Revisions sort naturally except for named variants, which belong beside their base. */
const byRevision = (a: EstimateSummary, b: EstimateSummary) =>
  a.revision.localeCompare(b.revision, undefined, { numeric: true })

/** Next free R-number from existing revisions (R0, R1, R2 -PRE WAR → R2). */
const nextRevisionName = (revs: EstimateSummary[]) => {
  const nums = revs
    .map((r) => /^R(\d+)/i.exec(r.revision)?.[1])
    .filter((n): n is string => n != null)
    .map(Number)
  return `R${nums.length ? Math.max(...nums) + 1 : 0}`
}

const apiErrorMessage = (data: { message?: string; error?: string }, status: number) =>
  data.message || (typeof data.error === 'string' ? data.error : null) || `HTTP ${status}`

export default function ProjectEstimatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const permissions = useProjectPermissions(id)

  const [project, setProject] = useState<ProjectHeader | null>(null)
  const [revisions, setRevisions] = useState<EstimateSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<EstimateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Project header and the revision list load together; the revision body follows
  // once we know which one is selected.
  useEffect(() => {
    if (!id) return
    let cancelled = false

    Promise.all([
      authenticatedFetch(`projects/${id}`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`Could not load project (${r.status})`)),
      ),
      authenticatedFetch(`estimates?projectId=${id}`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`Could not load estimates (${r.status})`)),
      ),
    ])
      .then(([proj, list]) => {
        if (cancelled) return
        setProject(proj)
        const sorted = (list.estimates as EstimateSummary[]).sort(byRevision)
        setRevisions(sorted)
        setActiveId((current) => current ?? sorted[sorted.length - 1]?.id ?? null)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!activeId) return
    let cancelled = false
    authenticatedFetch(`estimates/${activeId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => !cancelled && setEstimate(data))
      .catch(() => !cancelled && setError('Could not load that revision'))
    return () => {
      cancelled = true
    }
  }, [activeId])

  /** Applies a server response that already contains the repriced estimate. */
  const absorb = useCallback((updated: EstimateDetail) => {
    setEstimate(updated)
    setRevisions((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, totalAmount: updated.total } : r)),
    )
  }, [])

  const patch = async (url: string, body: unknown) => {
    setBusy(true)
    try {
      const res = await authenticatedFetch(url, { method: 'PATCH', body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      absorb(await res.json())
    } catch (err) {
      toast({
        title: 'Could not save that change',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const addRevision = async () => {
    setBusy(true)
    try {
      // Refetch so the next name is based on what is actually in the DB, not a
      // stale list that still thinks no revisions exist and suggests R0 again.
      const listRes = await authenticatedFetch(`estimates?projectId=${id}`)
      if (!listRes.ok) throw new Error(`Could not load revisions (${listRes.status})`)
      const listData = await listRes.json()
      const fresh = ((listData.estimates as EstimateSummary[]) || []).sort(byRevision)
      setRevisions(fresh)

      const revision = nextRevisionName(fresh)
      const copyFromId = activeId ?? fresh[fresh.length - 1]?.id

      const res = await authenticatedFetch('estimates', {
        method: 'POST',
        body: JSON.stringify({
          projectId: Number(id),
          revision,
          // Copying the latest revision carries its rates and percentages forward,
          // which is how an estimator actually raises the next one.
          copyFromId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, res.status))

      setRevisions((prev) =>
        [
          ...prev.filter((r) => r.id !== data.id),
          {
            id: data.id,
            jobNumber: data.jobNumber,
            revision: data.revision,
            status: data.status,
            totalAmount: data.total,
            lineCount: (data.bills ?? []).reduce(
              (n: number, b: { lines: unknown[] }) => n + b.lines.length,
              0,
            ),
            updatedAt: new Date().toISOString(),
          },
        ].sort(byRevision),
      )
      setActiveId(data.id)
      setEstimate(data)
      toast({ title: `Revision ${revision} created` })
    } catch (err) {
      toast({
        title: 'Could not create that revision',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    if (!estimate) return
    setBusy(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/estimates/${estimate.id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${estimate.jobNumber} ${estimate.revision} ${estimate.name}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const autoGenerate = async () => {
    if (!estimate) return
    const hasLines = estimate.bills.some((b) => b.lines.length > 0)
    if (
      hasLines &&
      !window.confirm(
        `Replace all items in ${estimate.revision} with an AI draft from the uploaded inputs?`,
      )
    ) {
      return
    }

    setBusy(true)
    try {
      const res = await authenticatedFetch(`estimates/${estimate.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ replace: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
      absorb(data)
      const lineCount = (data.bills ?? []).reduce(
        (n: number, b: { lines: unknown[] }) => n + b.lines.length,
        0,
      )
      toast({ title: `Generated ${lineCount} estimate line${lineCount === 1 ? '' : 's'}` })
    } catch (err) {
      toast({
        title: 'Auto generate failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const deleteRevision = async () => {
    if (!estimate) return
    if (
      !window.confirm(
        `Delete revision ${estimate.revision}? This cannot be undone.`,
      )
    ) {
      return
    }

    setBusy(true)
    try {
      const res = await authenticatedFetch(`estimates/${estimate.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(apiErrorMessage(data, res.status))

      const remaining = revisions.filter((r) => r.id !== estimate.id)
      setRevisions(remaining)
      setActiveId(remaining[remaining.length - 1]?.id ?? null)
      if (!remaining.length) setEstimate(null)
      toast({ title: `Revision ${estimate.revision} deleted` })
    } catch (err) {
      toast({
        title: 'Could not delete that revision',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <CubeLoader text="LOADING ESTIMATE" />

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}`)}
          className="uq-btn inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Project
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 truncate">
              {project?.name || 'Estimate'}
            </h1>
            {project && (
              <span
                className={`uq-pill shrink-0 ${
                  project.stage === 'TENDER'
                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}
              >
                {project.stage === 'TENDER' ? 'Tender' : 'Project'}
              </span>
            )}
          </div>
          {estimate && (
            <p className="text-xs text-slate-500 truncate">
              Job {estimate.jobNumber}
              {estimate.totalArea ? ` · ${estimate.totalArea.toLocaleString()} sqft` : ''}
              {estimate.client ? ` · ${estimate.client}` : ''}
            </p>
          )}
        </div>

        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}

        {permissions.canManage && estimate && (
          <button
            type="button"
            onClick={autoGenerate}
            disabled={busy}
            className="uq-btn inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-50"
            title="Draft lines with AI from uploaded inputs"
          >
            <Sparkles className="h-4 w-4" />
            Auto generate
          </button>
        )}
        {permissions.canManage && (
          <button
            type="button"
            onClick={addRevision}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Revision
          </button>
        )}
        {permissions.canManage && estimate && (
          <button
            type="button"
            onClick={deleteRevision}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-700 hover:bg-red-50 shrink-0 disabled:opacity-50"
            title={`Delete ${estimate.revision}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={busy || !estimate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>

      {revisions.length > 0 && (
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
          {revisions.map((rev) => (
            <button
              key={rev.id}
              type="button"
              onClick={() => setActiveId(rev.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                rev.id === activeId
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {rev.revision}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 shrink-0">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-[minmax(300px,34%)_1fr]">
        {id && (
          <InputFilesPane projectId={Number(id)} canManage={permissions.canManage} />
        )}

        {estimate ? (
          <EstimatePane
            estimate={estimate}
            canManage={permissions.canManage}
            onPatchEstimate={(body: Partial<Record<keyof Margins, number>>) =>
              patch(`estimates/${estimate.id}`, body)
            }
            onPatchLine={(lineId, qty) =>
              patch(`estimates/${estimate.id}/lines/${lineId}`, { qty })
            }
            onAddLine={async (line: NewEstimateLine) => {
              setBusy(true)
              try {
                const res = await authenticatedFetch(`estimates/${estimate.id}/lines`, {
                  method: 'POST',
                  body: JSON.stringify(line),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(apiErrorMessage(data, res.status))
                absorb(data)
              } catch (err) {
                toast({
                  title: 'Could not add that item',
                  description: err instanceof Error ? err.message : undefined,
                  variant: 'destructive',
                })
                throw err
              } finally {
                setBusy(false)
              }
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">No estimate yet</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Upload the client's drawings on the left, then raise the first revision to start
              pricing against them.
            </p>
            {permissions.canManage && (
              <button
                type="button"
                onClick={addRevision}
                disabled={busy}
                className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Start estimate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
