export type PageQuality = 'normal' | 'scanned' | 'poor'

export type DocOverallStatus = 'idle' | 'analyzing' | 'ready' | 'error'

export interface PageAnalysis {
  pageNumber: number
  quality: PageQuality
  textChars: number
  imageCoverage: number
  sharpness: number
  contrast: number
  thumbnail?: string
  imageDataUrl?: string
  ocrText?: string
  aiNotes?: string
  /** Kept for analyze metadata; UI no longer routes by this */
  route: 'direct' | 'ocr-cv' | 'ai-vision'
}

export interface DocumentAnalysis {
  fileName: string
  pageCount: number
  overall: PageQuality
  pages: PageAnalysis[]
  poorCount: number
  scannedCount: number
  normalCount: number
  analyzedAt?: string
}

export type LineSource = 'auto' | 'ocr' | 'ai' | 'manual' | 'measure'

export interface TakeoffLine {
  id: string
  tag: string
  system: string
  widthMm: number
  heightMm: number
  type: string
  quantity: number
  unit: string
  unitPrice: number
  notes: string
  source: LineSource
  pageRef?: number
  confirmed: boolean
  /** Element id from the element catalog, for example ext-wall or strip-footing. */
  element?: string
  /** 1-based floor the item sits on. 0 is substructure / ground. */
  floor?: number | null
  /** Measured length in millimetres, when the item has a run. */
  lengthMm?: number
  /** Measured area in square metres, when the item has an area. */
  areaM2?: number
  /** Measurement that produced this line. */
  measurementId?: string
  fileId?: string
  /** Price-sheet row the rate came from, used to split material and labour in the cost breakdown. */
  rateRowId?: string
}

/** A point in PDF page points (1/72 in), origin top-left of the page at scale 1. */
export type PagePoint = { x: number; y: number }

export type MeasurementKind = 'length' | 'area' | 'rect' | 'count' | 'dims'

/** One drawn or stated measurement on a sheet. Quantities are recomputed from the page scale. */
export interface Measurement {
  id: string
  fileId: string
  fileName: string
  pageNumber: number
  kind: MeasurementKind
  /** Drawn points. Empty for `dims` measurements that come from a dimension string or schedule. */
  points: PagePoint[]
  elementId: string
  label: string
  floor: number | null
  /** Stated sizes for `dims` measurements and extra sizes for drawn ones (wall height, footing depth). */
  dims: {
    lengthMm?: number
    widthMm?: number
    heightMm?: number
    depthMm?: number
    thicknessMm?: number
    count?: number
  }
  /** Openings or other area to subtract, in square metres. */
  deductM2: number
  notes: string
  source: 'ai' | 'manual'
  createdAt: string
}

export type PageScaleMethod = 'auto' | 'manual' | 'stated'

/** Millimetres per PDF point for one sheet. 1:100 is 35.28 mm/pt. */
export interface PageScale {
  mmPerPt: number
  label: string
  method: PageScaleMethod
  confidence: number
  samples: number
}

export type FloorSpec = {
  level: number
  name: string
  heightMm: number
  /** Built-up area of the floor plate in m². Filled from floor measurements when blank. */
  areaM2?: number
}

/**
 * UNIQUBE commercial stack. Direct cost (material + fabrication + installation) is marked up in
 * this order: overhead on cost, margin as a share of price, finance and contingency on that
 * subtotal, then design charges, then commission.
 */
export interface Commercials {
  currency: string
  /** AED per USD, for the USD column. */
  usdRate: number
  overheadPct: number
  marginPct: number
  financePct: number
  contingencyPct: number
  designPct: number
  commissionPct: number
  customsPct: number
  corporateTaxPct: number
  /** Steel allowance per m² of built-up area. */
  lgsKgPerM2: number
  hrsKgPerM2: number
  lgsRatePerKg: number
  hrsRatePerKg: number
  screwsPerM2: number
  screwRate: number
  connectorsPerKgLgs: number
  anchorsCount: number
  anchorRate: number
  /** Site installation labour per m² of built-up area. */
  installPerM2: number
  /** One 40 ft container per this many m² of built-up area. */
  m2PerContainer: number
  trailerPerContainer: number
  palletPerContainer: number
  /** Preliminaries as a share of direct cost, or a lump sum when prelimsLumpSum > 0. */
  prelimsPct: number
  prelimsLumpSum: number
  /** MEP first-fix allowance: panels per m² and rate per panel. */
  mepPanelsPerM2: number
  mepRatePerPanel: number
  includeSteelAllowance: boolean
  includeInstallation: boolean
  includeLogistics: boolean
  includePrelims: boolean
  includeMep: boolean
  /** Share of material cost that is imported and attracts customs (0–100). */
  importedMaterialPct?: number
  /** All-in cost of one site labourer per day (wage, visa, housing, transport). */
  labourDayRate?: number
  /** ISO date the steel, site and logistics rates on this sheet were last reviewed. */
  ratesReviewedAt?: string
}

