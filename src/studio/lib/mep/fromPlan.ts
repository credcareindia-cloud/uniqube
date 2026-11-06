import type { PtMm, Room, RoomCategory, Wall } from '../foundation/types'
import type { FixtureRow, LegendEntry, MepBuilding, MepDrawing, MepModule, SheetMark } from './types'

const SKIP: RoomCategory[] = ['stair', 'lift', 'shaft', 'void']
const OCCUPIED: RoomCategory[] = ['habitable', 'wet', 'corridor', 'store']

const CATALOG: Record<string, { description: string; module: MepModule }> = {
  DL: { description: 'Downlight', module: 'ceiling' },
  BL: { description: 'Wet-area bulkhead', module: 'ceiling' },
  EL: { description: 'Emergency light', module: 'ceiling' },
  SO: { description: 'Socket outlet', module: 'wall' },
  AC: { description: 'AC isolator', module: 'wall' },
  FCU: { description: 'Fan coil / indoor unit', module: 'mechanical' },
  ODU: { description: 'Outdoor condensing unit', module: 'mechanical' },
  EXH: { description: 'Wet-area extract fan', module: 'mechanical' },
  WC: { description: 'Water closet', module: 'plumbing' },
  BAS: { description: 'Basin', module: 'plumbing' },
  SHW: { description: 'Shower', module: 'plumbing' },
  SNK: { description: 'Sink', module: 'plumbing' },
  SD: { description: 'Smoke detector', module: 'fire' },
  MCP: { description: 'Manual call point', module: 'fire' },
  BEL: { description: 'Alarm sounder', module: 'fire' },
  FE: { description: 'Fire extinguisher', module: 'fire' },
}

const SHEETS: Array<{ id: string; title: string; module: MepModule }> = [
  { id: 'plan:lighting', title: 'Ground floor lighting', module: 'ceiling' },
  { id: 'plan:power', title: 'Ground floor power', module: 'wall' },
  { id: 'plan:mechanical', title: 'Ground floor mechanical', module: 'mechanical' },
  { id: 'plan:plumbing', title: 'Ground floor plumbing', module: 'plumbing' },
  { id: 'plan:fire', title: 'Ground floor fire', module: 'fire' },
]

export interface MepPlanLayout {
  footprint: PtMm[]
  walls: Wall[]
  rooms: Room[]
}

export interface PlanMep {
  drawings: MepDrawing[]
  legend: LegendEntry[]
  fixtures: FixtureRow[]
  marks: SheetMark[]
  building: MepBuilding
}

function wet(room: Room) {
  return room.category === 'wet'
}

function lightsFor(room: Room) {
  if (SKIP.includes(room.category) || room.areaM2 < 4) return {}
  if (wet(room)) return { BL: 2 }
  return { DL: Math.max(2, Math.round(room.areaM2 / 12)) }
}

function powerFor(room: Room) {
  if (SKIP.includes(room.category) || room.areaM2 < 4) return {}
  const so = Math.max(2, Math.round(room.areaM2 / 20))
  const server = /SERVER|STORAGE|STORE/.test(room.label.toUpperCase())
  const ac = room.areaM2 >= 15 && !wet(room) && !server ? 1 : 0
  return ac ? { SO: so, AC: ac } : { SO: so }
}

function mechanicalFor(room: Room) {
  if (SKIP.includes(room.category) || room.areaM2 < 4) return {}
  if (wet(room)) return { EXH: 1 }
  return { FCU: Math.max(1, Math.round(room.areaM2 / 35)) }
}

function plumbingFor(room: Room) {
  const label = room.label.toUpperCase()
  if (/KITCHEN|PANTRY/.test(label)) return { SNK: 1, ...(wet(room) ? { BAS: 1 } : {}) }
  if (!wet(room)) return {}
  const wc = /FEMALE|LADIES/.test(label) && room.areaM2 >= 8 ? 2 : 1
  const shower = /BATH|SHOWER/.test(label) ? 1 : 0
  return { WC: wc, BAS: wc, ...(shower ? { SHW: shower } : {}) }
}

