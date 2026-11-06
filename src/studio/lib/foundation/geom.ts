import type { Axis, PtMm } from './types.ts'

export interface RectMm {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Interval = [number, number]

export function mergeIntervals(list: Interval[], gapTol = 0): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1] + gapTol) last[1] = Math.max(last[1], iv[1])
    else out.push([iv[0], iv[1]])
  }
  return out
}

export function polygonArea(poly: PtMm[]): number {
  let a2 = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a2 += p.x * q.y - q.x * p.y
  }
  return Math.abs(a2) / 2
}

export function polygonPerimeter(poly: PtMm[]): number {
  let p = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    p += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return p
}

export function pointInPolygon(pt: PtMm, poly: PtMm[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function bboxOf(poly: PtMm[]): RectMm {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Distance from a point to the nearest edge of a polygon. */
export function distanceToPolygonEdge(pt: PtMm, poly: PtMm[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2))
    best = Math.min(best, Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)))
  }
  return best
}

/** Axis-aligned rectangle around a centreline segment: half-width each side, square caps of the same half-width. */
export function bufferLine(axis: Axis, pos: number, a: number, b: number, half: number, capHalf = half): RectMm {
  return axis === 'h'
    ? { x0: a - capHalf, x1: b + capHalf, y0: pos - half, y1: pos + half }
    : { y0: a - capHalf, y1: b + capHalf, x0: pos - half, x1: pos + half }
}

/**
 * Compressed grid over a set of axis-aligned rectangles and (optionally) a rectilinear clip polygon.
 * Exact union area and perimeter; corners and T-junctions are counted once (spec Module 9 "merged polygons").
 */
export class CompressedGrid {
  readonly xs: number[]
  readonly ys: number[]
  readonly W: number
  readonly H: number
  readonly cells: Uint8Array

  constructor(coords: { xs: number[]; ys: number[] }) {
    this.xs = uniqueSorted(coords.xs)
    this.ys = uniqueSorted(coords.ys)
    this.W = Math.max(0, this.xs.length - 1)
    this.H = Math.max(0, this.ys.length - 1)
    this.cells = new Uint8Array(this.W * this.H)
  }

  static forRects(rects: RectMm[], poly?: PtMm[]) {
    const xs: number[] = []
    const ys: number[] = []
    for (const r of rects) xs.push(r.x0, r.x1), ys.push(r.y0, r.y1)
    for (const p of poly ?? []) xs.push(p.x), ys.push(p.y)
    return new CompressedGrid({ xs, ys })
  }

  idx(i: number, j: number) {
    return j * this.W + i
  }

  centre(i: number, j: number): PtMm {
    return { x: (this.xs[i] + this.xs[i + 1]) / 2, y: (this.ys[j] + this.ys[j + 1]) / 2 }
  }

  cellArea(i: number, j: number) {
    return (this.xs[i + 1] - this.xs[i]) * (this.ys[j + 1] - this.ys[j])
  }

  markRect(r: RectMm, value = 1) {
    const i0 = lowerBound(this.xs, r.x0)
    const i1 = lowerBound(this.xs, r.x1)
    const j0 = lowerBound(this.ys, r.y0)
    const j1 = lowerBound(this.ys, r.y1)
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) this.cells[this.idx(i, j)] = value
  }

  markPolygon(poly: PtMm[], value = 1) {
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (pointInPolygon(this.centre(i, j), poly)) this.cells[this.idx(i, j)] = value
  }

  /** Keep only cells where predicate(mask value) holds. */
  filter(pred: (v: number) => boolean) {
    for (let k = 0; k < this.cells.length; k++) if (!pred(this.cells[k])) this.cells[k] = 0
  }

  area(): number {
    let a = 0
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (this.cells[this.idx(i, j)]) a += this.cellArea(i, j)
    return a
  }

  perimeter(): number {
    let p = 0
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= this.W || j >= this.H ? 0 : this.cells[this.idx(i, j)] ? 1 : 0)
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        if (!at(i, j)) continue
        const w = this.xs[i + 1] - this.xs[i]
        const h = this.ys[j + 1] - this.ys[j]
        if (!at(i, j - 1)) p += w
        if (!at(i, j + 1)) p += w
        if (!at(i - 1, j)) p += h
        if (!at(i + 1, j)) p += h
      }
    }
    return p
  }

  /** Cells as merged rectangles (one per row run), for drawing. */
  rects(): RectMm[] {
    const out: RectMm[] = []
    for (let j = 0; j < this.H; j++) {
      let start = -1
      for (let i = 0; i <= this.W; i++) {
        const on = i < this.W && this.cells[this.idx(i, j)]
        if (on && start < 0) start = i
        if (!on && start >= 0) {
          out.push({ x0: this.xs[start], x1: this.xs[i], y0: this.ys[j], y1: this.ys[j + 1] })
          start = -1
        }
      }
    }
    return out
  }
}

