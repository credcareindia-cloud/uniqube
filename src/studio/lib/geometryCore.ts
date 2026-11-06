/**
 * Geometry extraction engine.
 *
 * Reads the vector paths and positioned text out of one PDF page, finds the dimension strings,
 * and calibrates a page scale (millimetres per PDF point) from the dimension lines those strings
 * sit on. Everything here is pure so it can run in the browser or in a Node check.
 *
 * Coordinates: PDF points at scale 1, origin at the top-left of the page (viewport space).
 */

export type Pt = { x: number; y: number }

export interface GeoSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  len: number
}

export interface GeoRect {
  x: number
  y: number
  w: number
  h: number
}

export interface GeoText {
  text: string
  /** Centre of the string. */
  x: number
  y: number
  /** Advance width and glyph height, in points. */
  w: number
  h: number
  /** Direction of reading, radians, in viewport space (0 = left to right, −π/2 = bottom to top). */
  angle: number
}

export type DimUnit = 'mm' | 'cm' | 'm' | 'ft'

export interface GeoDimension extends GeoText {
  valueMm: number
  unit: DimUnit
  /** Segment the string was measured against, when calibration matched one. */
  segment?: GeoSegment
}

export interface ScaleCandidate {
  mmPerPt: number
  label: string
  method: 'auto' | 'stated'
  samples: number
  confidence: number
}

