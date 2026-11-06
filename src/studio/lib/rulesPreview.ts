import index from '../data/rulesIndex.json'

/** Direct AED per m² of built-up area, split out of the 5335 Staff Accommodation rebuild (3,417 m²). */
const SUPER_MATERIAL_PER_M2 = 365
const MANUFACTURING_PER_M2 = 120
const FINISHING_PER_M2 = 523
const FLOOR_SHARE = 143 / 523
const LOGISTICS_PER_M2 = 81
const INSTALL_PER_M2 = 75
const SUBSTRUCTURE_PER_M2 = 45
const WASTAGE_RATE = 0.025
const OVERHEAD_RATE = 0.15

export type StructuralSystem = 'lgs' | 'precast' | 'roll-formed'
export type BuildingPart = 'walls' | 'floors' | 'roof' | 'doors' | 'facade' | 'finishes'

export const BUILDING_PARTS: Array<[BuildingPart, string]> = [
  ['walls', 'Walls'],
  ['floors', 'Floors'],
  ['roof', 'Roof'],
  ['doors', 'Doors and windows'],
  ['facade', 'Facade'],
  ['finishes', 'Finishes'],
]

export type FoundationType = 'isolated-ground-beam' | 'strip-rc-wall' | 'slab-grid'

export const FOUNDATIONS: Array<[FoundationType, string]> = [
  ['isolated-ground-beam', 'Isolated footing with ground beam'],
  ['strip-rc-wall', 'Strip footing with RC wall'],
  ['slab-grid', 'Slab on the grid footing'],
]
export type FinishingScope = 'none' | 'shell' | 'standard' | 'full'
export type MepScope = 'none' | 'basic' | 'full'

export interface PreviewInput {
  gfaM2: number
  structuralSystem: StructuralSystem[]
  parts: BuildingPart[]
  finishing: FinishingScope
  mep: MepScope
  includeSubstructure: boolean
  foundation: FoundationType[]
  includeWastage: boolean
  includeLogistics: boolean
  includeInstallation: boolean
  marginPct: number
  externalCommissionPct: number
  internalCommissionPct: number
}

export interface PreviewLine {
  category: string
  amount: number
  basis: string
  status: 'PROVISIONAL' | 'EXCLUDED' | 'BLOCKED'
}

export interface PricePreview {
  blocked: string | null
  lines: PreviewLine[]
  baseCost: number
  netSale: number
  profit: number
  externalCommission: number
  internalCommission: number
  achievedMargin: number
  perM2: number
}

export interface RuleRow {
  id: string
  category: string
  scope: string
  name: string
  unit: string
  logic: string
  inputs: string[]
  check: string
  status: string
  gate: string
}

export const RULES = index.rules as RuleRow[]
export const RULE_CATEGORIES = index.categories
export const RULES_STATUS = index.status
export const RULES_ISSUED = index.issued
export const SOLVER = index.solver
export const MARGIN_NOTE = index.margin_note
export const APPROVAL_GATES = index.approval_gates as string[]

const finishFactor: Record<FinishingScope, number> = { none: 0, shell: 0.35, standard: 1, full: 1.35 }
const mepPerM2: Record<MepScope, number> = { none: 0, basic: 6, full: 40 }

function round10(value: number) {
  return Math.round(value / 10) * 10
}

/**
 * v2 simple solver. Margin and both commissions are shares of net sales, so they sit in the denominator.
 * QA-10: pricing back-substitution must reproduce the target margin.
 */
