/**
 * UNIQUBE Estimation Engine — Superstructure Logic v1.0 data model.
 * Lengths in mm and weights in kg internally; metres only at the BOQ edge.
 */

export type StudSpacing = 450 | 600
export type ProjectType = 'panelised' | 'volumetric_modular'
export type UnitSystem = 'metric' | 'imperial'
export type PitchedCovering = 'boards' | 'metal_sheet' | 'sandwich_panel'
export type FlatCovering = 'flat_deck' | 'sheeting_on_purlins'
export type LowestLevel = 'on_slab' | 'suspended'
export type FramingType = 'truss' | 'c_joist' | 'flat_roof_truss' | 'flat_roof_c_joist' | 'pitched_roof'
export type FloorFamily = 'truss' | 'c_joist'
export type WallStatus = 'LB' | 'NLB'
export type SuperSeverity = 'red' | 'amber'
export type RoofShape = 'gable' | 'hip' | 'mono' | 'valley_secondary'
export type PlanSource = 'ground' | 'same' | 'none'

export interface ProjectSettings {
  studSpacingMm: StudSpacing
  projectType: ProjectType
  unitSystem: UnitSystem
  pitchedRoofCovering: PitchedCovering
  flatRoofCovering: FlatCovering
  lowestLevel: LowestLevel
}

/** One row of the level table. The framing fields describe the floor or roof carried on this level's walls. */
export interface LevelRow {
  id: string
  name: string
  /** Where this level's walls come from: the foundation ground plan, the level below (typical plan), or no plan. */
  plan: PlanSource
  /** Floor-to-floor height to the level above (FFL to eaves under a pitched roof). User input; never assumed. */
  ffhMm: number | null
  lbSection: string
  nlbSection: string
  framingType: FramingType
  framingSection: string
  reinforcingStuds: boolean
  /** Roof row with a flat roof only. */
  parapetSection: string | null
  parapetHeightMm: number | null
}

export interface SuspendedFloor {
  framingType: FloorFamily
  section: string
  reinforcingStuds: boolean
}

export interface RoofSectionInput {
  id: string
  type: RoofShape
  /** Truss span Lt (hip: B; valley secondary: W2), mm. */
  ltMm: number | null
  /** Length along the ridge direction, mm (hip ends included). */
  lengthMm: number | null
  pitchDeg: number | null
  eavesOverhangMm: number
  vergeOverhangMm: number
  /** Hip roofs: hipped ends (1 or 2). */
  hipEnds: 1 | 2
}

export interface BalconyInput {
  id: string
  levelId: string
  lengthMm: number | null
  cantileverMm: number | null
  /** Axis of the supporting wall: 'h' runs along x, 'v' along y. */
  supportAxis: 'h' | 'v'
}

export interface SuperInputs {
  settings: ProjectSettings
  levels: LevelRow[]
  suspendedFloor: SuspendedFloor
  roofSections: RoofSectionInput[]
  balconies: BalconyInput[]
  parameterOverrides: Record<string, number>
}

export type HrsStatus = 'suggested' | 'accepted' | 'deleted'

export interface HrsDecision {
  status: HrsStatus
  section: string | null
  kgPerM: number | null
  lengthMm: number | null
  quantity: number | null
}

export interface HrsManual {
  id: string
  description: string
  levelId: string
  section: string
  kgPerM: number | null
  lengthMm: number | null
  quantity: number
  directKg: number | null
}

export type AllowanceMode = 'percent' | 'fixed_kg' | 'fixed_kg_per_unit'

export interface AllowanceRow {
  id: string
  item: string
  mode: AllowanceMode
  value: number | null
  /** Flights, modules … for fixed_kg_per_unit. */
  units: number | null
}

export interface ChangeLogEntry {
  at: string
  user: string
  entity: string
  from: string
  to: string
}

export interface SuperOverrides {
  hrsDecisions: Record<string, HrsDecision>
  hrsManual: HrsManual[]
  allowances: AllowanceRow[]
  /** Amber flags acknowledged by the engineer (flag keys). */
  acknowledged: string[]
  approvedBy: string | null
  approvedAt: string | null
  changeLog: ChangeLogEntry[]
}

// ——— results ———

export interface SuperFlag {
  /** Stable key: code + entity. */
  key: string
  code: string
  severity: SuperSeverity
  levelId: string | null
  entityIds: string[]
  message: string
  action: string
}

export interface WallRunResult {
  id: string
  levelId: string
  axis: 'h' | 'v'
  pos: number
  a: number
  b: number
  lengthMm: number
  heightMm: number
  status: WallStatus
  section: string
  external: boolean
  openings: number[]
  junctions: { L: number; T: number; X: number }
  stackedLengthMm: number
  sourceWallIds: string[]
  panels: number
  panelLengthMm: number
  studsRegular: number
  studsJamb: number
  studsJunction: number
  noggingRows: number
  studsMm: number
  tracksMm: number
  noggingMm: number
  extraTrackMm: number
  totalMm: number
  kg: number
}

export interface TrussPieceResult {
  spansMm: number[]
  lengthMm: number
  panels: number
  chordsMm: number
  verticalsMm: number
  diagonalsMm: number
  reinforcingMm: number
  totalMm: number
}

