/**
 * Modules 2–7: support lines, framing zones, framing direction, special areas, review gate overrides,
 * wall classification.
 */
import { mergeIntervals, partition, rectangularDecompose, type RectMm } from './geom.ts'
import { FLAG_DEFS, TIEBREAK_WEIGHTS } from './rules.ts'
import type {
  Axis,
  EngineerOverrides,
  Flag,
  FramingDecision,
  FramingDirection,
  FramingZone,
  PtMm,
  Room,
  ScoreBreakdown,
  SupportLine,
  Wall,
  WallClass,
} from './types.ts'

export interface FramingParams {
  spanMax: number
  spanRatioTolPct: number
  intWallContinuityPct: number
  intWallMaxOpening: number
  cantileverMax: number
  voidMax: number
  shearWallMinLen: number
  nodeSnapTol: number
}

export interface FramingInput {
  levelId: string
  storeyCount: number
  walls: Wall[]
  rooms: Room[]
  footprint: PtMm[]
  hasUpperLevels: boolean
  overrides: EngineerOverrides
  params: FramingParams
  sunkenNoted: boolean
}

export interface FramingOutput {
  supportLines: SupportLine[]
  zones: FramingZone[]
  decisions: FramingDecision[]
  wallClasses: WallClass[]
  flags: Flag[]
  notes: string[]
}

export function makeFlag(code: string, entityIds: string[], message: string): Flag {
  const def = FLAG_DEFS[code] ?? { severity: 'warn' as const, rule: '', action: '' }
  return { code, severity: def.severity, rule: def.rule, entityIds, message, action: def.action }
}

// ——— Module 2: primary support lines ———

function roomsAlongWall(wall: Wall, rooms: Room[], reach: number): { left: Room[]; right: Room[] } {
  const left: Room[] = []
  const right: Room[] = []
  for (const r of rooms) {
    const alongLo = wall.axis === 'h' ? r.bbox.x0 : r.bbox.y0
    const alongHi = wall.axis === 'h' ? r.bbox.x1 : r.bbox.y1
    const overlap = Math.min(alongHi, wall.b) - Math.max(alongLo, wall.a)
    if (overlap < 500) continue
    const acrossLo = wall.axis === 'h' ? r.bbox.y0 : r.bbox.x0
    const acrossHi = wall.axis === 'h' ? r.bbox.y1 : r.bbox.x1
    if (Math.abs(acrossHi - wall.pos) <= reach) left.push(r)
    else if (Math.abs(acrossLo - wall.pos) <= reach) right.push(r)
  }
  return { left, right }
}

export function buildSupportLines(walls: Wall[], rooms: Room[], overrides: EngineerOverrides, snapTol: number): SupportLine[] {
  const picks: Array<{ wall: Wall; category: SupportLine['category'] }> = []
  for (const w of walls) {
    if (w.isExternal) {
      picks.push({ wall: w, category: 'external' }) // SL-01
      continue
    }
    const sides = roomsAlongWall(w, rooms, snapTol)
    const cats = (list: Room[]) => list.map((r) => r.category)
    const core = [...sides.left, ...sides.right].some((r) => r.category === 'stair' || r.category === 'lift' || r.category === 'shaft')
    if (core) {
      picks.push({ wall: w, category: 'core' }) // SL-04
      continue
    }
    const corridorOneSide = cats(sides.left).includes('corridor') !== cats(sides.right).includes('corridor')
    if (corridorOneSide && sides.left.length && sides.right.length) {
      picks.push({ wall: w, category: 'corridor' }) // SL-03
      continue
    }
    if (overrides.promotedWallIds.includes(w.id)) picks.push({ wall: w, category: 'engineer' })
  }
  // SL-05: merge collinear segments within snap tolerance.
  const lines: SupportLine[] = []
  for (const b of overrides.beams ?? []) lines.push({ id: b.id, wallIds: [], category: 'engineer', axis: b.axis, pos: b.pos, a: Math.min(b.a, b.b), b: Math.max(b.a, b.b) })
  for (const p of picks) {
    const w = p.wall
    const same = lines.find((l) => l.axis === w.axis && Math.abs(l.pos - w.pos) <= snapTol && l.category === p.category && Math.min(l.b, w.b) - Math.max(l.a, w.a) >= -snapTol)
    if (same) {
      same.a = Math.min(same.a, w.a)
      same.b = Math.max(same.b, w.b)
      same.wallIds.push(w.id)
    } else {
      lines.push({ id: `SL-${lines.length + 1}-${w.id}`, wallIds: [w.id], category: p.category, axis: w.axis, pos: w.pos, a: w.a, b: w.b })
    }
  }
  return lines
}

