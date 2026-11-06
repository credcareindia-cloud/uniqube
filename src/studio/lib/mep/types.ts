export type MepModule = 'wall' | 'ceiling' | 'underground' | 'mechanical' | 'plumbing' | 'fire'

export interface MepDrawing {
  id: string
  name: string
  title: string
  number: string
  floor: string
  module: MepModule | 'unknown'
  pageNumber: number
  pageWidth: number
  pageHeight: number
}

export interface SheetMark {
  id: string
  drawingId: string
  code: string
  x: number
  y: number
}

export interface LegendEntry {
  id: string
  code: string
  description: string
  module: MepModule
}

export interface FixtureRow {
  id: string
  drawingId: string
  code: string
  description: string
  module: MepModule
  floor: string
  /** Fixtures read from the sheet or typed by the engineer. */
  count: number
  /** Fixtures that share one back box. 1 means one box per fixture. */
  gang: number
  source: 'counted' | 'manual'
}

export interface SanitaryCounts {
  wc: number | null
  basin: number | null
  shower: number | null
  sink: number | null
}

export interface MepSettings {
  conduitMaterial: 'PVC' | 'EMT' | 'GI'
  boxMaterial: 'plastic' | 'metal'
  wallConduitMm: number
  ceilingConduitMm: number
  /** Vertical drop per in-wall fixture. 3 m is the configured assumption. */
  wallDropM: number
  /** Horizontal run per ceiling fixture when the route is not measured. */
  ceilingRunM: number
  allowancePct: number
  undergroundInScope: boolean
  undergroundLengthM: number | null
  undergroundConduitMm: number
  mechanicalInScope: boolean
  /** Cooling watts per square metre of occupied floor. Empty until the engineer sets it. */
  coolingWm2: number | null
  occupancy: number | null
  freshAirLsPerPerson: number | null
  wetAirChanges: number | null
  plumbingInScope: boolean
  sanitary: SanitaryCounts
  /** Waste run per sanitary fitting when the pipe route is not measured. */
  wasteRunM: number | null
  fireInScope: boolean
}

/** Areas taken from the approved architecture bill. Null means that measure does not exist yet. */
export interface MepBuilding {
  occupiedM2: number | null
  wetM2: number | null
  storeys: number | null
  meanWallHeightM: number | null
}

export interface MepOverrides {
  approvedBy: string | null
  approvedAt: string | null
}

export type QtyBasis = 'counted' | 'estimated' | 'calculated' | 'manual'

export interface MepBoqLine {
  code: string
  module: 'Wall' | 'Ceiling' | 'Underground' | 'Mechanical' | 'Plumbing' | 'Fire'
  description: string
  base: number
  extra: number
  final: number
  unit: 'nr' | 'm' | 'kW' | 'L/s' | 'm3/h'
  kind: 'fixture' | 'material'
  basis: QtyBasis
}

export interface MepFlag {
  id: string
  level: 'red' | 'amber'
  text: string
}

export interface MepResult {
  boq: MepBoqLine[]
  flags: MepFlag[]
  ranAt: string
}

export interface MepInputs {
  drawings: MepDrawing[]
  legend: LegendEntry[]
  fixtures: FixtureRow[]
  marks: SheetMark[]
  settings: MepSettings
  building: MepBuilding | null
}

export interface MepState {
  inputs: MepInputs
  overrides: MepOverrides
  result: MepResult | null
}
