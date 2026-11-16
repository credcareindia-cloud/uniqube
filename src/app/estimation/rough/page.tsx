import { useEffect, useMemo } from 'react'
import { DraftingCompass, Eye } from 'lucide-react'
import { QubeCharacter } from '@/components/ui/QubeCharacter'
import { useRBAC } from '@/contexts/RBACContext'

function initials(name?: string) {
  const parts = (name || 'P').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function shortDate(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RoughEstimationPage() {
  const { userProjects, isLoading, refreshUserProjects } = useRBAC()

  useEffect(() => {
    refreshUserProjects()
  }, [refreshUserProjects])

  const tenders = useMemo(
    () =>
      [...userProjects]
        .filter((project) => (project.stage ?? 'PROJECT') === 'TENDER')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
    [userProjects],
  )

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--uq-ink)] flex items-center gap-2">
          <DraftingCompass className="h-6 w-6" />
          Rough Estimation
        </h1>
        <p className="mt-1 text-sm text-[var(--uq-muted)]">
          Working takeoffs for tender-stage projects. Start a request under Requests, then open the estimate here.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center">
          <QubeCharacter moment="auto" size={120} caption />
        </div>
      ) : tenders.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-[var(--uq-offwhite)] border border-black/5">
          <QubeCharacter mood="cute" size={120} className="mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No rough estimates yet</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            When you start a quote from Requests, the tender project appears here so you can open its estimate workspace.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-[var(--uq-offwhite)] p-3 sm:p-4 space-y-3">
          {tenders.map((project) => (
            <article
              key={project.id}
              className="rounded-2xl border border-black/5 bg-[var(--uq-offwhite-card)] px-4 py-4 sm:px-5 hover:border-black/10 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="h-12 w-12 rounded-xl bg-[var(--uq-blue)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(project.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {project.displayNumber != null && (
                      <span className="text-[11px] font-semibold text-slate-400">
                        #{String(project.displayNumber).padStart(2, '0')}
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-[var(--uq-ink)] truncate">{project.name}</h3>
                    <span className="uq-pill bg-[var(--uq-yellow-soft)] text-[var(--uq-ink)] border border-[var(--uq-yellow)]/40">
                      Tender
                    </span>
                  </div>
                  <p className="text-sm text-[var(--uq-muted)] truncate">
                    Updated {shortDate(project.updatedAt || project.createdAt)}
                    {project.description ? ` · ${project.description}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <a
                    href={`/projects/${project.id}/estimate`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  >
                    <Eye className="h-4 w-4" />
                    Open estimate
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
