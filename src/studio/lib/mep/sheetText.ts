import type { FixtureRow, LegendEntry, MepDrawing, MepModule, SheetMark } from './types'

const SKIP = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'W/P', 'AND', 'LED', 'FOR', 'THE', 'IN', 'OF', 'TO', 'BE', 'AN', 'OR', 'IP', 'NO', 'MM', 'REV', 'KD'])

export function moduleOf(title: string, name: string): MepModule | 'unknown' {
  const text = `${title} ${name}`.toUpperCase()
  if (/UNDERGROUND|DUCT BANK|TRENCH/.test(text)) return 'underground'
  if (/FIRE|ALARM|SPRINKLER|-FA-/.test(text)) return 'fire'
  if (/PLUMB|SANITAR|WATER|-PL-/.test(text)) return 'plumbing'
  if (/MECHANIC|HVAC|DUCT|-AC-|-ME-/.test(text)) return 'mechanical'
  if (/LIGHTING|CEILING|-EL-/.test(text)) return 'ceiling'
  if (/POWER|-EP-/.test(text)) return 'wall'
  return 'unknown'
}

export function floorOf(text: string) {
  if (/GROUND FLOOR/i.test(text) && /ROOF/i.test(text)) return 'Ground floor and roof'
  if (/GROUND FLOOR/i.test(text)) return 'Ground floor'
  if (/FIRST FLOOR/i.test(text)) return 'First floor'
  if (/ROOF/i.test(text)) return 'Roof'
  return ''
}

export function titleOf(text: string, name: string) {
  const layout = text.match(/((?:GROUND|FIRST|SECOND|ROOF)[A-Z0-9 &/'-]*LAYOUT)/i)
  if (layout) return layout[1].replace(/\s+/g, ' ').trim()
  return name.replace(/\.pdf$/i, '')
}

export function numberOf(text: string, name: string) {
  const found = text.match(/\b\d{2}A-[A-Z]{2,}-[A-Z]{2}-\d{2}\b/) ?? name.match(/\b\d{2}A-[A-Z]{2,}-[A-Z]{2}-\d{2}\b/)
  return found?.[0] ?? ''
}

export function proposeSheet(file: { id: string; name: string }, text: string, tokens: string[]): { drawing: MepDrawing; legend: LegendEntry[]; fixtures: FixtureRow[] } {
  const title = titleOf(text, file.name)
  const drawing: MepDrawing = {
    id: file.id,
    name: file.name,
    title,
    number: numberOf(text, file.name),
    floor: floorOf(title),
    module: moduleOf(`${title} ${file.name}`, file.name),
    pageNumber: 1,
    pageWidth: 0,
    pageHeight: 0,
  }
  const legend: LegendEntry[] = []
  const fixtures: FixtureRow[] = []
  if (drawing.module !== 'wall' && drawing.module !== 'ceiling') return { drawing, legend, fixtures }

  const counts = new Map<string, number>()
  for (const raw of tokens) {
    const token = raw.trim().toUpperCase()
    if (!isSymbolToken(token)) continue
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  const tags = [...counts.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1])
  for (const [code, count] of tags) {
    const id = `${file.id}-${code}`
    legend.push({ id, code, description: 'Confirm this symbol on the legend', module: drawing.module })
    fixtures.push({
      id,
      drawingId: file.id,
      code,
      description: 'Confirm this symbol on the legend',
      module: drawing.module,
      floor: drawing.floor,
      count,
      gang: 1,
      source: 'counted',
    })
  }
  return { drawing, legend, fixtures }
}

export function isSymbolToken(token: string) {
  return !SKIP.has(token) && (/^[A-Z]{1,2}$/.test(token) || /^[A-Z]\/[A-Z]$/.test(token))
}

export function placedMarks(drawingId: string, items: Array<{ text: string; x: number; y: number }>, codes: Set<string>): SheetMark[] {
  const marks: SheetMark[] = []
  const seen = new Map<string, number>()
  for (const item of items) {
    const code = item.text.trim().toUpperCase()
    if (!codes.has(code) || !isSymbolToken(code)) continue
    const n = (seen.get(code) ?? 0) + 1
    seen.set(code, n)
    marks.push({ id: `${drawingId}-${code}-${n}`, drawingId, code, x: item.x, y: item.y })
  }
  return marks
}
