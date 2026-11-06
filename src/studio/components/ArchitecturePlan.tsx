import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { openingCentre } from '../lib/architecture/engine'
import type { ArchOpening, ArchRoom, ArchSource, ArchWall } from '../lib/architecture/types'

const ROOM_FILL: Record<string, string> = {
  wet: 'rgba(14, 116, 144, 0.14)',
  habitable: 'rgba(253, 170, 72, 0.1)',
  corridor: 'rgba(100, 116, 139, 0.08)',
  store: 'rgba(124, 58, 237, 0.08)',
  stair: 'rgba(148, 163, 184, 0.1)',
  lift: 'rgba(148, 163, 184, 0.1)',
  shaft: 'rgba(148, 163, 184, 0.08)',
  void: 'rgba(226, 232, 240, 0.4)',
  balcony: 'rgba(37, 99, 235, 0.06)',
}

const OPENING_COLOUR = {
  door: '#fdaa48',
  window: '#2563eb',
  gap: '#ca8a04',
}

type Layer = 'rooms' | 'walls' | 'doors' | 'windows'

type Tip = {
  title: string
  body: string
  note: string
  colour: string
  left: number
  top: number
}

function roomName(room: ArchRoom) {
  const label = room.label?.trim()
  if (!label || label === 'UNLABELLED') return room.category
  return label
}

function openingLabel(opening: ArchOpening) {
  if (opening.type === 'door') return opening.widthMm >= 1200 ? 'Wide door' : 'Door'
  if (opening.type === 'window') {
    if (opening.widthMm >= 1800) return 'Wide window'
    if (opening.widthMm >= 1200) return 'Window'
    return 'Narrow window'
  }
  return 'Unmarked opening'
}

