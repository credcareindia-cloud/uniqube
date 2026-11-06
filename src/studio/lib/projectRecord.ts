import type {
  ClientDocStatus,
  DocumentCategory,
  DocOverallStatus,
  DocumentAnalysis,
  EstimateRevision,
  Measurement,
  MeasureTarget,
  PageScale,
  PriceSheetRow,
  ProjectContext,
  ProjectSetup,
  StageTab,
  StageView,
  TakeoffLine,
} from '../types'

export type SnapshotDocument = {
  id: string
  name: string
  sourceName?: string
  category?: DocumentCategory
  status: ClientDocStatus
  error?: string
  analysis: DocumentAnalysis | null
  file: Blob | null
}

export type StoredChat = {
  messages: unknown[]
  worked: Record<string, number>
  mode: 'ask' | 'execute'
  model: string
}

export type WorkspaceSnapshot = {
  projectSetup: ProjectSetup
  drawingScale: string
  lines: TakeoffLine[]
  tabs: StageTab[]
  activeTabId: string
  stageView: StageView
  priceSheet: PriceSheetRow[]
  status: DocOverallStatus
  statusMessage: string
  activeDocumentId: string | null
  documents: SnapshotDocument[]
  projectContext: ProjectContext
  measurements: Measurement[]
  pageScales: Record<string, PageScale>
  measureTarget: MeasureTarget | null
  revisions: EstimateRevision[]
}

export type ProjectRecord = WorkspaceSnapshot & {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  chat: StoredChat
}

export type ProjectIndexItem = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  lineCount: number
  fileCount: number
}

export function emptyChat(): StoredChat {
  return { messages: [], worked: {}, mode: 'execute', model: 'gpt-6.1-sol' }
}
