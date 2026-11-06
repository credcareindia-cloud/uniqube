/**
 * Module 1 (PI-05 … PI-07): walls, openings and rooms from calibrated plan geometry.
 */
import type { GeoSegment, GridAxes, PageGeometry, Region as PtRegion } from '../geometryCore.ts'
import { bufferLine, distanceToPolygonEdge, mergeIntervals, partition, pointInPolygon, type Interval, type RectMm } from './geom.ts'
import { roomCategoryFor } from './rules.ts'
import type { Axis, Opening, PtMm, Room, Wall } from './types.ts'

export interface WallExtractionInput {
  geo: PageGeometry
  mmPerPt: number
  /** Plan region in PDF points; its top-left is the mm origin. */
  region: PtRegion
  /** Footprint polygon in PDF points (outer wall face). */
  footprintPt: PtMm[]
  gridAxes: GridAxes
  levelId: string
  wallThkMin: number
  wallThkMax: number
  nodeSnapTol: number
}

export interface WallExtraction {
  walls: Wall[]
  rooms: Room[]
  footprintMm: PtMm[]
  confidence: number
  notes: string[]
}

const MIN_WALL_LEN_MM = 1000
const MIN_PAIR_OVERLAP_MM = 600
const MAX_OPENING_MM = 2500
const FACE_MERGE_GAP_MM = 100

