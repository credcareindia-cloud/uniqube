import rulesJson from '../../data/superstructureRules.json' with { type: 'json' }
import type { AllowanceRow, FramingType, SuperSeverity } from './types.ts'

type ParamEntry = { id: string; value: unknown; unit: string; source: string; used_in?: string; note?: string }
type RulesFile = {
  spec: { name: string; version: string; date: string }
  section_lists: { walls: string[]; trusses: string[]; c_joists: string[]; purlins: string[] }
  section_library_kg_per_m: Record<string, { kg_per_m: number; source: string }>
  parameters: ParamEntry[]
  flags: Array<{ id: string; trigger: string; severity: SuperSeverity }>
  flag_policy: string
  design_basis: Record<string, number | string | null>
  rates_aed: Array<{ item: string; unit: string; rate: number | null }>
  rules: { allowances: { rows: Array<{ item: string; mode: string }> } }
  test_cases: Array<{ id: string; rule: string; input: Record<string, unknown>; expected: Record<string, unknown> }>
}

export const SUPER_RULES_FILE = rulesJson as unknown as RulesFile
export const SUPER_VERSION = SUPER_RULES_FILE.spec.version
export const SUPER_PARAMETER_SET = `uniqube_superstructure_rules_v${SUPER_RULES_FILE.spec.version} (${SUPER_RULES_FILE.spec.date})`

const PARAMS: Record<string, ParamEntry> = Object.fromEntries(SUPER_RULES_FILE.parameters.map((p) => [p.id, p]))

export type Overrides = Record<string, number>

/** Numeric parameter with per-project override. */
export function P(id: string, overrides: Overrides = {}): number {
  if (overrides[id] != null && Number.isFinite(overrides[id])) return overrides[id]
  const v = PARAMS[id]?.value
  if (typeof v !== 'number') throw new Error(`Parameter P.${id} has no numeric value`)
  return v
}

/** Nested numeric parameter such as junction_studs.T, overridable as "junction_studs.T". */
export function PN(id: string, key: string, overrides: Overrides = {}): number {
  const flat = `${id}.${key}`
  if (overrides[flat] != null && Number.isFinite(overrides[flat])) return overrides[flat]
  const v = (PARAMS[id]?.value as Record<string, unknown> | undefined)?.[key]
  if (typeof v !== 'number') throw new Error(`Parameter P.${id}.${key} has no numeric value`)
  return v
}

export function PBool(id: string, overrides: Overrides = {}): boolean {
  if (overrides[id] != null) return overrides[id] !== 0
  return Boolean(PARAMS[id]?.value)
}

export function PRange(id: string): [number, number] {
  const v = PARAMS[id]?.value
  return Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : [0, Infinity]
}

export function PText(id: string): string {
  return String(PARAMS[id]?.value ?? '')
}

/** Flat parameter table for the UI: numeric values plus nested numeric members. */
export interface SuperParamRow {
  id: string
  value: number | number[] | null
  unit: string
  source: string
  note?: string
}

export const SUPER_PARAMETER_TABLE: SuperParamRow[] = SUPER_RULES_FILE.parameters.flatMap((p): SuperParamRow[] => {
  if (typeof p.value === 'number' || p.value === null) return [{ id: p.id, value: p.value as number | null, unit: p.unit, source: p.source, note: p.note }]
  if (Array.isArray(p.value)) return [{ id: p.id, value: p.value as number[], unit: p.unit, source: p.source, note: p.note }]
  if (p.value && typeof p.value === 'object') {
    return Object.entries(p.value as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({ id: `${p.id}.${k}`, value: v as number, unit: p.unit, source: p.source, note: p.note }))
  }
  return []
})

export const SECTION_LISTS = SUPER_RULES_FILE.section_lists
export const ALL_SECTIONS = Object.keys(SUPER_RULES_FILE.section_library_kg_per_m)

export function kgPerM(section: string, overrides: Overrides = {}): number {
  const key = `kg_per_m.${section}`
  if (overrides[key] != null && Number.isFinite(overrides[key])) return overrides[key]
  const entry = SUPER_RULES_FILE.section_library_kg_per_m[section]
  if (!entry) throw new Error(`Section ${section} is not in the section library`)
  return entry.kg_per_m
}

export function sectionKnown(section: string) {
  return Boolean(SUPER_RULES_FILE.section_library_kg_per_m[section])
}

/** Floor-zone deduction D above a level, by the framing it carries. Pitched roofs deduct nothing. */
export function floorZoneDeduction(framingType: FramingType, framingSection: string, overrides: Overrides = {}): number {
  if (framingType === 'pitched_roof') return 0
  if (framingType === 'truss' || framingType === 'flat_roof_truss') return P('floor_zone_deduction_truss_mm', overrides)
  if (/^1400S350/.test(framingSection)) return P('floor_zone_deduction_1400S350_mm', overrides)
  if (/^1200S350/.test(framingSection)) return P('floor_zone_deduction_1200S350_mm', overrides)
  throw new Error(`No floor-zone deduction is defined for ${framingSection}`)
}

export function floorFamily(framingType: FramingType): 'truss' | 'c_joist' | 'pitched' {
  if (framingType === 'pitched_roof') return 'pitched'
  return framingType === 'truss' || framingType === 'flat_roof_truss' ? 'truss' : 'c_joist'
}

export function isRoofFraming(framingType: FramingType) {
  return framingType === 'flat_roof_truss' || framingType === 'flat_roof_c_joist' || framingType === 'pitched_roof'
}

export const FRAMING_LABEL: Record<FramingType, string> = {
  truss: 'Floor trusses (600 deep Pratt)',
  c_joist: 'C-joists',
  flat_roof_truss: 'Flat roof — trusses',
  flat_roof_c_joist: 'Flat roof — C-joists',
  pitched_roof: 'Pitched roof trusses',
}

export const SUPER_FLAG_DEFS: Record<string, { severity: SuperSeverity; trigger: string }> = Object.fromEntries(
  SUPER_RULES_FILE.flags.map((f) => [f.id, { severity: f.severity, trigger: f.trigger }]),
)

export const DESIGN_BASIS = SUPER_RULES_FILE.design_basis
export const RATES_AED = SUPER_RULES_FILE.rates_aed
export const TEST_CASES = SUPER_RULES_FILE.test_cases

export function defaultAllowances(): AllowanceRow[] {
  return SUPER_RULES_FILE.rules.allowances.rows.map((row, i) => ({
    id: `ALW-${i + 1}`,
    item: row.item,
    mode: row.mode.includes('percent') ? 'percent' : row.mode.includes('per_module') || row.mode.includes('per_flight') ? 'fixed_kg_per_unit' : 'fixed_kg',
    value: null,
    units: null,
  }))
}