/** Union area and perimeter of rectangles, optionally clipped to a polygon. */
export function unionArea(rects: RectMm[], clip?: PtMm[]): { areaMm2: number; perimeterMm: number; grid: CompressedGrid } {
  const grid = CompressedGrid.forRects(rects, clip)
  for (const r of rects) grid.markRect(r)
  if (clip) {
    const mask = new Uint8Array(grid.cells)
    grid.cells.fill(0)
    grid.markPolygon(clip)
    for (let k = 0; k < grid.cells.length; k++) grid.cells[k] = grid.cells[k] && mask[k] ? 1 : 0
  }
  return { areaMm2: grid.area(), perimeterMm: grid.perimeter(), grid }
}

/** Area of polygon minus the union of rectangles. */
export function polygonMinusRects(poly: PtMm[], rects: RectMm[]): { areaMm2: number; grid: CompressedGrid } {
  const grid = CompressedGrid.forRects(rects, poly)
  grid.markPolygon(poly)
  for (const r of rects) grid.markRect(r, 0)
  return { areaMm2: grid.area(), grid }
}

/**
 * Partition a rectilinear polygon by cut segments (wall centrelines). Returns connected regions of
 * grid cells; two neighbouring cells are separated when a cut covers their shared edge.
 */
export interface Region {
  id: number
  cells: Array<[number, number]>
  bbox: RectMm
  areaMm2: number
}

export function partition(poly: PtMm[], cuts: Array<{ axis: Axis; pos: number; a: number; b: number }>, snapTol = 60): { grid: CompressedGrid; regions: Region[] } {
  const xs: number[] = poly.map((p) => p.x)
  const ys: number[] = poly.map((p) => p.y)
  for (const c of cuts) {
    if (c.axis === 'h') ys.push(c.pos), xs.push(c.a, c.b)
    else xs.push(c.pos), ys.push(c.a, c.b)
  }
  const grid = new CompressedGrid({ xs: snapCoords(xs, snapTol), ys: snapCoords(ys, snapTol) })
  grid.markPolygon(poly)
  const { W, H } = grid
  // blockedH[j*W+i]: edge between cell (i, j) and (i, j+1) is cut (a horizontal wall at ys[j+1]).
  // blockedV[j*W+i]: edge between cell (i, j) and (i+1, j) is cut (a vertical wall at xs[i+1]).
  const blockedH = new Uint8Array(W * H)
  const blockedV = new Uint8Array(W * H)
  for (const c of cuts) {
    if (c.axis === 'h') {
      const j = nearestIndex(grid.ys, c.pos, snapTol)
      if (j <= 0 || j >= grid.ys.length - 1) continue
      for (let i = 0; i < W; i++) {
        if (grid.xs[i] >= c.a - snapTol && grid.xs[i + 1] <= c.b + snapTol) blockedH[(j - 1) * W + i] = 1
      }
    } else {
      const i = nearestIndex(grid.xs, c.pos, snapTol)
      if (i <= 0 || i >= grid.xs.length - 1) continue
      for (let j = 0; j < H; j++) {
        if (grid.ys[j] >= c.a - snapTol && grid.ys[j + 1] <= c.b + snapTol) blockedV[j * W + (i - 1)] = 1
      }
    }
  }
  const label = new Int32Array(W * H)
  const regions: Region[] = []
  for (let start = 0; start < W * H; start++) {
    if (!grid.cells[start] || label[start]) continue
    const id = regions.length + 1
    const cells: Array<[number, number]> = []
    const stack = [start]
    label[start] = id
    while (stack.length) {
      const k = stack.pop()!
      const i = k % W
      const j = (k - i) / W
      cells.push([i, j])
      const tryGo = (ni: number, nj: number, blocked: boolean) => {
        if (blocked || ni < 0 || nj < 0 || ni >= W || nj >= H) return
        const nk = nj * W + ni
        if (!grid.cells[nk] || label[nk]) return
        label[nk] = id
        stack.push(nk)
      }
      tryGo(i + 1, j, Boolean(blockedV[j * W + i]))
      tryGo(i - 1, j, i > 0 && Boolean(blockedV[j * W + i - 1]))
      tryGo(i, j + 1, Boolean(blockedH[j * W + i]))
      tryGo(i, j - 1, j > 0 && Boolean(blockedH[(j - 1) * W + i]))
    }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let area = 0
    for (const [i, j] of cells) {
      x0 = Math.min(x0, grid.xs[i])
      x1 = Math.max(x1, grid.xs[i + 1])
      y0 = Math.min(y0, grid.ys[j])
      y1 = Math.max(y1, grid.ys[j + 1])
      area += grid.cellArea(i, j)
    }
    regions.push({ id, cells, bbox: { x0, y0, x1, y1 }, areaMm2: area })
  }
  return { grid, regions }
}

