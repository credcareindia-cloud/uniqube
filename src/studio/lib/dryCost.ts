import { apiJson } from './api'
import { roundedBoq } from './foundation/engine'
import { loadEngineState } from './foundation/run'
import { loadMepState } from './mep/run'
import { loadSuperState } from './superstructure/run'
import type { ArchState } from './architecture/types'
import type { TakeoffLine } from '../types'

export interface SourceLine {
  key: string
  source: string
  code: string
  description: string
  qty: number | null
  unit: string
  rate: number | null
}

export interface MaterialRow {
  id: string
  sourceKey: string | null
  source: string
  code: string
  description: string
  qty: number | null
  unit: string
  rate: number | null
  remarks: string
}

export interface LabourRow {
  id: string
  sourceKey: string | null
  source: string
  code: string
  trade: string
  description: string
  gang: number | null
  qty: number | null
  unit: string
  rate: number | null
  remarks: string
}

export interface DryCostSheet {
  material: MaterialRow[]
  labour: LabourRow[]
  dismissedMaterial: string[]
  dismissedLabour: string[]
}

export function emptyDryCost(): DryCostSheet {
  return { material: [], labour: [], dismissedMaterial: [], dismissedLabour: [] }
}

export function blankMaterial(): MaterialRow {
  return {
    id: crypto.randomUUID(),
    sourceKey: null,
    source: 'Manual',
    code: '',
    description: '',
    qty: null,
    unit: '',
    rate: null,
    remarks: '',
  }
}

export function blankLabour(): LabourRow {
  return {
    id: crypto.randomUUID(),
    sourceKey: null,
    source: 'Manual',
    code: '',
    trade: '',
    description: '',
    gang: null,
    qty: null,
    unit: 'day',
    rate: null,
    remarks: '',
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function keys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asMaterial(value: unknown): MaterialRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<MaterialRow>
  if (typeof row.id !== 'string') return null
  return {
    id: row.id,
    sourceKey: typeof row.sourceKey === 'string' ? row.sourceKey : null,
    source: text(row.source) || 'Manual',
    code: text(row.code),
    description: text(row.description),
    qty: num(row.qty),
    unit: text(row.unit),
    rate: num(row.rate),
    remarks: text(row.remarks),
  }
}

function asLabour(value: unknown): LabourRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<LabourRow>
  if (typeof row.id !== 'string') return null
  return {
    id: row.id,
    sourceKey: typeof row.sourceKey === 'string' ? row.sourceKey : null,
    source: text(row.source) || 'Manual',
    code: text(row.code),
    trade: text(row.trade),
    description: text(row.description),
    gang: num(row.gang),
    qty: num(row.qty),
    unit: text(row.unit),
    rate: num(row.rate),
    remarks: text(row.remarks),
  }
}

export function asDryCost(value: unknown): DryCostSheet | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Partial<DryCostSheet>
  return {
    material: Array.isArray(body.material) ? body.material.map(asMaterial).filter((row): row is MaterialRow => row !== null) : [],
    labour: Array.isArray(body.labour) ? body.labour.map(asLabour).filter((row): row is LabourRow => row !== null) : [],
    dismissedMaterial: keys(body.dismissedMaterial),
    dismissedLabour: keys(body.dismissedLabour),
  }
}