/** A saved pricing snapshot (R0, R1 …) for comparison across revisions. */
export interface EstimateRevision {
  id: string
  label: string
  savedAt: string
  note: string
  gfaM2: number
  directAed: number
  sellAed: number
  systems: Record<string, number>
  lineCount: number
}

export type BuildUpLayer = {
  id: string
  name: string
  /** Material and variant from the price sheet when the user picked one. */
  priceRowId?: string
  thicknessMm: number
}

export type BuildUp = {
  layers: BuildUpLayer[]
  /** Default sizes used when a measurement does not state them. */
  heightMm?: number
  widthMm?: number
  depthMm?: number
  thicknessMm?: number
  notes: string
}

export type ProjectUnits = 'mm' | 'm' | 'ft'

/** Everything the estimator should know about the job before reading a sheet. */
export interface ProjectContext {
  buildingType: string
  location: string
  description: string
  units: ProjectUnits
  floors: FloorSpec[]
  /** Elements the job includes, by element id. */
  elements: string[]
  buildUps: Record<string, BuildUp>
  scopeNotes: string
  /** Client, consultant, and job references used on the offer. */
  client: string
  consultant: string
  projectNumber: string
  commercials: Commercials
  /** Values entered once in Settings and read by every agent. */
  jobInputs?: JobInputs
  /** Quantities from the approved engines, kept in step when an engine is saved. Pricing reads these. */
  measured?: MeasuredQuantities | null
}

/** Engine quantities the pricing uses in place of kg/m² ratios. */
export interface MeasuredQuantities {
  /** Super structure: gross LGS (net × wastage), kg. */
  lgsGrossKg: number
  lgsNetKg: number
  hrsKg: number
  screws: number
  connectorsAed: number
  anchors: number
  /** Super structure result timestamp the figures came from. */
  superRanAt: string
  superApprovedBy: string | null
  /** Installation labour from the productivity model (dry cost sheet, in-scope lines), AED. */
  labourAed?: number | null
  labourGangDays?: number | null
  labourUnmatched?: number
  labourSavedAt?: string
}

export interface JobInputs {
  doorHeightMm: number | null
  windowHeightMm: number | null
  plinthAboveNglMm: number | null
  soilBearingKpa: number | null
  lineLoadKnM: number | null
  coolingWm2: number | null
  floorToFloorMm?: number | null
  measurementUnit: 'm2' | 'sqft'
  quoteValidUntil: string
}

export type CanvasTab = {
  id: 'canvas'
  kind: 'canvas'
  title: 'Canvas'
}

export type PreviewTab = {
  id: string
  kind: 'preview'
  title: string
  pageNumber: number
}

export type StageTab = CanvasTab | PreviewTab

export const CANVAS_TAB: CanvasTab = {
  id: 'canvas',
  kind: 'canvas',
  title: 'Canvas',
}

export type SubagentStatus = 'queued' | 'running' | 'done' | 'error'

export interface SubagentJob {
  id: string
  pageNumber: number
  quality: PageQuality
  title: string
  status: SubagentStatus
  expanded: boolean
  /** Nested collapse for model thinking */
  thinkingExpanded: boolean
  label: string
  streamText: string
  thinkingText: string
  answerText: string
  lineCount: number
  rawNotes?: string
  error?: string
}

export type AgentMessageRole = 'agent' | 'user' | 'system'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  text: string
  at: string
  expanded: boolean
  /** status = internal progress (hidden); chat = user-facing thread */
  kind: 'status' | 'chat'
}

/** reading = page subagents; synthesizing = lead agent builds canvas; ready = chat open */
export type TakeoffAgentPhase =
  | 'idle'
  | 'reading'
  | 'synthesizing'
  | 'ready'
  | 'error'

export interface TakeoffAgentState {
  phase: TakeoffAgentPhase
  jobs: SubagentJob[]
  messages: AgentMessage[]
  doneCount: number
  totalCount: number
  /** Chat compose only after final takeoff is on canvas */
  chatEnabled: boolean
  synthesisStream: string
  synthesisThinking: string
  synthesisAnswer: string
  synthesisExpanded: boolean
  synthesisThinkingExpanded: boolean
}

