/** Foundation / footing marks — first install step, stay visible as the sequence base. */
export function isFoundationMark(raw: string | null | undefined): boolean {
  const name = String(raw || '')
    .toLowerCase()
    .replace(/^\*/, '')
    .trim()
  if (!name) return false
  return (
    /\bfoundations?\b/i.test(name) ||
    /uq[_-]?foundation/i.test(name) ||
    /\bfootings?\b/i.test(name) ||
    /\bfooting\s*walls?\b/i.test(name) ||
    /\bwall\s*foundations?\b/i.test(name) ||
    /\bbearing\s*footings?\b/i.test(name)
  )
}

export function canonicalBimsfMark(raw: string | null | undefined): string | null {
  const name = String(raw || '')
    .replace(/^\*/, '')
    .trim()
  if (!name) return null
  if (isFoundationMark(name)) return 'Foundation'
  if (/^anchor\s*bolts?$/i.test(name)) return 'Anchor Bolt'
  if (/^connectors?$/i.test(name)) return 'Connectors'
  if (/^[A-Za-z]{1,4}[-_]?\d{1,8}(?:-\d+)?$/.test(name)) return name
  const embedded = name.match(/\b((?:NLB|ELB|ILB|LB|CD|FT|RT)[-_]?\d{1,8}(?:-\d+)?)\b/i)
  return embedded ? embedded[1].toUpperCase() : null
}

/** Real BIMSF marks only — not IFC member names or invented "Wall Panel" labels. */
export function isRealBimsfMark(raw: string | null | undefined): boolean {
  return canonicalBimsfMark(raw) !== null
}

/** Turn a row into its BIMSF mark. Returns null for IFC members with no real mark. */
export function extractPanelMark(panel: {
  name?: string | null
  tag?: string | null
  objectType?: string | null
  metadata?: Record<string, unknown> | null
}): string | null {
  const meta = panel.metadata || {}
  for (const raw of [meta.BIMSF_Container, meta.bimsf, meta.mark, meta.Mark, meta.panelMark]) {
    const mark = canonicalBimsfMark(typeof raw === 'string' ? raw : '')
    if (mark) return mark
  }

  const name = String(panel.name || panel.tag || '')
  const own = canonicalBimsfMark(name)
  if (own) return own

  return null
}

export function collapseMembersToPanels<T extends {
  id: string
  name?: string | null
  tag?: string | null
  objectType?: string | null
  metadata?: Record<string, unknown> | null
}>(panels: T[]): Array<T & { panelMark: string; memberCount: number; memberIds: string[] }> {
  const map = new Map<string, T & { panelMark: string; memberCount: number; memberIds: string[] }>()
  for (const panel of panels) {
    const mark = extractPanelMark(panel)
    if (!mark) continue
    const key = mark.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.memberCount += 1
      existing.memberIds.push(panel.id)
    } else {
      map.set(key, {
        ...panel,
        name: mark,
        tag: mark,
        panelMark: mark,
        memberCount: 1,
        memberIds: [panel.id],
      })
    }
  }
  return [...map.values()]
}