export interface PageGeometry {
  pageNumber: number
  widthPt: number
  heightPt: number
  segments: GeoSegment[]
  rects: GeoRect[]
  texts: GeoText[]
  dimensions: GeoDimension[]
  scaleCandidates: ScaleCandidate[]
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function mul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function apply(m: Matrix, x: number, y: number): Pt {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

/** Subset of pdf.js OPS this engine needs. */
export interface OpsTable {
  save: number
  restore: number
  transform: number
  constructPath: number
  endPath: number
  paintFormXObjectBegin: number
  paintFormXObjectEnd: number
}

/** Subset of pdf.js PDFPageProxy this engine needs. */
export interface PageLike {
  pageNumber: number
  getViewport(options: { scale: number }): {
    width: number
    height: number
    convertToViewportPoint(x: number, y: number): [number, number] | number[]
  }
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>
  getTextContent(): Promise<{ items: unknown[] }>
}

const DRAW_MOVE = 0
const DRAW_LINE = 1
const DRAW_CURVE = 2
const DRAW_QUAD = 3
const DRAW_CLOSE = 4

const MAX_SEGMENTS = 60000

function key(p: Pt) {
  return `${Math.round(p.x * 10)}:${Math.round(p.y * 10)}`
}

function segmentKey(a: Pt, b: Pt) {
  const ka = key(a)
  const kb = key(b)
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function makeSegment(a: Pt, b: Pt): GeoSegment {
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, len: Math.hypot(b.x - a.x, b.y - a.y) }
}

function rectFromSubpath(points: Pt[]): GeoRect | null {
  const pts = points.slice()
  if (pts.length === 5 && key(pts[0]) === key(pts[4])) pts.pop()
  if (pts.length !== 4) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX
  const h = maxY - minY
  if (w < 1 || h < 1) return null
  const tol = Math.max(0.6, Math.min(w, h) * 0.02)
  for (const p of pts) {
    const onX = Math.abs(p.x - minX) < tol || Math.abs(p.x - maxX) < tol
    const onY = Math.abs(p.y - minY) < tol || Math.abs(p.y - maxY) < tol
    if (!onX || !onY) return null
  }
  return { x: minX, y: minY, w, h }
}

type SegmentSink = {
  segments: GeoSegment[]
  rects: GeoRect[]
  seen: Set<string>
}

function addSegment(sink: SegmentSink, a: Pt, b: Pt) {
  if (sink.segments.length >= MAX_SEGMENTS) return
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len < 0.5) return
  const k = segmentKey(a, b)
  if (sink.seen.has(k)) return
  sink.seen.add(k)
  sink.segments.push(makeSegment(a, b))
}

function decodePath(buffer: ArrayLike<number>, ctm: Matrix, toView: (p: Pt) => Pt, sink: SegmentSink) {
  let current: Pt | null = null
  let start: Pt | null = null
  let subpath: Pt[] = []
  let subpathIsLines = true

  const flush = () => {
    if (subpathIsLines && subpath.length >= 4) {
      const rect = rectFromSubpath(subpath)
      if (rect) sink.rects.push(rect)
    }
    subpath = []
    subpathIsLines = true
  }

  for (let i = 0; i < buffer.length; ) {
    const op = buffer[i++]
    if (op === DRAW_MOVE) {
      flush()
      current = toView(apply(ctm, buffer[i++], buffer[i++]))
      start = current
      subpath = [current]
    } else if (op === DRAW_LINE) {
      const next = toView(apply(ctm, buffer[i++], buffer[i++]))
      if (current) addSegment(sink, current, next)
      current = next
      subpath.push(next)
    } else if (op === DRAW_CURVE) {
      const c1 = apply(ctm, buffer[i++], buffer[i++])
      const c2 = apply(ctm, buffer[i++], buffer[i++])
      void c1
      void c2
      const next = toView(apply(ctm, buffer[i++], buffer[i++]))
      current = next
      subpath.push(next)
      subpathIsLines = false
    } else if (op === DRAW_QUAD) {
      i += 2
      const next = toView(apply(ctm, buffer[i++], buffer[i++]))
      current = next
      subpath.push(next)
      subpathIsLines = false
    } else if (op === DRAW_CLOSE) {
      if (current && start && key(current) !== key(start)) {
        addSegment(sink, current, start)
        subpath.push(start)
      }
      flush()
      current = start
      if (start) subpath = [start]
    } else {
      break
    }
  }
  flush()
}

// ——— text ———

type RawText = {
  str: string
  transform: number[]
  width: number
  height: number
}

function isRawText(item: unknown): item is RawText {
  if (!item || typeof item !== 'object') return false
  const row = item as Partial<RawText>
  return typeof row.str === 'string' && Array.isArray(row.transform) && row.transform.length === 6
}

type Placed = {
  text: string
  start: Pt
  end: Pt
  h: number
  angle: number
}

function placeText(item: RawText, toView: (p: Pt) => Pt): Placed | null {
  const str = item.str
  if (!str.trim()) return null
  const [a, b, , , e, f] = item.transform
  const norm = Math.hypot(a, b) || 1
  const ux = a / norm
  const uy = b / norm
  const width = item.width || 0
  const start = toView({ x: e, y: f })
  const end = toView({ x: e + ux * width, y: f + uy * width })
  const fontSize = Math.hypot(item.transform[2], item.transform[3]) || item.height || norm
  const h = item.height || fontSize
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  return { text: str, start, end, h, angle }
}

function sameLine(prev: Placed, next: Placed) {
  let da = Math.abs(prev.angle - next.angle)
  if (da > Math.PI) da = 2 * Math.PI - da
  if (da > 0.05) return false
  const gap = Math.hypot(next.start.x - prev.end.x, next.start.y - prev.end.y)
  const tol = Math.max(prev.h, next.h, 2)
  if (gap > tol * 0.9) return false
  const dirX = Math.cos(prev.angle)
  const dirY = Math.sin(prev.angle)
  const offX = next.start.x - prev.end.x
  const offY = next.start.y - prev.end.y
  const perpendicular = Math.abs(-dirY * offX + dirX * offY)
  return perpendicular < tol * 0.5
}

function mergeTexts(placed: Placed[]): GeoText[] {
  const out: GeoText[] = []
  const push = (current: Placed) => {
    const text = current.text.replace(/\s+/g, ' ').trim()
    if (!text) return
    out.push({
      text,
      x: (current.start.x + current.end.x) / 2,
      y: (current.start.y + current.end.y) / 2,
      w: Math.hypot(current.end.x - current.start.x, current.end.y - current.start.y),
      h: current.h,
      angle: current.angle,
    })
  }
  const runs: Placed[] = []
  for (const item of placed) {
    const current = runs.length ? runs[runs.length - 1] : undefined
    if (current && sameLine(current, item)) {
      const gap = Math.hypot(item.start.x - current.end.x, item.start.y - current.end.y)
      const needsSpace = gap > Math.max(current.h, item.h) * 0.25 && !current.text.endsWith(' ') && !item.text.startsWith(' ')
      runs[runs.length - 1] = {
        text: current.text + (needsSpace ? ' ' : '') + item.text,
        start: current.start,
        end: item.end,
        h: Math.max(current.h, item.h),
        angle: current.angle,
      }
    } else {
      runs.push(item)
    }
  }
  for (const run of runs) push(run)
  return out
}

// ——— dimensions ———

const FT_IN = /^(\d+)\s*['′’]\s*-?\s*(?:(\d+)(?:\s+(\d+)\/(\d+))?\s*(?:["″”]|'')?)?$/
const IN_ONLY = /^(\d+)(?:\s+(\d+)\/(\d+))?\s*(?:["″”]|'')$/
const METRIC = /^([+-]?\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d+))?\s*(mm|cm|m)?$/i

/**
 * Parse a dimension string into millimetres. Unitless whole numbers are millimetres;
 * unitless decimals are metres; feet-and-inches are converted.
 */
export function parseDimension(raw: string, units: 'mm' | 'm' | 'ft' = 'mm'): { valueMm: number; unit: DimUnit } | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const ft = FT_IN.exec(text)
  if (ft) {
    const feet = Number(ft[1])
    const inches = Number(ft[2] ?? 0) + (ft[3] && ft[4] ? Number(ft[3]) / Number(ft[4]) : 0)
    const value = (feet * 12 + inches) * 25.4
    return value > 0 ? { valueMm: value, unit: 'ft' } : null
  }
  const inch = IN_ONLY.exec(text)
  if (inch) {
    const inches = Number(inch[1]) + (inch[2] && inch[3] ? Number(inch[2]) / Number(inch[3]) : 0)
    return inches > 0 ? { valueMm: inches * 25.4, unit: 'ft' } : null
  }
  const metric = METRIC.exec(text)
  if (!metric) return null
  const whole = metric[1].replace(/[,\s]/g, '')
  const decimals = metric[2]
  const suffix = metric[3]?.toLowerCase() as 'mm' | 'cm' | 'm' | undefined
  const value = Number(decimals ? `${whole}.${decimals}` : whole)
  if (!Number.isFinite(value) || value <= 0) return null
  if (suffix === 'm') return { valueMm: value * 1000, unit: 'm' }
  if (suffix === 'cm') return { valueMm: value * 10, unit: 'cm' }
  if (suffix === 'mm') return { valueMm: value, unit: 'mm' }
  if (decimals) {
    if (value < 200) return { valueMm: value * 1000, unit: 'm' }
    return { valueMm: value, unit: 'mm' }
  }
  if (units === 'm') {
    if (value < 200) return { valueMm: value * 1000, unit: 'm' }
    return { valueMm: value, unit: 'mm' }
  }
  if (units === 'ft') return null
  if (value < 100) return null
  // Above 200 m a unitless string is several dimension texts glued together ("612 466 694"), not one length.
  if (value > 200_000) return null
  return { valueMm: value, unit: 'mm' }
}

function angleDiff(a: number, b: number) {
  let d = Math.abs(a - b) % Math.PI
  if (d > Math.PI / 2) d = Math.PI - d
  return d
}

function segmentAngle(s: GeoSegment) {
  return Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
}

/** Perpendicular distance from a point to the segment's line, and the point's position along it (0..1 inside). */
function project(s: GeoSegment, p: Pt) {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const len2 = dx * dx + dy * dy || 1
  const t = ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / len2
  const perp = Math.abs(dy * (p.x - s.x1) - dx * (p.y - s.y1)) / Math.sqrt(len2)
  return { t, perp }
}

const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 1000]
/** Architectural imperial scales, as drawing ratios: 1/4" = 1'-0" is 1:48. */
const IMPERIAL_SCALES: Array<{ ratio: number; label: string }> = [
  { ratio: 12, label: '1" = 1\'-0"' },
  { ratio: 16, label: '3/4" = 1\'-0"' },
  { ratio: 24, label: '1/2" = 1\'-0"' },
  { ratio: 32, label: '3/8" = 1\'-0"' },
  { ratio: 48, label: '1/4" = 1\'-0"' },
  { ratio: 64, label: '3/16" = 1\'-0"' },
  { ratio: 96, label: '1/8" = 1\'-0"' },
  { ratio: 128, label: '3/32" = 1\'-0"' },
  { ratio: 192, label: '1/16" = 1\'-0"' },
  { ratio: 240, label: '1" = 20\'' },
  { ratio: 360, label: '1" = 30\'' },
  { ratio: 480, label: '1" = 40\'' },
]
const MM_PER_PT_AT_1 = 25.4 / 72

/** Nearest standard scale within 2.5 %, or an approximate ratio. */
export function snapScale(mmPerPt: number): { mmPerPt: number; label: string; snapped: boolean } {
  const ratio = mmPerPt / MM_PER_PT_AT_1
  let best: { ratio: number; label: string; err: number } | null = null
  for (const s of STANDARD_SCALES) {
    const err = Math.abs(ratio - s) / s
    if (err < 0.025 && (!best || err < best.err)) best = { ratio: s, label: `1:${s}`, err }
  }
  for (const s of IMPERIAL_SCALES) {
    const err = Math.abs(ratio - s.ratio) / s.ratio
    if (err < 0.025 && (!best || err < best.err)) best = { ratio: s.ratio, label: `${s.label} (1:${s.ratio})`, err }
  }
  if (best) return { mmPerPt: best.ratio * MM_PER_PT_AT_1, label: best.label, snapped: true }
  return { mmPerPt, label: `≈1:${Math.round(ratio)}`, snapped: false }
}

export function scaleLabel(mmPerPt: number): string {
  return snapScale(mmPerPt).label
}

export function mmPerPtForRatio(ratio: number): number {
  return ratio * MM_PER_PT_AT_1
}

/** Endpoints hashed to a coarse grid so end-mark checks stay fast on dense sheets. */
class EndpointIndex {
  private cells = new Map<string, GeoSegment[]>()
  private size: number

  constructor(segments: GeoSegment[], cell = 4) {
    this.size = cell
    for (const s of segments) {
      this.add(s.x1, s.y1, s)
      this.add(s.x2, s.y2, s)
    }
  }

  private cellKey(x: number, y: number) {
    return `${Math.floor(x / this.size)}:${Math.floor(y / this.size)}`
  }

  private add(x: number, y: number, s: GeoSegment) {
    const k = this.cellKey(x, y)
    const list = this.cells.get(k)
    if (list) list.push(s)
    else this.cells.set(k, [s])
  }

