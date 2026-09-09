import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  MapPin,
  Ship,
  Package,
  Ruler,
  CheckCircle2,
  HardHat,
  Pencil,
  X,
  Loader2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiUrl } from '@/config/api'
import { PanelStatusOverview, type StatusOverviewItem } from './PanelStatusOverview'

export type DashboardOpsData = {
  projectSize?: string
  vessel?: string
  container?: string
  departure?: string
  eta?: string
  port?: string
  factory?: string
  dailyRate?: string
  forecast?: string
  sitePhotoUrl?: string
  sitePhotoDocumentId?: string
}

type Props = {
  projectId?: number
  totalPanels?: number
  statuses?: StatusOverviewItem[]
  ops?: DashboardOpsData | null
  canEdit?: boolean
  saving?: boolean
  onSaveOps?: (ops: DashboardOpsData) => Promise<void> | void
  onUploadSitePhoto?: (file: File) => Promise<{ documentId: string; url: string }>
}

function pickStatusCount(statuses: StatusOverviewItem[], pattern: RegExp): number | null {
  const matches = statuses.filter((s) => pattern.test(s.name || ''))
  if (!matches.length) return null
  return matches.reduce((max, s) => Math.max(max, s.panelCount || 0), 0)
}

function parseDateValue(raw?: string): Date | null {
  if (!raw?.trim()) return null
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function toInputDate(raw?: string): string {
  const d = parseDateValue(raw)
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(raw?: string): string {
  const d = parseDateValue(raw)
  if (!d) return raw?.trim() || ''
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCountdown(eta?: string): string | null {
  const d = parseDateValue(eta)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)} DAYS OVERDUE`
  if (days === 0) return 'ARRIVING TODAY'
  return `${days} DAYS REMAINING`
}

type LatLng = { lat: number; lng: number }

const geocodeCache = new Map<string, LatLng | null>()

async function geocodePlace(query: string): Promise<LatLng | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (geocodeCache.has(key)) return geocodeCache.get(key) || null
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=1`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) {
      geocodeCache.set(key, null)
      return null
    }
    const data = await res.json()
    const coords = data?.features?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) {
      geocodeCache.set(key, null)
      return null
    }
    const point = { lng: Number(coords[0]), lat: Number(coords[1]) }
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      geocodeCache.set(key, null)
      return null
    }
    geocodeCache.set(key, point)
    return point
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

function mapBounds(a: LatLng, b: LatLng) {
  const pad = 0.18
  let west = Math.min(a.lng, b.lng)
  let east = Math.max(a.lng, b.lng)
  let south = Math.min(a.lat, b.lat)
  let north = Math.max(a.lat, b.lat)
  const lngSpan = Math.max(east - west, 8)
  const latSpan = Math.max(north - south, 5)
  west -= lngSpan * pad
  east += lngSpan * pad
  south -= latSpan * pad
  north += latSpan * pad
  return { west, east, south, north, latSpan, lngSpan }
}

