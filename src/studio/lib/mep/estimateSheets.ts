/** Estimate sheets drawn from the architectural room list. They are not an issued services drawing. */

export interface PlanRoom {
  name: string
  area: number
}

export function mepSheetName(sourceName: string) {
  const stem = sourceName.replace(/\.pdf$/i, '')
  const swapped = stem.replace(/ARCH/gi, 'MEP')
  return `${swapped === stem ? `${stem} - MEP` : swapped}.pdf`
}

export function roomsFromPlanText(text: string): PlanRoom[] {
  const rooms: PlanRoom[] = []
  const re = /(\d+)\s*m²\s*([A-Z][A-Z ]{2,}?)\s+\d+/g
  for (const match of text.matchAll(re)) {
    const area = Number(match[1])
    const name = match[2].replace(/\s+/g, ' ').trim()
    if (area > 0 && name && !rooms.some((room) => room.name === name && room.area === area)) rooms.push({ name, area })
  }
  return rooms
}

function wet(name: string) {
  return /TOILET|BATH|KITCHEN|WET/.test(name)
}

function lightsFor(room: PlanRoom) {
  if (wet(room.name)) return { BL: 2 }
  return { DL: Math.max(2, Math.round(room.area / 12)) }
}

function powerFor(room: PlanRoom) {
  const so = Math.max(2, Math.round(room.area / 20))
  const ac = room.area >= 15 && !wet(room.name) && !/STORAGE|SERVER/.test(room.name) ? 1 : 0
  return ac ? { SO: so, AC: ac } : { SO: so }
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function pack(rooms: PlanRoom[]) {
  const placed: Array<PlanRoom & { x: number; y: number; w: number; h: number }> = []
  let x = 36
  let y = 520
  let rowH = 0
  for (const room of rooms) {
    const w = Math.max(110, Math.min(280, 70 + room.area * 0.7))
    const h = Math.max(70, Math.min(160, 50 + room.area * 0.35))
    if (x + w > 800) {
      x = 36
      y -= rowH + 16
      rowH = 0
    }
    placed.push({ ...room, x, y: y - h, w, h })
    x += w + 12
    rowH = Math.max(rowH, h)
  }
  return placed
}

function symbols(room: PlanRoom & { x: number; y: number; w: number; h: number }, counts: Record<string, number>) {
  const ops: string[] = []
  const entries = Object.entries(counts)
  let n = 0
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)))
  for (const [code, count] of entries) {
    for (let i = 0; i < count; i += 1) {
      const col = n % cols
      const row = Math.floor(n / cols)
      const x = room.x + 14 + col * 22
      const y = room.y + room.h - 28 - row * 14
      ops.push(`BT /F1 8 Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(code)}) Tj ET`)
      n += 1
    }
  }
  return ops
}

function sheet(title: string, note: string, rooms: Array<PlanRoom & { x: number; y: number; w: number; h: number }>, countsFor: (room: PlanRoom) => Record<string, number>, extra: string[]) {
  const ops = [
    '0.6 w',
    '24 24 m 818 24 l 818 578 l 24 578 l h S',
    `BT /F1 16 Tf 36 590 Td (${pdfEscape(title)}) Tj ET`,
    `BT /F1 8 Tf 36 12 Td (${pdfEscape(note)}) Tj ET`,
    ...extra,
  ]
  for (const room of rooms) {
    ops.push(`${room.x.toFixed(1)} ${room.y.toFixed(1)} m ${(room.x + room.w).toFixed(1)} ${room.y.toFixed(1)} l ${(room.x + room.w).toFixed(1)} ${(room.y + room.h).toFixed(1)} l ${room.x.toFixed(1)} ${(room.y + room.h).toFixed(1)} l h S`)
    ops.push(`BT /F1 8 Tf ${(room.x + 8).toFixed(1)} ${(room.y + 8).toFixed(1)} Td (${pdfEscape(`${room.name} ${room.area} m2`)}) Tj ET`)
    ops.push(...symbols(room, countsFor(room)))
  }
  return ops.join('\n')
}

function buildPdf(streams: string[]) {
  const objects: string[] = []
  const kids: string[] = []
  let next = 3
  const pageIds: number[] = []
  const contentIds: number[] = []
  for (const stream of streams) {
    pageIds.push(next)
    contentIds.push(next + 1)
    next += 2
  }
  const fontId = next
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj')
  objects.push(`2 0 obj << /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >> endobj`)
  streams.forEach((stream, index) => {
    kids.push(
      `${pageIds[index]} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 620] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj`,
    )
    kids.push(`${contentIds[index]} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`)
  })
  kids.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj`)
  const body = [...objects, ...kids]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of body) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${body.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= body.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer << /Size ${body.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

export function buildMepEstimatePdf(text: string) {
  const found = roomsFromPlanText(text)
  const rooms = pack(found.length ? found : [{ name: 'GROUND FLOOR', area: 516 }])
  const lighting = sheet(
    'GROUND FLOOR LIGHTING LAYOUT',
    'Estimate sheet from the architectural room areas. Not an issued services drawing. DL downlight, BL wet-area bulkhead, EL emergency.',
    rooms,
    lightsFor,
    ['BT /F1 8 Tf 36 40 Td (EL) Tj ET', 'BT /F1 8 Tf 58 40 Td (EL) Tj ET', 'BT /F1 8 Tf 80 40 Td (EL) Tj ET', 'BT /F1 8 Tf 102 40 Td (EL) Tj ET'],
  )
  const power = sheet(
    'GROUND FLOOR POWER LAYOUT',
    'Estimate sheet from the architectural room areas. Not an issued services drawing. SO socket, AC isolator.',
    rooms,
    powerFor,
    [],
  )
  return buildPdf([lighting, power])
}