  /** Segments with an endpoint within `radius` of (x, y). */
  near(x: number, y: number, radius: number): GeoSegment[] {
    const out: GeoSegment[] = []
    const span = Math.ceil(radius / this.size)
    const cx = Math.floor(x / this.size)
    const cy = Math.floor(y / this.size)
    for (let ix = cx - span; ix <= cx + span; ix++) {
      for (let iy = cy - span; iy <= cy + span; iy++) {
        const list = this.cells.get(`${ix}:${iy}`)
        if (!list) continue
        for (const s of list) {
          const d = Math.min(Math.hypot(s.x1 - x, s.y1 - y), Math.hypot(s.x2 - x, s.y2 - y))
          if (d <= radius) out.push(s)
        }
      }
    }
    return out
  }
}

/** Something crosses the line at this point: an extension line, a tick, or an arrowhead. */
function crossingAt(x: number, y: number, angle: number, index: EndpointIndex, radius: number): boolean {
  return index.near(x, y, radius).some((other) => angleDiff(segmentAngle(other), angle) > 0.5)
}

/** A dimension line ends in an extension line or a tick that crosses it. */
function hasEndMarks(seg: GeoSegment, index: EndpointIndex): boolean {
  const angle = segmentAngle(seg)
  const radius = Math.max(1.5, Math.min(4, seg.len * 0.05))
  return crossingAt(seg.x1, seg.y1, angle, index, radius) && crossingAt(seg.x2, seg.y2, angle, index, radius)
}

/**
 * The dimension line under a string. CAD exports often break the line around the text,
 * so collinear pieces are chained back together before measuring between the end marks.
 */
export function dimensionLineFor(
  dim: GeoText,
  segments: GeoSegment[],
  index: EndpointIndex,
): { seg: GeoSegment; marked: boolean } | null {
  const reach = Math.max(dim.h * 3.5, 10)
  const ux = Math.cos(dim.angle)
  const uy = Math.sin(dim.angle)
  type Piece = { seg: GeoSegment; offset: number; a: number; b: number }
  const pieces: Piece[] = []
  for (const seg of segments) {
    if (angleDiff(segmentAngle(seg), dim.angle) > 0.035) continue
    const mid = { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 }
    const offset = -uy * (mid.x - dim.x) + ux * (mid.y - dim.y)
    if (Math.abs(offset) > reach) continue
    const a = ux * (seg.x1 - dim.x) + uy * (seg.y1 - dim.y)
    const b = ux * (seg.x2 - dim.x) + uy * (seg.y2 - dim.y)
    pieces.push({ seg, offset, a: Math.min(a, b), b: Math.max(a, b) })
  }
  if (!pieces.length) return null

  pieces.sort((p, q) => p.offset - q.offset)
  const bands: Piece[][] = []
  for (const piece of pieces) {
    const last = bands[bands.length - 1]
    if (last && Math.abs(piece.offset - last[0].offset) <= 1.2) last.push(piece)
    else bands.push([piece])
  }

  const gapLimit = Math.max(dim.w * 1.6, 6)
  const toPage = (along: number, offset: number): Pt => ({
    x: dim.x + ux * along - uy * offset,
    y: dim.y + uy * along + ux * offset,
  })
  let best: { seg: GeoSegment; marked: boolean; score: number } | null = null
  for (const band of bands) {
    band.sort((p, q) => p.a - q.a)
    const offset = band[0].offset
    const chains: Array<{ a: number; b: number }> = []
    for (const piece of band) {
      const last = chains[chains.length - 1]
      if (last && piece.a - last.b <= gapLimit) {
        // Chained dimensions share an extension line. A crossing at the junction starts a new run.
        const junction = toPage(last.b, offset)
        if (piece.a - last.b < 1.5 && crossingAt(junction.x, junction.y, dim.angle, index, 1.5)) {
          chains.push({ a: piece.a, b: piece.b })
        } else {
          last.b = Math.max(last.b, piece.b)
        }
      } else {
        chains.push({ a: piece.a, b: piece.b })
      }
    }
    const margin = dim.w * 0.6
    for (const chain of chains) {
      if (chain.a > margin || chain.b < -margin) continue
      const len = chain.b - chain.a
      // A run no longer than the string is the text's own box, not a dimension line.
      if (len < dim.w * 1.25 || len < 4) continue
      const p1 = toPage(chain.a, offset)
      const p2 = toPage(chain.b, offset)
      const seg: GeoSegment = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, len }
      const marked = hasEndMarks(seg, index)
      const score = Math.abs(offset) + (marked ? 0 : reach)
      if (!best || score < best.score) best = { seg, marked, score }
    }
  }
  return best ? { seg: best.seg, marked: best.marked } : null
}

/** Find the dimension line each dimension string sits on and vote for a page scale. */
export function calibrate(dimensions: GeoDimension[], segments: GeoSegment[]): ScaleCandidate[] {
  const votes: Array<{ ratio: number; weight: number }> = []
  const long = segments.filter((s) => s.len >= 2)
  const index = new EndpointIndex(long)
  for (const dim of dimensions) {
    const found = dimensionLineFor(dim, long, index)
    if (!found) continue
    dim.segment = found.seg
    const ratio = dim.valueMm / found.seg.len
    if (Number.isFinite(ratio) && ratio > 0.05 && ratio < 2000) {
      votes.push({ ratio, weight: found.marked ? 1 : 0.35 })
    }
  }
  if (!votes.length) return []
  votes.sort((a, b) => a.ratio - b.ratio)
  const clusters: Array<{ ratios: number[]; weight: number }> = []
  for (const vote of votes) {
    const last = clusters[clusters.length - 1]
    if (last && Math.abs(vote.ratio - last.ratios[0]) / last.ratios[0] < 0.03) {
      last.ratios.push(vote.ratio)
      last.weight += vote.weight
    } else {
      clusters.push({ ratios: [vote.ratio], weight: vote.weight })
    }
  }
  const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0)
  // Clusters that snap to the same standard scale are one answer.
  const merged = new Map<string, { ratios: number[]; weight: number; mmPerPt: number; label: string }>()
  for (const cluster of clusters) {
    const sorted = [...cluster.ratios].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const snap = snapScale(median)
    const existing = merged.get(snap.label)
    if (existing) {
      existing.ratios.push(...cluster.ratios)
      existing.weight += cluster.weight
    } else {
      merged.set(snap.label, { ratios: [...cluster.ratios], weight: cluster.weight, mmPerPt: snap.mmPerPt, label: snap.label })
    }
  }
  const out: ScaleCandidate[] = []
  for (const cluster of [...merged.values()].sort((a, b) => b.weight - a.weight).slice(0, 3)) {
    const sorted = [...cluster.ratios].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const spread = (sorted[sorted.length - 1] - sorted[0]) / median
    const share = cluster.weight / totalWeight
    const confidence = Math.min(1, cluster.weight / 6) * (0.4 + 0.6 * share) * (1 - Math.min(0.5, spread))
    out.push({
      mmPerPt: cluster.mmPerPt,
      label: cluster.label,
      method: 'auto',
      samples: cluster.ratios.length,
      confidence: Math.round(confidence * 100) / 100,
    })
  }
  return out
}

/** Auto candidates that agree with a scale note on the sheet get a boost. */
export function reconcileScales(auto: ScaleCandidate[], stated: ScaleCandidate[]): ScaleCandidate[] {
  const boosted = auto.map((candidate) => {
    const match = stated.find((s) => Math.abs(s.mmPerPt - candidate.mmPerPt) / candidate.mmPerPt < 0.03)
    if (!match) return candidate
    return { ...candidate, confidence: Math.min(1, Math.round((candidate.confidence + 0.3) * 100) / 100) }
  })
  boosted.sort((a, b) => b.confidence - a.confidence)
  return [...boosted, ...stated]
}

const STATED_METRIC = /\b(?:scale|sc\.?|échelle|esc\.?)\s*[:\-]?\s*1\s*[:/]\s*(\d{1,4})\b/i
const BARE_METRIC = /^1\s*:\s*(\d{1,4})$/
const STATED_IMPERIAL = /(\d+(?:\/\d+)?)\s*["″]\s*=\s*1\s*['′]\s*-?\s*0?\s*["″]?/i