function mercatorY(lat: number) {
  const clamped = Math.max(-85, Math.min(85, lat))
  const rad = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

function projectPoint(
  p: LatLng,
  bounds: { west: number; east: number; south: number; north: number },
  w: number,
  h: number
) {
  const x = ((p.lng - bounds.west) / (bounds.east - bounds.west)) * w
  const yNorth = mercatorY(bounds.north)
  const ySouth = mercatorY(bounds.south)
  const y = ((yNorth - mercatorY(p.lat)) / (yNorth - ySouth)) * h
  return { x, y }
}

function routeCurvePath(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  // Arc the path “north” of the chord so it reads like a shipping route
  const bend = Math.min(70, len * 0.22)
  const cx = mx - (dy / len) * bend
  const cy = my + (dx / len) * bend
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
}

function staticMapBgUrl(bounds: {
  west: number
  east: number
  south: number
  north: number
}): string {
  // OSM bbox embed matches our SVG projection exactly (no Google flight-time chip).
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.west}%2C${bounds.south}%2C${bounds.east}%2C${bounds.north}&layer=mapnik`
}

function ShipmentRouteMap({
  factory,
  port,
  canEdit,
  onEdit,
}: {
  factory?: string
  port?: string
  canEdit?: boolean
  onEdit?: () => void
}) {
  const originLabel = factory?.trim() || ''
  const destLabel = port?.trim() || ''
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [dest, setDest] = useState<LatLng | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!originLabel && !destLabel) {
        setOrigin(null)
        setDest(null)
        return
      }
      setLoading(true)
      const [o, d] = await Promise.all([
        originLabel ? geocodePlace(originLabel) : Promise.resolve(null),
        destLabel ? geocodePlace(destLabel) : Promise.resolve(null),
      ])
      if (cancelled) return
      setOrigin(o)
      setDest(d)
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [originLabel, destLabel])

  const W = 640
  const H = 220
  const route = useMemo(() => {
    if (!origin || !dest) return null
    const bounds = mapBounds(origin, dest)
    const a = projectPoint(origin, bounds, W, H)
    const b = projectPoint(dest, bounds, W, H)
    return { a, b, d: routeCurvePath(a, b), bounds }
  }, [origin, dest])

  const mapSrc = route
    ? staticMapBgUrl(route.bounds)
    : dest
      ? `https://maps.google.com/maps?q=${encodeURIComponent(destLabel)}&z=6&hl=en&output=embed`
      : origin
        ? `https://maps.google.com/maps?q=${encodeURIComponent(originLabel)}&z=6&hl=en&output=embed`
        : null

  if (!originLabel && !destLabel) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <MapPin className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-[var(--uq-muted)]">
          Add factory origin and destination port to show the shipment route.
        </p>
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-semibold text-[var(--uq-orange)] hover:underline"
          >
            Add locations
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {mapSrc && (
        <iframe
          title="Shipment route map"
          src={mapSrc}
          className="absolute inset-0 w-full h-[118%] -top-[9%] border-0 pointer-events-none"
          loading="lazy"
          tabIndex={-1}
          referrerPolicy="no-referrer-when-downgrade"
          aria-hidden
        />
      )}
      <div className="absolute inset-0 z-[1] bg-slate-900/[0.03] pointer-events-none" aria-hidden />
      <div className="absolute inset-0 z-[2] cursor-default" aria-hidden />

      {route && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 z-[3] w-full h-full pointer-events-none"
          aria-hidden
        >
          <path
            d={route.d}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <path
            d={route.d}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.25"
            strokeLinecap="round"
          />
          <circle cx={route.a.x} cy={route.a.y} r="7" fill="#fdaa48" stroke="#fff" strokeWidth="2.5" />
          <circle cx={route.b.x} cy={route.b.y} r="7" fill="#0ea5e9" stroke="#fff" strokeWidth="2.5" />
        </svg>
      )}

      {loading && !route && (
        <div className="absolute inset-0 z-[4] flex items-center justify-center bg-white/40">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && originLabel && destLabel && !route && (
        <div className="absolute inset-0 z-[4] flex items-center justify-center px-6 text-center bg-white/50">
          <p className="text-sm text-[var(--uq-muted)]">
            Couldn’t locate that origin/destination on the map. Try a clearer place name.
          </p>
        </div>
      )}

      {originLabel && (
        <div className="absolute left-4 bottom-4 z-[5] bg-white/95 rounded-lg px-3 py-2 text-xs shadow-sm border border-slate-200 max-w-[45%]">
          <p className="font-semibold text-[var(--uq-ink)] truncate">{originLabel}</p>
          <p className="text-[var(--uq-muted)] mt-0.5">Origin</p>
        </div>
      )}
      {destLabel && (
        <div className="absolute right-4 top-4 z-[5] bg-white/95 rounded-lg px-3 py-2 text-xs shadow-sm border border-slate-200 max-w-[45%]">
          <p className="font-semibold text-[var(--uq-ink)] truncate">{destLabel}</p>
          <p className="text-[var(--uq-muted)] mt-0.5">Destination</p>
        </div>
      )}
    </>
  )
}

const EMPTY_OPS: DashboardOpsData = {
  projectSize: '',
  vessel: '',
  container: '',
  departure: '',
  eta: '',
  port: '',
  factory: '',
  dailyRate: '',
  forecast: '',
  sitePhotoUrl: '',
  sitePhotoDocumentId: '',
}

