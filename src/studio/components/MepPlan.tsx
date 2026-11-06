import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { apiFetch, apiJson } from '../lib/api'
import { getPageGeometry } from '../lib/geometry'
import { electricalDiagram, type ElectricalDiagram } from '../lib/mep/diagram'
import type { ClientDocument } from '../types'
import type { MepPlanLayout } from '../lib/mep/fromPlan'
import type { FixtureRow, MepDrawing, SheetMark } from '../lib/mep/types'

const COLOURS = ['#DC2626', '#EA580C', '#2563EB', '#7C3AED', '#15803D', '#0F766E', '#BE185D', '#CA8A04']
const NAMED: Record<string, string> = {
  DL: '#DC2626',
  EL: '#EA580C',
  BL: '#2563EB',
  SO: '#7C3AED',
  AC: '#15803D',
  FCU: '#0F766E',
  ODU: '#115e59',
  EXH: '#0e7490',
  WC: '#1d4ed8',
  BAS: '#2563eb',
  SHW: '#7c3aed',
  SNK: '#4338ca',
  SD: '#b91c1c',
  MCP: '#c2410c',
  BEL: '#be185d',
  FE: '#9a3412',
  M: '#DC2626',
  T: '#EA580C',
  K: '#2563EB',
  J: '#7C3AED',
  IK: '#15803D',
  'H/L': '#0F766E',
}

const TRADE: Record<string, string> = {
  ceiling: 'Lighting',
  wall: 'Power',
  mechanical: 'Mechanical',
  plumbing: 'Plumbing',
  fire: 'Fire',
  underground: 'Underground',
}

type Tip = {
  markId: string
  code: string
  colour: string
  description: string
  room: string | null
  floor: string
  index: number
  of: number
  left: number
  top: number
}

function colourFor(code: string, index: number) {
  return NAMED[code] ?? COLOURS[index % COLOURS.length]
}

function roomAt(layout: MepPlanLayout | null, x: number, y: number) {
  if (!layout) return null
  const hit = layout.rooms.find(
    (room) => x >= room.bbox.x0 && x <= room.bbox.x1 && y >= room.bbox.y0 && y <= room.bbox.y1,
  )
  return hit?.label?.trim() || null
}

async function sheetFile(projectId: string, drawing: MepDrawing, documents: ClientDocument[]): Promise<File | null> {
  const local = documents.find((item) => item.file && item.file.size > 0 && (item.id === drawing.id || item.name === drawing.name))
  if (local?.file && local.file.size > 0) return local.file
  const project = await apiJson<{ body?: { documents?: Array<{ id: string; name: string }> } }>(`/api/projects/${projectId}`)
  const match = (project.body?.documents ?? []).find((item) => item.name === drawing.name)
  if (!match) return null
  const res = await apiFetch(`/api/projects/${projectId}/files/${match.id}`)
  if (!res.ok) return null
  const blob = await res.blob()
  if (!blob.size) return null
  return new File([blob], drawing.name, { type: blob.type || 'application/pdf' })
}

function MarkSymbol({
  mark,
  colour,
  radius,
  active,
  onEnter,
  onLeave,
  onPick,
}: {
  mark: SheetMark
  colour: string
  radius: number
  active: boolean
  onEnter: (event: MouseEvent<SVGGElement>) => void
  onLeave: () => void
  onPick: () => void
}) {
  const core = active ? radius : radius * 0.92
  const halo = radius * 1.55
  const ring = Math.max(radius * 0.18, 1)
  return (
    <g
      className={`mep__mark${active ? ' is-on' : ''}`}
      transform={`translate(${mark.x} ${mark.y})`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(event) => {
        event.stopPropagation()
        onPick()
      }}
    >
      <circle r={halo} fill={colour} opacity={active ? 0.22 : 0.12} />
      <circle r={core + ring} fill="#ffffff" />
      <circle r={core} fill={colour} />
      <circle r={core * 0.32} fill="#ffffff" opacity={0.9} />
    </g>
  )
}