/** Scale notes written on the sheet, such as SCALE 1:100 or 1/4" = 1'-0". */
export function statedScales(texts: GeoText[]): ScaleCandidate[] {
  const out = new Map<string, ScaleCandidate>()
  const add = (ratio: number, label: string) => {
    if (ratio < 1 || ratio > 5000) return
    const existing = out.get(label)
    if (existing) existing.samples += 1
    else out.set(label, { mmPerPt: mmPerPtForRatio(ratio), label, method: 'stated', samples: 1, confidence: 0.35 })
  }
  for (const text of texts) {
    const metric = STATED_METRIC.exec(text.text) ?? BARE_METRIC.exec(text.text.trim())
    if (metric) add(Number(metric[1]), `1:${Number(metric[1])}`)
    const imperial = STATED_IMPERIAL.exec(text.text)
    if (imperial) {
      const [num, den] = imperial[1].split('/').map(Number)
      const inches = den ? num / den : num
      if (inches > 0) {
        const ratio = 12 / inches
        add(ratio, `${imperial[1]}" = 1'-0" (1:${Math.round(ratio)})`)
      }
    }
  }
  return [...out.values()]
}

export interface ExtractOptions {
  units?: 'mm' | 'm' | 'ft'
}

/** Read vectors and text from a page and calibrate its scale. */
export async function extractGeometryFromPage(page: PageLike, OPS: OpsTable, options: ExtractOptions = {}): Promise<PageGeometry> {
  const viewport = page.getViewport({ scale: 1 })
  const toView = (p: Pt): Pt => {
    const [x, y] = viewport.convertToViewportPoint(p.x, p.y)
    return { x, y }
  }

  const sink: SegmentSink = { segments: [], rects: [], seen: new Set() }
  const ops = await page.getOperatorList()
  const stack: Matrix[] = []
  let ctm: Matrix = IDENTITY
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i] as unknown
    if (fn === OPS.save) {
      stack.push(ctm)
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? IDENTITY
    } else if (fn === OPS.transform) {
      if (Array.isArray(args) && args.length === 6) ctm = mul(ctm, args as Matrix)
    } else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      const matrix = Array.isArray(args) ? (args[0] as unknown) : null
      if (Array.isArray(matrix) && matrix.length === 6) ctm = mul(ctm, matrix as Matrix)
    } else if (fn === OPS.paintFormXObjectEnd) {
      ctm = stack.pop() ?? IDENTITY
    } else if (fn === OPS.constructPath) {
      if (!Array.isArray(args) || args.length < 2) continue
      const op = args[0] as number
      if (op === OPS.endPath) continue
      const data = args[1] as unknown
      const buffer = Array.isArray(data) ? (data[0] as unknown) : null
      if (!buffer || typeof (buffer as ArrayLike<number>).length !== 'number') continue
      decodePath(buffer as ArrayLike<number>, ctm, toView, sink)
    }
  }

  const content = await page.getTextContent()
  const placed: Placed[] = []
  for (const item of content.items) {
    if (!isRawText(item)) continue
    const p = placeText(item, toView)
    if (p) placed.push(p)
  }
  const texts = mergeTexts(placed)

  const dimensions: GeoDimension[] = []
  for (const text of texts) {
    const parsed = parseDimension(text.text, options.units)
    if (!parsed) continue
    dimensions.push({ ...text, valueMm: parsed.valueMm, unit: parsed.unit })
  }

  const scaleCandidates = reconcileScales(calibrate(dimensions, sink.segments), statedScales(texts))

  return {
    pageNumber: page.pageNumber,
    widthPt: viewport.width,
    heightPt: viewport.height,
    segments: sink.segments,
    rects: sink.rects,
    texts,
    dimensions,
    scaleCandidates,
  }
}

// ——— helpers for the workspace and the model ———

/** Nearest segment endpoint within `tolerance` points, for snapping. */
export function snapToGeometry(p: Pt, segments: GeoSegment[], tolerance: number): Pt | null {
  let best: Pt | null = null
  let bestDist = tolerance
  for (const s of segments) {
    for (const end of [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
    ]) {
      const d = Math.hypot(end.x - p.x, end.y - p.y)
      if (d < bestDist) {
        bestDist = d
        best = end
      }
    }
  }
  if (best) return best
  // Fall back to the nearest point on a segment.
  for (const s of segments) {
    const { t, perp } = project(s, p)
    if (t < 0 || t > 1 || perp >= bestDist) continue
    bestDist = perp
    best = { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t }
  }
  return best
}

function r1(value: number) {
  return Math.round(value * 10) / 10
}

// ——— plan region, grid axes, footprint ———

export interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

function isHorizontal(s: GeoSegment) {
  return Math.abs(s.y1 - s.y2) < 0.6
}

function isVertical(s: GeoSegment) {
  return Math.abs(s.x1 - s.x2) < 0.6
}

/**
 * Where the plan sits on the sheet: the box bounded by the longest horizontal and the longest
 * vertical dimension string that calibration matched to a line. Null when the page has no such pair.
 */
export function planRegionFor(geo: PageGeometry, padPt = 8): Region | null {
  // Longest matched dimension line in each direction, in page points. Value in mm is a poor
  // proxy: one mis-read string can outrank the real overall dimension.
  const matched = geo.dimensions.filter((d) => d.segment).sort((a, b) => b.segment!.len - a.segment!.len)
  const horiz = matched.find((d) => Math.abs(Math.cos(d.angle)) > 0.9)
  const vert = matched.find((d) => Math.abs(Math.sin(d.angle)) > 0.9)
  if (!horiz?.segment || !vert?.segment) return null
  const x0 = Math.min(horiz.segment.x1, horiz.segment.x2) - padPt
  const x1 = Math.max(horiz.segment.x1, horiz.segment.x2) + padPt
  const y0 = Math.min(vert.segment.y1, vert.segment.y2) - padPt
  const y1 = Math.max(vert.segment.y1, vert.segment.y2) + padPt
  if (x1 - x0 < 20 || y1 - y0 < 20) return null
  return { x0, y0, x1, y1 }
}

export interface GridAxes {
  /** x positions (points) of vertical grid lines, from a row of single-character bubbles. */
  verticalX: number[]
  /** y positions (points) of horizontal grid lines, from a column of single-character bubbles. */
  horizontalY: number[]
  labels: string[]
}

const GRID_LABEL = /^(\d{1,2}|[A-Z])$/