export function ArchitecturePlan({
  source,
  doorHeightMm,
  windowHeightMm,
}: {
  source: ArchSource
  doorHeightMm: number | null
  windowHeightMm: number | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState<Layer[]>([])
  const [tip, setTip] = useState<Tip | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const box = useMemo(() => {
    const xs = source.footprint.length
      ? source.footprint.map((point) => point.x)
      : source.rooms.flatMap((room) => [room.bbox.x0, room.bbox.x1]).concat(source.walls.flatMap((wall) => [wall.axis === 'h' ? wall.a : wall.pos, wall.axis === 'h' ? wall.b : wall.pos]))
    const ys = source.footprint.length
      ? source.footprint.map((point) => point.y)
      : source.rooms.flatMap((room) => [room.bbox.y0, room.bbox.y1]).concat(source.walls.flatMap((wall) => [wall.axis === 'v' ? wall.a : wall.pos, wall.axis === 'v' ? wall.b : wall.pos]))
    if (!xs.length || !ys.length) return null
    const pad = 1500
    return {
      x0: Math.min(...xs) - pad,
      y0: Math.min(...ys) - pad,
      width: Math.max(...xs) - Math.min(...xs) + pad * 2,
      height: Math.max(...ys) - Math.min(...ys) + pad * 2,
    }
  }, [source])

  if (!box) return <p className="doc-page__note">The sub structure plan has no rooms or walls to draw.</p>

  const stroke = Math.max(40, box.width / 700)
  const layers: Array<{ id: Layer; label: string }> = [
    { id: 'rooms', label: 'Rooms' },
    { id: 'walls', label: 'Walls' },
    { id: 'doors', label: 'Doors' },
    { id: 'windows', label: 'Windows' },
  ]

  const showTip = (event: MouseEvent, next: Omit<Tip, 'left' | 'top'>) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    setTip({
      ...next,
      left: Math.min(Math.max(12, event.clientX - rect.left + 14), Math.max(12, rect.width - 230)),
      top: Math.min(Math.max(12, event.clientY - rect.top + 14), Math.max(12, rect.height - 120)),
    })
  }

  return (
    <>
      <div className="fe__plan-bar">
        <span className="fe__muted">Architecture plan</span>
        <span className="fe__legend">
          {layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={hidden.includes(layer.id) ? 'is-off' : ''}
              onClick={() => setHidden((current) => (current.includes(layer.id) ? current.filter((item) => item !== layer.id) : [...current, layer.id]))}
            >
              <i
                style={{
                  background:
                    layer.id === 'doors' ? OPENING_COLOUR.door : layer.id === 'windows' ? OPENING_COLOUR.window : layer.id === 'walls' ? '#010127' : '#fdaa48',
                }}
              />
              {layer.label}
            </button>
          ))}
        </span>
      </div>
      <div className="mep__plan-wrap" ref={wrapRef}>
        <svg
          className="fe__svg mep__svg"
          viewBox={`${box.x0} ${box.y0} ${box.width} ${box.height}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={() => {
            setPicked(null)
            setTip(null)
          }}
        >
          <rect x={box.x0} y={box.y0} width={box.width} height={box.height} fill="#f8fafc" />
          {source.footprint.length ? (
            <polygon points={source.footprint.map((point) => `${point.x},${point.y}`).join(' ')} fill="#ffffff" stroke="#334155" strokeWidth={stroke} />
          ) : null}
          {!hidden.includes('rooms') &&
            source.rooms.map((room) => (
              <g
                key={room.id}
                className="arch__hit"
                onMouseEnter={(event) =>
                  showTip(event, {
                    title: roomName(room),
                    body: `${room.category} · ${room.areaM2.toFixed(1)} m²`,
                    note: room.category === 'wet' ? 'Wet room — waterproofing and moisture-resistant boards' : 'Occupied floor and ceiling take this area',
                    colour: room.category === 'wet' ? '#0e7490' : '#fdaa48',
                  })
                }
                onMouseLeave={() => setTip(null)}
                onClick={(event) => {
                  event.stopPropagation()
                  setPicked(room.id)
                }}
              >
                <rect
                  x={room.bbox.x0}
                  y={room.bbox.y0}
                  width={Math.max(1, room.bbox.x1 - room.bbox.x0)}
                  height={Math.max(1, room.bbox.y1 - room.bbox.y0)}
                  fill={ROOM_FILL[room.category] ?? 'rgba(248, 250, 252, 0.4)'}
                  stroke={picked === room.id ? '#010127' : '#cbd5e1'}
                  strokeWidth={picked === room.id ? stroke * 0.7 : stroke * 0.28}
                />
                <text
                  x={(room.bbox.x0 + room.bbox.x1) / 2}
                  y={(room.bbox.y0 + room.bbox.y1) / 2}
                  textAnchor="middle"
                  fontSize={Math.max(220, box.width / 70)}
                  fill="#475569"
                >
                  {roomName(room)}
                </text>
              </g>
            ))}
          {!hidden.includes('walls') &&
            source.walls.map((wall) => {
              const thickness = Math.max(wall.thickness, stroke * (wall.external ? 1.15 : 0.7))
              const x = wall.axis === 'h' ? wall.a : wall.pos - thickness / 2
              const y = wall.axis === 'h' ? wall.pos - thickness / 2 : wall.a
              return (
                <rect
                  key={wall.id}
                  className="arch__hit"
                  x={x}
                  y={y}
                  width={wall.axis === 'h' ? wall.lengthMm : thickness}
                  height={wall.axis === 'h' ? thickness : wall.lengthMm}
                  fill={wall.external ? '#010127' : '#64748b'}
                  onMouseEnter={(event) =>
                    showTip(event, {
                      title: wall.external ? 'External wall' : 'Partition',
                      body: `${(wall.lengthMm / 1000).toFixed(2)} m · ${wall.thickness} mm · ${wall.openings.length} opening${wall.openings.length === 1 ? '' : 's'}`,
                      note: wall.external ? 'Cement board, vapour barrier, rockwool, two gypsum layers' : 'Gypsum both faces and rockwool in the cavity',
                      colour: wall.external ? '#010127' : '#64748b',
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              )
            })}
          {source.walls.flatMap((wall) =>
            wall.openings
              .filter((opening) => (opening.type === 'gap' ? true : !hidden.includes(opening.type === 'door' ? 'doors' : 'windows')))
              .map((opening) => (
                <OpeningMark
                  key={opening.id || `${wall.id}-${opening.position}`}
                  wall={wall}
                  opening={opening}
                  stroke={stroke}
                  active={picked === opening.id}
                  onEnter={(event) =>
                    showTip(event, {
                      title: openingLabel(opening),
                      body: `${opening.widthMm} mm wide${opening.type === 'door' && doorHeightMm ? ` · ${doorHeightMm} mm high` : ''}${opening.type === 'window' && windowHeightMm ? ` · ${windowHeightMm} mm high` : ''}`,
                      note: wall.external ? 'On the facade' : 'On a partition',
                      colour: OPENING_COLOUR[opening.type],
                    })
                  }
                  onLeave={() => setTip(null)}
                  onPick={() => setPicked(opening.id)}
                />
              )),
          )}
        </svg>
        {tip ? (
          <aside className="mep__tip" style={{ left: tip.left, top: tip.top }} aria-live="polite">
            <span className="mep__tip-swatch" style={{ background: tip.colour }} />
            <div>
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
              <small>{tip.note}</small>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  )
}

function OpeningMark({
  wall,
  opening,
  stroke,
  active,
  onEnter,
  onLeave,
  onPick,
}: {
  wall: ArchWall
  opening: ArchOpening
  stroke: number
  active: boolean
  onEnter: (event: MouseEvent<SVGGElement>) => void
  onLeave: () => void
  onPick: () => void
}) {
  const centre = openingCentre(wall, opening)
  const colour = OPENING_COLOUR[opening.type]
  const along = Math.max(opening.widthMm, stroke * 4)
  const across = opening.type === 'window' ? Math.max(wall.thickness * 1.35, stroke * 1.8) : Math.max(wall.thickness * 1.8, stroke * 2.4)
  const x = wall.axis === 'h' ? centre.x - along / 2 : centre.x - across / 2
  const y = wall.axis === 'h' ? centre.y - across / 2 : centre.y - along / 2
  const w = wall.axis === 'h' ? along : across
  const h = wall.axis === 'h' ? across : along
  return (
    <g
      className={`arch__hit${active ? ' is-on' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(event) => {
        event.stopPropagation()
        onPick()
      }}
    >
      <rect x={x} y={y} width={w} height={h} fill={colour} stroke="#ffffff" strokeWidth={stroke * 0.28} rx={stroke * 0.3} />
      {opening.type === 'window' ? (
        <line
          x1={wall.axis === 'h' ? centre.x - along / 3 : centre.x}
          y1={wall.axis === 'h' ? centre.y : centre.y - along / 3}
          x2={wall.axis === 'h' ? centre.x + along / 3 : centre.x}
          y2={wall.axis === 'h' ? centre.y : centre.y + along / 3}
          stroke="#ffffff"
          strokeWidth={stroke * 0.28}
        />
      ) : (
        <circle cx={centre.x} cy={centre.y} r={stroke * 0.55} fill="#ffffff" />
      )}
    </g>
  )
}
