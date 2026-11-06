import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { pageScaleKey, useAppStore } from '../store'
import type { ClientDocument } from '../types'
import { getPageGeometry, openDocument } from '../lib/geometry'
import { snapToGeometry, type PageGeometry, type ScaleCandidate } from '../lib/geometryCore'
import { renderPdfPage } from '../lib/pdfAnalyze'

type Pt = { x: number; y: number }
type Mark = { a: Pt; b: Pt; label: string }

function acceptedScale(candidates: ScaleCandidate[]): ScaleCandidate | null {
  const autos = candidates.filter((c) => c.method === 'auto')
  if (!autos.length) return null
  const best = [...autos].sort((a, b) => b.samples - a.samples || b.confidence - a.confidence)[0]
  if (best.confidence >= 0.6) return best
  if (best.samples >= 12 && best.confidence >= 0.4) return best
  return null
}

function lengthLabel(a: Pt, b: Pt, mmPerPt: number | null) {
  const pt = Math.hypot(b.x - a.x, b.y - a.y)
  if (mmPerPt == null) return `${Math.round(pt)} pt`
  const mm = pt * mmPerPt
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`
}

export function DrawingPreview({ doc, onClose }: { doc: ClientDocument; onClose: () => void }) {
  const units = useAppStore((s) => s.projectContext.units)
  const pageScales = useAppStore((s) => s.pageScales)
  const [pages, setPages] = useState<string[]>([])
  const [pageCount, setPageCount] = useState(doc.analysis?.pageCount ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [openPage, setOpenPage] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setPages([])
    setError(null)
    setOpenPage(null)
    void (async () => {
      try {
        const pdf = await openDocument(doc)
        const count = doc.analysis?.pageCount || pdf.numPages
        if (alive) setPageCount(count)
        const urls: string[] = []
        for (let n = 1; n <= count; n += 1) {
          const url = await renderPdfPage(pdf, n, 640)
          if (!alive) return
          urls.push(url)
          setPages([...urls])
        }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not open this PDF')
      }
    })()
    return () => {
      alive = false
    }
  }, [doc.id, doc.file, doc.analysis?.pageCount])

  return (
    <aside className="agents-drawing" aria-label="Drawing">
      <header>
        <b>{doc.name}</b>
        <button type="button" className="os-btn" onClick={onClose} aria-label="Close drawing">
          <X size={14} />
        </button>
      </header>
      <div className="agents-drawing__pages">
        {error && <p className="agents-files__empty">{error}</p>}
        {!error && pages.length === 0 && <p className="agents-files__empty">Opening the PDF…</p>}
        {pages.map((url, index) => (
          <button key={url} type="button" className="agents-drawing__page" onClick={() => setOpenPage(index + 1)}>
            <img src={url} alt="" />
            <span>Page {index + 1}</span>
          </button>
        ))}
        {pages.length > 0 && pages.length < pageCount && <p className="agents-files__empty">Reading page {pages.length + 1} of {pageCount}…</p>}
      </div>
      {openPage != null && (
        <PageDialog
          doc={doc}
          pageNumber={openPage}
          units={units}
          savedScale={pageScales[pageScaleKey(doc.id, openPage)] ?? null}
          onClose={() => setOpenPage(null)}
        />
      )}
    </aside>
  )
}

function PageDialog({
  doc,
  pageNumber,
  units,
  savedScale,
  onClose,
}: {
  doc: ClientDocument
  pageNumber: number
  units: 'mm' | 'm' | 'ft'
  savedScale: { mmPerPt: number; label: string } | null
  onClose: () => void
}) {
  const [sheet, setSheet] = useState<string | null>(null)
  const [geo, setGeo] = useState<PageGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const [start, setStart] = useState<Pt | null>(null)
  const [hover, setHover] = useState<Pt | null>(null)
  const [marks, setMarks] = useState<Mark[]>([])
  const [redoStack, setRedoStack] = useState<Mark[]>([])

  useEffect(() => {
    let alive = true
    setSheet(null)
    setGeo(null)
    setError(null)
    setMeasuring(false)
    setStart(null)
    setHover(null)
    setMarks([])
    setRedoStack([])
    void (async () => {
      try {
        const pdf = await openDocument(doc)
        const url = await renderPdfPage(pdf, pageNumber, 1600)
        if (!alive) return
        setSheet(url)
        const geometry = await getPageGeometry(doc, pageNumber, units)
        if (alive) setGeo(geometry)
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not open this page')
      }
    })()
    return () => {
      alive = false
    }
  }, [doc, pageNumber, units])

  function undo() {
    if (start) {
      setStart(null)
      setHover(null)
      return
    }
    if (!marks.length) return
    const last = marks[marks.length - 1]
    setMarks(marks.slice(0, -1))
    setRedoStack([...redoStack, last])
  }

  function redo() {
    if (!redoStack.length) return
    const last = redoStack[redoStack.length - 1]
    setMarks([...marks, last])
    setRedoStack(redoStack.slice(0, -1))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const mmPerPt = savedScale?.mmPerPt ?? (geo ? acceptedScale(geo.scaleCandidates)?.mmPerPt ?? null : null)
  const scaleLabel = savedScale?.label ?? (geo ? acceptedScale(geo.scaleCandidates)?.label ?? null : null)

  function locate(event: React.MouseEvent<SVGSVGElement>): Pt | null {
    if (!geo) return null
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const raw = {
      x: ((event.clientX - rect.left) / rect.width) * geo.widthPt,
      y: ((event.clientY - rect.top) / rect.height) * geo.heightPt,
    }
    return snapToGeometry(raw, geo.segments, 8) ?? raw
  }

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!measuring || !start) return
    setHover(locate(event))
  }

  function onClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!measuring) return
    const point = locate(event)
    if (!point) return
    if (!start) {
      setStart(point)
      setHover(null)
      return
    }
    setMarks((list) => [...list, { a: start, b: point, label: lengthLabel(start, point, mmPerPt) }])
    setRedoStack([])
    setStart(null)
    setHover(null)
  }

  return (
    <div className="page-dialog" role="dialog" aria-modal aria-label={`${doc.name} page ${pageNumber}`} onClick={onClose}>
      <div className="page-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <b>
            {doc.name} · page {pageNumber}
          </b>
          <span>{scaleLabel ? scaleLabel : geo ? 'No scale on this page' : ''}</span>
          <button type="button" className={clsx('os-btn', measuring && 'os-btn--primary')} onClick={() => { setMeasuring((on) => !on); setStart(null); setHover(null) }}>
            Measure
          </button>
          <button type="button" className="os-btn" onClick={undo} disabled={!start && marks.length === 0}>
            Undo
          </button>
          <button type="button" className="os-btn" onClick={redo} disabled={redoStack.length === 0}>
            Redo
          </button>
          <button type="button" className="os-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="page-dialog__stage">
          {error && <p className="agents-files__empty">{error}</p>}
          {!error && !sheet && <p className="agents-files__empty">Opening this page…</p>}
          {sheet && geo && (
            <div className={clsx('page-dialog__sheet', measuring && 'is-measuring')}>
              <img src={sheet} alt={`Page ${pageNumber}`} />
              <svg viewBox={`0 0 ${geo.widthPt} ${geo.heightPt}`} onClick={onClick} onMouseMove={onMove}>
                {marks.map((mark, index) => (
                  <g key={index}>
                    <line x1={mark.a.x} y1={mark.a.y} x2={mark.b.x} y2={mark.b.y} />
                    <text x={(mark.a.x + mark.b.x) / 2} y={(mark.a.y + mark.b.y) / 2}>
                      {mark.label}
                    </text>
                  </g>
                ))}
                {start && hover && (
                  <g>
                    <line x1={start.x} y1={start.y} x2={hover.x} y2={hover.y} />
                    <text x={(start.x + hover.x) / 2} y={(start.y + hover.y) / 2}>
                      {lengthLabel(start, hover, mmPerPt)}
                    </text>
                  </g>
                )}
                {start && <circle cx={start.x} cy={start.y} r={Math.max(3, geo.widthPt / 280)} />}
              </svg>
              {measuring && <p>{start ? 'Click the end point.' : 'Click the start point.'}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