/** Grid bubbles: single letters or numbers lined up in a row (vertical grids) or a column (horizontal grids). */
export function gridAxesFor(geo: PageGeometry): GridAxes {
  const single = geo.texts.filter((t) => GRID_LABEL.test(t.text.trim()))
  const rows = new Map<number, GeoText[]>()
  const cols = new Map<number, GeoText[]>()
  for (const t of single) {
    const ry = Math.round(t.y / 4) * 4
    const rx = Math.round(t.x / 4) * 4
    rows.set(ry, [...(rows.get(ry) ?? []), t])
    cols.set(rx, [...(cols.get(rx) ?? []), t])
  }
  const verticalX: number[] = []
  const horizontalY: number[] = []
  const labels = new Set<string>()
  // One row of bubbles names the vertical grids; one column names the horizontal grids.
  const bestRow = [...rows.values()].sort((a, b) => b.length - a.length)[0]
  const inRow = new Set(bestRow && bestRow.length >= 4 ? bestRow : [])
  if (inRow.size) {
    for (const t of inRow) {
      verticalX.push(t.x)
      labels.add(t.text.trim())
    }
  }
  const bestCol = [...cols.values()]
    .map((group) => group.filter((t) => !inRow.has(t)))
    .sort((a, b) => b.length - a.length)[0]
  if (bestCol && bestCol.length >= 3) {
    for (const t of bestCol) {
      horizontalY.push(t.y)
      labels.add(t.text.trim())
    }
  }
  return {
    verticalX: [...new Set(verticalX.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b),
    horizontalY: [...new Set(horizontalY.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b),
    labels: [...labels],
  }
}

export interface FootprintResult {
  ok: boolean
  /** Simplified outline in page points, closed implicitly. */
  polygon: Pt[]
  areaM2: number
  perimeterM: number
  bboxMm: { w: number; h: number }
  bboxPt: Region
  writtenCheck: { overallWidthMm: number | null; overallDepthMm: number | null; widthDeltaPct: number | null; depthDeltaPct: number | null }
  region: Region
  cellPt: number
  closingRadiusPt: number
  openingRadiusPt: number
  segmentsUsed: number
  excludedDimensionSegments: number
  excludedGridSegments: number
  gridAxes: GridAxes
  notes: string[]
}

function simplifyPolyline(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return points
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const pa = points[a]
    const pb = points[b]
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const len = Math.hypot(dx, dy) || 1
    let far = -1
    let farDist = tolerance
    for (let i = a + 1; i < b; i++) {
      const p = points[i]
      const dist = Math.abs(dy * p.x - dx * p.y + pb.x * pa.y - pb.y * pa.x) / len
      if (dist > farDist) {
        farDist = dist
        far = i
      }
    }
    if (far > 0) {
      keep[far] = true
      stack.push([a, far], [far, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

/**
 * Trace the building footprint on a plan: rasterise the wall lines inside the plan region
 * (dimension lines and grid lines excluded), close small gaps, flood the outside, and read back
 * the largest enclosed outline as a polygon. Works for rectilinear and notched footprints.
 */
export function traceFootprint(
  geo: PageGeometry,
  mmPerPt: number,
  options: { region?: Region; closingRadiusPt?: number; openingRadiusPt?: number; cellPt?: number } = {},
): FootprintResult {
  const notes: string[] = []
  const gridAxes = gridAxesFor(geo)
  const region = options.region ?? planRegionFor(geo)
  const cell = options.cellPt ?? 1
  // Gap closing ≈ 120 mm (wall thickness), feature opening ≈ 350 mm radius (door swings, ticks), scale-aware.
  const radius = options.closingRadiusPt ?? (mmPerPt > 0 ? Math.min(6, Math.max(1, Math.round(120 / mmPerPt))) : 2)
  const open = options.openingRadiusPt ?? (mmPerPt > 0 ? Math.min(12, Math.max(2, Math.round(350 / mmPerPt))) : 3)
  const fail = (why: string): FootprintResult => ({
    ok: false,
    polygon: [],
    areaM2: 0,
    perimeterM: 0,
    bboxMm: { w: 0, h: 0 },
    bboxPt: { x0: 0, y0: 0, x1: 0, y1: 0 },
    writtenCheck: { overallWidthMm: null, overallDepthMm: null, widthDeltaPct: null, depthDeltaPct: null },
    region: region ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
    cellPt: cell,
    closingRadiusPt: radius,
    openingRadiusPt: open,
    segmentsUsed: 0,
    excludedDimensionSegments: 0,
    excludedGridSegments: 0,
    gridAxes,
    notes: [...notes, why],
  })
  if (!region) return fail('No plan region: the page has no horizontal and vertical dimension strings matched to lines. Give a region or pick a plan sheet.')
  if (!(mmPerPt > 0)) return fail('No page scale. Set the scale first.')

  const dimBandsH: number[] = []
  const dimBandsV: number[] = []
  for (const d of geo.dimensions) {
    if (!d.segment) continue
    if (isHorizontal(d.segment)) dimBandsH.push(d.segment.y1)
    else if (isVertical(d.segment)) dimBandsV.push(d.segment.x1)
  }
  const near = (list: number[], value: number, tol: number) => list.some((v) => Math.abs(v - value) < tol)

  const W = Math.ceil((region.x1 - region.x0) / cell)
  const H = Math.ceil((region.y1 - region.y0) / cell)
  if (W * H > 4_000_000) return fail('Plan region is too large to trace at this resolution.')
  const wall = new Uint8Array(W * H)
  const mark = (x: number, y: number) => {
    const i = Math.floor((x - region.x0) / cell)
    const j = Math.floor((y - region.y0) / cell)
    if (i >= 0 && j >= 0 && i < W && j < H) wall[j * W + i] = 1
  }
  let used = 0
  let dropDim = 0
  let dropGrid = 0
  for (const s of geo.segments) {
    if (s.len < 1.5) continue
    if (Math.max(s.x1, s.x2) < region.x0 || Math.min(s.x1, s.x2) > region.x1) continue
    if (Math.max(s.y1, s.y2) < region.y0 || Math.min(s.y1, s.y2) > region.y1) continue
    if ((isHorizontal(s) && near(dimBandsH, s.y1, 1.5)) || (isVertical(s) && near(dimBandsV, s.x1, 1.5))) {
      dropDim++
      continue
    }
    if ((isVertical(s) && near(gridAxes.verticalX, s.x1, 1.5)) || (isHorizontal(s) && near(gridAxes.horizontalY, s.y1, 1.5))) {
      dropGrid++
      continue
    }
    used++
    const n = Math.max(1, Math.ceil(s.len / (cell / 2)))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      mark(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t)
    }
  }
  if (!used) return fail('No wall lines inside the plan region.')

  const dilate = (src: Uint8Array, r: number) => {
    const out = new Uint8Array(src.length)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (!src[j * W + i]) continue
        for (let dj = -r; dj <= r; dj++) {
          const jj = j + dj
          if (jj < 0 || jj >= H) continue
          for (let di = -r; di <= r; di++) {
            const ii = i + di
            if (ii >= 0 && ii < W) out[jj * W + ii] = 1
          }
        }
      }
    }
    return out
  }
  const erode = (src: Uint8Array, r: number) => {
    const out = new Uint8Array(src.length)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let ok = 1
        for (let dj = -r; dj <= r && ok; dj++) {
          const jj = j + dj
          for (let di = -r; di <= r; di++) {
            const ii = i + di
            if (ii < 0 || jj < 0 || ii >= W || jj >= H || !src[jj * W + ii]) {
              ok = 0
              break
            }
          }
        }
        out[j * W + i] = ok
      }
    }
    return out
  }

  const closed = dilate(wall, radius)
  const outside = new Uint8Array(W * H)
  const stack: number[] = []
  for (let i = 0; i < W; i++) stack.push(i, (H - 1) * W + i)
  for (let j = 0; j < H; j++) stack.push(j * W, j * W + W - 1)
  while (stack.length) {
    const idx = stack.pop()!
    if (outside[idx] || closed[idx]) continue
    outside[idx] = 1
    const i = idx % W
    const j = (idx - i) / W
    if (i > 0) stack.push(idx - 1)
    if (i < W - 1) stack.push(idx + 1)
    if (j > 0) stack.push(idx - W)
    if (j < H - 1) stack.push(idx + W)
  }
  let inside = new Uint8Array(W * H)
  for (let k = 0; k < W * H; k++) inside[k] = outside[k] ? 0 : 1
  inside = erode(inside, radius)

  // Keep only the largest connected blob so furniture or detail boxes do not join the footprint.
  const label = new Int32Array(W * H)
  let bestLabel = 0
  let bestCount = 0
  let next = 0
  for (let start = 0; start < W * H; start++) {
    if (!inside[start] || label[start]) continue
    next++
    let count = 0
    const queue = [start]
    label[start] = next
    while (queue.length) {
      const idx = queue.pop()!
      count++
      const i = idx % W
      const j = (idx - i) / W
      for (const n of [i > 0 ? idx - 1 : -1, i < W - 1 ? idx + 1 : -1, j > 0 ? idx - W : -1, j < H - 1 ? idx + W : -1]) {
        if (n >= 0 && inside[n] && !label[n]) {
          label[n] = next
          queue.push(n)
        }
      }
    }
    if (count > bestCount) {
      bestCount = count
      bestLabel = next
    }
  }
  if (!bestCount) return fail('Nothing enclosed inside the plan region. Walls may be open or drawn as filled shapes.')
  for (let k = 0; k < W * H; k++) inside[k] = label[k] === bestLabel ? 1 : 0
  if (next > 1) notes.push(`${next - 1} smaller enclosed shapes were ignored.`)

  // Opening: shave off door swings, window ticks and grid marks that poke out of the wall line.
  if (open > 0) {
    inside = dilate(erode(inside, open), open)
    bestCount = 0
    for (let k = 0; k < W * H; k++) bestCount += inside[k]
    if (!bestCount) return fail('Footprint vanished after cleaning; the enclosed shape is thinner than the opening radius.')
  }

  // Boundary edges, clockwise with the inside on the right, chained into loops; keep the largest loop.
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : inside[j * W + i])
  const vkey = (p: Pt) => `${p.x}:${p.y}`
  const outgoing = new Map<string, Pt[]>()
  const addEdge = (a: Pt, b: Pt) => {
    const k = vkey(a)
    const list = outgoing.get(k)
    if (list) list.push(b)
    else outgoing.set(k, [b])
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!inside[j * W + i]) continue
      if (!at(i, j - 1)) addEdge({ x: i, y: j }, { x: i + 1, y: j })
      if (!at(i + 1, j)) addEdge({ x: i + 1, y: j }, { x: i + 1, y: j + 1 })
      if (!at(i, j + 1)) addEdge({ x: i + 1, y: j + 1 }, { x: i, y: j + 1 })
      if (!at(i - 1, j)) addEdge({ x: i, y: j + 1 }, { x: i, y: j })
    }
  }
  const usedEdges = new Set<string>()
  const edgeKey = (a: Pt, b: Pt) => `${vkey(a)}>${vkey(b)}`
  let loop: Pt[] = []
  let loopArea = 0
  for (const [startKey, firstList] of outgoing) {
    for (const first of firstList) {
      const [sx, sy] = startKey.split(':').map(Number)
      const start = { x: sx, y: sy }
      if (usedEdges.has(edgeKey(start, first))) continue
      const run: Pt[] = [start]
      usedEdges.add(edgeKey(start, first))
      let prev = start
      let cur = first
      let guard = 0
      while (vkey(cur) !== startKey && guard++ < W * H * 4) {
        run.push(cur)
        const options = (outgoing.get(vkey(cur)) ?? []).filter((n) => !usedEdges.has(edgeKey(cur, n)))
        if (!options.length) break
        // At a pinch, turn right first so the walk hugs the current cell.
        const dx = cur.x - prev.x
        const dy = cur.y - prev.y
        options.sort((a, b) => {
          const crossA = dx * (a.y - cur.y) - dy * (a.x - cur.x)
          const crossB = dx * (b.y - cur.y) - dy * (b.x - cur.x)
          return crossB - crossA
        })
        const nextPt = options[0]
        usedEdges.add(edgeKey(cur, nextPt))
        prev = cur
        cur = nextPt
      }
      if (run.length < 4) continue
      let a2 = 0
      for (let i = 0; i < run.length; i++) {
        const p = run[i]
        const q = run[(i + 1) % run.length]
        a2 += p.x * q.y - q.x * p.y
      }
      if (Math.abs(a2) > loopArea) {
        loopArea = Math.abs(a2)
        loop = run
      }
    }
  }
  if (loop.length < 4) return fail('Could not chain the outline.')

  const merged: Pt[] = []
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length]
    const cur = loop[i]
    const nxt = loop[(i + 1) % loop.length]
    const collinear = (prev.x === cur.x && cur.x === nxt.x) || (prev.y === cur.y && cur.y === nxt.y)
    if (!collinear) merged.push(cur)
  }
  // Closed ring: split at the vertex farthest from the first one and simplify both halves.
  let farIdx = 0
  let farDist = -1
  for (let i = 1; i < merged.length; i++) {
    const d = Math.hypot(merged[i].x - merged[0].x, merged[i].y - merged[0].y)
    if (d > farDist) {
      farDist = d
      farIdx = i
    }
  }
  const half1 = simplifyPolyline(merged.slice(0, farIdx + 1), 2.5)
  const half2 = simplifyPolyline([...merged.slice(farIdx), merged[0]], 2.5)
  let simplified = [...half1.slice(0, -1), ...half2.slice(0, -1)]
  // Rectilinear snap: edges that are nearly axis-aligned become exactly axis-aligned.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < simplified.length; i++) {
      const a = simplified[i]
      const b = simplified[(i + 1) % simplified.length]
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      if (dx < 4 && dx <= dy) b.x = a.x
      else if (dy < 4) b.y = a.y
    }
    simplified = simplified.filter((p, i) => {
      const q = simplified[(i + 1) % simplified.length]
      return p.x !== q.x || p.y !== q.y
    })
    simplified = simplified.filter((p, i) => {
      const prev = simplified[(i - 1 + simplified.length) % simplified.length]
      const nxt = simplified[(i + 1) % simplified.length]
      return !((prev.x === p.x && p.x === nxt.x) || (prev.y === p.y && p.y === nxt.y))
    })
  }
  const polygon = simplified.map((p) => ({ x: Math.round((region.x0 + p.x * cell) * 10) / 10, y: Math.round((region.y0 + p.y * cell) * 10) / 10 }))

  let area2 = 0
  let perimeterPt = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    area2 += a.x * b.y - b.x * a.y
    perimeterPt += Math.hypot(b.x - a.x, b.y - a.y)
  }
  const areaM2 = (Math.abs(area2) / 2) * mmPerPt * mmPerPt / 1e6
  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const bboxPt = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
  const bboxMm = { w: Math.round((bboxPt.x1 - bboxPt.x0) * mmPerPt), h: Math.round((bboxPt.y1 - bboxPt.y0) * mmPerPt) }
  const cellArea = bestCount * cell * cell * mmPerPt * mmPerPt / 1e6
  if (Math.abs(cellArea - areaM2) / Math.max(areaM2, 1) > 0.05) notes.push(`Cell count gives ${Math.round(cellArea)} m²; polygon gives ${Math.round(areaM2)} m². Check the outline.`)
  const regionArea = (region.x1 - region.x0) * (region.y1 - region.y0) * mmPerPt * mmPerPt / 1e6
  if (areaM2 > regionArea * 0.97) notes.push('Outline fills the whole plan region; the outside flood may be fenced by something other than walls.')

  // Compare with the written overall dimensions that define the plan region.
  const matched = geo.dimensions.filter((d) => d.segment).sort((a, b) => b.valueMm - a.valueMm)
  const writtenW = matched.find((d) => Math.abs(Math.cos(d.angle)) > 0.9)?.valueMm ?? null
  const writtenH = matched.find((d) => Math.abs(Math.sin(d.angle)) > 0.9)?.valueMm ?? null
  const pct = (a: number, b: number) => Math.round(((a - b) / b) * 1000) / 10
  const writtenCheck = {
    overallWidthMm: writtenW,
    overallDepthMm: writtenH,
    widthDeltaPct: writtenW ? pct(bboxMm.w, writtenW) : null,
    depthDeltaPct: writtenH ? pct(bboxMm.h, writtenH) : null,
  }
  if (writtenCheck.widthDeltaPct != null && Math.abs(writtenCheck.widthDeltaPct) > 2) notes.push(`Traced width differs from written ${writtenW} mm by ${writtenCheck.widthDeltaPct}%.`)
  if (writtenCheck.depthDeltaPct != null && Math.abs(writtenCheck.depthDeltaPct) > 2) notes.push(`Traced depth differs from written ${writtenH} mm by ${writtenCheck.depthDeltaPct}%.`)
  notes.push('Outline follows the outer face of the drawn wall lines; features narrower than the opening radius are smoothed away. Written dimensions govern where they differ.')

  return {
    ok: true,
    polygon,
    areaM2: Math.round(areaM2 * 10) / 10,
    perimeterM: Math.round(perimeterPt * mmPerPt / 100) / 10,
    bboxMm,
    bboxPt,
    writtenCheck,
    region,
    cellPt: cell,
    closingRadiusPt: radius,
    openingRadiusPt: open,
    segmentsUsed: used,
    excludedDimensionSegments: dropDim,
    excludedGridSegments: dropGrid,
    gridAxes,
    notes,
  }
}

