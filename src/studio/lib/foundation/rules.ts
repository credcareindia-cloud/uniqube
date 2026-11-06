import rulesJson from '../../data/foundationRules.json' with { type: 'json' }
import type { FlagSeverity, FoundationTypeId, RoomCategory, StoreyBand } from './types.ts'

type ParamEntry = { value: number | number[] | null; unit: string; status?: string; label?: string }
type RulesFile = {
  version: string
  date: string
  parameters: Record<string, ParamEntry>
  framing_tiebreak_weights: Record<string, number | string>
  room_categories: Record<string, string[] | string>
  storey_bands: Record<string, { min_storeys: number; max_storeys: number | null }>
  foundation_types: Record<string, { name: string; allowed_bands: string[]; sections: Record<string, Record<string, Record<string, number | boolean>>> }>
  default_rebar_schedule: Array<{ type: number | string; band: string; element: string; arrangement: string; kg: number; per: string; kg_per_m3: number }>
  steel_ratio_tolerance_pct: number
  flags: Array<{ code: string; severity: FlagSeverity; rule: string }>
}

export const RULES_FILE = rulesJson as unknown as RulesFile
export const PARAMETER_SET_VERSION = `uniqube_foundation_rules_v${RULES_FILE.version} (${RULES_FILE.date})`

export type ParamId = keyof typeof rulesJson.parameters

/** Numeric parameter with per-project override. Null parameters (project inputs) return null. */
export function param(id: ParamId, overrides: Record<string, number> = {}): number | null {
  if (overrides[id] != null && Number.isFinite(overrides[id])) return overrides[id]
  const entry = RULES_FILE.parameters[id]
  return typeof entry?.value === 'number' ? entry.value : null
}

export function paramRequired(id: ParamId, overrides: Record<string, number> = {}): number {
  const v = param(id, overrides)
  if (v == null) throw new Error(`Parameter P.${id} has no value`)
  return v
}

export function barList(overrides: Record<string, number> = {}): number[] {
  const entry = RULES_FILE.parameters.bar_list
  void overrides
  return Array.isArray(entry.value) ? entry.value : [10, 12, 16, 20]
}

export const PARAMETER_TABLE = Object.entries(RULES_FILE.parameters).map(([id, entry]) => ({
  id,
  value: entry.value,
  unit: entry.unit,
  status: entry.status ?? 'default',
  label: entry.label,
}))

export const TIEBREAK_WEIGHTS: Record<string, number> = Object.fromEntries(
  Object.entries(RULES_FILE.framing_tiebreak_weights).filter(([, v]) => typeof v === 'number') as Array<[string, number]>,
)

export function roomCategoryFor(label: string): RoomCategory {
  const text = label.toLowerCase()
  for (const [category, words] of Object.entries(RULES_FILE.room_categories)) {
    if (!Array.isArray(words)) continue
    if (words.some((w) => text.includes(w))) return category as RoomCategory
  }
  return (RULES_FILE.room_categories.default as RoomCategory) ?? 'habitable'
}

/** FT-01: storey band. */
export function bandFor(storeys: number): StoreyBand {
  const s2 = RULES_FILE.storey_bands.S2
  return storeys >= s2.min_storeys ? 'S2' : 'S1'
}

export function foundationTypeName(type: FoundationTypeId): string {
  return RULES_FILE.foundation_types[String(type)]?.name ?? `Type ${type}`
}

export function typeAllowed(type: FoundationTypeId, band: StoreyBand): boolean {
  return RULES_FILE.foundation_types[String(type)]?.allowed_bands.includes(band) ?? false
}

export function sectionsFor(type: FoundationTypeId, band: StoreyBand): Record<string, Record<string, number | boolean>> {
  const t = RULES_FILE.foundation_types[String(type)]
  return t?.sections[band] ?? t?.sections.S1 ?? {}
}

export const FLAG_DEFS: Record<string, { severity: FlagSeverity; rule: string; action: string }> = {
  'F-UNITS': { severity: 'stop', rule: 'PI-03', action: 'User confirms units' },
  'F-SCALE': { severity: 'stop', rule: 'PI-04', action: 'User confirms scale or a known dimension' },
  'F-LOWCONF': { severity: 'warn', rule: 'Module 1', action: 'Engineer checks walls on overlay' },
  'F-SPAN': { severity: 'stop', rule: 'FD-02', action: 'Engineer adds beam or sets support' },
  'F-NO-STACK': { severity: 'warn', rule: 'FD-04, PI-08', action: 'Upload all levels or accept' },
  'F-CANT': { severity: 'warn', rule: 'SA-02', action: 'Engineer review' },
  'F-VOID': { severity: 'warn', rule: 'SA-03', action: 'Engineer review' },
  'F-SUNKEN': { severity: 'warn', rule: 'SA-04', action: 'Engineer review' },
  'F-TRANSFER': { severity: 'stop', rule: 'WC-05', action: 'Engineer adds transfer or changes layout' },
  'F-LATERAL': { severity: 'warn', rule: 'WC-04', action: 'Engineer review' },
  'F-INPUT': { severity: 'stop', rule: 'FT-03', action: 'Estimator enters value' },
  'F-TYPE3': { severity: 'stop', rule: 'FT-02', action: 'Choose Type 1 or 2' },
  'F-BEARING': { severity: 'warn', rule: 'T3-R3', action: 'Widen beam base or use Type 1' },
  'F-RATIO': { severity: 'warn', rule: 'VC-01', action: 'Check geometry reading' },
  'F-NOWALLS': { severity: 'stop', rule: 'PI-05', action: 'Check the plan sheet and scale, or trace walls by hand' },
  'F-GATE': { severity: 'warn', rule: 'RG-03', action: 'Engineer approves the review gate' },
}

export const DEFAULT_REBAR_SCHEDULE = RULES_FILE.default_rebar_schedule
export const STEEL_RATIO_TOL_PCT = RULES_FILE.steel_ratio_tolerance_pct