export interface TrussLineResult {
  id: string
  direction: 'x' | 'y'
  positionMm: number
  zoneIds: string[]
  spansMm: number[]
  pieces: TrussPieceResult[]
  totalMm: number
}

export interface BlockingTrussResult {
  id: string
  zoneId: string
  kind: 'piece_end' | 'cut' | 'intermediate_support'
  lines: number
  lengthMm: number
  piece: TrussPieceResult
  totalMm: number
}

export interface JoistZoneResult {
  zoneId: string
  widthMm: number
  spanMm: number
  joists: number
  blockingRows: number
  joistsMm: number
  blockingMm: number
  rimsMm: number
  totalMm: number
}

export interface BalconyResult {
  id: string
  levelId: string
  lengthMm: number
  cantileverMm: number
  members: number
  memberLengthMm: number
  membersMm: number
  edgesMm: number
  totalMm: number
  kg: number
  excluded: boolean
}

export interface FloorResult {
  /** Level whose walls carry it; 'SUSPENDED' for a suspended lowest floor. */
  carriedBy: string
  label: string
  family: FloorFamily
  section: string
  reinforcing: boolean
  trussLines: TrussLineResult[]
  blocking: BlockingTrussResult[]
  joistZones: JoistZoneResult[]
  membersMm: number
  blockingMm: number
  rimsMm: number
  totalMm: number
  kg: number
  isRoof: boolean
  purlinsM: number
  purlinsKg: number
  bracingM: number
  bracingKg: number
}

export interface RoofSectionResult {
  id: string
  type: RoofShape
  ltMm: number
  lengthMm: number
  ridgeLengthMm: number
  pitchDeg: number
  eavesOverhangMm: number
  vergeOverhangMm: number
  commonCount: number
  commonMm: number
  jackCount: number
  jackMm: number
  hipRafterCount: number
  hipRafterMm: number
  valleyTrussCount: number
  valleyTrussMm: number
  valleyMemberMm: number
  outriggerCount: number
  outriggerMm: number
  vergeMemberMm: number
  fasciaMm: number
  planAreaM2: number
  slopeAreaM2: number
  eavesM: number
  purlinsM: number
  purlinsKg: number
  bracingTopM: number
  bracingBottomM: number
  bracingKg: number
  framingMm: number
  framingKg: number
}

export interface PitchedRoofResult {
  section: string
  sections: RoofSectionResult[]
  framingKg: number
  purlinsKg: number
  bracingKg: number
}

export interface ParapetResult {
  runs: WallRunResult[]
  heightMm: number
  section: string
  kg: number
}

export interface AnchorResult {
  levelId: string
  m10x200: number
  m8x100: number
  rodsExternal: number
  rodsInternal: number
  rodLengthMm: number | null
  corners: number
}

export interface LevelResult {
  levelId: string
  name: string
  index: number
  heightMm: number | null
  deductionMm: number
  wallRuns: WallRunResult[]
  floor: FloorResult | null
  roof: PitchedRoofResult | null
  parapet: ParapetResult | null
  balconies: BalconyResult[]
  anchors: AnchorResult
  areaM2: number
  kg: { wallsLb: number; wallsNlb: number; floor: number; balconies: number; roof: number; purlins: number; bracing: number; parapets: number; total: number }
  kgPerM2: number | null
  skipped: string | null
}

export interface HrsMarkupResult {
  id: string
  levelId: string
  memberType: string
  trigger: string
  entityIds: string[]
  suggestedLengthMm: number | null
  suggestedQuantity: number
  beamEnds: number
  status: HrsStatus
  section: string | null
  kgPerM: number | null
  lengthMm: number | null
  quantity: number | null
  kg: number | null
}

export interface HrsManualResult extends HrsManual {
  kg: number | null
}

export interface LoadPathResult {
  beamEndsOnLgsWalls: number
  studPacks: Array<{ markupId: string; levelId: string; studs: number; kg: number }>
  studPackStuds: number
  studPackKg: number
  padsToSubstructure: number
}

export interface SectionTotal {
  section: string
  m: number
  kg: number
}

export interface SuperBoqLine {
  id: string
  code: string
  group: string
  description: string
  levelId: string | null
  lgsSection: string | null
  unit: 'm' | 'kg' | 'nr' | 'AED' | 'kg/m²'
  qty: number | null
  basis: string
  ruleIds: string[]
}

export interface SuperTotals {
  calculatedLgsKg: number
  allowancesKg: number
  allowanceRows: Array<{ item: string; mode: AllowanceMode; value: number | null; kg: number | null }>
  netLgsKg: number
  screws: number
  connectorsAed: number
  grossLgsKg: number
  hrsMarkupKg: number
  hrsManualKg: number
  hrsKg: number
  anchorsM10: number
  anchorsM8: number
  rodsCount: number
  rodsLengthM: number
  studPackKg: number
}

export interface SuperResult {
  version: string
  parameterSetVersion: string
  ranAt: string
  foundationRanAt: string
  settings: ProjectSettings
  levels: LevelResult[]
  flags: SuperFlag[]
  missingInputs: string[]
  hrsMarkups: HrsMarkupResult[]
  hrsManual: HrsManualResult[]
  loadPath: LoadPathResult
  totals: SuperTotals
  bySection: SectionTotal[]
  suspendedFloor: FloorResult | null
  boq: SuperBoqLine[]
  blocked: boolean
  gateOpen: boolean
  notes: string[]
}