// ——— sheet summary ———

export interface SheetSummary {
  pageNumber: number
  drawingNo: string | null
  title: string | null
  scaleNotes: string[]
  date: string | null
  project: string[]
  kind: 'cover' | 'plan' | 'schedule' | 'section' | 'elevation' | 'detail' | 'unknown'
  levels: Array<{ label: string; mm: number }>
  statedAreas: Array<{ text: string; m2: number }>
  roomAreas: Array<{ m2: number; text: string }>
  gridLabels: string[]
  keywordHits: Record<string, string[]>
  dimensionCount: number
  textCount: number
  hasPlanRegion: boolean
}

const KEYWORDS: Record<string, RegExp> = {
  foundation: /\b(FOUNDATION|FOOTING|PILE|RAFT|GROUND BEAM|TIE BEAM|PLINTH|BLINDING|LEAN CONCRETE|HARDCORE|BACKFILL|EXCAVAT|SLAB ON GRADE|DPM|DPC|NGL|FGL|FFL|SFL)\b/i,
  structure: /\b(COLUMN|RC\b|REBAR|REINFORC|STRUCTUR|TRUSS|PURLIN|PURLINE)\b/i,
  blockwork: /BLOCK\s?WORK|BLOCKWORK|MASONRY/i,
  lgs: /\bLGS\b|LIGHT GAUGE/i,
  section: /\bSECTION\b/i,
  elevation: /\bELEVATION\b/i,
  plan: /\bPLAN\b/i,
  schedule: /\bSCHEDULE\b/i,
  byOthers: /BY OTHERS?/i,
}

