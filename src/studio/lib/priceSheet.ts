import type { PriceSheetRow } from '../types'
import { apiJson } from './api'
import { COMPONENTS, MATERIALS_BY_COMPONENT } from './projectCatalog'

export type { PriceSheetRow }

const STORAGE_KEY = 'estimation-price-sheet-v1'

function defaultUnit(materialLabel: string, variantLabel: string): string {
  const t = `${materialLabel} ${variantLabel}`.toLowerCase()
  if (/\b(door|window|panel|nos|unit|fitting|fixture|luminaire|detector)\b/.test(t))
    return 'nos'
  if (/\b(pipe|duct|cable|railing|beam|column|profile|steel)\b/.test(t)) return 'lm'
  if (/\b(concrete|earth|fill|excavation)\b/.test(t)) return 'm³'
  if (/\b(kg|rebar|bar)\b/.test(t)) return 'kg'
  return 'm²'
}

function defaultPrice(materialLabel: string, variantLabel: string): number {
  const t = `${materialLabel} ${variantLabel}`.toLowerCase()
  if (/stone|marble|granite|curtain/.test(t)) return 450
  if (/aluminium|aluminum|steel|fire rated|acoustic/.test(t)) return 180
  if (/gypsum|cement board|partition|ceiling/.test(t)) return 65
  if (/tile|flooring|vinyl|carpet/.test(t)) return 95
  if (/glass|glazing/.test(t)) return 320
  if (/hvac|ahu|chiller/.test(t)) return 850
  if (/cable|electrical|conduit/.test(t)) return 42
  if (/pipe|plumbing|drainage/.test(t)) return 55
  if (/concrete|foundation/.test(t)) return 280
  if (/asphalt|paving|road/.test(t)) return 120
  return 75
}

/** Seed rows from the materials catalog (one row per material × variant). */
export function buildSeedPriceSheet(): PriceSheetRow[] {
  const rows: PriceSheetRow[] = []
  for (const comp of COMPONENTS) {
    const materials = MATERIALS_BY_COMPONENT[comp.id] ?? []
    for (const mat of materials) {
      for (const v of mat.variants) {
        rows.push({
          id: `${comp.id}__${mat.id}__${v.id}`,
          discipline: comp.discipline,
          componentId: comp.id,
          componentLabel: comp.label,
          materialId: mat.id,
          materialLabel: mat.label,
          variantId: v.id,
          variantLabel: v.label,
          unit: defaultUnit(mat.label, v.label),
          unitPrice: defaultPrice(mat.label, v.label),
          currency: 'AED',
          notes: '',
        })
      }
    }
  }
  return rows
}

export function loadPriceSheet(): PriceSheetRow[] {
  return buildSeedPriceSheet()
}

/** Replace the seed once the database answers. Moves a leftover browser copy up on the first run. */
export async function hydratePriceSheet(): Promise<PriceSheetRow[] | null> {
  try {
    const remote = await apiJson<PriceSheetRow[] | null>('/api/price-sheet')
    if (Array.isArray(remote) && remote.length) {
      localStorage.removeItem(STORAGE_KEY)
      return remote
    }
  } catch {
    return null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PriceSheetRow[]
    if (!Array.isArray(parsed) || !parsed.length) return null
    await apiJson('/api/price-sheet', { method: 'PUT', body: JSON.stringify(parsed) })
    localStorage.removeItem(STORAGE_KEY)
    return parsed
  } catch {
    return null
  }
}

export function savePriceSheet(rows: PriceSheetRow[]) {
  void apiJson('/api/price-sheet', { method: 'PUT', body: JSON.stringify(rows) }).catch(() => undefined)
}

export function lookupUnitPrice(
  rows: PriceSheetRow[],
  componentId: string,
  materialId: string,
  variantId: string,
): number | undefined {
  return rows.find(
    (r) =>
      r.componentId === componentId &&
      r.materialId === materialId &&
      r.variantId === variantId,
  )?.unitPrice
}