// ——— Module 3: framing zones ———

function zoneId(levelId: string, r: RectMm) {
  return `Z-${levelId}-${Math.round(r.x0 / 10)}-${Math.round(r.y0 / 10)}-${Math.round(r.x1 / 10)}-${Math.round(r.y1 / 10)}`
}

export function buildZones(levelId: string, footprint: PtMm[], lines: SupportLine[], rooms: Room[], snapTol: number): FramingZone[] {
  const { grid, regions } = partition(
    footprint,
    lines.map((l) => ({ axis: l.axis, pos: l.pos, a: l.a, b: l.b })),
    Math.min(snapTol, 120),
  )
  const zones: FramingZone[] = []
  for (const region of regions) {
    const bboxArea = (region.bbox.x1 - region.bbox.x0) * (region.bbox.y1 - region.bbox.y0)
    if (region.areaMm2 < 1e6 || region.areaMm2 < bboxArea * 0.12) continue
    const rects = rectangularDecompose(grid, region).filter((r) => (r.x1 - r.x0) * (r.y1 - r.y0) >= 1e6 && Math.min(r.x1 - r.x0, r.y1 - r.y0) >= 600)
    for (const r of rects) {
      const inRect = rooms.filter((room) => {
        const cx = (room.bbox.x0 + room.bbox.x1) / 2
        const cy = (room.bbox.y0 + room.bbox.y1) / 2
        return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1
      })
      const bounding = lines.filter((l) => {
        if (l.axis === 'h') return (Math.abs(l.pos - r.y0) <= snapTol || Math.abs(l.pos - r.y1) <= snapTol) && Math.min(l.b, r.x1) - Math.max(l.a, r.x0) > 300
        return (Math.abs(l.pos - r.x0) <= snapTol || Math.abs(l.pos - r.x1) <= snapTol) && Math.min(l.b, r.y1) - Math.max(l.a, r.y0) > 300
      })
      zones.push({
        id: zoneId(levelId, r),
        levelId,
        bbox: { x0: Math.round(r.x0), y0: Math.round(r.y0), x1: Math.round(r.x1), y1: Math.round(r.y1) },
        Lx: Math.round(r.x1 - r.x0),
        Ly: Math.round(r.y1 - r.y0),
        boundingSupportIds: bounding.map((l) => l.id),
        voidIds: inRect.filter((room) => ['stair', 'lift', 'shaft', 'void'].includes(room.category)).map((room) => room.id),
        roomIds: inRect.map((room) => room.id),
      })
    }
  }
  return zones
}

// ——— Module 4: framing direction ———

/** Walls that would receive joists running in `direction` inside the zone. */
function receivingWalls(zone: FramingZone, direction: FramingDirection, walls: Wall[], snapTol: number): Wall[] {
  // joists along y bear on the horizontal walls at y0/y1; along x on the vertical walls at x0/x1
  const axis: Axis = direction === 'y' ? 'h' : 'v'
  const edges = direction === 'y' ? [zone.bbox.y0, zone.bbox.y1] : [zone.bbox.x0, zone.bbox.x1]
  const lo = direction === 'y' ? zone.bbox.x0 : zone.bbox.y0
  const hi = direction === 'y' ? zone.bbox.x1 : zone.bbox.y1
  return walls.filter((w) => w.axis === axis && edges.some((e) => Math.abs(w.pos - e) <= snapTol) && Math.min(w.b, hi) - Math.max(w.a, lo) > 300)
}

