import type { PageGeometry } from '../geometryCore'
import type { SheetMark } from './types'

export interface DiagramLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ElectricalDiagram {
  x0: number
  y0: number
  width: number
  height: number
  lines: DiagramLine[]
  marks: SheetMark[]
}

function axisAligned(x1: number, y1: number, x2: number, y2: number) {
  return Math.abs(x1 - x2) < 1.2 || Math.abs(y1 - y2) < 1.2
}

/** Plan lines and symbol marks for one sheet, cropped to the floor plan. */
export function electricalDiagram(geo: PageGeometry, drawingId: string, codes: string[]): ElectricalDiagram | null {
  const wanted = new Set(codes.map((code) => code.toUpperCase()))
  const walls = geo.segments.filter(
    (segment) => axisAligned(segment.x1, segment.y1, segment.x2, segment.y2) && segment.len >= 40 && segment.len < geo.widthPt * 0.55,
  )
  const body = walls.filter((segment) => {
    const x = (segment.x1 + segment.x2) / 2
    const y = (segment.y1 + segment.y2) / 2
    return x < geo.widthPt * 0.78 && y > geo.heightPt * 0.32 && y < geo.heightPt * 0.9
  })
  const lines = (body.length > 30 ? body : walls).map((segment) => ({ x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2 }))
  if (lines.length < 8) return null
  const candidates: SheetMark[] = []
  for (const text of geo.texts) {
    const code = text.text.trim().toUpperCase()
    if (!wanted.has(code)) continue
    candidates.push({ id: '', drawingId, code, x: text.x, y: text.y })
  }
  const clustered = largestCluster(candidates)
  const pad = 36
  const xs = clustered.length >= 8 ? clustered.map((mark) => mark.x) : lines.flatMap((line) => [line.x1, line.x2])
  const ys = clustered.length >= 8 ? clustered.map((mark) => mark.y) : lines.flatMap((line) => [line.y1, line.y2])
  const x0 = Math.min(...xs) - pad
  const y0 = Math.min(...ys) - pad
  const x1 = Math.max(...xs) + pad
  const y1 = Math.max(...ys) + pad
  const planLines = lines.filter((line) => {
    const x = (line.x1 + line.x2) / 2
    const y = (line.y1 + line.y2) / 2
    return x >= x0 && x <= x1 && y >= y0 && y <= y1
  })
  const seen = new Map<string, number>()
  const marks = clustered
    .filter((mark) => mark.x >= x0 && mark.x <= x1 && mark.y >= y0 && mark.y <= y1)
    .map((mark) => {
      const n = (seen.get(mark.code) ?? 0) + 1
      seen.set(mark.code, n)
      return { ...mark, id: `${drawingId}-${mark.code}-${n}` }
    })
  return { x0, y0, width: x1 - x0, height: y1 - y0, lines: planLines.length > 8 ? planLines : lines, marks }
}

/** Drop a side column of legend tags separated from the plan by a wide gap. */
function largestCluster(marks: SheetMark[]): SheetMark[] {
  if (marks.length < 8) return marks
  const sorted = [...marks].sort((a, b) => a.x - b.x)
  const groups: SheetMark[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = groups[groups.length - 1]
    if (sorted[i].x - previous[previous.length - 1].x > 160) groups.push([sorted[i]])
    else previous.push(sorted[i])
  }
  return groups.sort((a, b) => b.length - a.length)[0]
}