function fireFor(room: Room) {
  if (room.category === 'void' || room.category === 'shaft' || room.category === 'lift') return {}
  if (room.category === 'stair') return { SD: 1, MCP: 1, FE: 1 }
  if (room.category === 'corridor') return { SD: Math.max(1, Math.round(room.areaM2 / 15)), BEL: 1 }
  if (OCCUPIED.includes(room.category) && room.areaM2 >= 4) return { SD: 1 }
  return {}
}

function spread(room: Room, count: number) {
  const w = Math.max(1, room.bbox.x1 - room.bbox.x0)
  const h = Math.max(1, room.bbox.y1 - room.bbox.y0)
  const insetX = Math.min(w * 0.18, 900)
  const insetY = Math.min(h * 0.22, 900)
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (w / h))))
  const rows = Math.max(1, Math.ceil(count / cols))
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    points.push({
      x: room.bbox.x0 + insetX + ((w - insetX * 2) * (col + 1)) / (cols + 1),
      y: room.bbox.y0 + insetY + ((h - insetY * 2) * (row + 1)) / (rows + 1),
    })
  }
  return points
}

function corners(footprint: PtMm[], rooms: Room[], count: number) {
  const xs = footprint.length ? footprint.map((point) => point.x) : rooms.flatMap((room) => [room.bbox.x0, room.bbox.x1])
  const ys = footprint.length ? footprint.map((point) => point.y) : rooms.flatMap((room) => [room.bbox.y0, room.bbox.y1])
  if (!xs.length || !ys.length) return []
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const dx = (x1 - x0) * 0.08
  const dy = (y1 - y0) * 0.08
  const all = [
    { x: x0 + dx, y: y0 + dy },
    { x: x1 - dx, y: y0 + dy },
    { x: x0 + dx, y: y1 - dy },
    { x: x1 - dx, y: y1 - dy },
  ]
  return all.slice(0, Math.max(0, Math.min(4, count)))
}

export function mepFromPlan(layout: MepPlanLayout): PlanMep {
  const rooms = layout.rooms.filter((room) => room.areaM2 > 0)
  const drawings: MepDrawing[] = SHEETS.map((sheet) => ({
    id: sheet.id,
    name: 'Sub structure plan',
    title: sheet.title,
    number: '',
    floor: 'Ground floor',
    module: sheet.module,
    pageNumber: 1,
    pageWidth: 0,
    pageHeight: 0,
  }))
  const counts = new Map<string, number>()
  const marks: SheetMark[] = []
  const add = (drawingId: string, code: string, points: Array<{ x: number; y: number }>) => {
    counts.set(`${drawingId}:${code}`, (counts.get(`${drawingId}:${code}`) ?? 0) + points.length)
    points.forEach((point, index) => {
      marks.push({ id: `${drawingId}-${code}-${marks.length}-${index}`, drawingId, code, x: point.x, y: point.y })
    })
  }
  for (const room of rooms) {
    for (const [code, count] of Object.entries(lightsFor(room))) add('plan:lighting', code, spread(room, count))
    for (const [code, count] of Object.entries(powerFor(room))) add('plan:power', code, spread(room, count))
    for (const [code, count] of Object.entries(mechanicalFor(room))) add('plan:mechanical', code, spread(room, count))
    for (const [code, count] of Object.entries(plumbingFor(room))) add('plan:plumbing', code, spread(room, count))
    for (const [code, count] of Object.entries(fireFor(room))) add('plan:fire', code, spread(room, count))
  }
  add('plan:lighting', 'EL', corners(layout.footprint, rooms, 4))
  const fcu = counts.get('plan:mechanical:FCU') ?? 0
  const outdoor = Math.max(1, Math.ceil(fcu / 3))
  if (fcu > 0) add('plan:mechanical', 'ODU', corners(layout.footprint, rooms, outdoor))
  if (!(counts.get('plan:fire:MCP') ?? 0)) add('plan:fire', 'MCP', corners(layout.footprint, rooms, 2))
  if (!(counts.get('plan:fire:FE') ?? 0)) add('plan:fire', 'FE', corners(layout.footprint, rooms, 2))

  const legend: LegendEntry[] = []
  const fixtures: FixtureRow[] = []
  for (const drawing of drawings) {
    for (const [code, spec] of Object.entries(CATALOG)) {
      if (spec.module !== drawing.module) continue
      const count = counts.get(`${drawing.id}:${code}`) ?? 0
      if (count <= 0) continue
      const id = `${drawing.id}-${code}`
      legend.push({ id, code, description: spec.description, module: spec.module })
      fixtures.push({
        id,
        drawingId: drawing.id,
        code,
        description: spec.description,
        module: spec.module,
        floor: drawing.floor,
        count,
        gang: 1,
        source: 'counted',
      })
    }
  }
  const occupied = rooms.filter((room) => OCCUPIED.includes(room.category)).reduce((sum, room) => sum + room.areaM2, 0)
  const wetArea = rooms.filter((room) => room.category === 'wet').reduce((sum, room) => sum + room.areaM2, 0)
  return {
    drawings,
    legend,
    fixtures,
    marks,
    building: {
      occupiedM2: occupied > 0 ? Math.round(occupied * 100) / 100 : null,
      wetM2: wetArea > 0 ? Math.round(wetArea * 100) / 100 : null,
      storeys: rooms.length ? 1 : 0,
      meanWallHeightM: null,
    },
  }
}

