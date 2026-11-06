/**
 * UNIQUBE superstructure engine v1.0: LGS walls, floors, balconies, roofs, parapets, anchors and
 * rods, HRS markups, allowances and the calculation order. Deterministic; takes the approved
 * foundation result (walls, classes, zones) plus the level table. Unknown inputs block the run
 * instead of becoming zero.
 */
import type { EngineResult, FramingZone, Wall } from '../foundation/types.ts'
import {
  anchors as anchorCount,
  balconyQuantities,
  blockingTruss,
  bracing,
  commonTruss,
  cJoistZone,
  cutPieces,
  externalRods,
  factors,
  gableVerge,
  hipEnd,
  hrsMarkupKg,
  internalRods,
  loadPath as loadPathCalc,
  monoTruss,
  purlins as purlinCalc,
  rodLength,
  trussPiece,
  valley,
  wallHeight,
  wallRunQuantities,
} from './calc.ts'
import { FRAMING_LABEL, P, PBool, PN, PRange, PText, SUPER_FLAG_DEFS, SUPER_PARAMETER_SET, SUPER_VERSION, defaultAllowances, floorFamily, floorZoneDeduction, isRoofFraming, kgPerM, sectionKnown, type Overrides } from './rules.ts'
import type {
  AnchorResult,
  BalconyResult,
  BlockingTrussResult,
  FloorFamily,
  FloorResult,
  HrsMarkupResult,
  JoistZoneResult,
  LevelResult,
  LevelRow,
  LoadPathResult,
  ParapetResult,
  PitchedRoofResult,
  RoofSectionResult,
  SectionTotal,
  SuperBoqLine,
  SuperFlag,
  SuperInputs,
  SuperOverrides,
  SuperResult,
  SuperTotals,
  TrussLineResult,
  WallRunResult,
  WallStatus,
} from './types.ts'

export const DEFAULT_SETTINGS: SuperInputs['settings'] = {
  studSpacingMm: 600,
  projectType: 'panelised',
  unitSystem: 'metric',
  pitchedRoofCovering: 'metal_sheet',
  flatRoofCovering: 'flat_deck',
  lowestLevel: 'on_slab',
}

const LEVEL_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor', 'Sixth floor', 'Seventh floor', 'Eighth floor', 'Ninth floor']

export function levelName(index: number) {
  return LEVEL_NAMES[index] ?? `Level ${index}`
}

export function defaultLevelRow(index: number, isTop: boolean): LevelRow {
  return {
    id: `L${index}`,
    name: levelName(index),
    plan: index === 0 ? 'ground' : 'same',
    ffhMm: null,
    lbSection: '600S162-54',
    nlbSection: '600S162-43',
    framingType: isTop ? 'flat_roof_truss' : 'truss',
    framingSection: '600S162-54',
    reinforcingStuds: false,
    parapetSection: null,
    parapetHeightMm: null,
  }
}

export function defaultInputs(storeyCount: number): SuperInputs {
  const n = Math.max(1, Math.min(20, Math.floor(storeyCount)))
  return {
    settings: { ...DEFAULT_SETTINGS },
    levels: Array.from({ length: n }, (_, i) => defaultLevelRow(i, i === n - 1)),
    suspendedFloor: { framingType: 'truss', section: '600S162-54', reinforcingStuds: false },
    roofSections: [],
    balconies: [],
    parameterOverrides: {},
  }
}

export const EMPTY_SUPER_OVERRIDES: SuperOverrides = {
  hrsDecisions: {},
  hrsManual: [],
  allowances: defaultAllowances(),
  acknowledged: [],
  approvedBy: null,
  approvedAt: null,
  changeLog: [],
}

export interface SuperRunInput {
  foundation: EngineResult
  inputs: SuperInputs
  overrides: SuperOverrides
}

// ——— helpers ———

const JUNCTION_TOL = 300
const RUN_GAP = 300
const POS_TOL = 150
/** Plausibility bounds for an HRS kg/m: lightest rolled angle to the heaviest catalogue UC (356x406x634). */
const HRS_KG_PER_M_MIN = 1
const HRS_KG_PER_M_MAX = 634

interface RawRun {
  axis: 'h' | 'v'
  pos: number
  a: number
  b: number
  status: WallStatus
  external: boolean
  openings: number[]
  sourceWallIds: string[]
  review: boolean
}

function flag(code: string, levelId: string | null, entityIds: string[], message: string, action: string): SuperFlag {
  const def = SUPER_FLAG_DEFS[code] ?? { severity: 'amber' as const, trigger: '' }
  return { key: `${code}:${levelId ?? '-'}:${entityIds.join('+') || '-'}`, code, severity: def.severity, levelId, entityIds, message, action }
}

/** Continuous straight walls of one class: collinear segments touching end to end merge into a run. */
function buildRawRuns(foundation: EngineResult): RawRun[] {
  const classOf = (w: Wall) => foundation.wallClasses.find((c) => c.wallId === w.id)?.class ?? 'NLB'
  const groups = new Map<string, Wall[]>()
  for (const w of foundation.walls) {
    const cls = classOf(w)
    const status: WallStatus = cls === 'LB' || cls === 'SHEAR' ? 'LB' : 'NLB'
    const key = `${w.axis}:${status}`
    groups.set(key, [...(groups.get(key) ?? []), w])
  }
  const runs: RawRun[] = []
  for (const [key, walls] of groups) {
    const [axis, status] = key.split(':') as ['h' | 'v', WallStatus]
    const clusters: Wall[][] = []
    for (const w of [...walls].sort((p, q) => p.pos - q.pos)) {
      const c = clusters.find((grp) => Math.abs(grp[0].pos - w.pos) <= POS_TOL)
      if (c) c.push(w)
      else clusters.push([w])
    }
    for (const cluster of clusters) {
      const sorted = [...cluster].sort((p, q) => p.a - q.a)
      let current: RawRun | null = null
      for (const w of sorted) {
        if (current && w.a <= current.b + RUN_GAP) {
          current.b = Math.max(current.b, w.b)
          current.external = current.external || w.isExternal
          current.openings.push(...w.openings.map((op) => op.width))
          current.sourceWallIds.push(w.id)
          current.review = current.review || classOf(w) === 'REVIEW'
        } else {
          if (current) runs.push(current)
          current = { axis, pos: w.pos, a: w.a, b: w.b, status, external: w.isExternal, openings: w.openings.map((op) => op.width), sourceWallIds: [w.id], review: classOf(w) === 'REVIEW' }
        }
      }
      if (current) runs.push(current)
    }
  }
  return runs.sort((p, q) => p.axis.localeCompare(q.axis) || p.pos - q.pos || p.a - q.a)
}

/** Count each junction once: T and X on the through wall, L on the horizontal run. */
function junctionsFor(runs: RawRun[]): Map<RawRun, { L: number; T: number; X: number }> {
  const out = new Map<RawRun, { L: number; T: number; X: number }>()
  for (const r of runs) out.set(r, { L: 0, T: 0, X: 0 })
  const hs = runs.filter((r) => r.axis === 'h')
  const vs = runs.filter((r) => r.axis === 'v')
  const near = (x: number, y: number) => Math.abs(x - y) <= JUNCTION_TOL
  for (const A of hs) {
    for (const B of vs) {
      const aInB = A.pos >= B.a - JUNCTION_TOL && A.pos <= B.b + JUNCTION_TOL
      const bInA = B.pos >= A.a - JUNCTION_TOL && B.pos <= A.b + JUNCTION_TOL
      if (!aInB || !bInA) continue
      const bAtAEnd = near(B.pos, A.a) || near(B.pos, A.b)
      const aAtBEnd = near(A.pos, B.a) || near(A.pos, B.b)
      if (bAtAEnd && aAtBEnd) out.get(A)!.L += 1
      else if (aAtBEnd) out.get(A)!.T += 1
      else if (bAtAEnd) out.get(B)!.T += 1
      else out.get(A)!.X += 1
    }
  }
  return out
}

function overlapLength(a: RawRun, b: RawRun) {
  return Math.max(0, Math.min(a.b, b.b) - Math.max(a.a, b.a))
}

