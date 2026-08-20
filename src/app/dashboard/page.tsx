import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  MapPin,
  Ship,
  Package,
  Ruler,
  CheckCircle2,
  HardHat,
} from 'lucide-react'
import { api, type Project } from '@/services/api'
import { cn } from '@/lib/utils'

type ProgressStep = {
  id: number
  label: string
  pct: number
  tone: string
  done: boolean
}

function deriveOps(project: Project | null) {
  const total = project?.totalPanels || 395
  const installed = project?.completedPanels ?? Math.round(total * 0.83)
  const received = Math.min(total, Math.max(installed, Math.round(total * 0.95)))
  const remaining = Math.max(0, total - installed)
  const receivedPct = total ? Math.round((received / total) * 100) : 0
  const installedPct = total ? Math.round((installed / total) * 100) : 0

  const steps: ProgressStep[] = [
    { id: 1, label: 'DESIGN', pct: 100, tone: '#3b82f6', done: true },
    { id: 2, label: 'PRODUCTION', pct: 100, tone: '#22c55e', done: true },
    { id: 3, label: 'SHIPMENT', pct: 100, tone: '#8b5cf6', done: true },
    {
      id: 4,
      label: 'RECEIVED ON SITE',
      pct: receivedPct,
      tone: '#fdaa48',
      done: receivedPct >= 100,
    },
    {
      id: 5,
      label: 'INSTALLATION',
      pct: installedPct,
      tone: '#0ea5e9',
      done: installedPct >= 100,
    },
  ]

  return {
    total,
    installed,
    received,
    remaining,
    receivedPct,
    installedPct,
    projectSize: '20,000 sq ft',
    vessel: 'MSC MAERSK VIII',
    container: 'TRLU 4567890',
    departure: '20 MAY 2025',
    eta: '25 MAY 2025',
    etaCountdown: '5 DAYS REMAINING',
    port: 'Khalifa Port, Abu Dhabi, UAE',
    factory: 'Shanghai, China (Factory)',
    dailyRate: 12,
    forecast: '28 MAY 2025',
    steps,
  }
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getProjects()
        if (!cancelled) setProjects(res.projects || [])
      } catch {
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const active = useMemo(() => {
    if (!projects.length) return null
    const sorted = [...projects].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return tb - ta
    })
    return sorted[0]
  }, [projects])

  const ops = deriveOps(active)
  const title = active?.name || 'ADNOC SHARJAH'

  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold text-[var(--uq-ink)] mb-1">{title}</h1>
      <p className="text-sm text-[var(--uq-muted)] mb-5">Project Dashboard</p>

      {loading ? (
        <div className="text-sm text-[var(--uq-muted)]">Loading project metrics…</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
            <KpiCard
              icon={<Package className="h-4 w-4 text-sky-600" />}
              label="Total Panels"
              value={`${ops.total}`}
              unit="Panels"
            />
            <KpiCard
              icon={<Ruler className="h-4 w-4 text-violet-600" />}
              label="Project Size"
              value={ops.projectSize.split(' ')[0]}
              unit={ops.projectSize.replace(/^[^\s]+\s/, '')}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Received on Site"
              value={`${ops.received}`}
              unit="Panels"
              badge={`${ops.receivedPct}%`}
              badgeTone="emerald"
            />
            <KpiCard
              icon={<HardHat className="h-4 w-4 text-sky-600" />}
              label="Installed on Site"
              value={`${ops.installed}`}
              unit="Panels"
              badge={`${ops.installedPct}%`}
              badgeTone="emerald"
            />
            <div className="rounded-2xl border-2 border-[var(--uq-orange)] bg-[var(--uq-orange-soft)] p-4 min-h-[108px]">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--uq-orange)] text-white flex items-center justify-center shrink-0">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-[var(--uq-orange)] uppercase">
                    Expected Arrival
                  </p>
                  <p className="text-lg font-bold text-[var(--uq-ink)] mt-0.5">{ops.eta}</p>
                  <p className="text-xs text-[var(--uq-muted)] mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {ops.port}
                  </p>
                  <p className="text-[11px] font-bold text-[var(--uq-orange)] mt-2 tracking-wide">
                    {ops.etaCountdown}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress stepper */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 mb-5">
            <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--uq-muted)] mb-6">
              PROJECT PROGRESS
            </h2>
            <div className="relative">
              <div className="absolute left-6 right-6 top-[18px] h-[3px] bg-slate-100 hidden sm:block" />
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-2">
                {ops.steps.map((step, idx) => (
                  <div key={step.id} className="relative flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0">
                    {idx < ops.steps.length - 1 && (
                      <div
                        className="hidden sm:block absolute left-[calc(50%+18px)] right-[-50%] top-[18px] h-[3px]"
                        style={{
                          background: step.done
                            ? `linear-gradient(90deg, ${step.tone}, ${ops.steps[idx + 1].tone})`
                            : '#e5e7eb',
                        }}
                      />
                    )}
                    <div
                      className="relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0"
                      style={{ background: step.tone }}
                    >
                      {step.id}
                    </div>
                    <div className="sm:mt-3 sm:text-center">
                      <p className="text-[11px] font-bold tracking-wide text-[var(--uq-ink)]">
                        {step.label}
                      </p>
                      <p
                        className="text-xs font-semibold mt-1"
                        style={{ color: step.tone }}
                      >
                        {step.pct}% {step.done ? 'Complete' : 'In Progress'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom widgets */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--uq-muted)]">
                  SHIPMENT OVERVIEW
                </h2>
                <Ship className="h-4 w-4 text-[var(--uq-orange)]" />
              </div>
              <div className="px-5 pb-4">
                <div className="relative h-[220px] rounded-xl bg-[#eef2f7] overflow-hidden border border-slate-100">
                  <svg viewBox="0 0 640 220" className="absolute inset-0 w-full h-full" aria-hidden>
                    <defs>
                      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dbe3ee" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="640" height="220" fill="url(#grid)" />
                    <path
                      d="M90 140 C 220 40, 400 40, 540 130"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="7 7"
                    />
                    <circle cx="90" cy="140" r="7" fill="#fdaa48" />
                    <circle cx="540" cy="130" r="7" fill="#0ea5e9" />
                    <g transform="translate(300,70)">
                      <rect x="-18" y="-8" width="36" height="16" rx="4" fill="#1a2436" />
                      <polygon points="18,-2 28,0 18,2" fill="#1a2436" />
                    </g>
                  </svg>
                  <div className="absolute left-4 bottom-4 bg-white/95 rounded-lg px-3 py-2 text-xs shadow-sm border border-slate-200">
                    <p className="font-semibold text-[var(--uq-ink)]">{ops.factory}</p>
                    <p className="text-[var(--uq-muted)] mt-0.5">Origin</p>
                  </div>
                  <div className="absolute right-4 top-4 bg-white/95 rounded-lg px-3 py-2 text-xs shadow-sm border border-slate-200 max-w-[200px]">
                    <p className="font-semibold text-[var(--uq-ink)]">{ops.port}</p>
                    <p className="text-[var(--uq-muted)] mt-0.5">Destination</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/80">
                <Meta label="Vessel" value={ops.vessel} />
                <Meta label="Container No." value={ops.container} />
                <Meta label="Departure" value={ops.departure} />
                <Meta label="ETA" value={ops.eta} />
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
              <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--uq-muted)] mb-4">
                SITE PROGRESS
              </h2>
              <div className="flex gap-4">
                <div className="w-[120px] h-[150px] rounded-xl overflow-hidden bg-slate-200 shrink-0 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-300 via-slate-200 to-[var(--uq-orange)]/40" />
                  <div className="absolute inset-0 flex items-end p-2">
                    <span className="text-[10px] font-semibold text-white bg-black/40 rounded px-1.5 py-0.5">
                      Site photo
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <StatRow label="Total Panels" value={`${ops.total}`} />
                  <ProgressRow
                    label="Panels Installed"
                    value={`${ops.installed}`}
                    pct={ops.installedPct}
                    color="#22c55e"
                  />
                  <ProgressRow
                    label="Panels Received"
                    value={`${ops.received}`}
                    pct={ops.receivedPct}
                    color="#fdaa48"
                  />
                  <StatRow label="Panels Remaining" value={`${ops.remaining} (${Math.round((ops.remaining / ops.total) * 100)}%)`} />
                  <StatRow label="Daily Installation Rate" value={`${ops.dailyRate} Panels / Day`} />
                  <StatRow label="Forecast Completion" value={ops.forecast} emphasize />
                </div>
              </div>
              {!active && (
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="mt-4 text-sm font-semibold text-[var(--uq-orange)] hover:underline"
                >
                  Open a project to bind live panel counts →
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  unit,
  badge,
  badgeTone = 'emerald',
}: {
  icon: ReactNode
  label: string
  value: string
  unit: string
  badge?: string
  badgeTone?: 'emerald' | 'orange'
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 min-h-[108px]">
      <div className="flex items-center justify-between mb-3">
        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
          {icon}
        </div>
        {badge && (
          <span
            className={cn(
              'text-[11px] font-bold px-2 py-0.5 rounded-full',
              badgeTone === 'emerald'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-orange-50 text-orange-700'
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[var(--uq-ink)] leading-none">
        {value}{' '}
        <span className="text-sm font-semibold text-[var(--uq-muted)]">{unit}</span>
      </p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--uq-ink)] mt-0.5">{value}</p>
    </div>
  )
}

function StatRow({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--uq-muted)]">{label}</span>
      <span
        className={cn(
          'font-semibold',
          emphasize ? 'text-[var(--uq-orange)]' : 'text-[var(--uq-ink)]'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  pct,
  color,
}: {
  label: string
  value: string
  pct: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span className="text-[var(--uq-muted)]">{label}</span>
        <span className="font-semibold text-[var(--uq-ink)]">
          {value}{' '}
          <span className="text-xs" style={{ color }}>
            ({pct}%)
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
    </div>
  )
}