function intermediateWall(zone: FramingZone, walls: Wall[], lines: SupportLine[], p: FramingParams): Wall | null {
  const short = Math.min(zone.Lx, zone.Ly)
  const longAxis: Axis = zone.Lx >= zone.Ly ? 'h' : 'v' // wall parallel to the longer side
  const zoneLen = Math.max(zone.Lx, zone.Ly)
  const across = (w: Wall) => (longAxis === 'h' ? [zone.bbox.y0, zone.bbox.y1] : [zone.bbox.x0, zone.bbox.x1]).map((e) => Math.abs(w.pos - e))
  const candidates = walls.filter((w) => {
    if (w.axis !== longAxis) return false
    if (lines.some((l) => l.wallIds.includes(w.id))) return false
    const [d0, d1] = across(w)
    if (d0 < 300 || d1 < 300 || d0 + d1 > short + 300) return false // must lie inside the zone
    const lo = longAxis === 'h' ? zone.bbox.x0 : zone.bbox.y0
    const hi = longAxis === 'h' ? zone.bbox.x1 : zone.bbox.y1
    const cover = Math.min(w.b, hi) - Math.max(w.a, lo)
    if (cover < (p.intWallContinuityPct / 100) * zoneLen) return false
    if (w.openings.some((o) => o.width > p.intWallMaxOpening)) return false
    return d0 <= p.spanMax && d1 <= p.spanMax
  })
  if (!candidates.length) return null
  const mid = short / 2
  candidates.sort((a, b) => Math.abs(across(a)[0] - mid) - Math.abs(across(b)[0] - mid))
  return candidates[0]
}

function score(zone: FramingZone, direction: FramingDirection, walls: Wall[], lines: SupportLine[], rooms: Room[], hasUpper: boolean, snapTol: number, decisions: Map<string, FramingDirection>): ScoreBreakdown {
  const recv = receivingWalls(zone, direction, walls, snapTol)
  const primary = recv.filter((w) => lines.some((l) => l.wallIds.includes(w.id) && ['external', 'party', 'corridor', 'core'].includes(l.category)))
  const parts: ScoreBreakdown['parts'] = []
  const add = (criterion: string, key: string, s: number) => {
    const weight = TIEBREAK_WEIGHTS[key] ?? 0
    parts.push({ criterion, score: Math.round(s * 100) / 100, weight, points: Math.round(s * weight * 10) / 10 })
  }
  add('Bears on primary support lines', 'bears_on_primary_support', recv.length === 0 ? 0 : primary.length >= 2 ? 1 : primary.length === 1 ? 0.5 : 0)
  add('Vertical continuity', 'vertical_continuity', hasUpper ? (recv.length ? recv.filter((w) => w.stacksOnWallId).length / recv.length : 0) : 0)
  add('Bearing wall quality', 'bearing_wall_quality', recv.length ? 1 - recv.reduce((s, w) => s + w.openingRatio, 0) / recv.length : 0)
  const same = [...decisions.values()].filter((d) => d === direction).length
  const other = [...decisions.values()].filter((d) => d !== direction).length
  add('Consistency', 'consistency', decisions.size === 0 ? 0.5 : same >= other ? 1 : 0)
  const wetRooms = rooms.filter((r) => r.category === 'wet')
  const touchesWet = recv.some((w) => wetRooms.some((r) => {
    const acrossLo = w.axis === 'h' ? r.bbox.y0 : r.bbox.x0
    const acrossHi = w.axis === 'h' ? r.bbox.y1 : r.bbox.x1
    const alongLo = w.axis === 'h' ? r.bbox.x0 : r.bbox.y0
    const alongHi = w.axis === 'h' ? r.bbox.x1 : r.bbox.y1
    return (Math.abs(acrossLo - w.pos) <= snapTol || Math.abs(acrossHi - w.pos) <= snapTol) && Math.min(alongHi, w.b) - Math.max(alongLo, w.a) > 300
  }))
  add('Avoids wet-area walls', 'avoids_wet_area_walls', touchesWet ? 0 : 1)
  const span = direction === 'y' ? zone.Ly : zone.Lx
  add('Shorter span', 'shorter_span', span <= Math.min(zone.Lx, zone.Ly) ? 1 : 0)
  return { direction, total: Math.round(parts.reduce((s, x) => s + x.points, 0) * 10) / 10, parts }
}

