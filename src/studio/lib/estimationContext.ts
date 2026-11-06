import type { PriceSheetRow, ProjectSetup } from '../types'
import { componentLabel, disciplineLabel } from './projectCatalog'

const MAX_PRICE_LINES = 90
const MAX_CONTEXT_CHARS = 6500

/**
 * Compact project-setup + price-sheet block for LLM prompts.
 * Prefer rates that match selected materials; otherwise discipline-scoped sample.
 */
export function buildEstimationContext(
  projectSetup: ProjectSetup,
  priceSheet: PriceSheetRow[],
): string {
  const parts: string[] = []

  if (projectSetup.completed || projectSetup.projectName.trim()) {
    parts.push('PROJECT SETUP (authoritative — scope the takeoff to this):')
    parts.push(
      `- Project: ${projectSetup.projectName.trim() || '(unnamed)'}`,
    )
    parts.push(`- Floors: ${projectSetup.floors}`)
    parts.push(
      `- Disciplines: ${
        projectSetup.disciplines.length
          ? projectSetup.disciplines.map(disciplineLabel).join(', ')
          : '(none selected)'
      }`,
    )

    for (let floor = 1; floor <= projectSetup.floors; floor++) {
      const comps = projectSetup.floorComponents[floor] ?? []
      if (!comps.length) {
        parts.push(`- Floor ${floor}: (no components selected)`)
        continue
      }
      parts.push(`- Floor ${floor} components:`)
      for (const cid of comps) {
        const mats = projectSetup.floorMaterials[floor]?.[cid] ?? []
        if (!mats.length) {
          parts.push(`  · ${componentLabel(cid)} — materials TBD`)
          continue
        }
        const matBits = mats.map((m) => {
          const row = priceSheet.find(
            (r) =>
              r.componentId === cid &&
              r.materialId === m.materialId &&
              r.variantId === m.variantId,
          )
          if (row) {
            return `${row.materialLabel} / ${row.variantLabel}`
          }
          return `${m.materialId}/${m.variantId}`
        })
        parts.push(`  · ${componentLabel(cid)}: ${matBits.join('; ')}`)
      }
    }
  } else {
    parts.push(
      'PROJECT SETUP: not completed yet — extract openings/materials generally; leave unitPrice 0 if unsure.',
    )
  }

  const rates = selectRelevantRates(projectSetup, priceSheet)
  parts.push('')
  parts.push(
    `UNIT RATES (${rates[0]?.currency ?? 'AED'} — use these unitPrice values when a line matches):`,
  )
  if (!rates.length) {
    parts.push('- (no rates available)')
  } else {
    for (const r of rates) {
      parts.push(
        `- [${r.discipline}] ${r.componentLabel} | ${r.materialLabel} | ${r.variantLabel} → ${r.unitPrice} / ${r.unit}${r.notes ? ` (${r.notes})` : ''}`,
      )
    }
  }

  parts.push('')
  parts.push(
    'Rules: Prefer selected disciplines/components/materials. Match unitPrice from UNIT RATES when type/material aligns; otherwise 0. Do not invent rates outside the sheet.',
  )

  let text = parts.join('\n')
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS)}\n…(context truncated)`
  }
  return text
}

function selectRelevantRates(
  projectSetup: ProjectSetup,
  priceSheet: PriceSheetRow[],
): PriceSheetRow[] {
  const selectedKeys = new Set<string>()
  for (let floor = 1; floor <= projectSetup.floors; floor++) {
    const comps = projectSetup.floorComponents[floor] ?? []
    for (const cid of comps) {
      const mats = projectSetup.floorMaterials[floor]?.[cid] ?? []
      for (const m of mats) {
        selectedKeys.add(`${cid}|${m.materialId}|${m.variantId}`)
      }
      // Also include all catalog rates for selected components (variants)
      selectedKeys.add(`comp:${cid}`)
    }
  }

  let matched = priceSheet.filter(
    (r) =>
      selectedKeys.has(`${r.componentId}|${r.materialId}|${r.variantId}`) ||
      selectedKeys.has(`comp:${r.componentId}`),
  )

  if (!matched.length && projectSetup.disciplines.length) {
    const disc = new Set(projectSetup.disciplines)
    matched = priceSheet.filter((r) => disc.has(r.discipline))
  }

  if (!matched.length) {
    // Fallback: small sample across sheet so model still has rate examples
    matched = priceSheet.slice(0, Math.min(40, priceSheet.length))
  }

  // Prefer exact material matches first
  matched.sort((a, b) => {
    const aExact = selectedKeys.has(`${a.componentId}|${a.materialId}|${a.variantId}`)
      ? 0
      : 1
    const bExact = selectedKeys.has(`${b.componentId}|${b.materialId}|${b.variantId}`)
      ? 0
      : 1
    return aExact - bExact
  })

  return matched.slice(0, MAX_PRICE_LINES)
}