export type DisciplineId = 'civil' | 'arch' | 'struct' | 'mep'

export type WizardStep = 'details' | 'components' | 'materials'

/** Selected material + variant for a building component */
export type MaterialSelection = {
  materialId: string
  variantId: string
}

export interface ProjectSetup {
  projectName: string
  floors: number
  disciplines: DisciplineId[]
  /** floor number → selected component ids */
  floorComponents: Record<number, string[]>
  /** floor → componentId → material selections */
  floorMaterials: Record<number, Record<string, MaterialSelection[]>>
  completed: boolean
}

export type SetupPrefillStatus = 'idle' | 'running' | 'done' | 'error'

export interface SetupWizardState {
  open: boolean
  step: WizardStep
  /** 1-based floor currently being edited */
  currentFloor: number
  prefillStatus: SetupPrefillStatus
  prefillNote: string
}

export type StageView = 'takeoff' | 'pricing' | 'measure' | 'summary'

export type MeasureTarget = { fileId: string; pageNumber: number }

export interface PriceSheetRow {
  id: string
  discipline: DisciplineId
  componentId: string
  componentLabel: string
  materialId: string
  materialLabel: string
  variantId: string
  variantLabel: string
  unit: string
  /** Direct rate per unit: material + fabrication + installation, before markups. */
  unitPrice: number
  currency: string
  notes: string
  /** Optional split of the direct rate. When present they sum to unitPrice. */
  materialCost?: number
  fabCost?: number
  installCost?: number
  /**
   * Where the rate stands. seed = keyword guess from the catalog (never quotable),
   * listed = UNIQUBE price list with no review date, verified = checked by a person on rateDate.
   * Missing means listed (rows saved before statuses existed).
   */
  status?: 'seed' | 'listed' | 'verified'
  /** ISO date the rate was last checked (supplier quote, invoice or price list). */
  rateDate?: string
  /** Supplier, quote number or who checked it. */
  rateSource?: string
}

export type ClientDocStatus = 'reading' | 'ready' | 'error'

export type DocumentCategory = 'drawing' | 'bid' | 'other'

export function documentCategory(value: unknown): DocumentCategory {
  return value === 'bid' || value === 'other' || value === 'drawing' ? value : 'drawing'
}

export function documentCategoryLabel(value: unknown): string {
  const category = documentCategory(value)
  if (category === 'bid') return 'Bid'
  if (category === 'other') return 'Other'
  return 'Drawing'
}

/** A client PDF the estimator agent can list, search, and read page by page. */
export interface ClientDocument {
  id: string
  /** Name shown in the estimate. It can differ from the file name. */
  name: string
  /** Original file name, kept so a renamed document is not imported again. */
  sourceName: string
  category: DocumentCategory
  file: File
  analysis: DocumentAnalysis | null
  status: ClientDocStatus
  error?: string
}

export type AgentMode = 'ask' | 'execute'

export interface AppState {
  status: DocOverallStatus
  statusMessage: string
  /** 0–1 while classifying PDF after upload */
  analyzeProgress: number
  file: File | null
  analysis: DocumentAnalysis | null
  /** Every PDF added in this session. The agent reads these, not a single upload. */
  documents: ClientDocument[]
  /** Human or agent statement of scale / unit system. Empty until someone sets it. */
  drawingScale: string
  lines: TakeoffLine[]
  tabs: StageTab[]
  activeTabId: string
  agentBusy: boolean
  takeoffAgent: TakeoffAgentState
  projectSetup: ProjectSetup
  /** Null until the user creates or opens a project. */
  projectId: string | null
  setupWizard: SetupWizardState
  /** Main stage: takeoff canvas vs price sheet */
  stageView: StageView
  priceSheet: PriceSheetRow[]
  /** OpenAI Files API id for the current PDF (reuse across takeoff/chat) */
  openaiFileId: string | null
  /** Page pinned onto the next chat message. Not saved with the project. */
  chatPage: { fileId: string; fileName: string; pageNumber: number } | null
  /** Canvas lines pinned onto the next chat message. Not saved with the project. */
  chatLineIds: string[]
  projectContext: ProjectContext
  measurements: Measurement[]
  /** Keyed `${fileId}:${pageNumber}`. */
  pageScales: Record<string, PageScale>
  /** Sheet open in the measure workspace. */
  measureTarget: MeasureTarget | null
  /** Project context dialog open. Not saved. */
  contextOpen: boolean
  revisions: EstimateRevision[]
}