/** An engineer beam lands on the nearest perpendicular wall at each end (within 2 m) so it closes the zone it crosses. */
function snapBeamEnds(beam: EngineerOverrides['beams'][number], walls: Wall[], reach = 2000) {
  const perps = walls.filter((w) => w.axis !== beam.axis && w.a - 300 <= beam.pos && w.b + 300 >= beam.pos)
  const snap = (end: number, dir: -1 | 1) => {
    let best = end
    let bestD = reach
    for (const w of perps) {
      const d = (w.pos - end) * dir
      if (d >= -300 && d <= bestD) {
        bestD = d
        best = w.pos
      }
    }
    return best
  }
  return { ...beam, a: snap(Math.min(beam.a, beam.b), -1), b: snap(Math.max(beam.a, beam.b), 1) }
}

export function runFraming(input: FramingInput): FramingOutput {
  const { levelId, walls, rooms, footprint, params: p } = input
  const beams = (input.overrides.beams ?? []).map((b) => snapBeamEnds(b, walls))
  // A wall that carries a beam end is a support (WC-03); promote it so the beam closes its zone.
  const bearing = walls
    .filter((w) => beams.some((b) => w.axis !== b.axis && w.a - 300 <= b.pos && w.b + 300 >= b.pos && (Math.abs(w.pos - b.a) <= 300 || Math.abs(w.pos - b.b) <= 300)))
    .map((w) => w.id)
  const overrides: EngineerOverrides = { ...input.overrides, beams, promotedWallIds: [...new Set([...input.overrides.promotedWallIds, ...bearing])] }
  const flags: Flag[] = []
  const notes: string[] = []
  let lines = buildSupportLines(walls, rooms, overrides, p.nodeSnapTol)
  let zones: FramingZone[] = []
  const decisions: FramingDecision[] = []

  const suspended = input.storeyCount >= 2
  if (!suspended) {
    notes.push('Single storey: no suspended floor to frame. Roof framing is out of scope in v0.1 (SA-05); external walls are load-bearing for foundations (WC-02). Promote internal walls at the review gate if the roof bears on them.')
    zones = buildZones(levelId, footprint, lines, rooms, p.nodeSnapTol)
    for (const z of zones) decisions.push({ zoneId: z.id, direction: null, spanMm: null, receivingWallIds: [], case: 'none', scoreBreakdown: [], status: 'none', ruleIds: ['SA-05'], note: 'No floor framing on a single-storey plan.' })
  } else {
    if (!input.hasUpperLevels) flags.push(makeFlag('F-NO-STACK', [levelId], 'Only one plan was uploaded. Upper levels are assumed to stack on this plan; vertical continuity scores 0.'))
    // FD-02 may promote walls and split zones; iterate until stable.
    const promoted = new Set<string>(overrides.promotedWallIds)
    for (let pass = 0; pass < 6; pass++) {
      lines = buildSupportLines(walls, rooms, { ...overrides, promotedWallIds: [...promoted] }, p.nodeSnapTol)
      zones = buildZones(levelId, footprint, lines, rooms, p.nodeSnapTol)
      let changed = false
      for (const z of zones) {
        const short = Math.min(z.Lx, z.Ly)
        if (short > p.spanMax && !overrides.directions[z.id]) {
          const w = intermediateWall(z, walls, lines, p)
          if (w && !promoted.has(w.id)) {
            promoted.add(w.id)
            changed = true
            notes.push(`FD-02: promoted ${w.id} (${w.length} mm, openings ≤ ${Math.max(0, ...w.openings.map((o) => o.width))} mm) to split zone ${z.id}.`)
          }
        }
      }
      if (!changed) break
    }
    const chosen = new Map<string, FramingDirection>()
    for (const z of zones) {
      const corridorZone = z.roomIds.length > 0 && z.roomIds.every((id) => rooms.find((r) => r.id === id)?.category === 'corridor')
      const [short, long] = [Math.min(z.Lx, z.Ly), Math.max(z.Lx, z.Ly)]
      const shortDir: FramingDirection = z.Lx <= z.Ly ? 'x' : 'y' // joists span the short dimension
      const forced = overrides.directions[z.id]
      let d: FramingDecision
      if (forced) {
        const span = forced === 'x' ? z.Lx : z.Ly
        d = { zoneId: z.id, direction: forced, spanMm: span, receivingWallIds: receivingWalls(z, forced, walls, p.nodeSnapTol).map((w) => w.id), case: short > p.spanMax ? 'B' : long > p.spanMax ? 'A' : 'C', scoreBreakdown: [], status: 'engineer-set', ruleIds: ['RG-02'], note: 'Direction set by the engineer at the review gate.' }
      } else if (corridorZone) {
        d = { zoneId: z.id, direction: shortDir, spanMm: short, receivingWallIds: receivingWalls(z, shortDir, walls, p.nodeSnapTol).map((w) => w.id), case: 'corridor', scoreBreakdown: [], status: 'auto', ruleIds: ['SA-01'], note: 'Corridor: framed across its width.' }
      } else if (short > p.spanMax) {
        flags.push(makeFlag('F-SPAN', [z.id], `Zone ${Math.round(z.Lx)} × ${Math.round(z.Ly)} mm: both spans exceed P.span_max ${p.spanMax} mm and no intermediate wall qualifies (≥ ${p.intWallContinuityPct} % continuity, openings ≤ ${p.intWallMaxOpening} mm).`))
        d = { zoneId: z.id, direction: null, spanMm: null, receivingWallIds: [], case: 'B', scoreBreakdown: [], status: 'flagged', ruleIds: ['FD-02'], note: 'Needs an intermediate beam or an engineer-set support.' }
      } else if (long > p.spanMax) {
        d = { zoneId: z.id, direction: shortDir, spanMm: short, receivingWallIds: receivingWalls(z, shortDir, walls, p.nodeSnapTol).map((w) => w.id), case: 'A', scoreBreakdown: [], status: 'auto', ruleIds: ['FD-01'], note: `Only the ${short} mm span is within P.span_max.` }
      } else if (((long - short) / short) * 100 > p.spanRatioTolPct) {
        d = { zoneId: z.id, direction: shortDir, spanMm: short, receivingWallIds: receivingWalls(z, shortDir, walls, p.nodeSnapTol).map((w) => w.id), case: 'C', scoreBreakdown: [], status: 'auto', ruleIds: ['FD-03'], note: `Spans differ by ${Math.round(((long - short) / short) * 100)} % > ${p.spanRatioTolPct} %; shorter span wins.` }
      } else {
        const sx = score(z, 'x', walls, lines, rooms, input.hasUpperLevels, p.nodeSnapTol, chosen)
        const sy = score(z, 'y', walls, lines, rooms, input.hasUpperLevels, p.nodeSnapTol, chosen)
        const win: FramingDirection = sx.total >= sy.total ? 'x' : 'y'
        d = { zoneId: z.id, direction: win, spanMm: win === 'x' ? z.Lx : z.Ly, receivingWallIds: receivingWalls(z, win, walls, p.nodeSnapTol).map((w) => w.id), case: 'C', scoreBreakdown: [sx, sy], status: 'tie-break', ruleIds: ['FD-04'], note: `Tie-break ${sx.total} (x) vs ${sy.total} (y).` }
      }
      if (d.direction) chosen.set(z.id, d.direction)
      decisions.push(d)
    }
  }

  // Module 5: special areas
  for (const r of rooms) {
    const w = r.bbox.x1 - r.bbox.x0
    const h = r.bbox.y1 - r.bbox.y0
    if (r.category === 'balcony' && Math.min(w, h) > p.cantileverMax) flags.push(makeFlag('F-CANT', [r.id], `${r.label}: cantilever ${Math.min(w, h)} mm > P.cantilever_max ${p.cantileverMax} mm.`))
    if (['stair', 'lift', 'shaft', 'void'].includes(r.category) && suspended && Math.max(w, h) > p.voidMax) flags.push(makeFlag('F-VOID', [r.id], `${r.label}: opening side ${Math.max(w, h)} mm > P.void_max ${p.voidMax} mm.`))
  }
  if (input.sunkenNoted) flags.push(makeFlag('F-SUNKEN', [levelId], 'The plan notes a sunken or dropped area.'))

  // Module 7: wall classification
  const receiving = new Set(decisions.flatMap((d) => (d.status === 'flagged' ? [] : d.receivingWallIds)))
  const wallClasses: WallClass[] = []
  const classOf = new Map<string, WallClass>()
  for (const w of walls) {
    const forced = overrides.wallClasses[w.id]
    let c: WallClass
    if (forced) c = { wallId: w.id, class: forced, reasonRuleIds: ['RG-02'], reason: 'Set by the engineer at the review gate.' }
    else if (receiving.has(w.id)) c = { wallId: w.id, class: 'LB', reasonRuleIds: ['WC-01'], reason: 'Receives joists from an approved framing decision.' }
    else if (w.isExternal) c = { wallId: w.id, class: 'LB', reasonRuleIds: ['WC-02'], reason: 'External wall: load-bearing for foundation purposes.' }
    else if (lines.some((l) => l.wallIds.includes(w.id) && (l.category === 'core' || l.category === 'engineer'))) c = { wallId: w.id, class: 'LB', reasonRuleIds: ['WC-03'], reason: 'Supports a void trimmer or was promoted as a support line.' }
    else c = { wallId: w.id, class: 'NLB', reasonRuleIds: ['WC-06'], reason: 'No joists land on it and it is not external.' }
    classOf.set(w.id, c)
  }
  // WC-04 shear walls: per direction, solid length ≥ min, lowest opening ratio, both sides of the plan centre.
  const centre = { x: (Math.min(...footprint.map((q) => q.x)) + Math.max(...footprint.map((q) => q.x))) / 2, y: (Math.min(...footprint.map((q) => q.y)) + Math.max(...footprint.map((q) => q.y))) / 2 }
  for (const axis of ['h', 'v'] as const) {
    const cands = walls.filter((w) => w.axis === axis && w.solidLength >= p.shearWallMinLen).sort((a, b) => a.openingRatio - b.openingRatio || b.solidLength - a.solidLength)
    const sideOf = (w: Wall) => (axis === 'h' ? (w.pos < centre.y ? -1 : 1) : w.pos < centre.x ? -1 : 1)
    const picked: Wall[] = []
    for (const side of [-1, 1]) {
      const best = cands.find((w) => sideOf(w) === side && (classOf.get(w.id)?.class === 'LB' || true))
      if (best) picked.push(best)
    }
    if (picked.length < 2) flags.push(makeFlag('F-LATERAL', [levelId], `No qualifying shear wall (solid ≥ ${p.shearWallMinLen} mm) on both sides of the plan in the ${axis === 'h' ? 'x' : 'y'} direction.`))
    for (const w of picked) {
      const c = classOf.get(w.id)!
      if (c.class === 'NLB') classOf.set(w.id, { wallId: w.id, class: 'SHEAR', reasonRuleIds: ['WC-04'], reason: `Selected as shear wall (${axis === 'h' ? 'x' : 'y'} direction): solid ${w.solidLength} mm, opening ratio ${w.openingRatio}.` })
      else c.reasonRuleIds = [...new Set([...c.reasonRuleIds, 'WC-04'])]
    }
  }
  for (const w of walls) wallClasses.push(classOf.get(w.id)!)

  return { supportLines: lines, zones, decisions, wallClasses, flags, notes }
}