export function DashboardTab({
  projectId,
  totalPanels = 0,
  statuses = [],
  ops: opsProp = null,
  canEdit = false,
  saving = false,
  onSaveOps,
  onUploadSitePhoto,
}: Props) {
  const [editing, setEditing] = useState<'size' | 'arrival' | 'shipment' | 'site' | null>(null)
  const [draft, setDraft] = useState<DashboardOpsData>(EMPTY_OPS)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const ops = useMemo(() => ({ ...EMPTY_OPS, ...(opsProp || {}) }), [opsProp])

  useEffect(() => {
    if (editing) setDraft({ ...EMPTY_OPS, ...ops })
  }, [editing, ops])

  useEffect(() => {
    let cancelled = false
    const loadPhoto = async () => {
      if (ops.sitePhotoUrl) {
        setPhotoPreview(ops.sitePhotoUrl)
        return
      }
      if (!ops.sitePhotoDocumentId || !projectId) {
        setPhotoPreview(null)
        return
      }
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch(getApiUrl(`documents/${projectId}/${ops.sitePhotoDocumentId}/download`), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.url) setPhotoPreview(data.url)
      } catch {
        /* ignore */
      }
    }
    void loadPhoto()
    return () => {
      cancelled = true
    }
  }, [ops.sitePhotoDocumentId, ops.sitePhotoUrl, projectId])

  const total = totalPanels || 0
  const received = pickStatusCount(statuses, /receiv|deliver|arriv|on[\s-]?site/i)
  const installed = pickStatusCount(statuses, /install|erect|complet/i)
  const receivedN = received ?? 0
  const installedN = installed ?? 0
  const remaining = Math.max(0, total - installedN)
  const receivedPct = total ? Math.round((receivedN / total) * 100) : 0
  const installedPct = total ? Math.round((installedN / total) * 100) : 0
  const countdown = formatCountdown(ops.eta)

  const save = async () => {
    if (!onSaveOps) return
    await onSaveOps({
      projectSize: draft.projectSize?.trim() || '',
      vessel: draft.vessel?.trim() || '',
      container: draft.container?.trim() || '',
      departure: toInputDate(draft.departure) || '',
      eta: toInputDate(draft.eta) || '',
      port: draft.port?.trim() || '',
      factory: draft.factory?.trim() || '',
      dailyRate: draft.dailyRate?.trim() || '',
      forecast: toInputDate(draft.forecast) || '',
      sitePhotoUrl: draft.sitePhotoUrl?.trim() || '',
      sitePhotoDocumentId: draft.sitePhotoDocumentId?.trim() || '',
    })
    setEditing(null)
  }

  const handleSitePhotoPick = async (file: File | null) => {
    if (!file || !onUploadSitePhoto) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG, PNG, WebP, or GIF).')
      return
    }
    try {
      setPhotoError(null)
      setPhotoUploading(true)
      const uploaded = await onUploadSitePhoto(file)
      setDraft((d) => ({
        ...d,
        sitePhotoDocumentId: uploaded.documentId,
        sitePhotoUrl: uploaded.url,
      }))
      setPhotoPreview(uploaded.url)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCard
          icon={<Package className="h-4 w-4 text-sky-600" />}
          label="Total Panels"
          value={`${total}`}
          unit="Panels"
          hint="From project BIMSF panels"
        />
        <KpiCard
          icon={<Ruler className="h-4 w-4 text-violet-600" />}
          label="Project Size"
          value={ops.projectSize || '—'}
          unit=""
          hint={ops.projectSize ? undefined : 'Not set'}
          onEdit={canEdit ? () => setEditing('size') : undefined}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Received on Site"
          value={received == null ? '—' : `${receivedN}`}
          unit={received == null ? '' : 'Panels'}
          badge={received == null ? undefined : `${receivedPct}%`}
          badgeTone="emerald"
          hint={
            received == null
              ? 'Needs a status named Received / Delivered / On Site'
              : undefined
          }
        />
        <KpiCard
          icon={<HardHat className="h-4 w-4 text-sky-600" />}
          label="Installed on Site"
          value={installed == null ? '—' : `${installedN}`}
          unit={installed == null ? '' : 'Panels'}
          badge={installed == null ? undefined : `${installedPct}%`}
          badgeTone="emerald"
          hint={
            installed == null
              ? 'Needs a status named Installed / Complete'
              : undefined
          }
        />
        <div className="rounded-2xl border-2 border-[var(--uq-orange)] bg-[var(--uq-orange-soft)] p-4 min-h-[108px] relative">
          {canEdit && (
            <EditButton onClick={() => setEditing('arrival')} className="absolute top-3 right-3" />
          )}
          <div className="flex items-start gap-3 pr-6">
            <div className="h-10 w-10 rounded-xl bg-[var(--uq-orange)] text-white flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--uq-orange)] uppercase">
                Expected Arrival
              </p>
              <p className="text-lg font-bold text-[var(--uq-ink)] mt-0.5">
                {ops.eta ? formatDisplayDate(ops.eta) : '—'}
              </p>
              <p className="text-xs text-[var(--uq-muted)] mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{ops.port || 'Add destination port'}</span>
              </p>
              {countdown && (
                <p className="text-[11px] font-bold text-[var(--uq-orange)] mt-2 tracking-wide">
                  {countdown}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {statuses.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
          <PanelStatusOverview totalPanels={total} statuses={statuses} hideTotal />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--uq-muted)]">
              SHIPMENT OVERVIEW
            </h2>
            <div className="flex items-center gap-2">
              {canEdit && <EditButton onClick={() => setEditing('shipment')} />}
              <Ship className="h-4 w-4 text-[var(--uq-orange)]" />
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="relative h-[220px] rounded-xl bg-[#eef2f7] overflow-hidden border border-slate-100 select-none">
              <ShipmentRouteMap
                factory={ops.factory}
                port={ops.port}
                canEdit={canEdit}
                onEdit={() => setEditing('shipment')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/80">
            <Meta label="Vessel" value={ops.vessel || '—'} />
            <Meta label="Container No." value={ops.container || '—'} />
            <Meta label="Departure" value={ops.departure ? formatDisplayDate(ops.departure) : '—'} />
            <Meta label="ETA" value={ops.eta ? formatDisplayDate(ops.eta) : '—'} />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--uq-muted)]">
              SITE PROGRESS
            </h2>
            {canEdit && <EditButton onClick={() => setEditing('site')} />}
          </div>
          <div className="flex gap-4">
            <div className="w-[120px] h-[150px] rounded-xl overflow-hidden bg-slate-200 shrink-0 relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Site"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-300 via-slate-200 to-[var(--uq-orange)]/40" />
              )}
              <div className="absolute inset-0 flex items-end p-2">
                <span className="text-[10px] font-semibold text-white bg-black/40 rounded px-1.5 py-0.5">
                  Site photo
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <ProgressRow
                label="Installed"
                value={installed == null ? '—' : `${installedN}`}
                pct={installedPct}
                color="#22c55e"
              />
              <ProgressRow
                label="Received"
                value={received == null ? '—' : `${receivedN}`}
                pct={receivedPct}
                color="#fdaa48"
              />
              <StatRow
                label="Remaining"
                value={
                  total
                    ? `${remaining} (${Math.round((remaining / total) * 100)}%)`
                    : '—'
                }
              />
              <StatRow
                label="Daily Installation Rate"
                value={ops.dailyRate ? `${ops.dailyRate} Panels / Day` : '—'}
              />
              <StatRow
                label="Forecast Completion"
                value={ops.forecast ? formatDisplayDate(ops.forecast) : '—'}
                emphasize={!!ops.forecast}
              />
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditDialog
          title={
            editing === 'size'
              ? 'Edit project size'
              : editing === 'arrival'
                ? 'Edit expected arrival'
                : editing === 'shipment'
                  ? 'Edit shipment details'
                  : 'Edit site progress'
          }
          saving={saving || photoUploading}
          onClose={() => setEditing(null)}
          onSave={save}
        >
          {(editing === 'size' || editing === 'shipment' || editing === 'arrival') && (
            <>
              {(editing === 'size' || editing === 'shipment') && (
                <Field
                  label="Project size"
                  value={draft.projectSize || ''}
                  onChange={(v) => setDraft((d) => ({ ...d, projectSize: v }))}
                  placeholder="e.g. 20,000 sq ft"
                />
              )}
              {(editing === 'arrival' || editing === 'shipment') && (
                <>
                  <DateField
                    label="ETA"
                    value={draft.eta || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, eta: v }))}
                  />
                  <Field
                    label="Destination port"
                    value={draft.port || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, port: v }))}
                    placeholder="e.g. Khalifa Port, Abu Dhabi, UAE"
                  />
                </>
              )}
              {editing === 'shipment' && (
                <>
                  <Field
                    label="Factory / origin"
                    value={draft.factory || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, factory: v }))}
                    placeholder="e.g. Shanghai, China"
                  />
                  <Field
                    label="Vessel"
                    value={draft.vessel || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, vessel: v }))}
                    placeholder="Vessel name"
                  />
                  <Field
                    label="Container No."
                    value={draft.container || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, container: v }))}
                    placeholder="Container number"
                  />
                  <DateField
                    label="Departure"
                    value={draft.departure || ''}
                    onChange={(v) => setDraft((d) => ({ ...d, departure: v }))}
                  />
                </>
              )}
            </>
          )}
          {editing === 'site' && (
            <>
              <Field
                label="Daily installation rate"
                value={draft.dailyRate || ''}
                onChange={(v) => setDraft((d) => ({ ...d, dailyRate: v }))}
                placeholder="e.g. 12"
              />
              <DateField
                label="Forecast completion"
                value={draft.forecast || ''}
                onChange={(v) => setDraft((d) => ({ ...d, forecast: v }))}
              />
              <div className="block">
                <span className="text-[11px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
                  Site photo
                </span>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                    {(draft.sitePhotoUrl || photoPreview) ? (
                      <img
                        src={draft.sitePhotoUrl || photoPreview || ''}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <label className="flex-1">
                    <span className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[var(--uq-ink)] hover:bg-slate-50 cursor-pointer">
                      {photoUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {draft.sitePhotoDocumentId || draft.sitePhotoUrl
                            ? 'Replace photo'
                            : 'Upload photo'}
                        </>
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="sr-only"
                      disabled={photoUploading || !onUploadSitePhoto}
                      onChange={(e) => {
                        void handleSitePhotoPick(e.target.files?.[0] || null)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {photoError && (
                  <p className="mt-1.5 text-xs text-red-600">{photoError}</p>
                )}
                {!onUploadSitePhoto && (
                  <p className="mt-1.5 text-xs text-[var(--uq-muted)]">
                    Photo upload is unavailable for this project.
                  </p>
                )}
              </div>
            </>
          )}
        </EditDialog>
      )}
    </div>
  )
}

function EditButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[var(--uq-ink)] hover:border-slate-300 flex items-center justify-center transition-colors',
        className
      )}
      title="Edit"
      aria-label="Edit"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  )
}

