const LINE_KEYS = ['tag', 'sourceMark', 'type', 'system', 'widthMm', 'heightMm', 'quantity', 'unit', 'unitPrice', 'notes']

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function inline(value: unknown): string {
  return String(value)
    .replace(/[\\*_`[\]]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  })
}

function looksLikeLine(row: Record<string, unknown>): boolean {
  return LINE_KEYS.some((key) => row[key] != null && row[key] !== '')
}

function lineRows(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    const rows = value.filter(isRecord)
    if (rows.length === 0 || rows.length < value.length) return null
    return rows.filter(looksLikeLine).length * 2 >= rows.length ? rows : null
  }
  if (!isRecord(value)) return null
  let best: Record<string, unknown>[] | null = null
  for (const inner of Object.values(value)) {
    if (!Array.isArray(inner)) continue
    const rows = lineRows(inner)
    if (rows && (!best || rows.length > best.length)) best = rows
  }
  if (best) return best
  return looksLikeLine(value) ? [value] : null
}

function formatLine(row: Record<string, unknown>): string {
  const tag = typeof row.tag === 'string' ? row.tag.trim() : ''
  const mark = typeof row.sourceMark === 'string' ? row.sourceMark.trim() : ''
  const type = typeof row.type === 'string' ? row.type.trim() : ''
  const system = typeof row.system === 'string' ? row.system.trim() : ''
  const width = typeof row.widthMm === 'number' ? formatNumber(row.widthMm) : ''
  const height = typeof row.heightMm === 'number' ? formatNumber(row.heightMm) : ''
  const quantity = typeof row.quantity === 'number' ? formatNumber(row.quantity) : ''
  const unit = typeof row.unit === 'string' ? row.unit.trim() : ''
  const price = typeof row.unitPrice === 'number' && row.unitPrice !== 0 ? formatNumber(row.unitPrice) : ''

  const label = inline(tag || mark || type || 'Item')
  const detail: string[] = []
  if (mark && tag) detail.push(inline(mark))
  if (type) detail.push(inline(type))
  if (system) detail.push(inline(system))
  if (width && height) detail.push(`${width} × ${height} mm`)
  else if (width) detail.push(`${width} mm`)
  if (quantity) detail.push(unit ? `qty ${quantity} ${inline(unit)}` : `qty ${quantity}`)
  if (price) detail.push(price)

  return detail.length ? `**${label}** — ${detail.join(' · ')}` : `**${label}**`
}

function formatPayload(value: unknown): string | null {
  const rows = lineRows(value)
  if (!rows) return null
  const extras: string[] = []
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (item == null || item === '' || Array.isArray(item) || isRecord(item)) continue
      const name = key.replace(/([a-z])([A-Z])/g, '$1 $2')
      extras.push(`**${inline(name)}:** ${typeof item === 'number' ? formatNumber(item) : inline(item)}`)
    }
  }
  const count = rows.length === 1 ? '**1 item**' : `**${rows.length} items**`
  const list = rows.map((row) => `- ${formatLine(row)}`).join('\n')
  return `${[...extras, count].join('\n\n')}\n\n${list}`
}

function extractJson(text: string, start: number): { raw: string; end: number } | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') depth += 1
    else if (ch === '}' || ch === ']') {
      depth -= 1
      if (depth === 0) return { raw: text.slice(start, i + 1), end: i + 1 }
      if (depth < 0) return null
    }
  }
  return null
}

/** Turn a dumped takeoff JSON blob into a short list. Leave prose and markdown alone. */
export function formatReply(text: string): string {
  let out = ''
  let cursor = 0
  while (cursor < text.length) {
    const open = text.slice(cursor).search(/[[{]/)
    if (open < 0) {
      out += text.slice(cursor)
      break
    }
    const start = cursor + open
    const found = extractJson(text, start)
    if (!found) {
      out += text.slice(cursor, start + 1)
      cursor = start + 1
      continue
    }
    let formatted: string | null = null
    try {
      formatted = formatPayload(JSON.parse(found.raw) as unknown)
    } catch {
      formatted = null
    }
    if (!formatted) {
      out += text.slice(cursor, start + 1)
      cursor = start + 1
      continue
    }
    out += text.slice(cursor, start)
    if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n'
    out += formatted
    if (found.end < text.length && !formatted.endsWith('\n')) out += '\n\n'
    cursor = found.end
  }
  return out.trim()
}
