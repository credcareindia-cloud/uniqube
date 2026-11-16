/**
 * Data model for the UNIQUBE load-bearing wall and foundation engine (spec v0.1, Section 3).
 * Internal units: millimetres, kilograms, m², m³. All coordinates are plan millimetres with
 * the origin at the top-left of the plan region, x to the right, y down.
 */

export interface PtMm {
  x: number
  y: number
}

export type Axis = 'h' | 'v'

export interface Opening {
  id: string
  wallId: string
  type: 'door' | 'window' | 'gap'
  /** Clear width along the wall, mm. */
  width: number
  /** Start position along the wall axis, mm (absolute plan coordinate). */
  position: number
}

export type RoomCategory = 'habitable' | 'wet' | 'corridor' | 'balcony' | 'stair' | 'lift' | 'shaft' | 'void' | 'store'

export interface Room {
  id: string
  label: string
  category: RoomCategory
  /** Bounding box of the enclosed cell region, mm. */
  bbox: { x0: number; y0: number; x1: number; y1: number }
  areaM2: number
  labelPoint: PtMm | null
}

export interface Wall {
  id: string
  levelId: string
  axis: Axis
  /** Centreline position across the wall (y for horizontal walls, x for vertical), mm. */
  pos: number
  /** Extent along the wall, mm. */
  a: number
  b: number
  thickness: number
  length: number
  isExternal: boolean
  wallTypeTag: string | null
  openings: Opening[]
  openingRatio: number
  solidLength: number
  stacksOnWallId: string | null
  /** Where the two face lines were read, in PDF points, for citations. */
  source: { pagePt: { pos: number; a: number; b: number }; faceGapPt: number }
}

export type SupportCategory = 'external' | 'party' | 'corridor' | 'core' | 'promoted' | 'engineer'

export interface SupportLine {
  id: string
  wallIds: string[]
  category: SupportCategory
  axis: Axis
  pos: number
  a: number
  b: number
}

export interface FramingZone {
  id: string
  levelId: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  Lx: number
  Ly: number
  boundingSupportIds: string[]
  voidIds: string[]
  roomIds: string[]
}

export type FramingDirection = 'x' | 'y'
export type FramingStatus = 'auto' | 'tie-break' | 'flagged' | 'engineer-set' | 'none'

export interface ScoreBreakdown {
  direction: FramingDirection
  total: number
  parts: Array<{ criterion: string; score: number; weight: number; points: number }>
}

export interface FramingDecision {
  zoneId: string
  /** Direction the joists run. Joists running along y span the Ly dimension and bear on the horizontal walls. */
  direction: FramingDirection | null
  spanMm: number | null
  receivingWallIds: string[]
  case: 'A' | 'B' | 'C' | 'corridor' | 'none'
  scoreBreakdown: ScoreBreakdown[]
  status: FramingStatus
  ruleIds: string[]
  note: string
}

export type WallClassCode = 'LB' | 'SHEAR' | 'NLB' | 'REVIEW'

export interface WallClass {
  wallId: string
  class: WallClassCode
  reasonRuleIds: string[]
  reason: string
}

export type FlagSeverity = 'stop' | 'warn'

export interface Flag {
  code: string
  severity: FlagSeverity
  rule: string
  entityIds: string[]
  message: string
  action: string
}

export type FoundationTypeId = 1 | 2 | 3
export type StoreyBand = 'S1' | 'S2'

export interface FoundationNode {
  id: string
  point: PtMm
  nodeType: 'corner' | 'end' | 'T' | 'cross' | 'intermediate' | 'tie'
}

export interface FoundationElement {
  id: string
  type: 'strip' | 'wall' | 'pad' | 'column' | 'beam' | 'tie-beam' | 'slab'
  /** Axis-aligned plan rectangle(s), mm. */
  rects: Array<{ x0: number; y0: number; x1: number; y1: number }>
  section: Record<string, number>
  parentIds: string[]
  lengthMm?: number
}

export interface RebarSet {
  elementType: string
  role: string
  barDia: number
  spacingMm: number | null
  count: number | null
  layers: number
  lengthEachMm: number
  /** Total kg including laps and wastage. */
  totalKg: number
  /** kg per unit of the element quantity (m, m², or each). */
  kgPerUnit: number
  perUnit: 'm' | 'm2' | 'each'
  ruleIds: string[]
}

export type BoqSection = 'Earthworks' | 'Concrete' | 'Formwork' | 'Reinforcement' | 'Waterproofing and protection'

export interface QuantityLine {
  id: string
  boqCode: string
  section: BoqSection
  description: string
  elementType: string
  band: StoreyBand
  unit: 'm3' | 'm2' | 'kg' | 'nr'
  netQty: number
  wastePct: number
  grossQty: number
  ruleIds: string[]
  elementIds: string[]
  flags: string[]
  /** Formula with the numbers substituted, for traceability. */
  basis: string
}

export interface EngineerOverrides {
  /** zoneId → direction set by the engineer (RG-02). */
  directions: Record<string, FramingDirection>
  /** Walls promoted to support lines by the engineer. */
  promotedWallIds: string[]
  /** Beams added by the engineer (RG-02 "add beam"); act as support lines, mm plan coordinates. */
  beams: Array<{ id: string; axis: Axis; pos: number; a: number; b: number }>
  /** Wall class forced by the engineer. */
  wallClasses: Record<string, 'LB' | 'NLB'>
  /** Engineer confirmed the page scale for PI-04 when written dims disagree or are imperial. */
  scaleConfirmed: boolean
  /** Review gate approval (RG-03). */
  approvedBy: string | null
  approvedAt: string | null
  changeLog: Array<{ at: string; user: string; entity: string; from: string; to: string }>
}

export interface EngineInputs {
  storeyCount: number
  foundationType: FoundationTypeId
  plinthAboveNglMm: number | null
  soilBearingKpa: number | null
  lineLoadPerStoreyKnM: number | null
  /** Parameter overrides keyed by parameter id (without the P. prefix). */
  parameterOverrides: Record<string, number>
}

export interface LevelInfo {
  id: string
  name: string
  elevationMm: number | null
  sourcePage: number
  fileId: string
  drawingNo: string | null
}

export interface EngineResult {
  version: string
  parameterSetVersion: string
  ranAt: string
  level: LevelInfo
  scale: { mmPerPt: number; label: string; method: string; confidence: number; samples: number }
  /** Plan region origin in PDF points, so mm coordinates can be mapped back to the page. */
  originPt: { x: number; y: number }
  footprint: { polygon: PtMm[]; areaM2: number; perimeterM: number }
  walls: Wall[]
  rooms: Room[]
  supportLines: SupportLine[]
  zones: FramingZone[]
  decisions: FramingDecision[]
  wallClasses: WallClass[]
  lbLines: Array<{ id: string; axis: Axis; pos: number; a: number; b: number; wallIds: string[]; external: boolean }>
  band: StoreyBand
  foundationType: FoundationTypeId
  elements: FoundationElement[]
  nodes: FoundationNode[]
  rebar: RebarSet[]
  boq: QuantityLine[]
  flags: Flag[]
  gateOpen: boolean
  blocked: boolean
  checks: Array<{ id: string; ok: boolean; detail: string }>
  summary: Record<string, number>
}