export function extractWalls(input: WallExtractionInput): WallExtraction {
  const { geo, mmPerPt, region, gridAxes, levelId } = input
  const toMm = (pt: number, origin: number) => (pt - origin) * mmPerPt
  const footprintMm = input.footprintPt.map((p) => ({ x: toMm(p.x, region.x0), y: toMm(p.y, region.y0) }))
  const notes: string[] = []

  // Dimension lines: drop segments collinear with and overlapping a matched dimension segment.
  const dimSegs = geo.dimensions.filter((d) => d.segment).map((d) => d.segment!)
  const onDimension = (s: GeoSegment, axis: Axis) =>
    dimSegs.some((d) => {
      if (axis === 'h') {
        if (Math.abs(d.y1 - d.y2) >= 0.6 || Math.abs(d.y1 - s.y1) >= 1.5) return false
        const o = Math.min(Math.max(d.x1, d.x2), Math.max(s.x1, s.x2)) - Math.max(Math.min(d.x1, d.x2), Math.min(s.x1, s.x2))
        return o > 0.5 * s.len
      }
      if (Math.abs(d.x1 - d.x2) >= 0.6 || Math.abs(d.x1 - s.x1) >= 1.5) return false
      const o = Math.min(Math.max(d.y1, d.y2), Math.max(s.y1, s.y2)) - Math.max(Math.min(d.y1, d.y2), Math.min(s.y1, s.y2))
      return o > 0.5 * s.len
    })
  // Grid lines: on a grid axis and running out past the footprint to the bubbles.
  const fpX0 = Math.min(...input.footprintPt.map((p) => p.x))
  const fpX1 = Math.max(...input.footprintPt.map((p) => p.x))
  const fpY0 = Math.min(...input.footprintPt.map((p) => p.y))
  const fpY1 = Math.max(...input.footprintPt.map((p) => p.y))
  const near = (list: number[], v: number, tol: number) => list.some((x) => Math.abs(x - v) < tol)
  const isGridLine = (s: GeoSegment, axis: Axis) =>
    axis === 'h'
      ? near(gridAxes.horizontalY, s.y1, 1.5) && (Math.min(s.x1, s.x2) < fpX0 - 2 || Math.max(s.x1, s.x2) > fpX1 + 2)
      : near(gridAxes.verticalX, s.x1, 1.5) && (Math.min(s.y1, s.y2) < fpY0 - 2 || Math.max(s.y1, s.y2) > fpY1 + 2)
  const inRegion = (s: GeoSegment) =>
    Math.min(s.x1, s.x2) >= region.x0 && Math.max(s.x1, s.x2) <= region.x1 && Math.min(s.y1, s.y2) >= region.y0 && Math.max(s.y1, s.y2) <= region.y1

  const walls: Wall[] = []
  for (const axis of ['h', 'v'] as const) {
    const segs = geo.segments.filter((s) => {
      if (!inRegion(s) || s.len * mmPerPt < 150) return false
      if (axis === 'h' ? Math.abs(s.y1 - s.y2) >= 0.3 : Math.abs(s.x1 - s.x2) >= 0.3) return false
      return !onDimension(s, axis) && !isGridLine(s, axis)
    })
    // Face rows: all collinear segments at one position, merged into intervals.
    const buckets = new Map<number, Interval[]>()
    for (const s of segs) {
      const pos = axis === 'h' ? s.y1 : s.x1
      const key = Math.round(pos * 4) / 4
      const a = axis === 'h' ? Math.min(s.x1, s.x2) : Math.min(s.y1, s.y2)
      const b = axis === 'h' ? Math.max(s.x1, s.x2) : Math.max(s.y1, s.y2)
      const list = buckets.get(key) ?? []
      list.push([a, b])
      buckets.set(key, list)
    }
    const rows = [...buckets.entries()].map(([pos, ivs]) => ({ pos, ivs: mergeIntervals(ivs, FACE_MERGE_GAP_MM / mmPerPt) })).sort((p, q) => p.pos - q.pos)

    // Candidate wall = two parallel face rows a wall thickness apart with overlapping extent.
    type Cand = { pos: number; thkMm: number; a: number; b: number; faceA: number; faceB: number }
    const cands: Cand[] = []
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const gapMm = (rows[j].pos - rows[i].pos) * mmPerPt
        if (gapMm < input.wallThkMin) continue
        if (gapMm > input.wallThkMax) break
        for (const p of rows[i].ivs) {
          for (const q of rows[j].ivs) {
            const a = Math.max(p[0], q[0])
            const b = Math.min(p[1], q[1])
            if ((b - a) * mmPerPt < MIN_PAIR_OVERLAP_MM) continue
            cands.push({ pos: (rows[i].pos + rows[j].pos) / 2, thkMm: gapMm, a, b, faceA: rows[i].pos, faceB: rows[j].pos })
          }
        }
      }
    }
    // Longest first; among similar lengths the thinner pairing wins (face-to-face, not face-to-finish).
    cands.sort((p, q) => Math.round((q.b - q.a) / 10) - Math.round((p.b - p.a) / 10) || p.thkMm - q.thkMm)
    const accepted: Cand[] = []
    for (const c of cands) {
      const dup = accepted.some((w) => {
        if (Math.abs(w.pos - c.pos) * mmPerPt >= (w.thkMm + c.thkMm) / 2 + 80) return false
        const overlap = Math.min(w.b, c.b) - Math.max(w.a, c.a)
        return overlap * mmPerPt > 200
      })
      if (!dup) accepted.push(c)
    }

    // Chain collinear pieces; the gap between pieces is an opening.
    const groups: Cand[][] = []
    for (const c of [...accepted].sort((p, q) => p.pos - q.pos || p.a - q.a)) {
      const g = groups.find((grp) => Math.abs(grp[0].pos - c.pos) * mmPerPt < 120 && Math.abs(grp[0].thkMm - c.thkMm) < 100)
      if (g) g.push(c)
      else groups.push([c])
    }
    for (const g of groups) {
      g.sort((p, q) => p.a - q.a)
      let run: Cand[] = [g[0]]
      const flush = () => {
        const a = run[0].a
        const b = Math.max(...run.map((r) => r.b))
        const lengthMm = (b - a) * mmPerPt
        if (lengthMm < MIN_WALL_LEN_MM) return
        const posMm = axis === 'h' ? toMm(run[0].pos, region.y0) : toMm(run[0].pos, region.x0)
        const aMm = axis === 'h' ? toMm(a, region.x0) : toMm(a, region.y0)
        const bMm = axis === 'h' ? toMm(b, region.x0) : toMm(b, region.y0)
        const thk = Math.round(run.reduce((s, r) => s + r.thkMm, 0) / run.length)
        const id = `W-${axis}-${Math.round(posMm / 10)}-${Math.round(aMm / 10)}-${Math.round(bMm / 10)}`
        const openings: Opening[] = []
        for (let k = 1; k < run.length; k++) {
          const gapStart = run[k - 1].b
          const gapEnd = run[k].a
          const width = (gapEnd - gapStart) * mmPerPt
          if (width < 300) continue
          openings.push({
            id: `${id}-O${k}`,
            wallId: id,
            type: width <= 1300 ? 'door' : width <= MAX_OPENING_MM ? 'window' : 'gap',
            width: Math.round(width),
            position: Math.round(axis === 'h' ? toMm(gapStart, region.x0) : toMm(gapStart, region.y0)),
          })
        }
        const openingTotal = openings.reduce((s, o) => s + o.width, 0)
        const centreMid: PtMm = axis === 'h' ? { x: (aMm + bMm) / 2, y: posMm } : { x: posMm, y: (aMm + bMm) / 2 }
        const centreA: PtMm = axis === 'h' ? { x: aMm + 200, y: posMm } : { x: posMm, y: aMm + 200 }
        const centreB: PtMm = axis === 'h' ? { x: bMm - 200, y: posMm } : { x: posMm, y: bMm - 200 }
        const edgeDist = Math.min(distanceToPolygonEdge(centreMid, footprintMm), distanceToPolygonEdge(centreA, footprintMm), distanceToPolygonEdge(centreB, footprintMm))
        const inside = pointInPolygon(centreMid, footprintMm) || pointInPolygon(centreA, footprintMm) || pointInPolygon(centreB, footprintMm)
        const isExternal = edgeDist <= thk / 2 + input.nodeSnapTol
        if (!inside && !isExternal) return
        walls.push({
          id,
          levelId,
          axis,
          pos: Math.round(posMm),
          a: Math.round(aMm),
          b: Math.round(bMm),
          thickness: thk,
          length: Math.round(lengthMm),
          isExternal,
          wallTypeTag: null,
          openings,
          openingRatio: Math.round((openingTotal / lengthMm) * 1000) / 1000,
          solidLength: Math.round(lengthMm - openingTotal),
          stacksOnWallId: null,
          source: { pagePt: { pos: Math.round(run[0].pos * 10) / 10, a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10 }, faceGapPt: Math.round(((run[0].faceB - run[0].faceA) * 100)) / 100 },
        })
      }
      for (let k = 1; k < g.length; k++) {
        const gap = (g[k].a - run[run.length - 1].b) * mmPerPt
        if (gap <= MAX_OPENING_MM) run.push(g[k])
        else {
          flush()
          run = [g[k]]
        }
      }
      flush()
    }
  }

  // Drop a wall that shadows a longer parallel wall (finish lines, skirting, tiling offsets).
  for (let i = walls.length - 1; i >= 0; i--) {
    const w = walls[i]
    const shadowed = walls.some((o) => {
      if (o === w || o.axis !== w.axis || o.length <= w.length) return false
      if (Math.abs(o.pos - w.pos) > (o.thickness + w.thickness) / 2 + 80) return false
      return Math.min(o.b, w.b) - Math.max(o.a, w.a) >= 0.7 * w.length
    })
    if (shadowed) walls.splice(i, 1)
  }

  // External walls snap onto the footprint edge so corners close; internal walls extend to meet the nearest wall.
  snapWallEnds(walls, footprintMm, input.nodeSnapTol)

  // Rooms: partition the footprint by all walls; label each region by the room text inside it.
  const rooms = buildRooms(walls, footprintMm, geo, mmPerPt, region, levelId)

  const external = walls.filter((w) => w.isExternal)
  const extLen = external.reduce((s, w) => s + w.length, 0)
  const confidence = Math.max(0.2, Math.min(1, extLen / Math.max(1, polygonPerimeterMm(footprintMm))))
  if (!walls.length) notes.push('No wall pairs found inside the plan region.')
  else notes.push(`${walls.length} walls (${external.length} external, ${walls.length - external.length} internal), ${rooms.length} rooms.`)
  if (confidence < 0.8) notes.push(`External walls cover ${Math.round(confidence * 100)} % of the footprint perimeter; some faces were not read as pairs.`)
  return { walls, rooms, footprintMm, confidence, notes }
}