const LEVEL_LABEL = /^(GROUND FLOOR|FIRST FLOOR|SECOND FLOOR|ROOF|PARAPET|FFL|NGL|SFL|TOP OF [A-Z ]+|LEVEL \d+|L\d+|GF|FF)$/i
const DRAWING_NO = /^[A-Z]{1,2}-?\d{3}[A-Z]?$/
const AREA_TEXT = /(\d[\d,]*(?:\.\d+)?)\s*(m\s?²|m\s?2|sq\.?\s*m|sqm)(?![a-z])/i

function nearestBelow(label: GeoText, texts: GeoText[]): GeoText | null {
  let best: GeoText | null = null
  let bestDist = Infinity
  for (const t of texts) {
    if (t === label) continue
    const dy = t.y - label.y
    const dx = t.x - label.x
    if (dy < 4 || dy > 32 || dx < -20 || dx > 90) continue
    if (/:$/.test(t.text) || /^(DATE|REV\.?|SCALE|DRAWING NO\.?|DRAWN|CHECKED|APPROVED|STATUS|INT\. REV\.)/i.test(t.text)) continue
    const dist = Math.hypot(dx, dy * 1.5)
    if (dist < bestDist) {
      bestDist = dist
      best = t
    }
  }
  return best
}

/** What the sheet is: drawing number, title, scales, levels, stated areas, grid, and keyword hits. */
export function sheetSummary(geo: PageGeometry): SheetSummary {
  const texts = geo.texts
  const find = (re: RegExp) => texts.find((t) => re.test(t.text.trim()))
  const titleLabel = find(/^DRAWING TITLE/i)
  const noLabel = find(/^DRAWING NO/i)
  const dateLabel = find(/^DATE:$/i)
  const projectLabel = find(/^Project:$/i)
  const drawingNo =
    (noLabel && nearestBelow(noLabel, texts)?.text) ??
    texts.find((t) => DRAWING_NO.test(t.text.trim()) && t.x > geo.widthPt * 0.75)?.text ??
    null
  const title = titleLabel ? (nearestBelow(titleLabel, texts)?.text ?? null) : null
  const date = dateLabel ? (nearestBelow(dateLabel, texts)?.text ?? null) : null
  const project: string[] = []
  if (projectLabel) {
    for (const t of texts) {
      const dy = t.y - projectLabel.y
      const dx = t.x - projectLabel.x
      if (dy > 4 && dy < 60 && dx > -10 && dx < 75 && t.x > geo.widthPt * 0.7 && !/:$/.test(t.text)) project.push(t.text)
    }
  }
  const scaleNotes = [...new Set(texts.map((t) => t.text.trim()).filter((t) => /^(1\s*:\s*\d{1,4}|As indicated|NTS|SCALE:?\s*NTS)$/i.test(t)))]

  const levels: Array<{ label: string; mm: number }> = []
  for (const t of texts) {
    if (!LEVEL_LABEL.test(t.text.trim())) continue
    const endX = t.x + t.w / 2
    let value: GeoText | null = null
    let valueDist = 30
    for (const v of texts) {
      if (v === t || !/^[+-]?\d{1,6}$/.test(v.text.trim())) continue
      const d = Math.min(Math.hypot(v.x - t.x, v.y - t.y), Math.hypot(v.x - endX, v.y - t.y))
      if (d < valueDist) {
        valueDist = d
        value = v
      }
    }
    if (!value) continue
    const mm = Number(value.text)
    if (!levels.some((l) => l.label.toUpperCase() === t.text.toUpperCase() && l.mm === mm)) levels.push({ label: t.text.trim(), mm })
  }

  const statedAreas: Array<{ text: string; m2: number }> = []
  const roomAreas: Array<{ m2: number; text: string }> = []
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    let m = AREA_TEXT.exec(t.text)
    let label = t.text
    if (!m && /AREA\s*[=:]\s*[\d,.]+\s*m?$/i.test(t.text)) {
      // "BUILT-UP AREA = 516 m" with the ² in the next run
      const n = texts.find((v) => v !== t && Math.abs(v.y - t.y) < 6 && v.x > t.x && v.x - t.x < 60 && /^[²2]$/.test(v.text.trim()))
      if (n) {
        label = `${t.text}${n.text}`
        m = AREA_TEXT.exec(label.replace(/m\s*[²2]$/i, 'm²'))
      }
    }
    if (!m) continue
    const m2 = Number(m[1].replace(/,/g, ''))
    if (!Number.isFinite(m2)) continue
    if (/AREA/i.test(label)) statedAreas.push({ text: label, m2 })
    else roomAreas.push({ m2, text: label })
  }

  const keywordHits: Record<string, string[]> = {}
  for (const [name, re] of Object.entries(KEYWORDS)) {
    const hits = [...new Set(texts.filter((t) => re.test(t.text)).map((t) => t.text.trim()))].slice(0, 12)
    if (hits.length) keywordHits[name] = hits
  }

  const grid = gridAxesFor(geo)
  const region = planRegionFor(geo)
  const upperTitle = (title ?? '').toUpperCase()
  const kind: SheetSummary['kind'] = /COVER/.test(upperTitle)
    ? 'cover'
    : /SCHEDULE/.test(upperTitle)
      ? 'schedule'
      : /ELEVATION/.test(upperTitle)
        ? 'elevation'
        : /SECTION/.test(upperTitle)
          ? 'section'
          : /PLAN/.test(upperTitle) || (region && grid.verticalX.length >= 3)
            ? 'plan'
            : /DETAIL/.test(upperTitle)
              ? 'detail'
              : 'unknown'

  return {
    pageNumber: geo.pageNumber,
    drawingNo,
    title,
    scaleNotes,
    date,
    project,
    kind,
    levels,
    statedAreas,
    roomAreas,
    gridLabels: grid.labels,
    keywordHits,
    dimensionCount: geo.dimensions.length,
    textCount: texts.length,
    hasPlanRegion: Boolean(region),
  }
}

