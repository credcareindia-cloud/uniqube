import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Hash,
  Minus,
  MousePointer2,
  Pentagon,
  Plus,
  Ruler,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { pageScaleKey, useAppStore } from '../store'
import type { Measurement, MeasurementKind, PagePoint, PageScale } from '../types'
import { renderPdfPage } from '../lib/pdfAnalyze'
import { getPageGeometry, openDocument } from '../lib/geometry'
import { snapScale, snapToGeometry, type PageGeometry } from '../lib/geometryCore'
import { ELEMENTS, computeQuantities, elementById, floorName } from '../lib/elements'

type Tool = 'select' | 'length' | 'area' | 'rect' | 'count' | 'calibrate'

const TOOLS: Array<{ id: Tool; label: string; icon: typeof Ruler; hint: string }> = [
  { id: 'select', label: 'Select', icon: MousePointer2, hint: 'Pick a measurement to edit it' },
  { id: 'length', label: 'Length', icon: Ruler, hint: 'Click along the run. Enter or double-click to finish.' },
  { id: 'area', label: 'Area', icon: Pentagon, hint: 'Click around the outline. Enter or double-click to close.' },
  { id: 'rect', label: 'Rectangle', icon: Square, hint: 'Click two opposite corners.' },
  { id: 'count', label: 'Count', icon: Hash, hint: 'Click each item. Enter to finish.' },
  { id: 'calibrate', label: 'Calibrate', icon: Crosshair, hint: 'Click two points on a known dimension.' },
]

const GROUP_COLOR: Record<string, string> = {
  substructure: '#f0a8a8',
  superstructure: '#c4b5fd',
  walls: '#8fd9b0',
  floors: '#9ec1ff',
  roof: '#f5d58a',
  openings: '#ffb27d',
}

const RENDER_WIDTH = 2400

function colorFor(elementId: string) {
  return GROUP_COLOR[elementById(elementId)?.group ?? ''] ?? '#ececec'
}

function shortCode(elementId: string) {
  const map: Record<string, string> = {
    'ext-wall': 'EW',
    'int-wall': 'IW',
    'bath-wall': 'BW',
    floor: 'FL',
    roof: 'RF',
    door: 'D',
    window: 'W',
    'iso-footing': 'IF',
    'ground-beam': 'GB',
    'strip-footing': 'SF',
    'grid-footing': 'GF',
    'ground-slab': 'GS',
    column: 'C',
    beam: 'B',
    'struct-wall': 'SW',
    staircase: 'ST',
  }
  return map[elementId] ?? elementId.slice(0, 2).toUpperCase()
}

function floorCode(level: number | null) {
  if (level == null) return ''
  if (level === 0) return 'SUB'
  if (level === 1) return 'GF'
  return `L${level - 1}`
}