/** Drop traced jogs narrower than the tolerance (pilasters, wall-thickness steps) so corners are building corners. */
function simplifyPolygon(polygon: Array<{ x: number; y: number }>, tol: number) {
  let pts = polygon.filter((p, i, all) => i === 0 || Math.hypot(all[i - 1].x - p.x, all[i - 1].y - p.y) > 1)
  if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) <= 1) pts = pts.slice(0, -1)
  let changed = true
  while (changed && pts.length > 4) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]
      const b = pts[i]
      const c = pts[(i + 1) % pts.length]
      const len = Math.hypot(c.x - a.x, c.y - a.y)
      const dist = len < 1 ? Math.hypot(b.x - a.x, b.y - a.y) : Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y)) / len
      if (dist < tol) {
        pts.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return pts
}

function footprintCorners(polygon: Array<{ x: number; y: number }>) {
  const pts = simplifyPolygon(polygon, 400)
  let corners = 0
  let nonOrthogonal = false
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i + pts.length - 1) % pts.length]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    const d1 = { x: p1.x - p0.x, y: p1.y - p0.y }
    const d2 = { x: p2.x - p1.x, y: p2.y - p1.y }
    const cross = d1.x * d2.y - d1.y * d2.x
    if (Math.abs(cross) > 1e-6) corners += 1
    if (Math.abs(d2.x) > 400 && Math.abs(d2.y) > 400) nonOrthogonal = true
  }
  return { corners, nonOrthogonal }
}

interface ZoneFraming {
  zone: FramingZone
  direction: 'x' | 'y'
  spanMm: number
  widthMm: number
  /** Sub-spans after accepted intermediate beams. */
  spansMm: number[]
}

function zoneFramings(foundation: EngineResult, splits: Record<string, number>): ZoneFraming[] {
  return foundation.zones.map((zone) => {
    const d = foundation.decisions.find((x) => x.zoneId === zone.id)
    const direction: 'x' | 'y' = d?.direction ?? (zone.Lx <= zone.Ly ? 'x' : 'y')
    const spanMm = d?.spanMm ?? (direction === 'x' ? zone.Lx : zone.Ly)
    const widthMm = direction === 'x' ? zone.Ly : zone.Lx
    const parts = Math.max(1, (splits[zone.id] ?? 0) + 1)
    return { zone, direction, spanMm, widthMm, spansMm: Array(parts).fill(spanMm / parts) }
  })
}

/** Chain of zones crossed at one truss position in one direction, sorted along the span axis. */
function chainAt(framings: ZoneFraming[], direction: 'x' | 'y', position: number): ZoneFraming[][] {
  const hit = framings
    .filter((f) => f.direction === direction)
    .filter((f) => (direction === 'x' ? position >= f.zone.bbox.y0 - 1 && position <= f.zone.bbox.y1 + 1 : position >= f.zone.bbox.x0 - 1 && position <= f.zone.bbox.x1 + 1))
    .sort((p, q) => (direction === 'x' ? p.zone.bbox.x0 - q.zone.bbox.x0 : p.zone.bbox.y0 - q.zone.bbox.y0))
  const chains: ZoneFraming[][] = []
  for (const f of hit) {
    const last = chains[chains.length - 1]
    const prev = last?.[last.length - 1]
    const start = direction === 'x' ? f.zone.bbox.x0 : f.zone.bbox.y0
    const prevEnd = prev ? (direction === 'x' ? prev.zone.bbox.x1 : prev.zone.bbox.y1) : null
    if (prev && prevEnd != null && Math.abs(start - prevEnd) <= JUNCTION_TOL && !last.includes(f)) last.push(f)
    else chains.push([f])
  }
  return chains
}

function buildFloor(
  foundation: EngineResult,
  framings: ZoneFraming[],
  carriedBy: string,
  label: string,
  family: FloorFamily,
  section: string,
  reinforcing: boolean,
  spacing: number,
  isRoof: boolean,
  o: Overrides,
): FloorResult {
  const trussLines: TrussLineResult[] = []
  const blocking: BlockingTrussResult[] = []
  const joistZones: JoistZoneResult[] = []
  const xs = foundation.footprint.polygon.map((p) => p.x)
  const ys = foundation.footprint.polygon.map((p) => p.y)
  const origin = { x: Math.min(...xs), y: Math.min(...ys) }
  const extent = { x: Math.max(...xs), y: Math.max(...ys) }

  if (family === 'truss') {
    for (const direction of ['x', 'y'] as const) {
      const across = direction === 'x' ? 'y' : 'x'
      const seen = new Set<string>()
      for (let pos = origin[across]; pos <= extent[across] + 1; pos += spacing) {
        for (const chain of chainAt(framings, direction, pos)) {
          const spans = chain.flatMap((f) => f.spansMm)
          const key = `${direction}:${Math.round(pos)}:${chain.map((f) => f.zone.id).join('|')}`
          if (seen.has(key)) continue
          seen.add(key)
          const pieces = cutPieces(spans, o).map((piece) => trussPiece(piece, reinforcing, o))
          trussLines.push({ id: `TL-${direction}-${Math.round(pos)}`, direction, positionMm: Math.round(pos), zoneIds: chain.map((f) => f.zone.id), spansMm: spans, pieces, totalMm: pieces.reduce((s, p) => s + p.totalMm, 0) })
        }
      }
    }
    // blocking trusses: one along each piece end, two at a cut, one along each intermediate support
    for (const f of framings) {
      const mid = f.direction === 'x' ? (f.zone.bbox.y0 + f.zone.bbox.y1) / 2 : (f.zone.bbox.x0 + f.zone.bbox.x1) / 2
      const chain = chainAt(framings, f.direction, mid).find((c) => c.includes(f))
      if (!chain) continue
      const owners = chain.flatMap((z) => z.spansMm.map(() => z))
      const spans = chain.flatMap((z) => z.spansMm)
      const pieces = cutPieces(spans, o)
      const cutAt = new Set<number>()
      let idx = 0
      for (let i = 0; i < pieces.length - 1; i++) {
        idx += pieces[i].length
        cutAt.add(idx)
      }
      const add = (kind: BlockingTrussResult['kind'], lines: number) => {
        const piece = blockingTruss(f.widthMm, reinforcing, o)
        blocking.push({ id: `BT-${f.zone.id}-${kind}-${blocking.length + 1}`, zoneId: f.zone.id, kind, lines, lengthMm: f.widthMm, piece, totalMm: piece.totalMm * lines })
      }
      if (owners[0] === f) add('piece_end', PN('blocking_trusses', 'per_piece_end', o))
      for (let j = 1; j < spans.length; j++) {
        if (owners[j] !== f) continue
        if (cutAt.has(j)) add('cut', PN('blocking_trusses', 'per_cut', o))
        else add('intermediate_support', PN('blocking_trusses', 'per_intermediate_support', o))
      }
      if (owners[owners.length - 1] === f) add('piece_end', PN('blocking_trusses', 'per_piece_end', o))
    }
  } else {
    for (const f of framings) {
      for (const span of f.spansMm) {
        const q = cJoistZone(f.widthMm, span, spacing, section, o)
        joistZones.push({ zoneId: f.zone.id, widthMm: f.widthMm, spanMm: span, joists: q.joists, blockingRows: q.blockingRows, joistsMm: q.joistsMm, blockingMm: q.blockingMm, rimsMm: q.rimsMm, totalMm: q.totalMm })
      }
    }
  }

  const membersMm = trussLines.reduce((s, l) => s + l.totalMm, 0) + joistZones.reduce((s, z) => s + z.joistsMm, 0)
  const blockingMm = blocking.reduce((s, b) => s + b.totalMm, 0) + joistZones.reduce((s, z) => s + z.blockingMm, 0)
  const rimsMm = joistZones.reduce((s, z) => s + z.rimsMm, 0)
  const totalMm = membersMm + blockingMm + rimsMm
  return { carriedBy, label, family, section, reinforcing, trussLines, blocking, joistZones, membersMm, blockingMm, rimsMm, totalMm, kg: (totalMm / 1000) * kgPerM(section, o), isRoof, purlinsM: 0, purlinsKg: 0, bracingM: 0, bracingKg: 0 }
}