export function MepPlan({
  projectId,
  drawings,
  fixtures,
  marks,
  documents,
  layout,
}: {
  projectId: string
  drawings: MepDrawing[]
  fixtures: FixtureRow[]
  marks: SheetMark[]
  documents: ClientDocument[]
  layout: MepPlanLayout | null
}) {
  const sheets = drawings.filter((drawing) => Boolean(TRADE[drawing.module]))
  const [drawingId, setDrawingId] = useState(sheets[0]?.id ?? '')
  const [diagram, setDiagram] = useState<ElectricalDiagram | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = sheets.find((item) => item.id === drawingId) ?? sheets[0] ?? null
  const codes = useMemo(
    () => fixtures.filter((row) => row.drawingId === drawing?.id && row.count > 0).map((row) => row.code),
    [fixtures, drawing?.id],
  )
  const codesKey = codes.join('|')

  useEffect(() => {
    if (drawing && drawing.id !== drawingId) setDrawingId(drawing.id)
  }, [drawing, drawingId])

  useEffect(() => {
    let alive = true
    setDiagram(null)
    setProblem(null)
    if (!drawing || (layout && drawing.id.startsWith('plan:'))) return
    if (!codesKey) {
      setProblem('No symbols are confirmed on this sheet yet.')
      return
    }
    const codeList = codesKey.split('|')
    void (async () => {
      try {
        const file = await sheetFile(projectId, drawing, documents)
        if (!alive) return
        if (!file) {
          setProblem(`${drawing.name} is not in this project, so the plan cannot be drawn.`)
          return
        }
        const doc: ClientDocument = { id: drawing.id, name: drawing.name, sourceName: drawing.name, category: 'drawing', file, analysis: null, status: 'ready' }
        const geo = await getPageGeometry(doc, drawing.pageNumber || 1, 'mm')
        if (!alive) return
        const next = electricalDiagram(geo, drawing.id, codeList)
        if (!next) setProblem('This sheet has no plan lines to draw.')
        else setDiagram(next)
      } catch (err) {
        if (!alive) return
        setProblem(err instanceof Error ? err.message : 'The plan could not be drawn.')
      }
    })()
    return () => {
      alive = false
    }
  }, [projectId, drawing, codesKey, documents, layout])

  const onPlan = Boolean(drawing && layout && drawing.id.startsWith('plan:'))
  const shown = useMemo(() => {
    if (!drawing) return [] as SheetMark[]
    if (onPlan) return marks.filter((mark) => mark.drawingId === drawing.id)
    return diagram?.marks ?? []
  }, [drawing, onPlan, marks, diagram])
  const legendCodes = useMemo(() => [...new Set(codes)], [codes])
  const visible = useMemo(() => shown.filter((mark) => !hidden.includes(mark.code)), [shown, hidden])
  const byCode = useMemo(() => {
    const map = new Map<string, SheetMark[]>()
    for (const mark of visible) {
      const list = map.get(mark.code) ?? []
      list.push(mark)
      map.set(mark.code, list)
    }
    return map
  }, [visible])

  if (!drawing) {
    return <p className="doc-page__note">Run the sub structure plan, then the lighting and power counts are drawn on it.</p>
  }

  const picked = selected ? fixtures.find((row) => row.drawingId === drawing.id && row.code === visible.find((mark) => mark.id === selected)?.code) : null
  const stroke = diagram ? Math.max(2.4, diagram.width / 110) : 2

  const openTip = (mark: SheetMark, event: MouseEvent<SVGGElement>) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const box = wrap.getBoundingClientRect()
    const fixture = fixtures.find((row) => row.drawingId === mark.drawingId && row.code === mark.code)
    const siblings = byCode.get(mark.code) ?? []
    const index = siblings.findIndex((item) => item.id === mark.id) + 1
    const left = Math.min(Math.max(12, event.clientX - box.left + 14), Math.max(12, box.width - 220))
    const top = Math.min(Math.max(12, event.clientY - box.top + 14), Math.max(12, box.height - 110))
    setTip({
      markId: mark.id,
      code: mark.code,
      colour: colourFor(mark.code, legendCodes.indexOf(mark.code)),
      description: fixture?.description || mark.code,
      room: roomAt(onPlan ? layout : null, mark.x, mark.y),
      floor: fixture?.floor || drawing.floor || '',
      index: index > 0 ? index : 1,
      of: siblings.length || fixture?.count || 1,
      left,
      top,
    })
  }

  const clearTip = (markId: string) => {
    setTip((current) => (current?.markId === markId ? null : current))
  }

  return (
    <>
      <div className="fe__plan-bar">
        <select
          aria-label="Electrical sheet"
          value={drawing.id}
          onChange={(event) => {
            setDrawingId(event.target.value)
            setSelected(null)
            setTip(null)
          }}
        >
          {sheets.map((sheet) => (
            <option key={sheet.id} value={sheet.id}>
              {TRADE[sheet.module] ?? sheet.module} · {sheet.floor || sheet.name}
            </option>
          ))}
        </select>
        <span className="fe__legend">
          {legendCodes.map((code, index) => (
            <button
              key={code}
              type="button"
              className={hidden.includes(code) ? 'is-off' : ''}
              onClick={() => setHidden((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]))}
            >
              <i style={{ background: colourFor(code, index) }} /> {code} {fixtures.find((row) => row.drawingId === drawing.id && row.code === code)?.count ?? 0}
            </button>
          ))}
        </span>
      </div>
      <div className="mep__plan-wrap" ref={wrapRef}>
        {onPlan && layout ? (
          <PlanSheet
            layout={layout}
            marks={visible}
            legendCodes={legendCodes}
            selected={selected}
            hovered={tip?.markId ?? null}
            onSelect={setSelected}
            onEnter={openTip}
            onLeave={clearTip}
          />
        ) : problem ? (
          <p className="doc-page__note">{problem}</p>
        ) : !diagram ? (
          <p className="doc-page__note">Drawing the plan…</p>
        ) : (
          <svg
            className="fe__svg mep__svg"
            viewBox={`${diagram.x0} ${diagram.y0} ${diagram.width} ${diagram.height}`}
            preserveAspectRatio="xMidYMid meet"
            onClick={() => {
              setSelected(null)
              setTip(null)
            }}
          >
            <rect x={diagram.x0} y={diagram.y0} width={diagram.width} height={diagram.height} fill="#f8fafc" />
            {diagram.lines.map((line, index) => (
              <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#334155" strokeWidth={stroke * 0.55} />
            ))}
            {visible.map((mark) => (
              <MarkSymbol
                key={mark.id}
                mark={mark}
                colour={colourFor(mark.code, legendCodes.indexOf(mark.code))}
                radius={selected === mark.id ? diagram.width / 42 : diagram.width / 52}
                active={selected === mark.id || tip?.markId === mark.id}
                onEnter={(event) => openTip(mark, event)}
                onLeave={() => clearTip(mark.id)}
                onPick={() => setSelected(mark.id)}
              />
            ))}
          </svg>
        )}
        {tip ? (
          <aside className="mep__tip" style={{ left: tip.left, top: tip.top }} aria-live="polite">
            <span className="mep__tip-swatch" style={{ background: tip.colour }} />
            <div>
              <strong>
                {tip.code}
                <span>
                  {tip.index}/{tip.of}
                </span>
              </strong>
              <p>{tip.description}</p>
              {(tip.room || tip.floor) && (
                <small>
                  {[tip.room, tip.floor].filter(Boolean).join(' · ')}
                </small>
              )}
            </div>
          </aside>
        ) : null}
      </div>
      <p className="fe__muted">
        {onPlan || diagram ? `${visible.length} symbols on the plan.` : 'The plan is the linework of the sheet, with each counted symbol in its own colour.'}
        {picked ? ` Selected ${picked.code}: ${picked.count} · ${picked.description}` : ' Hover a mark for its annotation.'}
      </p>
    </>
  )
}

