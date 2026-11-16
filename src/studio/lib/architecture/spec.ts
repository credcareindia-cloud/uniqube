import specJson from '../../data/architectureRules.json' with { type: 'json' }

type Requirement = 'M' | 'C' | 'O'

export interface SpecRule {
  id: string
  title?: string
  rule: string
  formula?: string
  parameters?: string[]
  result?: string
}

export interface SpecRuleGroup {
  code: string
  name: string
  note?: string
  rules: SpecRule[]
}

export interface SpecSlot {
  slot: string
  requirement: Requirement
  condition?: string
  options: string
}

export interface SpecLocation {
  code: string
  name: string
  zone?: 'DRY' | 'WET' | 'EXTERNAL'
  measured_as: string
  rules: string[]
  slots: SpecSlot[]
  items?: string[]
}

export interface SpecSlotOption {
  label: string
  materials: string[]
  specification_attributes: string[]
}

export interface SpecScrewRate {
  board: string
  sheet_width_mm: number
  sheet_length_mm: number
  support: string
  support_spacing_mm: number
  screw_spacing_mm: number
  dimension_across_supports: 'width' | 'length'
  screws_per_sheet: number
  rate_per_m2: number
}

export interface SpecResultLine {
  item: string
  net: number
  unit: string
  wastage_pct: number
  gross: number
  pack_size: number
  purchase_quantity: number
  purchase_unit: string
  rules: string[]
}

interface SpecFile {
  meta: { title: string; version: string; date: string; status: string }
  enumerations: {
    default_zone_by_room_type: { WET: string[]; EXTERNAL: string[] }
    scope_precedence_most_specific_first: string[]
  }
  parameters: Array<{ key: string; default: number; unit: string; rule: string; description: string }>
  rule_constants: { constants: Array<{ key: string; value: number; unit: string; rule: string }> }
  locations: { notes: string[]; list: SpecLocation[] }
  slot_options: { options: Record<string, SpecSlotOption> }
  rule_groups: SpecRuleGroup[]
  calculation_sequence: Array<{ step: number; action: string; rules: string[] }>
  screw_rates: { rows: SpecScrewRate[] }
  consumption_rates: Array<{ parent: string; dependent: string; basis: string; rate?: number | null; rate_unit: string; wastage_pct: number }>
  tile_adhesive_rates: { rows: Array<{ longest_tile_side_mm_from: number; longest_tile_side_mm_to: number | null; rate_kg_per_m2: number }> }
  wastage_defaults: Array<{ group: string; wastage_pct: number }>
  fire_table: { rows: Array<{ fire_rating_minutes: number; layers_per_face: number; board_thickness_mm: number; board: string }> }
  worked_example: {
    inputs: {
      wall: Record<string, number>
      openings: Array<{ kind: 'window' | 'door'; width_m: number; height_m: number; sill_board?: boolean }>
      reveal_depth_ext_m: number
      reveal_depth_int_m: number
    }
    results: SpecResultLine[]
  }
  to_confirm: string[]
}

export const ARCH_SPEC = specJson as unknown as SpecFile
export const ARCH_SPEC_VERSION = ARCH_SPEC.meta.version
export const ARCH_SPEC_LABEL = `${ARCH_SPEC.meta.title} v${ARCH_SPEC.meta.version} (${ARCH_SPEC.meta.date})`

/** Project-level overrides of parameters and rule constants, keyed by their master-data key. */
export type ArchOverrides = Record<string, number>

const VALUES: Record<string, number> = Object.fromEntries([
  ...ARCH_SPEC.parameters.map((p) => [p.key, p.default] as const),
  ...ARCH_SPEC.rule_constants.constants.map((c) => [c.key, c.value] as const),
])

/** Parameter or rule constant in its stored unit (mm, m, m2, % or factor). */
export function archParam(key: string, overrides: ArchOverrides = {}): number {
  const override = overrides[key]
  if (override != null && Number.isFinite(override)) return override
  const value = VALUES[key]
  if (value == null) throw new Error(`Architecture parameter ${key} is not in the rules file`)
  return value
}

export function archWastage(group: string): number {
  const row = ARCH_SPEC.wastage_defaults.find((item) => item.group === group)
  if (!row) throw new Error(`No default wastage for ${group}`)
  return row.wastage_pct
}

export const ARCH_LOCATIONS = ARCH_SPEC.locations.list
export const ARCH_SLOT_OPTIONS = ARCH_SPEC.slot_options.options
export const ARCH_RULE_GROUPS = ARCH_SPEC.rule_groups
export const ARCH_SCREW_RATES = ARCH_SPEC.screw_rates.rows
export const ARCH_FIRE_TABLE = ARCH_SPEC.fire_table.rows
export const ARCH_TO_CONFIRM = ARCH_SPEC.to_confirm