function wallRunResult(raw: RawRun, id: string, levelId: string, heightMm: number, section: string, spacing: number, junctions: { L: number; T: number; X: number }, stackedLengthMm: number, o: Overrides): WallRunResult {
  const lengthMm = raw.b - raw.a
  const q = wallRunQuantities({ lengthMm, heightMm, spacingMm: spacing, section, openings: raw.openings.length, junctions }, o)
  return { id, levelId, axis: raw.axis, pos: raw.pos, a: raw.a, b: raw.b, lengthMm, heightMm, status: raw.status, section, external: raw.external, openings: raw.openings, junctions, stackedLengthMm, sourceWallIds: raw.sourceWallIds, ...q }
}

// ——— main ———

export function runSuperstructure({ foundation, inputs, overrides }: SuperRunInput): SuperResult {
  const o = inputs.parameterOverrides
  const s = inputs.settings.studSpacingMm
  const flags: SuperFlag[] = []
  const missing: string[] = []
  const notes: string[] = []
  const hrs: HrsMarkupResult[] = []
  const sectionTotals = new Map<string, SectionTotal>()
  const addSection = (section: string, mm: number, kg: number) => {
    const row = sectionTotals.get(section) ?? { section, m: 0, kg: 0 }
    row.m += mm / 1000
    row.kg += kg
    sectionTotals.set(section, row)
  }
  const suggest = (id: string, levelId: string, memberType: string, trigger: string, entityIds: string[], lengthMm: number | null, quantity: number, beamEnds: number) => {
    const decision = overrides.hrsDecisions[id]
    const status = decision?.status ?? 'suggested'
    const section = decision?.section ?? null
    const kgPerMetre = decision?.kgPerM ?? null
    const length = decision?.lengthMm ?? lengthMm
    const qty = decision?.quantity ?? quantity
    const kg = status === 'accepted' && kgPerMetre != null && length != null && qty != null ? hrsMarkupKg(length, kgPerMetre, qty, o) : null
    hrs.push({ id, levelId, memberType, trigger, entityIds, suggestedLengthMm: lengthMm, suggestedQuantity: quantity, beamEnds, status, section, kgPerM: kgPerMetre, lengthMm: length, quantity: qty, kg })
    if (status === 'suggested') flags.push(flag('F-HRS-PENDING', levelId, [id], `${memberType} suggested (${trigger}) is neither accepted nor deleted.`, 'Accept the HRS markup with a section and kg/m, or delete it.'))
    if (status === 'accepted' && kg == null) missing.push(`${id}: accepted ${memberType} needs section, kg/m, length and quantity`)
    if (status === 'accepted' && kg != null) {
      // plausibility: no rolled section weighs more than the heaviest catalogue UC (634 kg/m) or less than the lightest angle (~1 kg/m)
      if (kgPerMetre! > HRS_KG_PER_M_MAX || kgPerMetre! < HRS_KG_PER_M_MIN) missing.push(`${id}: ${kgPerMetre} kg/m is outside any rolled section (${HRS_KG_PER_M_MIN}–${HRS_KG_PER_M_MAX} kg/m); enter the supplier kg/m for ${section ?? 'the section'}`)
      if (!section || !/[A-Za-z]/.test(section)) missing.push(`${id}: section "${section ?? ''}" is not a designation (e.g. UB 305x165x40, PFC 200x75x23, SHS 100x100x5)`)
      if (length! <= 0 || qty! <= 0) missing.push(`${id}: length and quantity must be above zero`)
    }
    return status === 'accepted'
  }

  // design basis: every value is null until UNIQUBE fills it, so nothing can fall outside it
  const levels = inputs.levels
  const top = levels.length - 1
  const rawRuns = buildRawRuns(foundation)
  const junctionMap = junctionsFor(rawRuns)
  const { corners, nonOrthogonal } = footprintCorners(foundation.footprint.polygon)
  if (nonOrthogonal) flags.push(flag('F-WALL-GEOMETRY', null, ['footprint'], 'The footprint has an edge that is neither horizontal nor vertical.', 'Check the curved or angled walls by hand; the wall rules assume straight orthogonal runs.'))
  if (rawRuns.some((r) => r.review)) notes.push('Walls the foundation engine left in REVIEW are framed as NLB here until they are classified.')

  // splits from accepted intermediate beams, per level (zone id → beam count)
  const splitsByLevel: Record<string, Record<string, number>> = {}
  for (const [id, d] of Object.entries(overrides.hrsDecisions)) {
    const m = /^HRS-SPAN-(L\d+|SUSPENDED)-(.+)$/.exec(id)
    if (!m || d.status !== 'accepted') continue
    splitsByLevel[m[1]] = { ...(splitsByLevel[m[1]] ?? {}), [m[2]]: Math.max(1, Math.round(d.quantity ?? 1)) }
  }

  const maxSpan = P('max_span_mm', o)
  const [hMin, hMax] = PRange('stud_height_range_mm')
  const areaM2 = foundation.footprint.areaM2
  const levelResults: LevelResult[] = []
  let previousRuns: WallRunResult[] | null = null

  // F-SPAN and voids are plan facts; they repeat on every framed level
  const spanChecks = (levelId: string, framings: ZoneFraming[]) => {
    for (const f of framings) {
      if (f.spanMm > maxSpan) {
        const beams = Math.ceil(f.spanMm / maxSpan) - 1
        const accepted = suggest(`HRS-SPAN-${levelId}-${f.zone.id}`, levelId, 'intermediate beam', 'F-SPAN', [f.zone.id], f.widthMm, beams, 2)
        if (!accepted) flags.push(flag('F-SPAN', levelId, [f.zone.id], `Zone ${f.zone.id} spans ${(f.spanMm / 1000).toFixed(2)} m with no intermediate wall (limit ${(maxSpan / 1000).toFixed(1)} m).`, 'Accept the intermediate beam markup or add a wall in the foundation engine.'))
      }
      for (const voidId of f.zone.voidIds) {
        const room = foundation.rooms.find((r) => r.id === voidId)
        if (!room) continue
        const w = room.bbox.x1 - room.bbox.x0
        const h = room.bbox.y1 - room.bbox.y0
        if (Math.max(w, h) > P('hrs_void_threshold_mm', o)) suggest(`HRS-VOID-${levelId}-${voidId}`, levelId, 'trimmer beams', 'void wider than the trimmer threshold', [voidId], Math.max(w, h), 2, 2)
      }
    }
  }

  // suspended lowest level: its own floor row under the ground floor
  let suspendedFloor: FloorResult | null = null
  if (inputs.settings.lowestLevel === 'suspended') {
    flags.push(flag('F-SUSPENDED', 'L0', [], 'The lowest level has no slab; its floor is framed in LGS and the anchor rules are off.', 'Confirm the suspended floor row and the bearing of the ground floor walls.'))
    const framings = zoneFramings(foundation, splitsByLevel.SUSPENDED ?? {})
    spanChecks('SUSPENDED', framings)
    if (!sectionKnown(inputs.suspendedFloor.section)) missing.push('Suspended floor: framing section')
    else suspendedFloor = buildFloor(foundation, framings, 'SUSPENDED', 'Suspended ground floor', inputs.suspendedFloor.framingType, inputs.suspendedFloor.section, inputs.suspendedFloor.reinforcingStuds, s, false, o)
  }

  for (let i = 0; i <= top; i++) {
    const row = levels[i]
    const isTop = i === top
    const empty = (skipped: string | null, heightMm: number | null): LevelResult => ({
      levelId: row.id,
      name: row.name,
      index: i,
      heightMm,
      deductionMm: 0,
      wallRuns: [],
      floor: null,
      roof: null,
      parapet: null,
      balconies: [],
      anchors: { levelId: row.id, m10x200: 0, m8x100: 0, rodsExternal: 0, rodsInternal: 0, rodLengthMm: null, corners },
      areaM2,
      kg: { wallsLb: 0, wallsNlb: 0, floor: 0, balconies: 0, roof: 0, purlins: 0, bracing: 0, parapets: 0, total: 0 },
      kgPerM2: null,
      skipped,
    })

    if (row.plan === 'none') {
      flags.push(flag('F-LEVEL-MISSING', row.id, [], `${row.name} has no plan; no quantities for this level.`, 'Pick a plan source for the level (same as below for a typical plan).'))
      levelResults.push(empty('no plan', null))
      previousRuns = null
      continue
    }
    if (!isTop && isRoofFraming(row.framingType)) missing.push(`${row.name}: carries roof framing although ${levels[i + 1].name} sits above it; choose a floor framing type`)
    if (isTop && !isRoofFraming(row.framingType)) missing.push(`${row.name}: is the top level, so its framing row must be a flat or pitched roof`)

    for (const [label, section] of [['LB wall section', row.lbSection], ['NLB wall section', row.nlbSection]] as const) {
      if (!sectionKnown(section)) missing.push(`${row.name}: ${label} ${section || '(blank)'} is not in the section library`)
    }
    if (row.framingType !== 'pitched_roof' && !sectionKnown(row.framingSection)) missing.push(`${row.name}: framing section ${row.framingSection || '(blank)'} is not in the section library`)
    if (row.framingType === 'pitched_roof' && !sectionKnown(row.framingSection)) missing.push(`${row.name}: roof truss section ${row.framingSection || '(blank)'} is not in the section library`)

    let deduction = 0
    try {
      deduction = floorZoneDeduction(row.framingType, row.framingSection, o)
    } catch (e) {
      missing.push(`${row.name}: ${e instanceof Error ? e.message : 'floor-zone deduction'}`)
    }
    if (row.ffhMm == null) {
      missing.push(`${row.name}: ${row.framingType === 'pitched_roof' ? 'FFL-to-eaves height' : 'floor-to-floor height'} (read it from the sections; the engine never assumes it)`)
      levelResults.push(empty('floor-to-floor height missing', null))
      previousRuns = null
      continue
    }
    const H = wallHeight(row.ffhMm, deduction, o)
    if (H < hMin || H > hMax) flags.push(flag('F-HEIGHT-RANGE', row.id, [], `${row.name} stud height ${H} mm is outside ${hMin}–${hMax} mm.`, 'Check the floor-to-floor height and the framing depth above this level.'))
    if (H <= 0) {
      missing.push(`${row.name}: wall height ${H} mm after the ${deduction} mm floor-zone deduction`)
      levelResults.push(empty('wall height not positive', H))
      previousRuns = null
      continue
    }

    // walls
    const wallRuns: WallRunResult[] = rawRuns.map((raw, k) => {
      const section = raw.status === 'LB' ? row.lbSection : row.nlbSection
      const below = previousRuns?.filter((r) => r.axis === raw.axis && Math.abs(r.pos - raw.pos) <= POS_TOL) ?? []
      const stacked = i === 0 ? raw.b - raw.a : below.reduce((sum, r) => sum + overlapLength(raw, { ...raw, a: r.a, b: r.b }), 0)
      return wallRunResult(raw, `${row.id}-WR${k + 1}`, row.id, H, sectionKnown(section) ? section : '600S162-54', s, junctionMap.get(raw)!, Math.min(stacked, raw.b - raw.a), o)
    })
    for (const run of wallRuns) {
      for (const width of run.openings) {
        if (width > P('panel_max_length_mm', o)) flags.push(flag('F-OPENING-PANEL', row.id, [run.id], `Opening ${width} mm in ${run.id} is wider than one panel (${P('panel_max_length_mm', o)} mm).`, 'Confirm the header and the panel split at this opening.'))
        if (width >= P('hrs_opening_limit_mm', o)) suggest(`HRS-OPEN-${row.id}-${run.id}-${width}`, row.id, 'header beam', `opening ≥ ${P('hrs_opening_limit_mm', o)} mm`, [run.id], width + 2 * 150, 1, 2)
      }
      if (i > 0 && previousRuns && run.status === 'LB' && run.stackedLengthMm < run.lengthMm - JUNCTION_TOL) {
        const accepted = suggest(`HRS-STACK-${row.id}-${run.id}`, row.id, 'transfer beam', 'F-STACK', [run.id], run.lengthMm - run.stackedLengthMm, 1, 2)
        if (!accepted) flags.push(flag('F-STACK', row.id, [run.id], `LB wall ${run.id} has ${(run.lengthMm - run.stackedLengthMm).toFixed(0)} mm with no wall below.`, 'Accept the transfer beam markup or change the wall below.'))
      }
    }
    const wallsLb = wallRuns.filter((r) => r.status === 'LB').reduce((sum, r) => sum + r.kg, 0)
    const wallsNlb = wallRuns.filter((r) => r.status === 'NLB').reduce((sum, r) => sum + r.kg, 0)
    for (const r of wallRuns) addSection(r.section, r.totalMm, r.kg)

    // floor or roof carried on these walls
    let floor: FloorResult | null = null
    let roof: PitchedRoofResult | null = null
    let parapet: ParapetResult | null = null
    const family = floorFamily(row.framingType)
    if (family !== 'pitched' && sectionKnown(row.framingSection)) {
      const framings = zoneFramings(foundation, splitsByLevel[row.id] ?? {})
      spanChecks(row.id, framings)
      const isRoof = isRoofFraming(row.framingType)
      floor = buildFloor(foundation, framings, row.id, isRoof ? `${FRAMING_LABEL[row.framingType]} over ${row.name}` : `${levels[i + 1]?.name ?? 'Level above'} floor`, family, row.framingSection, row.reinforcingStuds && family === 'truss', s, isRoof, o)
      addSection(row.framingSection, floor.totalMm, floor.kg)
      if (isRoof && inputs.settings.flatRoofCovering === 'sheeting_on_purlins') {
        const xs = foundation.footprint.polygon.map((p) => p.x)
        const ys = foundation.footprint.polygon.map((p) => p.y)
        const long = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
        const short = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
        const pur = purlinCalc(areaM2, 0, foundation.footprint.perimeterM, o)
        floor.purlinsM = pur.purlinsM
        floor.purlinsKg = pur.purlinsM * kgPerM(PText('purlin_section'), o)
        addSection(PText('purlin_section'), pur.purlinsM * 1000, floor.purlinsKg)
        if (PBool('flat_purlin_roof_bracing_default', o)) {
          const br = bracing(long, short, o)
          floor.bracingM = br.totalMm / 1000
          floor.bracingKg = floor.bracingM * kgPerM(PText('strap_section'), o)
          addSection(PText('strap_section'), br.totalMm, floor.bracingKg)
        }
      }
      if (isRoof && row.parapetHeightMm != null && row.parapetHeightMm > 0) {
        const section = row.parapetSection && sectionKnown(row.parapetSection) ? row.parapetSection : row.nlbSection
        const external = rawRuns.filter((r) => r.external)
        const corner = junctionsFor(external)
        const runs = external.map((raw, k) => wallRunResult({ ...raw, status: 'NLB', openings: [] }, `${row.id}-PP${k + 1}`, row.id, row.parapetHeightMm!, section, s, { L: corner.get(raw)!.L, T: 0, X: 0 }, raw.b - raw.a, o))
        parapet = { runs, heightMm: row.parapetHeightMm, section, kg: runs.reduce((sum, r) => sum + r.kg, 0) }
        for (const r of runs) addSection(r.section, r.totalMm, r.kg)
      }
    } else if (family === 'pitched') {
      if (!inputs.roofSections.length) flags.push(flag('F-ROOF-PLAN', row.id, [], 'Pitched roof chosen with no roof sections entered from the roof plan.', 'Add the roof sections (shape, span, length, pitch, overhangs) from the roof plan.'))
      else if (sectionKnown(row.framingSection)) roof = buildPitchedRoof(inputs, row, s, flags, missing, suggest, addSection, o)
    }

    // balconies on the floor carried by this level
    const balconies: BalconyResult[] = []
    for (const bal of inputs.balconies.filter((b) => b.levelId === levels[i + 1]?.id)) {
      if (bal.lengthMm == null || bal.cantileverMm == null) {
        missing.push(`Balcony ${bal.id}: length and cantilever`)
        continue
      }
      if (family === 'pitched' || !sectionKnown(row.framingSection)) continue
      const over = bal.cantileverMm > P('max_cantilever_mm', o)
      if (over) {
        const accepted = suggest(`HRS-CANT-${row.id}-${bal.id}`, row.id, 'cantilever beams', 'F-CANTILEVER', [bal.id], bal.cantileverMm * (1 + P('balcony_backspan_ratio', o)), 2, 1)
        if (!accepted) flags.push(flag('F-CANTILEVER', row.id, [bal.id], `Balcony ${bal.id} cantilevers ${bal.cantileverMm} mm (limit ${P('max_cantilever_mm', o)} mm); excluded until the engineer confirms.`, 'Accept the cantilever beam markup or shorten the balcony.'))
        balconies.push({ id: bal.id, levelId: row.id, lengthMm: bal.lengthMm, cantileverMm: bal.cantileverMm, members: 0, memberLengthMm: 0, membersMm: 0, edgesMm: 0, totalMm: 0, kg: 0, excluded: true })
        continue
      }
      const framings = zoneFramings(foundation, {})
      const area = (f: ZoneFraming) => f.zone.Lx * f.zone.Ly
      const dominant = framings.reduce((acc, f) => ({ ...acc, [f.direction]: (acc[f.direction] ?? 0) + area(f) }), {} as Record<string, number>)
      const floorDir = (dominant.x ?? 0) >= (dominant.y ?? 0) ? 'x' : 'y'
      if ((bal.supportAxis === 'h' && floorDir === 'x') || (bal.supportAxis === 'v' && floorDir === 'y')) flags.push(flag('F-BACKSPAN', row.id, [bal.id], `Floor framing runs parallel to the wall supporting balcony ${bal.id}.`, 'Confirm the backspan members and their anchorage into the floor.'))
      const q = balconyQuantities(bal.lengthMm, bal.cantileverMm, s, family, row.reinforcingStuds && family === 'truss', o)
      const kg = (q.totalMm / 1000) * kgPerM(row.framingSection, o)
      balconies.push({ id: bal.id, levelId: row.id, lengthMm: bal.lengthMm, cantileverMm: bal.cantileverMm, ...q, kg, excluded: false })
      addSection(row.framingSection, q.totalMm, kg)
    }

    // anchors and rods
    const anchorsRow: AnchorResult = { levelId: row.id, m10x200: 0, m8x100: 0, rodsExternal: 0, rodsInternal: 0, rodLengthMm: null, corners }
    if (i === 0 && inputs.settings.lowestLevel === 'on_slab') {
      for (const r of wallRuns) {
        if (r.status === 'LB') anchorsRow.m10x200 += anchorCount(r.lengthMm, PN('anchor_lb', 'spacing_mm', o))
        else anchorsRow.m8x100 += anchorCount(r.lengthMm, PN('anchor_nlb', 'spacing_mm', o))
      }
    }
    if (i > 0) {
      anchorsRow.rodsExternal = externalRods(wallRuns.filter((r) => r.external).map((r) => r.lengthMm), corners, o)
      anchorsRow.rodsInternal = wallRuns.filter((r) => !r.external && r.status === 'LB').reduce((sum, r) => sum + internalRods(r.stackedLengthMm, o), 0)
      const below = levels[i - 1]
      try {
        anchorsRow.rodLengthMm = rodLength(floorZoneDeduction(below.framingType, below.framingSection, o), o)
      } catch {
        anchorsRow.rodLengthMm = null
      }
    }

    const kg = {
      wallsLb,
      wallsNlb,
      floor: floor?.kg ?? 0,
      balconies: balconies.reduce((sum, b) => sum + b.kg, 0),
      roof: roof?.framingKg ?? 0,
      purlins: (floor?.purlinsKg ?? 0) + (roof?.purlinsKg ?? 0),
      bracing: (floor?.bracingKg ?? 0) + (roof?.bracingKg ?? 0),
      parapets: parapet?.kg ?? 0,
      total: 0,
    }
    kg.total = kg.wallsLb + kg.wallsNlb + kg.floor + kg.balconies + kg.roof + kg.purlins + kg.bracing + kg.parapets
    levelResults.push({ levelId: row.id, name: row.name, index: i, heightMm: H, deductionMm: deduction, wallRuns, floor, roof, parapet, balconies, anchors: anchorsRow, areaM2, kg, kgPerM2: areaM2 > 0 ? kg.total / areaM2 : null, skipped: null })
    previousRuns = wallRuns
  }

  if (suspendedFloor) {
    const ground = levelResults[0]
    if (ground) {
      ground.kg.floor += suspendedFloor.kg
      ground.kg.total += suspendedFloor.kg
      ground.kgPerM2 = ground.areaM2 > 0 ? ground.kg.total / ground.areaM2 : null
      addSection(suspendedFloor.section, suspendedFloor.totalMm, suspendedFloor.kg)
    }
  }

  // manual HRS
  const hrsManual = overrides.hrsManual.map((m) => {
    const kg = m.directKg != null ? m.directKg * (1 + P('hrs_wastage', o)) : m.kgPerM != null && m.lengthMm != null ? hrsMarkupKg(m.lengthMm, m.kgPerM, m.quantity, o) : null
    if (kg == null) missing.push(`Manual HRS ${m.description || m.id}: kg/m and length, or direct kg`)
    return { ...m, kg }
  })

  // load path loop: stud packs under accepted beam ends, every level down to the foundation
  const loadPath: LoadPathResult = { beamEndsOnLgsWalls: 0, studPacks: [], studPackStuds: 0, studPackKg: 0, padsToSubstructure: 0 }
  for (const m of hrs.filter((x) => x.status === 'accepted' && x.beamEnds > 0)) {
    const levelIndex = m.levelId === 'SUSPENDED' ? -1 : levels.findIndex((l) => l.id === m.levelId)
    const levelsBelow = levelIndex + 1
    const ends = m.beamEnds * Math.max(1, Math.round(m.quantity ?? m.suggestedQuantity))
    const lp = loadPathCalc(ends, levelsBelow, o)
    loadPath.beamEndsOnLgsWalls += ends
    loadPath.padsToSubstructure += lp.padsToSubstructure
    for (let k = 0; k <= levelIndex; k++) {
      const lvl = levelResults[k]
      const studs = ends * P('stud_pack_studs', o)
      const kg = lvl?.heightMm ? (studs * lvl.heightMm) / 1000 * kgPerM(sectionKnown(levels[k].lbSection) ? levels[k].lbSection : '600S162-54', o) : 0
      loadPath.studPacks.push({ markupId: m.id, levelId: levels[k].id, studs, kg })
      loadPath.studPackStuds += studs
      loadPath.studPackKg += kg
      if (lvl && kg) {
        lvl.kg.wallsLb += kg
        lvl.kg.total += kg
        lvl.kgPerM2 = lvl.areaM2 > 0 ? lvl.kg.total / lvl.areaM2 : null
      }
    }
  }
  if (loadPath.studPackKg) addSection('stud packs', 0, loadPath.studPackKg)

  // calculation order
  const calculatedLgsKg = levelResults.reduce((sum, l) => sum + l.kg.total, 0)
  const allowanceRows = overrides.allowances.map((row) => {
    const kg = row.value == null ? null : row.mode === 'percent' ? (calculatedLgsKg * row.value) / 100 : row.mode === 'fixed_kg' ? row.value : row.units == null ? null : row.value * row.units
    return { item: row.item, mode: row.mode, value: row.value, kg }
  })
  const allowancesKg = allowanceRows.reduce((sum, r) => sum + (r.kg ?? 0), 0)
  const hrsRaw = hrs.reduce((sum, m) => sum + (m.status === 'accepted' && m.kgPerM != null && m.lengthMm != null && m.quantity != null ? (m.lengthMm / 1000) * m.kgPerM * m.quantity : 0), 0)
  const manualRaw = hrsManual.reduce((sum, m) => sum + (m.directKg == null && m.kgPerM != null && m.lengthMm != null ? (m.lengthMm / 1000) * m.kgPerM * m.quantity : 0), 0)
  const manualDirect = hrsManual.reduce((sum, m) => sum + (m.directKg ?? 0), 0)
  const f = factors(calculatedLgsKg, allowancesKg, hrsRaw + manualRaw, manualDirect, o)
  const hrsMarkupKgTotal = hrs.reduce((sum, m) => sum + (m.kg ?? 0), 0)
  const hrsManualKg = hrsManual.reduce((sum, m) => sum + (m.kg ?? 0), 0)
  const rodsCount = levelResults.reduce((sum, l) => sum + l.anchors.rodsExternal + l.anchors.rodsInternal, 0)
  const rodsLengthM = levelResults.reduce((sum, l) => sum + ((l.anchors.rodsExternal + l.anchors.rodsInternal) * (l.anchors.rodLengthMm ?? 0)) / 1000, 0)
  const totals: SuperTotals = {
    calculatedLgsKg,
    allowancesKg,
    allowanceRows,
    netLgsKg: f.netLgsKg,
    screws: f.screws,
    connectorsAed: f.connectorsAed,
    grossLgsKg: f.grossLgsKg,
    hrsMarkupKg: hrsMarkupKgTotal,
    hrsManualKg,
    hrsKg: f.hrsKg,
    anchorsM10: levelResults.reduce((sum, l) => sum + l.anchors.m10x200, 0),
    anchorsM8: levelResults.reduce((sum, l) => sum + l.anchors.m8x100, 0),
    rodsCount,
    rodsLengthM,
    studPackKg: loadPath.studPackKg,
  }

  const dedupe = new Map<string, SuperFlag>()
  for (const fl of flags) if (!dedupe.has(fl.key)) dedupe.set(fl.key, fl)
  const allFlags = [...dedupe.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1))
  const blocked = allFlags.some((fl) => fl.severity === 'red') || missing.length > 0
  const ambers = allFlags.filter((fl) => fl.severity === 'amber')
  const acknowledgedAll = ambers.every((fl) => overrides.acknowledged.includes(fl.key))
  const gateOpen = !blocked && acknowledgedAll && Boolean(overrides.approvedBy)

  const result: SuperResult = {
    version: `superstructure-engine-${SUPER_VERSION}`,
    parameterSetVersion: SUPER_PARAMETER_SET,
    ranAt: new Date().toISOString(),
    foundationRanAt: foundation.ranAt,
    settings: inputs.settings,
    levels: levelResults,
    flags: allFlags,
    missingInputs: [...new Set(missing)],
    hrsMarkups: hrs,
    hrsManual,
    loadPath,
    totals,
    bySection: [...sectionTotals.values()].sort((a, b) => b.kg - a.kg),
    suspendedFloor,
    boq: [],
    blocked,
    gateOpen,
    notes,
  }
  result.boq = buildBoq(result)
  return result
}