/** Keep typed rates. Refresh code, description, quantity and unit from the latest quantities. */
export function mergeDryCost(saved: DryCostSheet | null, sources: SourceLine[]): DryCostSheet {
  const sheet = saved ?? emptyDryCost()
  const skipMaterial = new Set(sheet.dismissedMaterial)
  const skipLabour = new Set(sheet.dismissedLabour)
  const material = sheet.material.filter((row) => !row.sourceKey || !skipMaterial.has(row.sourceKey))
  const labour = sheet.labour.filter((row) => !row.sourceKey || !skipLabour.has(row.sourceKey))
  const materialByKey = new Map(material.filter((row) => row.sourceKey).map((row) => [row.sourceKey as string, row]))
  const labourByKey = new Map(labour.filter((row) => row.sourceKey).map((row) => [row.sourceKey as string, row]))

  for (const source of sources) {
    if (!skipMaterial.has(source.key)) {
      const existing = materialByKey.get(source.key)
      if (existing) {
        existing.qty = source.qty
        existing.unit = source.unit
      } else {
        const row: MaterialRow = {
          id: source.key,
          sourceKey: source.key,
          source: source.source,
          code: source.code,
          description: source.description,
          qty: source.qty,
          unit: source.unit,
          rate: source.rate,
          remarks: '',
        }
        material.push(row)
        materialByKey.set(source.key, row)
      }
    }
    if (!skipLabour.has(source.key)) {
      const existing = labourByKey.get(source.key)
      if (existing) {
        existing.qty = source.qty
        existing.unit = source.unit
      } else {
        const row: LabourRow = {
          id: `${source.key}:labour`,
          sourceKey: source.key,
          source: source.source,
          code: source.code,
          trade: source.source,
          description: source.description,
          gang: null,
          qty: source.qty,
          unit: source.unit,
          rate: null,
          remarks: '',
        }
        labour.push(row)
        labourByKey.set(source.key, row)
      }
    }
  }

  return { material, labour, dismissedMaterial: sheet.dismissedMaterial, dismissedLabour: sheet.dismissedLabour }
}

export function lineAmount(qty: number | null, rate: number | null): number | null {
  if (qty == null || rate == null) return null
  return Math.round(qty * rate * 100) / 100
}

export function sheetTotal(rows: Array<{ qty: number | null; rate: number | null }>): number {
  return Math.round(rows.reduce((sum, row) => sum + (lineAmount(row.qty, row.rate) ?? 0), 0) * 100) / 100
}

function unitText(unit: string) {
  if (unit === 'm2') return 'm²'
  if (unit === 'm3') return 'm³'
  return unit
}

export function takeoffSources(lines: TakeoffLine[]): SourceLine[] {
  return lines
    .filter((line) => line.quantity > 0)
    .map((line) => ({
      key: `takeoff:${line.id}`,
      source: 'Takeoff',
      code: line.tag || line.element || '',
      description: [line.system, line.type, line.notes].filter(Boolean).join(' · '),
      qty: line.quantity,
      unit: unitText(line.unit),
      rate: line.unitPrice > 0 ? line.unitPrice : null,
    }))
}

export async function collectSources(projectId: string): Promise<SourceLine[]> {
  const [engine, arch, mep] = await Promise.all([
    loadEngineState(projectId).catch(() => null),
    apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`).catch(() => null),
    loadMepState(projectId).catch(() => null),
  ])
  const storeys = engine?.inputs.storeyCount ?? 1
  const superState = await loadSuperState(projectId, storeys).catch(() => null)
  const lines: SourceLine[] = []

  for (const row of engine?.result ? roundedBoq(engine.result) : []) {
    lines.push({
      key: `foundation:${row.id}`,
      source: 'Sub structure',
      code: row.boqCode,
      description: row.description,
      qty: row.grossQty,
      unit: unitText(row.unit),
      rate: null,
    })
  }
  for (const row of superState?.result?.boq ?? []) {
    if (row.qty == null) continue
    lines.push({
      key: `structure:${row.id}`,
      source: 'Super structure',
      code: row.code,
      description: row.lgsSection ? `${row.description} · ${row.lgsSection}` : row.description,
      qty: row.qty,
      unit: unitText(row.unit),
      rate: null,
    })
  }
  for (const row of mep?.result?.boq ?? []) {
    lines.push({
      key: `mep:${row.code}`,
      source: 'MEP',
      code: row.code,
      description: row.description,
      qty: row.final,
      unit: unitText(row.unit),
      rate: null,
    })
  }
  for (const row of arch?.result?.lines ?? []) {
    lines.push({
      key: `architecture:${row.code}`,
      source: 'Architecture',
      code: row.code,
      description: row.description,
      qty: row.qty,
      unit: unitText(row.unit),
      rate: null,
    })
  }
  return lines
}

export async function loadDryCost(projectId: string): Promise<DryCostSheet | null> {
  const remote = await apiJson<unknown>(`/api/projects/${projectId}/dry-cost`)
  return asDryCost(remote)
}

export async function saveDryCost(projectId: string, sheet: DryCostSheet) {
  await apiJson(`/api/projects/${projectId}/dry-cost`, { method: 'PUT', body: JSON.stringify(sheet) })
}