/** Ground-floor LB lines: LB + SHEAR centrelines merged along each axis (input to Modules 9–11). */
export function lbLines(walls: Wall[], classes: WallClass[], snapTol: number) {
  const lb = walls.filter((w) => ['LB', 'SHEAR'].includes(classes.find((c) => c.wallId === w.id)?.class ?? 'NLB'))
  const out: Array<{ id: string; axis: Axis; pos: number; a: number; b: number; wallIds: string[]; external: boolean }> = []
  for (const axis of ['h', 'v'] as const) {
    const groups: Wall[][] = []
    for (const w of lb.filter((x) => x.axis === axis).sort((p, q) => p.pos - q.pos)) {
      const g = groups.find((grp) => Math.abs(grp[0].pos - w.pos) <= snapTol / 2)
      if (g) g.push(w)
      else groups.push([w])
    }
    for (const g of groups) {
      const pos = Math.round(g.reduce((s, w) => s + w.pos * w.length, 0) / g.reduce((s, w) => s + w.length, 0))
      // footings continue under door openings, so bridge gaps up to the snap tolerance × 10 (3 m)
      for (const iv of mergeIntervals(g.map((w) => [w.a, w.b] as [number, number]), snapTol * 10)) {
        const members = g.filter((w) => w.b >= iv[0] && w.a <= iv[1])
        out.push({ id: `LB-${axis}-${Math.round(pos / 10)}-${Math.round(iv[0] / 10)}`, axis, pos, a: iv[0], b: iv[1], wallIds: members.map((w) => w.id), external: members.some((w) => w.isExternal) })
      }
    }
  }
  return out
}