// ——— pitched roof (PR1–PR7, purlins, bracing) ———

type Suggest = (id: string, levelId: string, memberType: string, trigger: string, entityIds: string[], lengthMm: number | null, quantity: number, beamEnds: number) => boolean

function buildPitchedRoof(inputs: SuperInputs, row: LevelRow, s: number, flags: SuperFlag[], missing: string[], suggest: Suggest, addSection: (section: string, mm: number, kg: number) => void, o: Overrides): PitchedRoofResult {
  const heel = P('heel_height_min_mm', o)
  const [pMin, pMax] = PRange('pitch_range_deg')
  const sections: RoofSectionResult[] = []
  const trussSection = row.framingSection
  for (const rs of inputs.roofSections) {
    if (rs.ltMm == null || rs.lengthMm == null || rs.pitchDeg == null) {
      missing.push(`Roof section ${rs.id}: span, length and pitch`)
      continue
    }
    const Lt = rs.ltMm
    const L = rs.lengthMm
    const θ = rs.pitchDeg
    const O = rs.eavesOverhangMm
    const G = rs.vergeOverhangMm
    if (θ < pMin || θ > pMax) flags.push(flag('F-PITCH', row.id, [rs.id], `Roof section ${rs.id} pitch ${θ}° is outside ${pMin}–${pMax}°.`, 'Confirm the pitch from the sections.'))
    if (O > P('max_eaves_overhang_mm', o)) flags.push(flag('F-OVERHANG', row.id, [rs.id], `Eaves overhang ${O} mm on ${rs.id} is over ${P('max_eaves_overhang_mm', o)} mm.`, 'Confirm the overhang support.'))
    if (G > P('max_verge_overhang_mm', o)) flags.push(flag('F-OVERHANG', row.id, [rs.id], `Verge overhang ${G} mm on ${rs.id} is over ${P('max_verge_overhang_mm', o)} mm.`, 'Confirm the verge ladder support.'))
    if (Lt > P('max_span_mm', o) && rs.type !== 'valley_secondary') {
      const accepted = suggest(`HRS-ROOF-${row.id}-${rs.id}`, row.id, 'roof beam', 'F-SPAN (roof)', [rs.id], L, 1, 2)
      if (!accepted) flags.push(flag('F-SPAN', row.id, [rs.id], `Roof section ${rs.id} spans ${(Lt / 1000).toFixed(2)} m with no support (limit ${(P('max_span_mm', o) / 1000).toFixed(1)} m).`, 'Accept the roof beam markup or add a support line.'))
    }

    const res: RoofSectionResult = { id: rs.id, type: rs.type, ltMm: Lt, lengthMm: L, ridgeLengthMm: L, pitchDeg: θ, eavesOverhangMm: O, vergeOverhangMm: G, commonCount: 0, commonMm: 0, jackCount: 0, jackMm: 0, hipRafterCount: 0, hipRafterMm: 0, valleyTrussCount: 0, valleyTrussMm: 0, valleyMemberMm: 0, outriggerCount: 0, outriggerMm: 0, vergeMemberMm: 0, fasciaMm: 0, planAreaM2: 0, slopeAreaM2: 0, eavesM: 0, purlinsM: 0, purlinsKg: 0, bracingTopM: 0, bracingBottomM: 0, bracingKg: 0, framingMm: 0, framingKg: 0 }
    const cos = Math.cos((θ * Math.PI) / 180)
    let gableEnds = 0
    let planAreaMm2 = 0
    let eavesMm = 0
    let slopeMm = 0
    let halves: number[] = []

    if (rs.type === 'gable' || rs.type === 'valley_secondary') {
      const ridge = L
      res.ridgeLengthMm = ridge
      const truss = commonTruss(Lt, O, θ, heel, o)
      res.commonCount = Math.ceil(ridge / s - 1e-9) + 1
      res.commonMm = res.commonCount * truss.totalMm
      gableEnds = rs.type === 'gable' ? 2 : 1
      planAreaMm2 = (L + (rs.type === 'gable' ? 2 : 1) * G) * (Lt + 2 * O)
      eavesMm = 2 * (L + (rs.type === 'gable' ? 2 : 1) * G)
      slopeMm = (Lt / 2 + O) / cos
      halves = [Lt / 2, Lt / 2]
      if (rs.type === 'valley_secondary') {
        const v = valley(Lt, s, θ, o)
        res.valleyTrussCount = v.spans.length
        res.valleyTrussMm = v.spans.reduce((sum, span) => sum + commonTruss(span, 0, θ, heel, o).totalMm, 0)
        res.valleyMemberMm = PBool('valley_member_default', o) ? 2 * v.valleyMemberMm : 0
      }
    } else if (rs.type === 'hip') {
      const B = Lt
      const ridge = Math.max(0, L - (rs.hipEnds * B) / 2)
      res.ridgeLengthMm = ridge
      const truss = commonTruss(Lt, O, θ, heel, o)
      res.commonCount = Math.ceil(ridge / s - 1e-9) + 1
      res.commonMm = res.commonCount * truss.totalMm
      const hip = hipEnd(B, s, O, θ, o)
      const jack = (span: number) => (span < P('min_jack_truss_span_mm', o) ? (span + O) / cos : monoTruss(span, O, 0, θ, heel, o).totalMm)
      const perEnd = hip.endJackSpans.reduce((sum, span) => sum + jack(span), 0) + 2 * hip.sideJackSpans.reduce((sum, span) => sum + jack(span), 0)
      res.jackCount = rs.hipEnds * (hip.endJackSpans.length + 2 * hip.sideJackSpans.length)
      res.jackMm = rs.hipEnds * perEnd
      res.hipRafterCount = rs.hipEnds * hip.hipRafters * hip.hipRafterPly
      res.hipRafterMm = res.hipRafterCount * hip.hipRafterMm
      gableEnds = 2 - rs.hipEnds
      planAreaMm2 = (L + rs.hipEnds * O + gableEnds * G) * (B + 2 * O)
      eavesMm = 2 * (L + gableEnds * G) + rs.hipEnds * (B + 2 * O)
      slopeMm = (B / 2 + O) / cos
      halves = [B / 2, B / 2]
    } else {
      const truss = monoTruss(Lt, O, O, θ, heel, o)
      res.commonCount = Math.ceil(L / s - 1e-9) + 1
      res.commonMm = res.commonCount * truss.totalMm
      gableEnds = 2
      planAreaMm2 = (L + 2 * G) * (Lt + 2 * O)
      eavesMm = 2 * (L + 2 * G)
      slopeMm = (Lt + 2 * O) / cos
      halves = [Lt]
    }

    // PR3 fascia along eaves with an overhang, PR4 verge ladders on gable ends
    res.fasciaMm = O > 0 ? eavesMm : 0
    if (gableEnds > 0) {
      const rakes = gableEnds * (rs.type === 'mono' ? 1 : 2)
      const vg = rs.type === 'mono' ? { rakeMm: slopeMm, outriggers: Math.ceil(slopeMm / s - 1e-9) + 1, outriggerMm: G * (1 + P('verge_backspan_ratio', o)) } : gableVerge(Lt, O, G, θ, s, o)
      res.outriggerCount = G > 0 ? rakes * vg.outriggers : 0
      res.outriggerMm = res.outriggerCount * vg.outriggerMm
      res.vergeMemberMm = rakes * vg.rakeMm
    }

    res.framingMm = res.commonMm + res.jackMm + res.hipRafterMm + res.valleyTrussMm + res.valleyMemberMm + res.outriggerMm + res.vergeMemberMm + res.fasciaMm
    res.framingKg = (res.framingMm / 1000) * kgPerM(trussSection, o)
    addSection(trussSection, res.framingMm, res.framingKg)

    // purlins at 1200 on the slope area plus the eaves length
    res.planAreaM2 = planAreaMm2 / 1e6
    res.eavesM = eavesMm / 1000
    const pur = purlinCalc(res.planAreaM2, θ, res.eavesM, o)
    res.slopeAreaM2 = pur.slopeAreaM2
    res.purlinsM = pur.purlinsM
    res.purlinsKg = pur.purlinsM * kgPerM(PText('purlin_section'), o)
    addSection(PText('purlin_section'), pur.purlinsM * 1000, res.purlinsKg)

    // strap bracing: top chord per slope, bottom chord per half
    const slopes = rs.type === 'mono' ? 1 : 2
    res.bracingTopM = (slopes * bracing(L, slopeMm, o).totalMm) / 1000
    res.bracingBottomM = PBool('bottom_chord_bracing_default', o) ? halves.reduce((sum, w) => sum + bracing(L, w, o).totalMm, 0) / 1000 : 0
    res.bracingKg = (res.bracingTopM + res.bracingBottomM) * kgPerM(PText('strap_section'), o)
    addSection(PText('strap_section'), (res.bracingTopM + res.bracingBottomM) * 1000, res.bracingKg)
    sections.push(res)
  }
  if (inputs.roofSections.length > 1) flags.push(flag('F-ROOF-SHAPE', row.id, inputs.roofSections.map((r) => r.id), 'The roof is built from several sections; check the junctions (valleys, box gutters, unequal pitches) by hand.', 'Acknowledge after checking the roof plan.'))
  return { section: trussSection, sections, framingKg: sections.reduce((sum, r) => sum + r.framingKg, 0), purlinsKg: sections.reduce((sum, r) => sum + r.purlinsKg, 0), bracingKg: sections.reduce((sum, r) => sum + r.bracingKg, 0) }
}