function fmt(value: number | undefined, digits = 2) {
  if (value == null) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function pathFor(points: PagePoint[], close: boolean) {
  if (!points.length) return ''
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return close ? `${d} Z` : d
}

function rectPoints(a: PagePoint, b: PagePoint) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

function centroid(points: PagePoint[]): PagePoint {
  if (!points.length) return { x: 0, y: 0 }
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export function MeasureWorkspace() {
  const documents = useAppStore((s) => s.documents)
  const target = useAppStore((s) => s.measureTarget)
  const setMeasureTarget = useAppStore((s) => s.setMeasureTarget)
  const ctx = useAppStore((s) => s.projectContext)
  const pageScales = useAppStore((s) => s.pageScales)
  const measurements = useAppStore((s) => s.measurements)
  const addMeasurement = useAppStore((s) => s.addMeasurement)
  const updateMeasurement = useAppStore((s) => s.updateMeasurement)
  const removeMeasurement = useAppStore((s) => s.removeMeasurement)
  const pushMeasurement = useAppStore((s) => s.pushMeasurement)
  const setPageScale = useAppStore((s) => s.setPageScale)
  const lines = useAppStore((s) => s.lines)

  const readyDocs = documents.filter((d) => d.status === 'ready' && d.analysis)
  const doc = readyDocs.find((d) => d.id === target?.fileId) ?? readyDocs[0] ?? null
  const pageNumber = Math.min(Math.max(1, target?.pageNumber ?? 1), doc?.analysis?.pageCount ?? 1)
  const scale: PageScale | null = doc ? pageScales[pageScaleKey(doc.id, pageNumber)] ?? null : null
  const inScope = ELEMENTS.filter((element) => ctx.elements.includes(element.id))

  const [tool, setTool] = useState<Tool>('length')
  const [elementId, setElementId] = useState(inScope[0]?.id ?? 'ext-wall')
  const [floor, setFloor] = useState<number | null>(ctx.floors[0]?.level ?? 1)
  const [label, setLabel] = useState('')
  const [snap, setSnap] = useState(true)
  const [showVectors, setShowVectors] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [image, setImage] = useState<string | null>(null)
  const [geo, setGeo] = useState<PageGeometry | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PagePoint[]>([])
  const [hover, setHover] = useState<PagePoint | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [calibrating, setCalibrating] = useState<{ points: PagePoint[]; value: string } | null>(null)
  const [ratioInput, setRatioInput] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tokenRef = useRef(0)

  const pageMeasurements = useMemo(
    () => (doc ? measurements.filter((m) => m.fileId === doc.id && m.pageNumber === pageNumber) : []),
    [measurements, doc, pageNumber],
  )
  const selected = pageMeasurements.find((m) => m.id === selectedId) ?? null

  useEffect(() => {
    if (!inScope.some((element) => element.id === elementId) && inScope[0]) setElementId(inScope[0].id)
  }, [inScope, elementId])

  // Load the sheet image and its geometry.
  useEffect(() => {
    if (!doc) return
    const token = ++tokenRef.current
    setImage(null)
    setGeo(null)
    setError(null)
    setDraft([])
    setLoading('Drawing the sheet…')
    void (async () => {
      try {
        const pdf = await openDocument(doc)
        const url = await renderPdfPage(pdf, pageNumber, RENDER_WIDTH)
        if (token !== tokenRef.current) return
        setImage(url)
        setLoading('Reading vectors and dimension strings…')
        const geometry = await getPageGeometry(doc, pageNumber, ctx.units)
        if (token !== tokenRef.current) return
        setGeo(geometry)
        setLoading(null)
      } catch (reason) {
        if (token !== tokenRef.current) return
        setError(reason instanceof Error ? reason.message : 'Could not open this sheet')
        setLoading(null)
      }
    })()
  }, [doc, pageNumber, ctx.units])

  // Fit the sheet to the viewport once the geometry size is known.
  useEffect(() => {
    if (!geo || !viewportRef.current) return
    const box = viewportRef.current.getBoundingClientRect()
    const fit = Math.max(0.05, (box.width - 24) / geo.widthPt)
    setZoom(fit)
  }, [geo?.widthPt, geo?.pageNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  const widthPt = geo?.widthPt ?? 1
  const heightPt = geo?.heightPt ?? 1

  const toPage = useCallback(
    (event: { clientX: number; clientY: number; shiftKey?: boolean }): PagePoint | null => {
      const svg = svgRef.current
      if (!svg) return null
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const dom = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
      let point: PagePoint = { x: dom.x, y: dom.y }
      if (snap && geo) {
        const tolerance = 9 / zoom
        const snapped = snapToGeometry(point, geo.segments, tolerance)
        if (snapped) point = snapped
      }
      if (event.shiftKey && draft.length && (tool === 'length' || tool === 'area')) {
        const last = draft[draft.length - 1]
        if (Math.abs(point.x - last.x) > Math.abs(point.y - last.y)) point = { x: point.x, y: last.y }
        else point = { x: last.x, y: point.y }
      }
      return point
    },
    [snap, geo, zoom, draft, tool],
  )

  const nextLabel = useCallback(() => {
    const code = `${shortCode(elementId)}${floorCode(floor) ? `-${floorCode(floor)}` : ''}`
    const taken = new Set(measurements.map((m) => m.label))
    let n = 1
    while (taken.has(`${code}-${n}`)) n++
    return `${code}-${n}`
  }, [elementId, floor, measurements])

  const finish = useCallback(
    (points: PagePoint[], kind: MeasurementKind) => {
      if (!doc) return
      const result = addMeasurement({
        fileId: doc.id,
        fileName: doc.name,
        pageNumber,
        kind,
        points,
        elementId,
        label: label.trim() || nextLabel(),
        floor,
        dims: {},
        deductM2: 0,
        notes: '',
        source: 'manual',
      })
      setDraft([])
      setLabel('')
      setSelectedId(result.measurement.id)
    },
    [doc, pageNumber, elementId, label, floor, addMeasurement, nextLabel],
  )

  const finishDraft = useCallback(() => {
    if (tool === 'length' && draft.length >= 2) finish(draft, 'length')
    else if (tool === 'area' && draft.length >= 3) finish(draft, 'area')
    else if (tool === 'count' && draft.length >= 1) finish(draft, 'count')
  }, [tool, draft, finish])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (event.key === 'Escape') {
        setDraft([])
        setCalibrating(null)
      } else if (event.key === 'Enter') {
        finishDraft()
      } else if (event.key === 'Backspace') {
        setDraft((d) => d.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finishDraft])

  function onSvgClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!doc || !geo) return
    const point = toPage(event)
    if (!point) return
    if (tool === 'select') {
      setSelectedId(null)
      return
    }
    if (tool === 'calibrate') {
      const pts = [...(calibrating?.points ?? []), point].slice(-2)
      setCalibrating({ points: pts, value: calibrating?.value ?? '' })
      return
    }
    if (tool === 'rect') {
      if (draft.length === 1) finish([draft[0], point], 'rect')
      else setDraft([point])
      return
    }
    setDraft((d) => [...d, point])
  }

  function applyCalibration() {
    if (!doc || !calibrating || calibrating.points.length < 2) return
    const known = Number(calibrating.value)
    if (!(known > 0)) return
    const [a, b] = calibrating.points
    const distance = Math.hypot(b.x - a.x, b.y - a.y)
    if (distance < 0.5) return
    const mmPerPt = known / distance
    setPageScale(doc.id, pageNumber, { mmPerPt, label: snapScale(mmPerPt).label, method: 'manual', confidence: 1, samples: 1 })
    setCalibrating(null)
    setTool('length')
  }

  function applyRatio() {
    if (!doc) return
    const ratio = Number(ratioInput.replace(/^1\s*:\s*/, ''))
    if (!(ratio > 0)) return
    const mmPerPt = (ratio * 25.4) / 72
    setPageScale(doc.id, pageNumber, { mmPerPt, label: snapScale(mmPerPt).label, method: 'stated', confidence: 0.8, samples: 1 })
    setRatioInput('')
  }

  function applyCandidate(index: number) {
    if (!doc || !geo) return
    const candidate = geo.scaleCandidates[index]
    if (!candidate) return
    setPageScale(doc.id, pageNumber, {
      mmPerPt: candidate.mmPerPt,
      label: candidate.label,
      method: candidate.method,
      confidence: candidate.confidence,
      samples: candidate.samples,
    })
  }

  function gotoPage(next: number) {
    if (!doc?.analysis) return
    const clamped = Math.min(Math.max(1, next), doc.analysis.pageCount)
    setMeasureTarget({ fileId: doc.id, pageNumber: clamped })
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    setZoom((z) => Math.min(12, Math.max(0.05, z * factor)))
  }

  const draftLength = useMemo(() => {
    if (!scale || draft.length < 1) return null
    const pts = hover ? [...draft, hover] : draft
    let total = 0
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (tool === 'rect' && draft.length === 1 && hover) {
      const r = rectPoints(draft[0], hover)
      return `${fmt((r.w * scale.mmPerPt) / 1000)} × ${fmt((r.h * scale.mmPerPt) / 1000)} m`
    }
    return `${fmt((total * scale.mmPerPt) / 1000)} m`
  }, [draft, hover, scale, tool])

  if (!doc) {
    return (
      <div className="measure measure--empty">
        <div className="stage-empty stage-empty--inset">
          <h2>No sheet to measure</h2>
          <p>Add a PDF drawing on the right, then open it here.</p>
        </div>
      </div>
    )
  }

  const pageCount = doc.analysis?.pageCount ?? 1
  const current = TOOLS.find((t) => t.id === tool)
  const strokeW = 1.6 / zoom
  const fontSize = 11 / zoom
  const autoCandidates = geo?.scaleCandidates ?? []

  return (
    <div className="measure">
      <div className="measure__bar">
        <div className="measure__group">
          <select
            className="measure__select"
            value={doc.id}
            title="Drawing"
            onChange={(e) => setMeasureTarget({ fileId: e.target.value, pageNumber: 1 })}
          >
            {readyDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" className="icon-btn" title="Previous page" disabled={pageNumber <= 1} onClick={() => gotoPage(pageNumber - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span className="measure__page">
            {pageNumber} / {pageCount}
          </span>
          <button type="button" className="icon-btn" title="Next page" disabled={pageNumber >= pageCount} onClick={() => gotoPage(pageNumber + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="measure__group measure__tools" role="toolbar" aria-label="Measure tools">
          {TOOLS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={clsx('measure__tool', tool === item.id && 'is-on')}
                title={`${item.label} · ${item.hint}`}
                aria-pressed={tool === item.id}
                onClick={() => {
                  setTool(item.id)
                  setDraft([])
                  if (item.id !== 'calibrate') setCalibrating(null)
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="measure__group">
          <select className="measure__select" value={elementId} title="Element" onChange={(e) => setElementId(e.target.value)}>
            {inScope.map((element) => (
              <option key={element.id} value={element.id}>
                {element.label}
              </option>
            ))}
          </select>
          <select
            className="measure__select measure__select--short"
            value={floor == null ? '' : String(floor)}
            title="Floor"
            onChange={(e) => setFloor(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="0">Substructure</option>
            {ctx.floors.map((item) => (
              <option key={item.level} value={item.level}>
                {item.name}
              </option>
            ))}
            <option value="">No floor</option>
          </select>
          <input
            className="measure__label"
            value={label}
            placeholder={nextLabel()}
            title="Tag for the next measurement"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="measure__group measure__group--end">
          <label className="measure__toggle" title="Snap to drawn lines">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
          </label>
          <label className="measure__toggle" title="Show extracted vectors">
            <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} /> Vectors
          </label>
          <button type="button" className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.05, z / 1.25))}>
            <Minus size={14} />
          </button>
          <span className="measure__zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => Math.min(12, z * 1.25))}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="measure__scalebar">
        {scale ? (
          <span className="measure__scale measure__scale--on">
            Scale {scale.label} · {scale.method}
            {scale.method === 'auto' ? ` · ${Math.round(scale.confidence * 100)}% from ${scale.samples} dims` : ''}
          </span>
        ) : (
          <span className="measure__scale">No scale on this sheet yet</span>
        )}
        {autoCandidates.slice(0, 3).map((candidate, index) => (
          <button
            key={`${candidate.label}-${index}`}
            type="button"
            className="btn btn--ghost measure__chip"
            title={`${candidate.method} · ${candidate.samples} samples · confidence ${candidate.confidence}`}
            onClick={() => applyCandidate(index)}
          >
            Use {candidate.label}
            {candidate.method === 'auto' ? ` (${Math.round(candidate.confidence * 100)}%)` : ' (title block)'}
          </button>
        ))}
        <form
          className="measure__ratio"
          onSubmit={(e) => {
            e.preventDefault()
            applyRatio()
          }}
        >
          <input value={ratioInput} placeholder="1:100" title="Type a ratio" onChange={(e) => setRatioInput(e.target.value)} />
          <button type="submit" className="btn btn--ghost" disabled={!ratioInput.trim()}>
            Set
          </button>
        </form>
        {calibrating && (
          <form
            className="measure__ratio"
            onSubmit={(e) => {
              e.preventDefault()
              applyCalibration()
            }}
          >
            <span>{calibrating.points.length < 2 ? 'Click the second point' : 'Known distance (mm)'}</span>
            <input
              type="number"
              min={1}
              value={calibrating.value}
              disabled={calibrating.points.length < 2}
              placeholder="3500"
              onChange={(e) => setCalibrating({ ...calibrating, value: e.target.value })}
            />
            <button type="submit" className="btn" disabled={calibrating.points.length < 2 || !(Number(calibrating.value) > 0)}>
              Calibrate
            </button>
          </form>
        )}
        <span className="measure__hint">
          {current?.hint}
          {draftLength ? ` · ${draftLength}` : ''}
          {draft.length > 0 && tool !== 'rect' ? ' · Enter to finish, Esc to cancel' : ''}
        </span>
      </div>

      <div className="measure__body">
        <div ref={viewportRef} className="measure__viewport" onWheel={onWheel}>
          {error && <p className="measure__error">{error}</p>}
          {loading && !error && <p className="measure__loading">{loading}</p>}
          {image && geo && (
            <div className="measure__sheet" style={{ width: widthPt * zoom, height: heightPt * zoom }}>
              <img src={image} alt={`Page ${pageNumber} of ${doc.name}`} draggable={false} />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${widthPt} ${heightPt}`}
                width={widthPt * zoom}
                height={heightPt * zoom}
                className={clsx('measure__overlay', tool !== 'select' && 'is-drawing')}
                onClick={onSvgClick}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  finishDraft()
                }}
                onMouseMove={(e) => setHover(toPage(e))}
                onMouseLeave={() => setHover(null)}
              >
                {showVectors &&
                  geo.segments.map((s, i) => (
                    <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#5aa0ff" strokeOpacity={0.45} strokeWidth={strokeW * 0.6} />
                  ))}
                {geo.dimensions.map((d, i) =>
                  d.segment ? (
                    <line
                      key={`d${i}`}
                      x1={d.segment.x1}
                      y1={d.segment.y1}
                      x2={d.segment.x2}
                      y2={d.segment.y2}
                      stroke="#f5d58a"
                      strokeOpacity={showVectors ? 0.6 : 0}
                      strokeWidth={strokeW}
                    />
                  ) : null,
                )}

                {pageMeasurements.map((m) => {
                  const color = colorFor(m.elementId)
                  const isSel = m.id === selectedId
                  const q = computeQuantities(m, ctx, scale)
                  const text = `${m.label} · ${fmt(q.qty)} ${q.unit}`
                  const onPick = (e: React.MouseEvent) => {
                    if (tool !== 'select') return
                    e.stopPropagation()
                    setSelectedId(m.id)
                  }
                  if (m.kind === 'rect' && m.points.length >= 2) {
                    const r = rectPoints(m.points[0], m.points[1])
                    return (
                      <g key={m.id} onClick={onPick} className="measure__shape">
                        <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={color} fillOpacity={isSel ? 0.3 : 0.16} stroke={color} strokeWidth={strokeW * (isSel ? 2 : 1)} />
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={fontSize} fill={color} textAnchor="middle" paintOrder="stroke" stroke="#111" strokeWidth={fontSize * 0.25}>
                          {text}
                        </text>
                      </g>
                    )
                  }
                  if (m.kind === 'count' || (m.kind === 'dims' && m.points.length)) {
                    const c = centroid(m.points)
                    return (
                      <g key={m.id} onClick={onPick} className="measure__shape">
                        {m.points.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r={5 / zoom} fill={color} fillOpacity={0.85} stroke="#111" strokeWidth={strokeW * 0.5} />
                        ))}
                        <text x={c.x} y={c.y - 8 / zoom} fontSize={fontSize} fill={color} textAnchor="middle" paintOrder="stroke" stroke="#111" strokeWidth={fontSize * 0.25}>
                          {text}
                        </text>
                      </g>
                    )
                  }
                  if (!m.points.length) return null
                  const closed = m.kind === 'area'
                  const c = centroid(m.points)
                  return (
                    <g key={m.id} onClick={onPick} className="measure__shape">
                      <path d={pathFor(m.points, closed)} fill={closed ? color : 'none'} fillOpacity={isSel ? 0.3 : 0.16} stroke={color} strokeWidth={strokeW * (isSel ? 2.4 : 1.4)} strokeLinejoin="round" strokeLinecap="round" />
                      {m.points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={2.4 / zoom} fill={color} />
                      ))}
                      <text x={c.x} y={c.y} fontSize={fontSize} fill={color} textAnchor="middle" paintOrder="stroke" stroke="#111" strokeWidth={fontSize * 0.25}>
                        {text}
                      </text>
                    </g>
                  )
                })}

                {draft.length > 0 && tool === 'rect' && hover && (
                  <rect {...rectPoints(draft[0], hover)} fill="#8fd9b0" fillOpacity={0.15} stroke="#8fd9b0" strokeWidth={strokeW} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
                )}
                {draft.length > 0 && tool !== 'rect' && (
                  <>
                    <path d={pathFor(hover ? [...draft, hover] : draft, tool === 'area' && draft.length >= 2)} fill={tool === 'area' ? '#8fd9b0' : 'none'} fillOpacity={0.12} stroke="#8fd9b0" strokeWidth={strokeW} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />
                    {draft.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={3 / zoom} fill="#8fd9b0" />
                    ))}
                  </>
                )}
                {calibrating?.points.map((p, i) => (
                  <circle key={`c${i}`} cx={p.x} cy={p.y} r={4 / zoom} fill="#f5d58a" stroke="#111" strokeWidth={strokeW * 0.5} />
                ))}
                {calibrating && calibrating.points.length === 2 && (
                  <line x1={calibrating.points[0].x} y1={calibrating.points[0].y} x2={calibrating.points[1].x} y2={calibrating.points[1].y} stroke="#f5d58a" strokeWidth={strokeW} />
                )}
                {hover && tool !== 'select' && (
                  <g>
                    <line x1={hover.x - 8 / zoom} y1={hover.y} x2={hover.x + 8 / zoom} y2={hover.y} stroke="#fff" strokeWidth={strokeW * 0.6} />
                    <line x1={hover.x} y1={hover.y - 8 / zoom} x2={hover.x} y2={hover.y + 8 / zoom} stroke="#fff" strokeWidth={strokeW * 0.6} />
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>

        <aside className="measure__side">
          <h3>
            Measurements · page {pageNumber}
            <span>{pageMeasurements.length}</span>
          </h3>
          {pageMeasurements.length === 0 && <p className="measure__empty">Draw on the sheet, or ask the estimator to measure this page.</p>}
          <ul className="measure__list">
            {pageMeasurements.map((m) => {
              const q = computeQuantities(m, ctx, scale)
              const owned = lines.filter((line) => line.measurementId === m.id)
              return (
                <li key={m.id} className={clsx('measure__item', m.id === selectedId && 'is-on')}>
                  <button type="button" className="measure__item-main" onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}>
                    <span className="measure__dot" style={{ background: colorFor(m.elementId) }} />
                    <span className="measure__item-label">{m.label}</span>
                    <span className="measure__item-qty">
                      {q.needsScale ? 'no scale' : `${fmt(q.qty)} ${q.unit}`}
                    </span>
                  </button>
                  <div className="measure__item-sub">
                    {elementById(m.elementId)?.label ?? m.elementId}
                    {m.floor != null ? ` · ${floorName(m.floor)}` : ''} · {m.source}
                    {owned.length ? ` · ${owned.length} line${owned.length === 1 ? '' : 's'}` : ' · not on canvas'}
                  </div>
                </li>
              )
            })}
          </ul>

          {selected && (
            <MeasurementEditor
              key={selected.id}
              measurement={selected}
              scale={scale}
              onChange={(patch) => updateMeasurement(selected.id, patch)}
              onPush={() => pushMeasurement(selected.id)}
              onRemove={() => {
                removeMeasurement(selected.id)
                setSelectedId(null)
              }}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function MeasurementEditor({
  measurement,
  scale,
  onChange,
  onPush,
  onRemove,
}: {
  measurement: Measurement
  scale: PageScale | null
  onChange: (patch: Partial<Omit<Measurement, 'id'>>) => void
  onPush: () => void
  onRemove: () => void
}) {
  const ctx = useAppStore((s) => s.projectContext)
  const element = elementById(measurement.elementId)
  const q = computeQuantities(measurement, ctx, scale)
  const sizes = element?.sizes ?? []
  const showLength = measurement.kind === 'dims' && element?.measure !== 'count'
  const showCount = measurement.kind === 'dims' || measurement.kind === 'count'

  function setDim(key: keyof Measurement['dims'], raw: string) {
    const value = Number(raw)
    onChange({ dims: { ...measurement.dims, [key]: value > 0 ? value : undefined } })
  }

  return (
    <div className="measure__editor">
      <h4>{measurement.label}</h4>
      <label>
        <span>Tag</span>
        <input value={measurement.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label>
        <span>Element</span>
        <select value={measurement.elementId} onChange={(e) => onChange({ elementId: e.target.value })}>
          {ELEMENTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Floor</span>
        <select
          value={measurement.floor == null ? '' : String(measurement.floor)}
          onChange={(e) => onChange({ floor: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="0">Substructure</option>
          {ctx.floors.map((item) => (
            <option key={item.level} value={item.level}>
              {item.name}
            </option>
          ))}
          <option value="">No floor</option>
        </select>
      </label>
      {showLength && (
        <label>
          <span>Length (mm)</span>
          <input type="number" min={0} value={measurement.dims.lengthMm ?? ''} onChange={(e) => setDim('lengthMm', e.target.value)} />
        </label>
      )}
      {sizes.includes('width') && (
        <label>
          <span>Width (mm)</span>
          <input type="number" min={0} value={measurement.dims.widthMm ?? ''} placeholder="build-up default" onChange={(e) => setDim('widthMm', e.target.value)} />
        </label>
      )}
      {sizes.includes('height') && (
        <label>
          <span>Height (mm)</span>
          <input type="number" min={0} value={measurement.dims.heightMm ?? ''} placeholder={q.heightMm ? String(q.heightMm) : 'floor height'} onChange={(e) => setDim('heightMm', e.target.value)} />
        </label>
      )}
      {sizes.includes('depth') && (
        <label>
          <span>Depth (mm)</span>
          <input type="number" min={0} value={measurement.dims.depthMm ?? ''} placeholder="build-up default" onChange={(e) => setDim('depthMm', e.target.value)} />
        </label>
      )}
      {sizes.includes('thickness') && (
        <label>
          <span>Thickness (mm)</span>
          <input type="number" min={0} value={measurement.dims.thicknessMm ?? ''} placeholder="build-up default" onChange={(e) => setDim('thicknessMm', e.target.value)} />
        </label>
      )}
      {showCount && (
        <label>
          <span>Count</span>
          <input type="number" min={0} value={measurement.dims.count ?? ''} placeholder={measurement.points.length ? String(measurement.points.length) : '1'} onChange={(e) => setDim('count', e.target.value)} />
        </label>
      )}
      {(element?.measure === 'area' || element?.unit === 'm²') && (
        <label>
          <span>Deduct (m²)</span>
          <input type="number" min={0} step={0.01} value={measurement.deductM2 || ''} onChange={(e) => onChange({ deductM2: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
      )}
      <label className="measure__editor-wide">
        <span>Notes</span>
        <input value={measurement.notes} placeholder="Which dims this rests on" onChange={(e) => onChange({ notes: e.target.value })} />
      </label>
      <dl className="measure__quant">
        {q.lengthMm != null && (
          <>
            <dt>Length</dt>
            <dd>{fmt(q.lengthMm / 1000)} m</dd>
          </>
        )}
        {q.widthMm != null && (
          <>
            <dt>Width</dt>
            <dd>{fmt(q.widthMm / 1000)} m</dd>
          </>
        )}
        {q.heightMm != null && (
          <>
            <dt>Height</dt>
            <dd>{fmt(q.heightMm / 1000)} m</dd>
          </>
        )}
        {q.grossM2 != null && (
          <>
            <dt>Gross</dt>
            <dd>{fmt(q.grossM2)} m²</dd>
          </>
        )}
        {q.netM2 != null && q.netM2 !== q.grossM2 && (
          <>
            <dt>Net</dt>
            <dd>{fmt(q.netM2)} m²</dd>
          </>
        )}
        {q.volumeM3 != null && (
          <>
            <dt>Volume</dt>
            <dd>{fmt(q.volumeM3)} m³</dd>
          </>
        )}
        {q.count != null && (
          <>
            <dt>Count</dt>
            <dd>{q.count}</dd>
          </>
        )}
        <dt>Billed</dt>
        <dd>
          <strong>
            {q.needsScale ? 'scale needed' : `${fmt(q.qty)} ${q.unit}`}
          </strong>
        </dd>
      </dl>
      <p className="measure__basis">{q.basis}</p>
      <div className="measure__editor-actions">
        <button type="button" className="btn" onClick={onPush} disabled={q.needsScale}>
          <Upload size={14} /> Update canvas
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRemove}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  )
}