function EditDialog({
  title,
  children,
  saving,
  onClose,
  onSave,
}: {
  title: string
  children: ReactNode
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-[var(--uq-ink)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">{children}</div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-2 text-sm font-semibold rounded-lg bg-[var(--uq-orange)] text-white hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[var(--uq-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--uq-orange)]/30 focus:border-[var(--uq-orange)]"
      />
    </label>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const inputValue = toInputDate(value)
  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
        {label}
      </span>
      <input
        type="date"
        value={inputValue}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[var(--uq-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--uq-orange)]/30 focus:border-[var(--uq-orange)]"
      />
      {inputValue ? (
        <span className="mt-1 block text-[11px] text-[var(--uq-muted)]">
          {formatDisplayDate(inputValue)}
        </span>
      ) : null}
    </label>
  )
}

function KpiCard({
  icon,
  label,
  value,
  unit,
  badge,
  badgeTone = 'emerald',
  hint,
  onEdit,
}: {
  icon: ReactNode
  label: string
  value: string
  unit: string
  badge?: string
  badgeTone?: 'emerald' | 'orange'
  hint?: string
  onEdit?: () => void
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 min-h-[108px] relative">
      {onEdit && <EditButton onClick={onEdit} className="absolute top-3 right-3" />}
      <div className="flex items-center justify-between mb-3 pr-8">
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
        {unit ? (
          <span className="text-sm font-semibold text-[var(--uq-muted)]">{unit}</span>
        ) : null}
      </p>
      {hint && <p className="mt-2 text-[10px] text-[var(--uq-muted)] leading-snug">{hint}</p>}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wide text-[var(--uq-muted)] uppercase">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--uq-ink)] mt-0.5 break-words">{value}</p>
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
          'font-semibold text-right',
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
          {value !== '—' && (
            <span className="text-xs" style={{ color }}>
              ({pct}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value === '—' ? 0 : Math.min(100, pct)}%`, background: color }}
        />
      </div>
    </div>
  )
}