export function planDrawings(drawings: MepDrawing[]) {
  if (!drawings.length) return true
  return drawings.every((drawing) => drawing.id.startsWith('plan:') || (/MEP/i.test(drawing.name) && !/ARCH/i.test(drawing.name)))
}

const GENERATED = new Set(['mechanical', 'plumbing', 'fire'])

export function mergePlanTrades(
  current: { drawings: MepDrawing[]; legend: LegendEntry[]; fixtures: FixtureRow[]; marks: SheetMark[] },
  built: PlanMep,
): Pick<PlanMep, 'drawings' | 'legend' | 'fixtures' | 'marks' | 'building'> {
  const realElectrical = current.drawings.some((drawing) => (drawing.module === 'wall' || drawing.module === 'ceiling') && !drawing.id.startsWith('plan:'))
  if (!realElectrical) {
    return {
      drawings: built.drawings,
      legend: built.legend,
      fixtures: [...current.fixtures.filter((row) => row.source === 'manual'), ...built.fixtures],
      marks: built.marks,
      building: built.building,
    }
  }
  return {
    drawings: [
      ...current.drawings.filter((drawing) => !drawing.id.startsWith('plan:mechanical') && !drawing.id.startsWith('plan:plumbing') && !drawing.id.startsWith('plan:fire')),
      ...built.drawings.filter((drawing) => GENERATED.has(drawing.module)),
    ],
    legend: [...current.legend.filter((entry) => !GENERATED.has(entry.module)), ...built.legend.filter((entry) => GENERATED.has(entry.module))],
    fixtures: [
      ...current.fixtures.filter((row) => row.source === 'manual' || !GENERATED.has(row.module)),
      ...built.fixtures.filter((row) => GENERATED.has(row.module)),
    ],
    marks: [
      ...current.marks.filter((mark) => !mark.drawingId.startsWith('plan:mechanical') && !mark.drawingId.startsWith('plan:plumbing') && !mark.drawingId.startsWith('plan:fire')),
      ...built.marks.filter((mark) => mark.drawingId.startsWith('plan:mechanical') || mark.drawingId.startsWith('plan:plumbing') || mark.drawingId.startsWith('plan:fire')),
    ],
    building: built.building,
  }
}