function PlanSheet({
  layout,
  marks,
  legendCodes,
  selected,
  hovered,
  onSelect,
  onEnter,
  onLeave,
}: {
  layout: MepPlanLayout
  marks: SheetMark[]
  legendCodes: string[]
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onEnter: (mark: SheetMark, event: MouseEvent<SVGGElement>) => void
  onLeave: (markId: string) => void
}) {
  const xs = layout.footprint.length ? layout.footprint.map((point) => point.x) : layout.rooms.flatMap((room) => [room.bbox.x0, room.bbox.x1])
  const ys = layout.footprint.length ? layout.footprint.map((point) => point.y) : layout.rooms.flatMap((room) => [room.bbox.y0, room.bbox.y1])
  if (!xs.length || !ys.length) return <p className="doc-page__note">The sub structure plan has no rooms to draw.</p>
  const pad = 1500
  const x0 = Math.min(...xs) - pad
  const y0 = Math.min(...ys) - pad
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2
  const stroke = Math.max(40, width / 700)
  const radius = width / 78
  return (
    <svg
      className="fe__svg mep__svg"
      viewBox={`${x0} ${y0} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={() => onSelect(null)}
    >
      <rect x={x0} y={y0} width={width} height={height} fill="#f8fafc" />
      {layout.footprint.length ? (
        <polygon points={layout.footprint.map((point) => `${point.x},${point.y}`).join(' ')} fill="#ffffff" stroke="#334155" strokeWidth={stroke} />
      ) : null}
      {layout.rooms.map((room) => (
        <g key={room.id}>
          <rect x={room.bbox.x0} y={room.bbox.y0} width={room.bbox.x1 - room.bbox.x0} height={room.bbox.y1 - room.bbox.y0} fill="none" stroke="#94a3b8" strokeWidth={stroke * 0.45} />
          <text
            x={(room.bbox.x0 + room.bbox.x1) / 2}
            y={room.bbox.y0 + Math.min(700, (room.bbox.y1 - room.bbox.y0) * 0.22)}
            textAnchor="middle"
            fontSize={Math.max(280, width / 55)}
            fill="#64748b"
          >
            {room.label}
          </text>
        </g>
      ))}
      {layout.walls.map((wall) => {
        const thickness = Math.max(wall.thickness, stroke)
        const x = wall.axis === 'h' ? wall.a : wall.pos - thickness / 2
        const y = wall.axis === 'h' ? wall.pos - thickness / 2 : wall.a
        return <rect key={wall.id} x={x} y={y} width={wall.axis === 'h' ? wall.length : thickness} height={wall.axis === 'h' ? thickness : wall.length} fill="#334155" />
      })}
      {marks.map((mark) => (
        <MarkSymbol
          key={mark.id}
          mark={mark}
          colour={colourFor(mark.code, legendCodes.indexOf(mark.code))}
          radius={selected === mark.id || hovered === mark.id ? radius * 1.2 : radius}
          active={selected === mark.id || hovered === mark.id}
          onEnter={(event) => onEnter(mark, event)}
          onLeave={() => onLeave(mark.id)}
          onPick={() => onSelect(mark.id)}
        />
      ))}
    </svg>
  )
}