function polygonPerimeterMm(poly: PtMm[]) {
  let p = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    p += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return p
}

/** Extend wall ends to the nearest perpendicular wall centreline (within tol) so junctions close. */
function snapWallEnds(walls: Wall[], footprint: PtMm[], tol: number) {
  const bbox = { x0: Math.min(...footprint.map((p) => p.x)), x1: Math.max(...footprint.map((p) => p.x)), y0: Math.min(...footprint.map((p) => p.y)), y1: Math.max(...footprint.map((p) => p.y)) }
  for (const w of walls) {
    const perps = walls.filter((o) => o.axis !== w.axis)
    for (const end of ['a', 'b'] as const) {
      const value = w[end]
      let best: number | null = null
      for (const o of perps) {
        // o.pos is along w's axis; o spans o.a..o.b across w's axis and must reach w.pos
        if (o.a - tol > w.pos || o.b + tol < w.pos) continue
        const d = Math.abs(o.pos - value)
        if (d <= Math.max(tol, o.thickness) && (best == null || d < Math.abs(best - value))) best = o.pos
      }
      if (best != null) w[end] = best
      else if (w.isExternal) {
        // snap to footprint bbox edge when the wall runs out near it
        const edge = w.axis === 'h' ? (end === 'a' ? bbox.x0 : bbox.x1) : end === 'a' ? bbox.y0 : bbox.y1
        if (Math.abs(edge - value) <= tol * 2) w[end] = Math.round(edge)
      }
    }
    w.length = Math.round(w.b - w.a)
    const openingTotal = w.openings.reduce((s, o) => s + o.width, 0)
    w.solidLength = Math.round(w.length - openingTotal)
    w.openingRatio = Math.round((openingTotal / Math.max(1, w.length)) * 1000) / 1000
    if (w.isExternal) {
      // external wall centrelines sit half a thickness inside the traced outer face
      const inward = (() => {
        const probe = w.axis === 'h' ? { x: (w.a + w.b) / 2, y: w.pos + 1 } : { x: w.pos + 1, y: (w.a + w.b) / 2 }
        return pointInPolygon(probe, footprint) ? 1 : -1
      })()
      void inward
    }
  }
}