/** FZ-02: greedy decomposition of a cell region into maximal rectangles, largest first. */
export function rectangularDecompose(grid: CompressedGrid, region: Region): RectMm[] {
  const { W } = grid
  const inRegion = new Uint8Array(grid.W * grid.H)
  for (const [i, j] of region.cells) inRegion[j * W + i] = 1
  const out: RectMm[] = []
  let guard = 0
  while (guard++ < 500) {
    // find the largest-area rectangle of still-unassigned region cells
    let best: { i0: number; j0: number; i1: number; j1: number; area: number } | null = null
    for (const [i, j] of region.cells) {
      if (!inRegion[j * W + i]) continue
      // extend right as far as possible, then down while every row stays full
      let i1 = i
      while (i1 + 1 < grid.W && inRegion[j * W + i1 + 1]) i1++
      let j1 = j
      let width = i1
      while (j1 + 1 < grid.H) {
        let ok = true
        for (let ii = i; ii <= width; ii++) if (!inRegion[(j1 + 1) * W + ii]) {
          ok = false
          break
        }
        if (!ok) break
        j1++
      }
      // also try the tallest-first variant for this corner
      for (const [ci1, cj1] of [[width, j1]] as Array<[number, number]>) {
        const area = (grid.xs[ci1 + 1] - grid.xs[i]) * (grid.ys[cj1 + 1] - grid.ys[j])
        if (!best || area > best.area) best = { i0: i, j0: j, i1: ci1, j1: cj1, area }
      }
      let j2 = j
      while (j2 + 1 < grid.H && inRegion[(j2 + 1) * W + i]) j2++
      let i2 = i
      let ok = true
      while (ok && i2 + 1 < grid.W) {
        for (let jj = j; jj <= j2; jj++) if (!inRegion[jj * W + i2 + 1]) {
          ok = false
          break
        }
        if (ok) i2++
      }
      const area2 = (grid.xs[i2 + 1] - grid.xs[i]) * (grid.ys[j2 + 1] - grid.ys[j])
      if (!best || area2 > best.area) best = { i0: i, j0: j, i1: i2, j1: j2, area: area2 }
    }
    if (!best) break
    for (let j = best.j0; j <= best.j1; j++) for (let i = best.i0; i <= best.i1; i++) inRegion[j * W + i] = 0
    out.push({ x0: grid.xs[best.i0], y0: grid.ys[best.j0], x1: grid.xs[best.i1 + 1], y1: grid.ys[best.j1 + 1] })
  }
  return out
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
}

/** Collapse coordinates closer than tol into one (the first seen), so near-collinear walls share a grid line. */
function snapCoords(values: number[], tol: number): number[] {
  const sorted = uniqueSorted(values)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length && v - out[out.length - 1] < tol) continue
    out.push(v)
  }
  return out
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < v - 1e-6) lo = mid + 1
    else hi = mid
  }
  return lo
}

function nearestIndex(arr: number[], v: number, tol: number): number {
  let best = -1
  let bestD = tol
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v)
    if (d <= bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function round2(v: number) {
  return Math.round(v * 100) / 100
}
