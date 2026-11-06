export interface ArchOpening {
  id: string
  type: 'door' | 'window' | 'gap'
  widthMm: number
  /** Start along the wall axis, plan millimetres. */
  position: number
}

export interface ArchWall {
  id: string
  external: boolean
  lengthMm: number
  axis: 'h' | 'v'
  pos: number
  a: number
  b: number
  thickness: number
  openings: ArchOpening[]
}

export interface ArchRoom {
  id: string
  label: string
  category: string
  areaM2: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface ArchLevel {
  id: string
  name: string
  heightMm: number | null
  isRoof: boolean
}

export interface ArchParapet {
  lengthMm: number
  heightMm: number
}

export interface ArchPoint {
  x: number
  y: number
}

/** What architecture is allowed to measure. Lengths are millimetres from the plan. */
export interface ArchSource {
  foundationReady: boolean
  foundationApproved: boolean
  footprintM2: number
  footprint: ArchPoint[]
  walls: ArchWall[]
  rooms: ArchRoom[]
  levels: ArchLevel[]
  parapet: ArchParapet | null
}

export interface ArchSettings {
  doorHeightMm: number | null
  windowHeightMm: number | null
}

export interface ArchLine {
  code: string
  description: string
  qty: number
  unit: 'm2' | 'm' | 'nr'
  basis: 'calculated' | 'counted'
  group: 'measured' | 'openings' | 'finishes'
}

export interface ArchFlag {
  id: string
  level: 'red' | 'amber'
  text: string
}

export interface ArchSummary {
  storeys: number
  occupiedM2: number | null
  wetM2: number | null
  dryM2: number | null
  meanWallHeightM: number | null
  doors: number
  windows: number
}

export interface ArchResult {
  lines: ArchLine[]
  flags: ArchFlag[]
  summary: ArchSummary
  ranAt: string
}

export interface ArchState {
  settings: ArchSettings
  overrides: { approvedBy: string | null; approvedAt: string | null }
  result: ArchResult | null
}
