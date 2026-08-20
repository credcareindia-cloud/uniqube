/** Turn IFC member/family names into a BIMSF-style panel mark. Returns null for members. */
export function extractPanelMark(panel: {
  name?: string | null
  tag?: string | null
  objectType?: string | null
  metadata?: Record<string, unknown> | null
}): string | null {
  const meta = panel.metadata || {}
  const fromMeta = String(meta.BIMSF_Container || meta.bimsf || meta.mark || meta.Mark || '')
    .replace(/^\*/, '')
    .trim()
  if (fromMeta) return fromMeta

  const name = String(panel.name || panel.tag || '')
  const objectType = String(panel.objectType || '')

  const assembly = name.match(/Assembly:([^:]+)/i)
  if (assembly?.[1]) {
    return assembly[1].replace(/-\d+$/, '').trim()
  }

  const mark = name.match(/\b((?:NLB|ELB|LB|CD|FT|RT)[-_]?\d+[A-Z0-9-]*)\b/i)
  if (mark?.[1]) {
    return mark[1].replace(/-\d+$/, '').toUpperCase()
  }

  if (
    /foundation/i.test(name) ||
    /IfcFooting/i.test(objectType) ||
    /^Floor:/i.test(name) ||
    /IfcSlab/i.test(objectType)
  ) {
    return 'Foundation'
  }

  if (/^Basic Wall:/i.test(name) || /IfcWall/i.test(objectType)) {
    return 'Wall Panel'
  }

  if (/IfcDoor/i.test(objectType) || /^Door:/i.test(name)) return 'Door Panel'
  if (/IfcWindow/i.test(objectType) || /^Window:/i.test(name)) return 'Window Panel'

  if (
    /IfcFlow/i.test(objectType) ||
    /^Pipe /i.test(name) ||
    /Duct/i.test(name)
  ) {
    return 'MEP Panel'
  }

  return null
}

export function collapseMembersToPanels<T extends {
  id: string
  name?: string | null
  tag?: string | null
  objectType?: string | null
  metadata?: Record<string, unknown> | null
}>(panels: T[]): Array<T & { panelMark: string; memberCount: number }> {
  const map = new Map<string, T & { panelMark: string; memberCount: number }>()
  for (const panel of panels) {
    const mark = extractPanelMark(panel)
    if (!mark) continue
    const key = mark.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.memberCount += 1
    } else {
      map.set(key, {
        ...panel,
        name: mark,
        tag: mark,
        panelMark: mark,
        memberCount: 1,
      })
    }
  }
  return [...map.values()]
}