/** Compact JSON for the model: sizes in points and, when a scale is known, millimetres. */
export function summarizeGeometry(
  geo: PageGeometry,
  mmPerPt: number | null,
  limits: { segments?: number; rects?: number; texts?: number; dimensions?: number } = {},
) {
  const segLimit = limits.segments ?? 80
  const rectLimit = limits.rects ?? 60
  const textLimit = limits.texts ?? 120
  const dimLimit = limits.dimensions ?? 120
  const toMm = (pt: number) => (mmPerPt == null ? undefined : Math.round(pt * mmPerPt))
  const region = planRegionFor(geo)
  const inRegion = (s: GeoSegment) =>
    !region ||
    (Math.min(s.x1, s.x2) >= region.x0 && Math.max(s.x1, s.x2) <= region.x1 && Math.min(s.y1, s.y2) >= region.y0 && Math.max(s.y1, s.y2) <= region.y1)
  const segments = geo.segments
    .filter(inRegion)
    .sort((a, b) => b.len - a.len)
    .slice(0, segLimit)
    .map((s) => ({ x1: r1(s.x1), y1: r1(s.y1), x2: r1(s.x2), y2: r1(s.y2), lenPt: r1(s.len), lenMm: toMm(s.len) }))
  const grid = gridAxesFor(geo)
  const sheet = sheetSummary(geo)
  const chains = dimensionChains(geo)
  const rects = [...geo.rects]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, rectLimit)
    .map((r) => ({
      x: r1(r.x),
      y: r1(r.y),
      wPt: r1(r.w),
      hPt: r1(r.h),
      wMm: toMm(r.w),
      hMm: toMm(r.h),
      areaM2: mmPerPt == null ? undefined : Math.round(r.w * r.h * mmPerPt * mmPerPt / 1e4) / 100,
    }))
  const dimensions = geo.dimensions.slice(0, dimLimit).map((d) => ({
    text: d.text,
    valueMm: Math.round(d.valueMm),
    x: r1(d.x),
    y: r1(d.y),
    angleDeg: Math.round((d.angle * 180) / Math.PI),
    onSegment: d.segment
      ? { x1: r1(d.segment.x1), y1: r1(d.segment.y1), x2: r1(d.segment.x2), y2: r1(d.segment.y2) }
      : undefined,
  }))
  const dimKeys = new Set(geo.dimensions.map((d) => `${d.x}:${d.y}`))
  const labels = geo.texts
    .filter((t) => !dimKeys.has(`${t.x}:${t.y}`) && /[A-Za-z]/.test(t.text) && t.text.length <= 60)
    .slice(0, textLimit)
    .map((t) => ({ text: t.text, x: r1(t.x), y: r1(t.y), angleDeg: Math.round((t.angle * 180) / Math.PI) }))
  return {
    pageNumber: geo.pageNumber,
    pageSizePt: { width: r1(geo.widthPt), height: r1(geo.heightPt) },
    coordinateNote:
      'Points are PDF points from the top-left corner of the page. Pass them back to addMeasurement as points.',
    counts: { segments: geo.segments.length, rects: geo.rects.length, texts: geo.texts.length, dimensions: geo.dimensions.length },
    scaleCandidates: geo.scaleCandidates,
    sheet,
    planRegion: region
      ? {
          x0: r1(region.x0),
          y0: r1(region.y0),
          x1: r1(region.x1),
          y1: r1(region.y1),
          note: 'Bounded by the longest matched horizontal and vertical dimension strings. longestSegments are limited to this box.',
        }
      : null,
    gridAxes: {
      verticalX: grid.verticalX.map(r1),
      horizontalY: grid.horizontalY.map(r1),
      labels: grid.labels,
      spacingMm:
        mmPerPt == null
          ? undefined
          : {
              vertical: grid.verticalX.slice(1).map((x, i) => Math.round((x - grid.verticalX[i]) * mmPerPt)),
              horizontal: grid.horizontalY.slice(1).map((y, i) => Math.round((y - grid.horizontalY[i]) * mmPerPt)),
            },
    },
    dimensionChains: chains,
    dimensions,
    rects,
    longestSegments: segments,
    labels,
  }
}

export interface DimensionChain {
  orientation: 'horizontal' | 'vertical'
  /** y (horizontal chain) or x (vertical chain) of the dimension line, in points. */
  atPt: number
  values: number[]
  sumMm: number
  /** The single overall dimension string this chain spans, if one lies parallel and covers the same extent. */
  overallMm: number | null
  deltaMm: number | null
  note: string | null
}

/**
 * Written dimension strings that sit on one dimension line, in order, with their sum and the overall
 * string they add up to. A sum that misses the overall by one or two wall thicknesses is normal
 * (grid centrelines vs wall faces) and worth saying out loud.
 */
export function dimensionChains(geo: PageGeometry): DimensionChain[] {
  const matched = geo.dimensions.filter((d) => d.segment)
  const out: DimensionChain[] = []
  for (const orientation of ['horizontal', 'vertical'] as const) {
    const dims = matched.filter((d) => (orientation === 'horizontal' ? Math.abs(Math.cos(d.angle)) > 0.9 : Math.abs(Math.sin(d.angle)) > 0.9))
    const lineOf = (d: GeoDimension) => (orientation === 'horizontal' ? (d.segment!.y1 + d.segment!.y2) / 2 : (d.segment!.x1 + d.segment!.x2) / 2)
    const along = (d: GeoDimension) => (orientation === 'horizontal' ? d.x : d.y)
    const extent = (d: GeoDimension) =>
      orientation === 'horizontal'
        ? [Math.min(d.segment!.x1, d.segment!.x2), Math.max(d.segment!.x1, d.segment!.x2)]
        : [Math.min(d.segment!.y1, d.segment!.y2), Math.max(d.segment!.y1, d.segment!.y2)]
    const groups: GeoDimension[][] = []
    for (const d of [...dims].sort((a, b) => lineOf(a) - lineOf(b))) {
      const last = groups[groups.length - 1]
      if (last && Math.abs(lineOf(last[0]) - lineOf(d)) < 2.5) last.push(d)
      else groups.push([d])
    }
    for (const group of groups) {
      if (group.length < 2) continue
      group.sort((a, b) => along(a) - along(b))
      const values = group.map((d) => d.valueMm)
      const sumMm = values.reduce((a, b) => a + b, 0)
      const start = Math.min(...group.map((d) => extent(d)[0]))
      const end = Math.max(...group.map((d) => extent(d)[1]))
      // An overall string: same orientation, alone on its line, spanning about the same extent.
      const overall = dims
        .filter((d) => !group.includes(d))
        .filter((d) => {
          const [s, e] = extent(d)
          return Math.abs(s - start) < 12 && Math.abs(e - end) < 12
        })
        .filter((d) => Math.abs(d.valueMm - sumMm) <= d.valueMm * 0.05)
        .sort((a, b) => b.valueMm - a.valueMm)[0]
      const overallMm = overall?.valueMm ?? null
      const deltaMm = overallMm == null ? null : overallMm - sumMm
      out.push({
        orientation,
        atPt: Math.round(lineOf(group[0]) * 10) / 10,
        values,
        sumMm,
        overallMm,
        deltaMm,
        note:
          deltaMm == null
            ? null
            : deltaMm === 0
              ? 'Chain sums to the overall.'
              : `Chain sums to ${sumMm}, overall says ${overallMm}: ${deltaMm > 0 ? '+' : ''}${deltaMm} mm. Usually grid centrelines vs outer wall faces. Say which one you used.`,
      })
    }
  }
  return out.sort((a, b) => b.values.length - a.values.length)
}