function buildRooms(walls: Wall[], footprint: PtMm[], geo: PageGeometry, mmPerPt: number, region: PtRegion, levelId: string): Room[] {
  const cuts = walls.map((w) => ({ axis: w.axis, pos: w.pos, a: w.a, b: w.b }))
  const { grid, regions } = partition(footprint, cuts, 60)
  const labelRe = /^[A-Z][A-Z .&/'-]{2,}$/
  const texts = geo.texts
    .filter((t) => t.x > region.x0 && t.x < region.x1 && t.y > region.y0 && t.y < region.y1 && labelRe.test(t.text.trim()) && !/^(W-\d|D-\d|WD|TYPE|SCALE|NOTE)/.test(t.text.trim()))
    .map((t) => ({ text: t.text.trim(), x: (t.x - region.x0) * mmPerPt, y: (t.y - region.y0) * mmPerPt }))
  const rooms: Room[] = []
  for (const r of regions) {
    if (r.areaMm2 < 0.5e6) continue // < 0.5 m²: wall-thickness slivers
    const bboxArea = (r.bbox.x1 - r.bbox.x0) * (r.bbox.y1 - r.bbox.y0)
    if (r.areaMm2 < bboxArea * 0.12) continue // the ring between the outer face and the wall centrelines
    const inside = texts.filter((t) => {
      if (t.x < r.bbox.x0 || t.x > r.bbox.x1 || t.y < r.bbox.y0 || t.y > r.bbox.y1) return false
      return r.cells.some(([i, j]) => t.x >= grid.xs[i] && t.x <= grid.xs[i + 1] && t.y >= grid.ys[j] && t.y <= grid.ys[j + 1])
    })
    const label = inside.map((t) => t.text).join(' ') || 'UNLABELLED'
    rooms.push({
      id: `R-${levelId}-${r.id}`,
      label,
      category: inside.length ? roomCategoryFor(label) : 'habitable',
      bbox: { x0: Math.round(r.bbox.x0), y0: Math.round(r.bbox.y0), x1: Math.round(r.bbox.x1), y1: Math.round(r.bbox.y1) },
      areaM2: Math.round(r.areaMm2 / 1e4) / 100,
      labelPoint: inside[0] ? { x: Math.round(inside[0].x), y: Math.round(inside[0].y) } : null,
    })
  }
  return rooms
}

export function wallRect(w: Wall, half = w.thickness / 2): RectMm {
  return bufferLine(w.axis, w.pos, w.a, w.b, half)
}

export function wallAxisLabel(axis: Axis) {
  return axis === 'h' ? 'horizontal' : 'vertical'
}