export function pricePreview(input: PreviewInput): PricePreview {
  const empty = (blocked: string): PricePreview => ({
    blocked,
    lines: [],
    baseCost: 0,
    netSale: 0,
    profit: 0,
    externalCommission: 0,
    internalCommission: 0,
    achievedMargin: 0,
    perM2: 0,
  })
  if (!input.structuralSystem.includes('lgs')) {
    const named = input.structuralSystem.map((item) => (item === 'roll-formed' ? 'roll formed steel' : item)).join(', ') || 'this system'
    return empty(
      `No approved rate card for ${named}. QA-14: an unknown price stays an exception. It is not filled with zero and it is not guessed.`,
    )
  }
  const gfa = input.gfaM2
  if (!(gfa > 0)) return empty('Enter a gross floor area to price the template.')

  const superMaterial = gfa * SUPER_MATERIAL_PER_M2
  const manufacturing = gfa * MANUFACTURING_PER_M2
  const floorCut = input.parts.includes('floors') ? 0 : gfa * FINISHING_PER_M2 * FLOOR_SHARE
  const finishing = gfa * FINISHING_PER_M2 * finishFactor[input.finishing] - floorCut
  const sub = input.includeSubstructure ? gfa * SUBSTRUCTURE_PER_M2 : 0
  const mep = gfa * mepPerM2[input.mep]
  const materialBase = superMaterial + Math.max(0, finishing) + sub
  const wastage = input.includeWastage ? materialBase * WASTAGE_RATE : 0
  const logistics = input.includeLogistics ? gfa * LOGISTICS_PER_M2 : 0
  const installation = (input.includeInstallation ? gfa * INSTALL_PER_M2 : 0) + mep
  const beforeOverhead = sub + superMaterial + Math.max(0, finishing) + manufacturing + wastage + logistics + installation
  const overheads = beforeOverhead * OVERHEAD_RATE
  const base = beforeOverhead + overheads

  const margin = input.marginPct / 100
  const ext = input.externalCommissionPct / 100
  const inn = input.internalCommissionPct / 100
  const denom = 1 - margin - ext - inn
  if (denom <= 0.05) {
    return empty('Margin plus commissions must stay under 95% of the selling price. The solver has no answer above that.')
  }
  const net = base / denom
  const lines: PreviewLine[] = [
    {
      category: 'Substructure',
      amount: round10(sub),
      basis: input.includeSubstructure
        ? `${FOUNDATIONS.filter(([id]) => input.foundation.includes(id)).map(([, label]) => label).join(', ') || 'Foundation'} · ${SUBSTRUCTURE_PER_M2} AED/m² provisional allowance`
        : 'Out of scope — not posted',
      status: sub > 0 ? 'PROVISIONAL' : 'EXCLUDED',
    },
    {
      category: 'Superstructure',
      amount: round10(superMaterial),
      basis: `LGS material, hot-rolled steel and fasteners · ${SUPER_MATERIAL_PER_M2} AED/m² from 5335`,
      status: 'PROVISIONAL',
    },
    {
      category: 'Finishes',
      amount: round10(Math.max(0, finishing)),
      basis: `${input.finishing} scope${input.parts.length ? ` · ${BUILDING_PARTS.filter(([id]) => input.parts.includes(id)).map(([, label]) => label.toLowerCase()).join(', ')}` : ''}`,
      status: 'PROVISIONAL',
    },
    {
      category: 'Manufacturing',
      amount: round10(manufacturing),
      basis: 'Factory fabrication split out of the LGS rate so it is not counted twice',
      status: 'PROVISIONAL',
    },
    {
      category: 'Wastage',
      amount: round10(wastage),
      basis: input.includeWastage ? `${WASTAGE_RATE * 100}% of material, after net quantity` : 'Excluded',
      status: wastage > 0 ? 'PROVISIONAL' : 'EXCLUDED',
    },
    {
      category: 'MEP (services)',
      amount: round10(mep),
      basis: `${input.mep} · posted inside Installation, first fix only`,
      status: mep > 0 ? 'PROVISIONAL' : 'EXCLUDED',
    },
    {
      category: 'Logistics & installation',
      amount: round10(logistics + installation - mep),
      basis: 'Containers and site installation per m² of built-up area',
      status: logistics + installation - mep > 0 ? 'PROVISIONAL' : 'EXCLUDED',
    },
    {
      category: 'Overheads',
      amount: round10(overheads),
      basis: `${OVERHEAD_RATE * 100}% of base trades, inside base cost (v2 waterfall)`,
      status: 'PROVISIONAL',
    },
  ]
  return {
    blocked: null,
    lines,
    baseCost: base,
    netSale: net,
    profit: net * margin,
    externalCommission: net * ext,
    internalCommission: net * inn,
    achievedMargin: margin,
    perM2: net / gfa,
  }
}

export function draftRuleCount() {
  return RULES.filter((rule) => rule.status.startsWith('DRAFT')).length
}