// ——— BOQ ———

function buildBoq(result: SuperResult): SuperBoqLine[] {
  const suspendedFloor = result.suspendedFloor
  const rows: SuperBoqLine[] = []
  let n = 0
  const add = (group: string, description: string, levelId: string | null, lgsSection: string | null, unit: SuperBoqLine['unit'], qty: number | null, basis: string, ruleIds: string[]) => {
    n += 1
    rows.push({ id: `SS-${String(n).padStart(3, '0')}`, code: `SS-${String(n).padStart(3, '0')}`, group, description, levelId, lgsSection, unit, qty, basis, ruleIds })
  }
  for (const lvl of result.levels) {
    if (lvl.skipped) continue
    const lb = lvl.wallRuns.filter((r) => r.status === 'LB')
    const nlb = lvl.wallRuns.filter((r) => r.status === 'NLB')
    const bySection = (runs: WallRunResult[]) => [...new Set(runs.map((r) => r.section))].map((section) => ({ section, runs: runs.filter((r) => r.section === section) }))
    for (const { section, runs } of bySection(lb)) add('LGS walls', `${lvl.name} — load-bearing walls`, lvl.levelId, section, 'kg', runs.reduce((s, r) => s + r.kg, 0), `${runs.length} runs · ${(runs.reduce((s, r) => s + r.lengthMm, 0) / 1000).toFixed(1)} m · H ${lvl.heightMm} mm · ${(runs.reduce((s, r) => s + r.totalMm, 0) / 1000).toFixed(0)} m of section`, ['SS-W1', 'SS-W2', 'SS-W3'])
    for (const { section, runs } of bySection(nlb)) add('LGS walls', `${lvl.name} — non-load-bearing walls`, lvl.levelId, section, 'kg', runs.reduce((s, r) => s + r.kg, 0), `${runs.length} runs · ${(runs.reduce((s, r) => s + r.lengthMm, 0) / 1000).toFixed(1)} m · H ${lvl.heightMm} mm`, ['SS-W1', 'SS-W2', 'SS-W3'])
    const floors = [lvl.floor, lvl.index === 0 ? suspendedFloor : null].filter((f): f is FloorResult => Boolean(f) && f !== null)
    for (const fl of [...new Set(floors)]) {
      const group = fl.isRoof ? 'LGS roof' : 'LGS floors'
      const rate = fl.totalMm > 0 ? fl.kg / (fl.totalMm / 1000) : 0
      if (fl.family === 'truss') {
        add(group, `${fl.label} — floor trusses`, lvl.levelId, fl.section, 'kg', (fl.membersMm / 1000) * rate, `${fl.trussLines.length} truss lines · ${fl.trussLines.reduce((s, l) => s + l.pieces.length, 0)} pieces · ${(fl.membersMm / 1000).toFixed(0)} m${fl.reinforcing ? ' · reinforcing studs' : ''}`, ['SS-F1', 'SS-F2', 'SS-F3'])
        add(group, `${fl.label} — blocking trusses`, lvl.levelId, fl.section, 'kg', (fl.blockingMm / 1000) * rate, `${fl.blocking.reduce((s, b) => s + b.lines, 0)} lines · ${(fl.blockingMm / 1000).toFixed(0)} m`, ['SS-F4'])
      } else {
        add(group, `${fl.label} — C-joists`, lvl.levelId, fl.section, 'kg', (fl.membersMm / 1000) * rate, `${fl.joistZones.reduce((s, z) => s + z.joists, 0)} joists · ${(fl.membersMm / 1000).toFixed(0)} m`, ['SS-J1'])
        add(group, `${fl.label} — joist blocking and rims`, lvl.levelId, fl.section, 'kg', ((fl.blockingMm + fl.rimsMm) / 1000) * rate, `blocking ${(fl.blockingMm / 1000).toFixed(0)} m · rims ${(fl.rimsMm / 1000).toFixed(0)} m`, ['SS-J2', 'SS-J3'])
      }
      if (fl.purlinsKg) add('LGS roof', `${fl.label} — purlins`, lvl.levelId, PText('purlin_section'), 'kg', fl.purlinsKg, `${fl.purlinsM.toFixed(1)} m at ${P('purlin_spacing_mm')} mm`, ['SS-R8'])
      if (fl.bracingKg) add('LGS roof', `${fl.label} — roof plane strap bracing`, lvl.levelId, PText('strap_section'), 'kg', fl.bracingKg, `${fl.bracingM.toFixed(1)} m of strap`, ['SS-R9'])
    }
    for (const b of lvl.balconies.filter((x) => !x.excluded)) add('LGS floors', `Balcony ${b.id}`, lvl.levelId, lvl.floor?.section ?? null, 'kg', b.kg, `${b.members} members × ${b.memberLengthMm} mm · edges ${(b.edgesMm / 1000).toFixed(1)} m`, ['SS-B1', 'SS-B2'])
    if (lvl.roof) {
      for (const r of lvl.roof.sections) {
        add('LGS roof', `Roof ${r.id} (${r.type}) — trusses, jacks, hips, verge and fascia`, lvl.levelId, lvl.roof.section, 'kg', r.framingKg, `${r.commonCount} common · ${r.jackCount} jacks · ${r.hipRafterCount} hip rafter members · ${r.valleyTrussCount} valley · ${r.outriggerCount} outriggers · ${(r.framingMm / 1000).toFixed(0)} m`, ['SS-R1', 'SS-R2', 'SS-R3', 'SS-R4', 'SS-R5', 'SS-R6'])
        add('LGS roof', `Roof ${r.id} — purlins`, lvl.levelId, PText('purlin_section'), 'kg', r.purlinsKg, `slope ${r.slopeAreaM2.toFixed(1)} m² · eaves ${r.eavesM.toFixed(1)} m · ${r.purlinsM.toFixed(1)} m`, ['SS-R8'])
        add('LGS roof', `Roof ${r.id} — strap bracing`, lvl.levelId, PText('strap_section'), 'kg', r.bracingKg, `top ${r.bracingTopM.toFixed(1)} m · bottom ${r.bracingBottomM.toFixed(1)} m`, ['SS-R9'])
      }
    }
    if (lvl.parapet) add('LGS walls', `${lvl.name} — parapets`, lvl.levelId, lvl.parapet.section, 'kg', lvl.parapet.kg, `${lvl.parapet.runs.length} runs · H ${lvl.parapet.heightMm} mm · NLB rules, L-corners only`, ['SS-P1'])
    if (lvl.anchors.m10x200) add('Fixings', `${lvl.name} — M10 × 200 anchors (LB walls)`, lvl.levelId, null, 'nr', lvl.anchors.m10x200, `at ${PN('anchor_lb', 'spacing_mm')} mm, both ends`, ['SS-A1'])
    if (lvl.anchors.m8x100) add('Fixings', `${lvl.name} — M8 × 100 anchors (NLB walls)`, lvl.levelId, null, 'nr', lvl.anchors.m8x100, `at ${PN('anchor_nlb', 'spacing_mm')} mm, both ends`, ['SS-A2'])
    if (lvl.anchors.rodsExternal) add('Fixings', `${lvl.name} — M16 rods, external walls`, lvl.levelId, null, 'nr', lvl.anchors.rodsExternal, `${lvl.anchors.corners} corners + runs at ${P('rod_external_spacing_mm')} mm · rod ${lvl.anchors.rodLengthMm ?? '—'} mm`, ['SS-A3'])
    if (lvl.anchors.rodsInternal) add('Fixings', `${lvl.name} — M16 rods, stacked internal LB walls`, lvl.levelId, null, 'nr', lvl.anchors.rodsInternal, `at ${P('rod_internal_spacing_mm')} mm, both ends · rod ${lvl.anchors.rodLengthMm ?? '—'} mm`, ['SS-A4'])
    add('kg/m²', `${lvl.name} — LGS intensity`, lvl.levelId, null, 'kg/m²', lvl.kgPerM2, `${lvl.kg.total.toFixed(0)} kg over ${lvl.areaM2.toFixed(1)} m²`, ['SS-C6'])
  }
  for (const p of result.loadPath.studPacks) add('LGS walls', `Stud pack under ${p.markupId}`, p.levelId, null, 'kg', p.kg, `${p.studs} studs, full height`, ['SS-H3'])
  for (const m of result.hrsMarkups.filter((x) => x.status === 'accepted')) add('HRS', `${m.memberType} ${m.id}`, m.levelId, m.section, 'kg', m.kg, `${m.quantity ?? '—'} × ${m.lengthMm ?? '—'} mm × ${m.kgPerM ?? '—'} kg/m × 1.05 × 1.05`, ['SS-H1', 'SS-H2'])
  for (const m of result.hrsManual) add('HRS', `${m.description || 'Manual HRS'} ${m.id}`, m.levelId, m.section, 'kg', m.kg, m.directKg != null ? `${m.directKg} kg direct × 1.05` : `${m.quantity} × ${m.lengthMm ?? '—'} mm × ${m.kgPerM ?? '—'} kg/m × 1.05 × 1.05`, ['SS-H2'])
  for (const a of result.totals.allowanceRows) add('Allowances', a.item, null, null, 'kg', a.kg, a.value == null ? 'no value entered' : a.mode === 'percent' ? `${a.value} % of calculated LGS` : a.mode === 'fixed_kg' ? 'fixed kg' : `${a.value} kg per unit`, ['SS-C1', 'SS-C2'])
  const t = result.totals
  add('Totals', 'Calculated LGS', null, null, 'kg', t.calculatedLgsKg, 'walls + floors + balconies + roof + purlins + bracing + parapets', ['SS-C1'])
  add('Totals', 'Net LGS', null, null, 'kg', t.netLgsKg, 'calculated + allowances', ['SS-C2'])
  add('Totals', 'Gross LGS', null, null, 'kg', t.grossLgsKg, `net × (1 + ${P('lgs_wastage')})`, ['SS-C4'])
  add('Totals', 'Screws', null, null, 'nr', t.screws, `${P('screws_per_kg')} per kg net LGS`, ['SS-C3'])
  add('Totals', 'Connectors', null, null, 'AED', t.connectorsAed, `${P('connector_aed_per_kg')} AED per kg net LGS`, ['SS-C3'])
  add('Totals', 'HRS (markups + manual)', null, null, 'kg', t.hrsKg, 'length × kg/m × qty × 1.05 × 1.05; direct kg × 1.05', ['SS-C5'])
  add('Totals', 'M10 × 200 anchors', null, null, 'nr', t.anchorsM10, 'counted items', ['SS-A1'])
  add('Totals', 'M8 × 100 anchors', null, null, 'nr', t.anchorsM8, 'counted items', ['SS-A2'])
  add('Totals', 'M16 rods with 2 nuts', null, null, 'nr', t.rodsCount, `${t.rodsLengthM.toFixed(1)} m of rod`, ['SS-A3', 'SS-A4'])
  return rows
}

export function superBoqCsv(result: SuperResult, header: Record<string, string>) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = Object.entries(header).map(([k, v]) => `${esc(k)},${esc(v)}`)
  lines.push('')
  lines.push(['code', 'group', 'description', 'level', 'section', 'qty', 'unit', 'basis', 'rules'].map(esc).join(','))
  for (const r of result.boq) lines.push([r.code, r.group, r.description, r.levelId ?? '', r.lgsSection ?? '', r.qty == null ? '' : r.unit === 'kg' || r.unit === 'nr' ? Math.round(r.qty) : Math.round(r.qty * 100) / 100, r.unit, r.basis, r.ruleIds.join(' ')].map(esc).join(','))
  lines.push('')
  lines.push(['section', 'm', 'kg'].map(esc).join(','))
  for (const s of result.bySection) lines.push([s.section, Math.round(s.m), Math.round(s.kg)].map(esc).join(','))
  return lines.join('\n')
}
