import { create } from 'zustand'
import type {
  AgentMessage,
  AppState,
  BuildUp,
  Commercials,
  DisciplineId,
  DocumentCategory,
  EstimateRevision,
  FloorSpec,
  MaterialSelection,
  Measurement,
  MeasureTarget,
  PageScale,
  PreviewTab,
  PriceSheetRow,
  ProjectContext,
  ProjectSetup,
  SetupWizardState,
  StageView,
  SubagentJob,
  TakeoffAgentState,
  TakeoffLine,
} from './types'
import { CANVAS_TAB, documentCategory } from './types'
import type { ProjectRecord } from './lib/projectRecord'
import { COMPONENTS } from './lib/projectCatalog'
import {
  buildSeedPriceSheet,
  loadPriceSheet,
  savePriceSheet,
} from './lib/priceSheet'
import { buildEstimationContext } from './lib/estimationContext'
import { buildAiRulesBlock, buildRulesReference } from './lib/rulesContext'
import {
  computeQuantities,
  emptyProjectContext,
  floorsFromCount,
  linesForMeasurement,
  withElementRates,
  type Quantities,
} from './lib/elements'
import { buildEstimate, nextRevisionLabel, revisionFromEstimate } from './lib/estimate'

export function pageScaleKey(fileId: string, pageNumber: number) {
  return `${fileId}:${pageNumber}`
}

/** Lines a measurement should put on the canvas right now. */
function derivedLines(
  measurement: Measurement,
  s: Pick<AppState, 'projectContext' | 'pageScales' | 'priceSheet'>,
): { quantities: Quantities; lines: TakeoffLine[] } {
  const scale = s.pageScales[pageScaleKey(measurement.fileId, measurement.pageNumber)] ?? null
  const quantities = computeQuantities(measurement, s.projectContext, scale)
  const lines = linesForMeasurement(measurement, quantities, s.projectContext, s.priceSheet).map((line) => ({
    ...line,
    id: newId(),
    confirmed: false,
  }))
  return { quantities, lines }
}

/** Replace the canvas lines owned by these measurements, keeping lines a person already confirmed. */
function relinkLines(
  lines: TakeoffLine[],
  measurements: Measurement[],
  s: Pick<AppState, 'projectContext' | 'pageScales' | 'priceSheet'>,
): TakeoffLine[] {
  const ids = new Set(measurements.map((m) => m.id))
  const kept = lines.filter((line) => !line.measurementId || !ids.has(line.measurementId) || line.confirmed)
  const confirmedTags = new Set(
    lines.filter((line) => line.measurementId && ids.has(line.measurementId) && line.confirmed).map((line) => line.tag),
  )
  const fresh: TakeoffLine[] = []
  for (const measurement of measurements) {
    for (const line of derivedLines(measurement, s).lines) {
      if (confirmedTags.has(line.tag)) continue
      fresh.push(line)
    }
  }
  return [...kept, ...fresh]
}

const emptyProjectSetup = (): ProjectSetup => ({
  projectName: '',
  floors: 1,
  disciplines: [],
  floorComponents: {},
  floorMaterials: {},
  completed: false,
})

const idleWizard = (): SetupWizardState => ({
  open: false,
  step: 'details',
  currentFloor: 1,
  prefillStatus: 'idle',
  prefillNote: '',
})

function newId() {
  return crypto.randomUUID()
}

const idleAgent: TakeoffAgentState = {
  phase: 'idle',
  jobs: [],
  messages: [],
  doneCount: 0,
  totalCount: 0,
  chatEnabled: false,
  synthesisStream: '',
  synthesisThinking: '',
  synthesisAnswer: '',
  synthesisExpanded: false,
  synthesisThinkingExpanded: false,
}

function stamp() {
  return new Date().toLocaleTimeString()
}

function agentMsg(
  role: AgentMessage['role'],
  text: string,
  kind: AgentMessage['kind'] = 'status',
): AgentMessage {
  return { id: newId(), role, text, at: stamp(), expanded: false, kind }
}

function emptyLine(): TakeoffLine {
  return {
    id: newId(),
    tag: '',
    system: 'CW 50',
    widthMm: 0,
    heightMm: 0,
    type: 'Fixed window',
    quantity: 1,
    unit: 'Pieces',
    unitPrice: 0,
    notes: '',
    source: 'manual',
    confirmed: false,
  }
}

function previewTabId(pageNumber: number) {
  return `preview-p${pageNumber}`
}

const readingJobs = new Map<string, number>()

function fileFromBlob(blob: Blob | null, name: string): File {
  if (!blob || blob.size === 0) return new File([], name, { type: 'application/pdf' })
  if (blob instanceof File && blob.name) return blob
  return new File([blob], name, { type: blob.type || 'application/pdf' })
}

const INTERRUPTED_READ = 'Reading was interrupted. Add the PDF again.'

function startPdfRead(projectId: string, id: string, file: File): Promise<void> {
  const job = `${projectId}:${id}`
  const generation = (readingJobs.get(job) ?? 0) + 1
  readingJobs.set(job, generation)
  return (async () => {
    const current = () => readingJobs.get(job) === generation
    try {
      const { analyzePdf } = await import('./lib/pdfAnalyze')
      const analysis = await analyzePdf(file, (msg, pct) => {
        if (!current()) return
        const state = useAppStore.getState()
        if (state.projectId !== projectId) return
        if (!state.documents.some((doc) => doc.id === id && doc.status === 'reading')) return
        useAppStore.setState({
          status: 'analyzing',
          statusMessage: msg,
          analyzeProgress: Math.min(0.99, Math.max(0.02, pct)),
        })
      })
      if (!current()) return
      useAppStore.setState((state) => {
        if (state.projectId !== projectId || !state.documents.some((doc) => doc.id === id)) return {}
        return {
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, analysis, status: 'ready' as const, error: undefined } : doc,
          ),
          file,
          analysis,
          status: 'ready' as const,
          statusMessage: `${analysis.pageCount} page(s) · ${file.name}`,
          analyzeProgress: 1,
          projectSetup: state.projectSetup.projectName
            ? state.projectSetup
            : { ...state.projectSetup, projectName: file.name.replace(/\.pdf$/i, '') },
        }
      })
    } catch (e) {
      if (!current()) return
      const message = e instanceof Error ? e.message : 'Failed to read PDF'
      useAppStore.setState((state) => {
        if (state.projectId !== projectId || !state.documents.some((doc) => doc.id === id)) return {}
        return {
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, status: 'error' as const, error: message } : doc,
          ),
          status: 'error' as const,
          statusMessage: message,
          analyzeProgress: 0,
        }
      })
    } finally {
      if (current()) readingJobs.delete(job)
    }
  })()
}

function patchJob(
  jobs: SubagentJob[],
  id: string,
  partial: Partial<SubagentJob>,
): SubagentJob[] {
  return jobs.map((j) => (j.id === id ? { ...j, ...partial } : j))
}

interface Actions {
  reset: () => void
  setActiveTab: (id: string) => void
  openPreviewTab: (pageNumber: number) => void
  closeTab: (id: string) => void
  ingestFile: (file: File) => Promise<void>
  addClientFiles: (files: File[], details?: Array<{ name?: string; category?: DocumentCategory }>) => Promise<void>
  updateDocument: (id: string, patch: { name?: string; category?: DocumentCategory }) => void
  replaceDocumentFile: (id: string, file: File) => void
  retryDocument: (id: string) => void
  selectDocument: (id: string) => void
  removeDocument: (id: string) => void
  setChatPage: (page: { fileId: string; fileName: string; pageNumber: number }) => void
  clearChatPage: () => void
  toggleChatLine: (id: string) => void
  clearChatLines: () => void
  setDrawingScale: (statement: string) => void
  runTakeoffAgent: () => Promise<void>
  /** Re-read one failed (or any) page without restarting the whole run */
  retryPageJob: (pageNumber: number) => Promise<void>
  /** Rebuild canvas from whatever page reads succeeded */
  resumeSynthesis: () => Promise<void>
  toggleSubagentExpand: (id: string) => void
  toggleSubagentThinking: (id: string) => void
  toggleSynthesisExpand: () => void
  toggleSynthesisThinking: () => void
  toggleMessageExpand: (id: string) => void
  sendAgentChat: (text: string) => Promise<void>
  addLine: () => void
  updateLine: (id: string, patch: Partial<TakeoffLine>) => void
  /** Insert or replace a canvas line by tag. Used by the estimator agent. */
  upsertTakeoffLine: (line: Omit<TakeoffLine, 'id' | 'confirmed'>) => { id: string; action: 'added' | 'updated' }
  removeLine: (id: string) => void
  toggleConfirm: (id: string) => void
  // Project setup wizard
  setSetupDetails: (patch: {
    projectName?: string
    floors?: number
    disciplines?: DisciplineId[]
  }) => void
  toggleFloorComponent: (floor: number, componentId: string) => void
  setFloorComponents: (floor: number, componentIds: string[]) => void
  toggleMaterialSelection: (
    floor: number,
    componentId: string,
    selection: MaterialSelection,
  ) => void
  wizardNext: () => void
  wizardBack: () => void
  closeSetupWizard: () => void
  openSetupWizard: () => void
  /** Replace the workspace with a saved project. */
  applyProject: (record: ProjectRecord) => void
  /** AI-suggest project name / floors / disciplines / components / materials */
  prefillSetupFromAi: () => Promise<void>
  // Price sheet
  setStageView: (view: StageView) => void
  updatePriceRow: (id: string, patch: Partial<PriceSheetRow>) => void
  addPriceRow: () => void
  removePriceRow: (id: string) => void
  resetPriceSheet: () => void
  // Project context
  setContextOpen: (open: boolean) => void
  setProjectContext: (patch: Partial<ProjectContext>) => void
  setFloorCount: (count: number) => void
  setFloor: (level: number, patch: Partial<Omit<FloorSpec, 'level'>>) => void
  setBuildUp: (elementId: string, buildUp: BuildUp | null) => void
  setCommercials: (patch: Partial<Commercials>) => void
  // Estimate revisions
  saveRevision: (label?: string, note?: string) => EstimateRevision
  removeRevision: (id: string) => void
  // Measurements
  setMeasureTarget: (target: MeasureTarget | null) => void
  setPageScale: (fileId: string, pageNumber: number, scale: PageScale | null) => void
  addMeasurement: (
    input: Omit<Measurement, 'id' | 'createdAt'>,
    options?: { toCanvas?: boolean },
  ) => { measurement: Measurement; quantities: Quantities; lines: TakeoffLine[] }
  updateMeasurement: (id: string, patch: Partial<Omit<Measurement, 'id'>>) => void
  removeMeasurement: (id: string) => void
  /** Put or refresh the canvas lines for a measurement. */
  pushMeasurement: (id: string) => TakeoffLine[]
}

export const useAppStore = create<AppState & Actions>((set, get) => ({
  status: 'idle',
  statusMessage: 'Drop a client drawing PDF to begin',
  analyzeProgress: 0,
  file: null,
  analysis: null,
  documents: [],
  drawingScale: '',
  lines: [],
  tabs: [CANVAS_TAB],
  activeTabId: 'canvas',
  agentBusy: false,
  takeoffAgent: idleAgent,
  projectSetup: emptyProjectSetup(),
  projectId: null,
  setupWizard: idleWizard(),
  stageView: 'takeoff' as StageView,
  priceSheet: withElementRates(loadPriceSheet()),
  openaiFileId: null as string | null,
  chatPage: null,
  chatLineIds: [] as string[],
  projectContext: emptyProjectContext(),
  measurements: [] as Measurement[],
  pageScales: {} as Record<string, PageScale>,
  measureTarget: null as MeasureTarget | null,
  contextOpen: false,
  revisions: [] as EstimateRevision[],

  reset: () =>
    set({
      status: 'idle',
      statusMessage: 'Drop a client drawing PDF to begin',
      analyzeProgress: 0,
      file: null,
      analysis: null,
      documents: [],
      drawingScale: '',
      lines: [],
      tabs: [CANVAS_TAB],
      activeTabId: 'canvas',
      agentBusy: false,
      takeoffAgent: idleAgent,
      projectSetup: emptyProjectSetup(),
      setupWizard: idleWizard(),
      stageView: 'takeoff',
      openaiFileId: null,
      chatPage: null,
      chatLineIds: [],
      measurements: [],
      pageScales: {},
      measureTarget: null,
      contextOpen: false,
      revisions: [],
    }),

  setActiveTab: (id) => {
    if (get().tabs.some((t) => t.id === id)) {
      set({ activeTabId: id })
    }
  },

  openPreviewTab: (pageNumber) => {
    const id = previewTabId(pageNumber)
    const { tabs } = get()
    const existing = tabs.find((t) => t.id === id)
    if (existing) {
      set({ activeTabId: id })
      return
    }
    const tab: PreviewTab = {
      id,
      kind: 'preview',
      title: `Preview · P${pageNumber}`,
      pageNumber,
    }
    set({
      tabs: [...tabs, tab],
      activeTabId: id,
    })
  },

  closeTab: (id) => {
    if (id === 'canvas') return
    const { tabs, activeTabId } = get()
    const nextTabs = tabs.filter((t) => t.id !== id)
    const nextActive =
      activeTabId === id
        ? nextTabs[nextTabs.length - 1]?.id ?? 'canvas'
        : activeTabId
    set({ tabs: nextTabs.length ? nextTabs : [CANVAS_TAB], activeTabId: nextActive })
  },

  ingestFile: async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      set({ status: 'error', statusMessage: 'Please drop a PDF file' })
      return
    }
    set({
      status: 'analyzing',
      statusMessage: 'Reading PDF…',
      analyzeProgress: 0.02,
      file,
      analysis: null,
      lines: [],
      tabs: [CANVAS_TAB],
      activeTabId: 'canvas',
      agentBusy: false,
      takeoffAgent: idleAgent,
      projectSetup: emptyProjectSetup(),
      setupWizard: idleWizard(),
      openaiFileId: null,
    })

    try {
      const { analyzePdf } = await import('./lib/pdfAnalyze')
      const analysis = await analyzePdf(file, (msg, pct) => {
        set({
          statusMessage: msg,
          analyzeProgress: Math.min(0.99, Math.max(0.02, pct)),
        })
      })
      set({
        analysis,
        status: 'ready',
        statusMessage: `Classified ${analysis.pageCount} page(s)`,
        analyzeProgress: 1,
        tabs: [CANVAS_TAB],
        activeTabId: 'canvas',
        takeoffAgent: idleAgent,
        openaiFileId: null,
        projectSetup: {
          ...emptyProjectSetup(),
          projectName: file.name.replace(/\.pdf$/i, ''),
        },
        setupWizard: {
          open: true,
          step: 'details',
          currentFloor: 1,
          prefillStatus: 'idle',
          prefillNote: '',
        },
      })
      // Auto-suggest setup from drawing text (non-blocking for wizard UI)
      void get().prefillSetupFromAi()
    } catch (e) {
      set({
        status: 'error',
        statusMessage: e instanceof Error ? e.message : 'Failed to analyze PDF',
        analyzeProgress: 0,
      })
    }
  },

  addClientFiles: async (files, details) => {
    const projectId = get().projectId
    if (!projectId) {
      set({ status: 'error', statusMessage: 'Create a project before adding documents' })
      return
    }
    const pdfs = files
      .map((file, index) => ({ file, detail: details?.[index] }))
      .filter((item) => item.file.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) {
      set({ status: 'error', statusMessage: 'Add a PDF' })
      return
    }
    for (const { file, detail } of pdfs) {
      if (get().projectId !== projectId) return
      const name = detail?.name?.trim() || file.name.replace(/\.pdf$/i, '')
      const category = documentCategory(detail?.category)
      const stalled = get().documents.find((doc) => !doc.analysis && (doc.sourceName === file.name || doc.name === file.name || doc.file.name === file.name))
      const id = stalled?.id ?? newId()
      set((s) => ({
        documents: stalled
          ? s.documents.map((doc) =>
              doc.id === id
                ? { ...doc, name, sourceName: file.name, category, file, analysis: null, status: 'reading' as const, error: undefined }
                : doc,
            )
          : [...s.documents, { id, name, sourceName: file.name, category, file, analysis: null, status: 'reading' as const }],
        status: 'analyzing',
        statusMessage: `Reading ${name}…`,
        analyzeProgress: 0.02,
      }))
      await startPdfRead(projectId, id, file)
    }
  },

  updateDocument: (id, patch) => {
    const name = patch.name?.trim()
    set((s) => ({
      documents: s.documents.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              name: name || doc.name,
              category: patch.category ? documentCategory(patch.category) : doc.category,
            }
          : doc,
      ),
    }))
  },

  replaceDocumentFile: (id, file) => {
    set((s) => ({
      documents: s.documents.map((doc) =>
        doc.id === id
          ? { ...doc, file, sourceName: doc.sourceName || file.name, status: doc.analysis ? ('ready' as const) : doc.status, error: undefined }
          : doc,
      ),
    }))
  },

  retryDocument: (id) => {
    const projectId = get().projectId
    const doc = get().documents.find((item) => item.id === id)
    if (!projectId || !doc || doc.file.size === 0 || doc.status === 'reading') return
    set((s) => ({
      documents: s.documents.map((item) =>
        item.id === id ? { ...item, status: 'reading' as const, error: undefined, analysis: null } : item,
      ),
      status: 'analyzing',
      statusMessage: `Reading ${doc.name}…`,
      analyzeProgress: 0.02,
    }))
    void startPdfRead(projectId, id, doc.file)
  },

  selectDocument: (id) => {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc?.analysis) return
    set({
      file: doc.file,
      analysis: doc.analysis,
      activeTabId: 'canvas',
      tabs: [CANVAS_TAB],
    })
  },

  removeDocument: (id) => {
    const { documents, analysis, chatPage, measurements, pageScales, measureTarget, lines } = get()
    const removed = documents.find((d) => d.id === id)
    const next = documents.filter((d) => d.id !== id)
    const stillShowing = removed?.analysis && analysis === removed.analysis
    const fallback = next.find((d) => d.analysis) ?? null
    const gone = new Set(measurements.filter((m) => m.fileId === id).map((m) => m.id))
    const scales = Object.fromEntries(Object.entries(pageScales).filter(([key]) => !key.startsWith(`${id}:`)))
    set({
      documents: next,
      file: stillShowing ? (fallback?.file ?? null) : get().file,
      analysis: stillShowing ? (fallback?.analysis ?? null) : analysis,
      chatPage: chatPage?.fileId === id ? null : chatPage,
      measurements: measurements.filter((m) => m.fileId !== id),
      pageScales: scales,
      lines: lines.filter((line) => !line.measurementId || !gone.has(line.measurementId) || line.confirmed),
      measureTarget: measureTarget?.fileId === id ? null : measureTarget,
      stageView: measureTarget?.fileId === id && get().stageView === 'measure' ? 'takeoff' : get().stageView,
    })
  },

  setChatPage: (page) => set({ chatPage: page }),

  clearChatPage: () => set({ chatPage: null }),

  toggleChatLine: (id) =>
    set((s) => ({
      chatLineIds: s.chatLineIds.includes(id)
        ? s.chatLineIds.filter((item) => item !== id)
        : [...s.chatLineIds, id],
    })),

  clearChatLines: () => set({ chatLineIds: [] }),

  setDrawingScale: (statement) => {
    set({ drawingScale: statement.trim() })
  },

  toggleSubagentExpand: (id) => {
    const { takeoffAgent } = get()
    set({
      takeoffAgent: {
        ...takeoffAgent,
        jobs: takeoffAgent.jobs.map((j) =>
          j.id === id ? { ...j, expanded: !j.expanded } : j,
        ),
      },
    })
  },

  toggleSubagentThinking: (id) => {
    const { takeoffAgent } = get()
    set({
      takeoffAgent: {
        ...takeoffAgent,
        jobs: takeoffAgent.jobs.map((j) =>
          j.id === id ? { ...j, thinkingExpanded: !j.thinkingExpanded } : j,
        ),
      },
    })
  },

  toggleSynthesisExpand: () => {
    const { takeoffAgent } = get()
    set({
      takeoffAgent: {
        ...takeoffAgent,
        synthesisExpanded: !takeoffAgent.synthesisExpanded,
      },
    })
  },

  toggleSynthesisThinking: () => {
    const { takeoffAgent } = get()
    set({
      takeoffAgent: {
        ...takeoffAgent,
        synthesisThinkingExpanded: !takeoffAgent.synthesisThinkingExpanded,
      },
    })
  },

  toggleMessageExpand: (id) => {
    const { takeoffAgent } = get()
    set({
      takeoffAgent: {
        ...takeoffAgent,
        messages: takeoffAgent.messages.map((m) =>
          m.id === id ? { ...m, expanded: !m.expanded } : m,
        ),
      },
    })
  },

  sendAgentChat: async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const { takeoffAgent, agentBusy, lines, projectSetup, priceSheet, openaiFileId } =
      get()
    if (!takeoffAgent.chatEnabled || agentBusy) return

    const userMessage = agentMsg('user', trimmed, 'chat')
    set({
      agentBusy: true,
      takeoffAgent: {
        ...takeoffAgent,
        messages: [...takeoffAgent.messages, userMessage],
        synthesisStream: '',
        synthesisExpanded: false,
      },
      statusMessage: 'Agent answering…',
    })

    try {
      const { chatTakeoffAgent, extractJsonBlock, linesFromAgentText, stripJsonFromReply } =
        await import('./lib/takeoffAgent')

      const offerNotes =
        takeoffAgent.synthesisAnswer ||
        takeoffAgent.jobs.map((j) => j.rawNotes || j.answerText).filter(Boolean).join('\n\n')

      const estimationContext = buildEstimationContext(projectSetup, priceSheet)
      const rulesPrompt = buildAiRulesBlock('chat')
      const rulesReference = buildRulesReference(projectSetup)

      const reply = await chatTakeoffAgent(
        trimmed,
        lines,
        offerNotes,
        get()
          .takeoffAgent.messages.filter((m) => m.kind === 'chat')
          .map((m) => ({ role: m.role, text: m.text })),
        {
          onStatus: (msg) => set({ statusMessage: msg }),
          onToken: (_c, full, parts) => {
            set((s) => ({
              takeoffAgent: {
                ...s.takeoffAgent,
                synthesisStream: full,
                synthesisThinking: parts.thinking,
                synthesisAnswer: parts.answer,
              },
            }))
          },
        },
        { estimationContext, rulesPrompt, rulesReference },
        openaiFileId,
      )

      const parsed = extractJsonBlock(reply)
      let nextLines = lines
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const action = (parsed as { action?: string }).action
        if (action === 'replace') {
          const updated = linesFromAgentText(reply, newId)
          if (updated.length) nextLines = updated
        }
      } else if (Array.isArray(parsed)) {
        const updated = linesFromAgentText(reply, newId)
        if (updated.length) nextLines = updated
      }

      const visible = stripJsonFromReply(reply) || 'Done.'
      set((s) => ({
        lines: nextLines,
        agentBusy: false,
        statusMessage: 'Ready',
        activeTabId: 'canvas',
        takeoffAgent: {
          ...s.takeoffAgent,
          phase: 'ready',
          chatEnabled: true,
          synthesisStream: '',
          messages: [...s.takeoffAgent.messages, agentMsg('agent', visible, 'chat')],
        },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed'
      set((s) => ({
        agentBusy: false,
        statusMessage: msg,
        takeoffAgent: {
          ...s.takeoffAgent,
          synthesisStream: '',
          messages: [...s.takeoffAgent.messages, agentMsg('agent', msg, 'chat')],
        },
      }))
    }
  },

  runTakeoffAgent: async () => {
    const { analysis, agentBusy, file } = get()
    if (!analysis || agentBusy) return
    if (!file) {
      set({ statusMessage: 'No PDF file loaded' })
      return
    }

    const { openaiReady } = await import('./lib/openai')
    const { runPdfTakeoff, linesFromAgentText, stripJsonFromReply } = await import(
      './lib/takeoffAgent'
    )

    const jobId = newId()
    const jobs: SubagentJob[] = [
      {
        id: jobId,
        pageNumber: 1,
        quality: analysis.overall,
        title: 'Document · Sol',
        status: 'running',
        expanded: false,
        thinkingExpanded: false,
        label: 'Uploading / reading PDF…',
        streamText: '',
        thinkingText: '',
        answerText: '',
        lineCount: 0,
      },
    ]

    set({
      agentBusy: true,
      lines: [],
      statusMessage: 'Takeoff: checking OpenAI…',
      takeoffAgent: {
        phase: 'reading',
        jobs,
        doneCount: 0,
        totalCount: 1,
        chatEnabled: false,
        synthesisStream: '',
        synthesisThinking: '',
        synthesisAnswer: '',
        synthesisExpanded: false,
        synthesisThinkingExpanded: false,
        messages: [],
      },
    })

    const ready = await openaiReady()
    if (!ready) {
      const msg =
        'OpenAI is not configured on the Uniqube server'
      set({
        agentBusy: false,
        statusMessage: msg,
        takeoffAgent: {
          ...get().takeoffAgent,
          phase: 'error',
          chatEnabled: false,
          jobs: patchJob(get().takeoffAgent.jobs, jobId, {
            status: 'error',
            label: 'API key missing',
            error: msg,
          }),
          messages: [agentMsg('agent', msg, 'chat')],
        },
      })
      return
    }

    const estimationContext = buildEstimationContext(
      get().projectSetup,
      get().priceSheet,
    )
    const rulesPrompt = [
      buildAiRulesBlock('pageReader'),
      buildAiRulesBlock('leadEstimation'),
    ]
      .filter(Boolean)
      .join('\n\n')
    const rulesReference = buildRulesReference(get().projectSetup)

    try {
      set({
        statusMessage: 'Takeoff: GPT-6.1 Sol reading PDF…',
        takeoffAgent: {
          ...get().takeoffAgent,
          phase: 'synthesizing',
          jobs: patchJob(get().takeoffAgent.jobs, jobId, {
            status: 'running',
            label: 'Sol estimating…',
          }),
        },
      })

      const { text, fileId } = await runPdfTakeoff({
        file,
        fileId: get().openaiFileId,
        ctx: { estimationContext, rulesPrompt, rulesReference },
        callbacks: {
          onStatus: (label) => {
            set({
              statusMessage: label,
              takeoffAgent: {
                ...get().takeoffAgent,
                jobs: patchJob(get().takeoffAgent.jobs, jobId, {
                  label,
                  status: 'running',
                }),
              },
            })
          },
          onToken: (_c, full, parts) => {
            set((s) => ({
              takeoffAgent: {
                ...s.takeoffAgent,
                synthesisStream: full,
                synthesisAnswer: parts.answer || full,
                jobs: patchJob(s.takeoffAgent.jobs, jobId, {
                  streamText: full,
                  answerText: parts.answer || full,
                  label: `Writing… (${(parts.answer || full).length})`,
                }),
              },
            }))
          },
        },
      })

      const finalLines = linesFromAgentText(text, newId)
      const visible = stripJsonFromReply(text)

      set((s) => ({
        openaiFileId: fileId,
        lines: finalLines,
        agentBusy: false,
        statusMessage: `Takeoff ready · ${finalLines.length} line(s)`,
        activeTabId: 'canvas',
        takeoffAgent: {
          ...s.takeoffAgent,
          phase: 'ready',
          chatEnabled: true,
          doneCount: 1,
          synthesisStream: text,
          synthesisAnswer: visible || text,
          synthesisExpanded: false,
          jobs: patchJob(s.takeoffAgent.jobs, jobId, {
            status: 'done',
            label: 'Done',
            streamText: text,
            answerText: visible || text,
            rawNotes: text,
            lineCount: finalLines.length,
          }),
          messages: [
            agentMsg(
              'agent',
              finalLines.length
                ? `Takeoff ready — ${finalLines.length} line(s) from Sol (direct PDF). Ask to change or clarify anything.`
                : 'Sol returned an offer but no parseable JSON lines — open the document job or ask chat to rebuild the canvas.',
              'chat',
            ),
          ],
        },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Takeoff failed'
      set((s) => ({
        agentBusy: false,
        statusMessage: msg,
        takeoffAgent: {
          ...s.takeoffAgent,
          phase: 'error',
          chatEnabled: true,
          jobs: patchJob(s.takeoffAgent.jobs, jobId, {
            status: 'error',
            label: msg.length > 48 ? `${msg.slice(0, 48)}…` : msg,
            error: msg,
          }),
          messages: [agentMsg('agent', msg, 'chat')],
        },
      }))
    }
  },

  retryPageJob: async (_pageNumber) => {
    // Re-run full PDF takeoff (page rows are a single document job now)
    if (get().agentBusy) return
    await get().runTakeoffAgent()
  },

  resumeSynthesis: async () => {
    const { takeoffAgent, agentBusy } = get()
    if (agentBusy) return
    const notes = takeoffAgent.jobs.find((j) => j.rawNotes)?.rawNotes
    if (notes) {
      const { linesFromAgentText } = await import('./lib/takeoffAgent')
      const finalLines = linesFromAgentText(notes, newId)
      set({
        lines: finalLines,
        statusMessage: `Rebuilt canvas · ${finalLines.length} line(s)`,
        activeTabId: 'canvas',
        takeoffAgent: {
          ...takeoffAgent,
          phase: 'ready',
          chatEnabled: true,
          messages: [
            ...takeoffAgent.messages.filter((m) => m.kind === 'chat'),
            agentMsg(
              'agent',
              finalLines.length
                ? `Rebuilt ${finalLines.length} line(s) from last Sol response.`
                : 'Could not parse lines from last response — run Takeoff again.',
              'chat',
            ),
          ],
        },
      })
      return
    }
    await get().runTakeoffAgent()
  },

  addLine: () => set((s) => ({ lines: [...s.lines, emptyLine()] })),

  updateLine: (id, patch) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),

  upsertTakeoffLine: (line) => {
    const tag = line.tag.trim() || 'OPEN'
    const existing = get().lines.find((l) => l.tag.toLowerCase() === tag.toLowerCase())
    if (existing) {
      get().updateLine(existing.id, { ...line, tag, source: line.source || 'ai' })
      return { id: existing.id, action: 'updated' as const }
    }
    const id = newId()
    set((s) => ({
      lines: [
        ...s.lines,
        {
          ...line,
          id,
          tag,
          source: line.source || 'ai',
          confirmed: false,
        },
      ],
    }))
    return { id, action: 'added' as const }
  },

  removeLine: (id) =>
    set((s) => ({
      lines: s.lines.filter((l) => l.id !== id),
      chatLineIds: s.chatLineIds.filter((item) => item !== id),
    })),

  toggleConfirm: (id) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.id === id ? { ...l, confirmed: !l.confirmed } : l)),
    })),

  setSetupDetails: (patch) =>
    set((s) => {
      const floors = patch.floors ?? s.projectSetup.floors
      const next: ProjectSetup = {
        ...s.projectSetup,
        ...patch,
        floors,
      }
      // Drop floor data beyond new floor count
      if (patch.floors != null) {
        const comps = { ...next.floorComponents }
        const mats = { ...next.floorMaterials }
        for (const key of Object.keys(comps)) {
          if (Number(key) > floors) delete comps[Number(key)]
        }
        for (const key of Object.keys(mats)) {
          if (Number(key) > floors) delete mats[Number(key)]
        }
        next.floorComponents = comps
        next.floorMaterials = mats
      }
      // Drop components that no longer match selected disciplines
      if (patch.disciplines != null) {
        const allowed = new Set(
          COMPONENTS.filter((c) => patch.disciplines!.includes(c.discipline)).map(
            (c) => c.id,
          ),
        )
        const comps: Record<number, string[]> = {}
        const mats: Record<number, Record<string, MaterialSelection[]>> = {}
        for (const [floorKey, ids] of Object.entries(next.floorComponents)) {
          const kept = ids.filter((id) => allowed.has(id))
          comps[Number(floorKey)] = kept
          const floorMats = next.floorMaterials[Number(floorKey)] ?? {}
          mats[Number(floorKey)] = Object.fromEntries(
            Object.entries(floorMats).filter(([cid]) => allowed.has(cid)),
          )
        }
        next.floorComponents = comps
        next.floorMaterials = mats
      }
      return { projectSetup: next }
    }),

  toggleFloorComponent: (floor, componentId) =>
    set((s) => {
      const prev = s.projectSetup.floorComponents[floor] ?? []
      const has = prev.includes(componentId)
      const next = has ? prev.filter((id) => id !== componentId) : [...prev, componentId]
      const floorMats = { ...(s.projectSetup.floorMaterials[floor] ?? {}) }
      if (has) delete floorMats[componentId]
      return {
        projectSetup: {
          ...s.projectSetup,
          floorComponents: { ...s.projectSetup.floorComponents, [floor]: next },
          floorMaterials: { ...s.projectSetup.floorMaterials, [floor]: floorMats },
        },
      }
    }),

  setFloorComponents: (floor, componentIds) =>
    set((s) => {
      const allowed = new Set(componentIds)
      const floorMats = { ...(s.projectSetup.floorMaterials[floor] ?? {}) }
      for (const key of Object.keys(floorMats)) {
        if (!allowed.has(key)) delete floorMats[key]
      }
      return {
        projectSetup: {
          ...s.projectSetup,
          floorComponents: {
            ...s.projectSetup.floorComponents,
            [floor]: componentIds,
          },
          floorMaterials: {
            ...s.projectSetup.floorMaterials,
            [floor]: floorMats,
          },
        },
      }
    }),

  toggleMaterialSelection: (floor, componentId, selection) =>
    set((s) => {
      const floorMats = { ...(s.projectSetup.floorMaterials[floor] ?? {}) }
      const list = [...(floorMats[componentId] ?? [])]
      const idx = list.findIndex(
        (m) =>
          m.materialId === selection.materialId && m.variantId === selection.variantId,
      )
      if (idx >= 0) list.splice(idx, 1)
      else list.push(selection)
      floorMats[componentId] = list
      return {
        projectSetup: {
          ...s.projectSetup,
          floorMaterials: {
            ...s.projectSetup.floorMaterials,
            [floor]: floorMats,
          },
        },
      }
    }),

  wizardNext: () => {
    const { setupWizard, projectSetup } = get()
    const { step, currentFloor } = setupWizard
    const { floors } = projectSetup

    if (step === 'details') {
      if (!projectSetup.projectName.trim() || projectSetup.disciplines.length === 0) return
      set({
        setupWizard: { ...setupWizard, open: true, step: 'components', currentFloor: 1 },
      })
      return
    }

    if (step === 'components') {
      const selected = projectSetup.floorComponents[currentFloor] ?? []
      if (selected.length === 0) return
      set({
        setupWizard: { ...setupWizard, step: 'materials' },
      })
      return
    }

    // materials → next floor or finish
    if (currentFloor < floors) {
      set({
        setupWizard: {
          ...setupWizard,
          open: true,
          step: 'components',
          currentFloor: currentFloor + 1,
        },
      })
      return
    }

    set({
      projectSetup: { ...projectSetup, completed: true },
      setupWizard: idleWizard(),
      statusMessage: `Project setup complete — ${projectSetup.projectName}`,
    })
  },

  wizardBack: () => {
    const { setupWizard, projectSetup } = get()
    const { step, currentFloor } = setupWizard

    if (step === 'details') return

    if (step === 'components') {
      if (currentFloor <= 1) {
        set({ setupWizard: { ...setupWizard, open: true, step: 'details', currentFloor: 1 } })
        return
      }
      set({
        setupWizard: {
          ...setupWizard,
          open: true,
          step: 'materials',
          currentFloor: currentFloor - 1,
        },
      })
      return
    }

    // materials → components same floor
    set({
      setupWizard: {
        ...setupWizard,
        open: true,
        step: 'components',
        currentFloor,
      },
      projectSetup,
    })
  },

  closeSetupWizard: () =>
    set({
      setupWizard: idleWizard(),
    }),

  openSetupWizard: () =>
    set((s) => ({
      setupWizard: {
        open: true,
        step: s.projectSetup.completed ? 'details' : s.setupWizard.step || 'details',
        currentFloor: 1,
        prefillStatus: s.setupWizard.prefillStatus,
        prefillNote: s.setupWizard.prefillNote,
      },
      projectSetup: s.projectSetup.completed
        ? { ...s.projectSetup, completed: false }
        : s.projectSetup,
    })),

  applyProject: (record) => {
    const resume: Array<{ id: string; file: File }> = []
    const documents = record.documents.map((doc) => {
      const sourceName = doc.sourceName || doc.name
      const file = fileFromBlob(doc.file, sourceName)
      const missing = file.size === 0 && !doc.analysis
      const interrupted = !doc.analysis && (doc.status === 'reading' || doc.error === INTERRUPTED_READ)
      const canResume = interrupted && file.size > 0
      if (canResume) resume.push({ id: doc.id, file })
      return {
        id: doc.id,
        name: doc.name,
        sourceName,
        category: documentCategory(doc.category),
        file,
        analysis: doc.analysis,
        status: missing || (interrupted && !canResume) ? ('error' as const) : canResume ? ('reading' as const) : doc.status === 'reading' ? ('ready' as const) : doc.status,
        error: missing
          ? 'This PDF was not saved. Add it again.'
          : interrupted && !canResume
            ? 'This PDF was not saved. Add it again.'
            : canResume
              ? undefined
              : doc.error,
      }
    })
    const active =
      documents.find((doc) => doc.id === record.activeDocumentId && doc.analysis) ??
      documents.find((doc) => doc.analysis) ??
      null
    const firstResume = resume[0]
    set({
      projectId: record.id,
      status: firstResume ? 'analyzing' : record.status === 'analyzing' ? 'ready' : record.status,
      statusMessage: firstResume ? `Reading ${firstResume.file.name}…` : record.statusMessage,
      analyzeProgress: firstResume ? 0.02 : record.status === 'ready' ? 1 : 0,
      file: active?.file ?? null,
      analysis: active?.analysis ?? null,
      documents,
      drawingScale: record.drawingScale,
      lines: record.lines,
      tabs: record.tabs.length ? record.tabs : [CANVAS_TAB],
      activeTabId: record.tabs.some((tab) => tab.id === record.activeTabId) ? record.activeTabId : 'canvas',
      agentBusy: false,
      takeoffAgent: idleAgent,
      projectSetup: {
        ...record.projectSetup,
        projectName: record.projectSetup.projectName.trim() || record.name,
      },
      setupWizard: idleWizard(),
      stageView:
        record.stageView === 'pricing' || record.stageView === 'summary'
          ? record.stageView
          : record.stageView === 'measure' && record.measureTarget
            ? 'measure'
            : 'takeoff',
      priceSheet: withElementRates(record.priceSheet.length ? record.priceSheet : buildSeedPriceSheet()),
      openaiFileId: null,
      chatPage: null,
      chatLineIds: [],
      projectContext: record.projectContext,
      measurements: record.measurements,
      pageScales: record.pageScales,
      measureTarget: record.measureTarget,
      contextOpen: false,
      revisions: record.revisions,
    })
    if (resume.length) {
      void (async () => {
        for (const item of resume) await startPdfRead(record.id, item.id, item.file)
      })()
    }
  },

  prefillSetupFromAi: async () => {
    const { analysis, setupWizard } = get()
    if (!analysis || setupWizard.prefillStatus === 'running') return

    set({
      setupWizard: {
        ...get().setupWizard,
        open: true,
        prefillStatus: 'running',
        prefillNote: 'AI suggesting project setup…',
      },
      statusMessage: 'AI suggesting project setup…',
    })

    try {
      const { suggestSetupFromAnalysis, applySuggestionToSetup } =
        await import('./lib/setupPrefill')
      const rulesPrompt = buildAiRulesBlock('setupPrefill')
      const suggestion = await suggestSetupFromAnalysis(analysis, {
        rulesPrompt,
        file: get().file,
        fileId: get().openaiFileId,
        onStatus: (msg) => {
          set({
            statusMessage: msg,
            setupWizard: {
              ...get().setupWizard,
              prefillStatus: 'running',
              prefillNote: msg,
            },
          })
        },
      })
      // Persist file id if prefill uploaded the PDF
      // (suggestSetupWithPdf uploads when fileId missing)
      set({
        projectSetup: applySuggestionToSetup(suggestion),
        setupWizard: {
          ...get().setupWizard,
          open: true,
          step: 'details',
          currentFloor: 1,
          prefillStatus: 'done',
          prefillNote: suggestion.rationale,
        },
        statusMessage: `Setup suggested — ${suggestion.projectName}`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Setup suggestion failed'
      set({
        setupWizard: {
          ...get().setupWizard,
          prefillStatus: 'error',
          prefillNote: msg,
        },
        statusMessage: msg,
      })
    }
  },

  setStageView: (view) => set({ stageView: view }),

  updatePriceRow: (id, patch) =>
    set((s) => {
      const priceSheet = s.priceSheet.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      )
      savePriceSheet(priceSheet)
      return { priceSheet }
    }),

  addPriceRow: () =>
    set((s) => {
      const row: PriceSheetRow = {
        id: `custom-${crypto.randomUUID()}`,
        discipline: 'arch',
        componentId: 'custom',
        componentLabel: 'Custom',
        materialId: 'custom',
        materialLabel: 'New material',
        variantId: 'std',
        variantLabel: 'Standard',
        unit: 'm²',
        unitPrice: 0,
        currency: 'AED',
        notes: '',
      }
      const priceSheet = [...s.priceSheet, row]
      savePriceSheet(priceSheet)
      return { priceSheet }
    }),

  removePriceRow: (id) =>
    set((s) => {
      const priceSheet = s.priceSheet.filter((r) => r.id !== id)
      savePriceSheet(priceSheet)
      return { priceSheet }
    }),

  resetPriceSheet: () => {
    const priceSheet = withElementRates(buildSeedPriceSheet())
    savePriceSheet(priceSheet)
    set({ priceSheet })
  },

  setContextOpen: (open) => set({ contextOpen: open }),

  setProjectContext: (patch) =>
    set((s) => {
      const projectContext = { ...s.projectContext, ...patch }
      return {
        projectContext,
        lines: relinkLines(s.lines, s.measurements, { ...s, projectContext }),
      }
    }),

  setFloorCount: (count) =>
    set((s) => {
      const projectContext = { ...s.projectContext, floors: floorsFromCount(count, s.projectContext.floors) }
      return { projectContext, lines: relinkLines(s.lines, s.measurements, { ...s, projectContext }) }
    }),

  setFloor: (level, patch) =>
    set((s) => {
      const floors = s.projectContext.floors.map((floor) => (floor.level === level ? { ...floor, ...patch, level } : floor))
      const projectContext = { ...s.projectContext, floors }
      return { projectContext, lines: relinkLines(s.lines, s.measurements, { ...s, projectContext }) }
    }),

  setBuildUp: (elementId, buildUp) =>
    set((s) => {
      const buildUps = { ...s.projectContext.buildUps }
      if (buildUp) buildUps[elementId] = buildUp
      else delete buildUps[elementId]
      const projectContext = { ...s.projectContext, buildUps }
      return { projectContext, lines: relinkLines(s.lines, s.measurements, { ...s, projectContext }) }
    }),

  setCommercials: (patch) =>
    set((s) => ({
      projectContext: { ...s.projectContext, commercials: { ...s.projectContext.commercials, ...patch } },
    })),

  saveRevision: (label, note = '') => {
    const s = get()
    const estimate = buildEstimate({
      lines: s.lines,
      measurements: s.measurements,
      pageScales: s.pageScales,
      projectContext: s.projectContext,
      priceSheet: s.priceSheet,
    })
    const revision = revisionFromEstimate(estimate, (label ?? '').trim() || nextRevisionLabel(s.revisions), note)
    set({ revisions: [...s.revisions, revision] })
    return revision
  },

  removeRevision: (id) => set((s) => ({ revisions: s.revisions.filter((rev) => rev.id !== id) })),

  setMeasureTarget: (target) =>
    set({
      measureTarget: target,
      stageView: target ? 'measure' : 'takeoff',
      contextOpen: false,
    }),

  setPageScale: (fileId, pageNumber, scale) =>
    set((s) => {
      const key = pageScaleKey(fileId, pageNumber)
      const pageScales = { ...s.pageScales }
      if (scale) pageScales[key] = scale
      else delete pageScales[key]
      const affected = s.measurements.filter((m) => m.fileId === fileId && m.pageNumber === pageNumber)
      return {
        pageScales,
        lines: relinkLines(s.lines, affected, { ...s, pageScales }),
        drawingScale: scale && !s.drawingScale ? `${scale.label} on ${pageNumber}` : s.drawingScale,
      }
    }),

  addMeasurement: (input, options) => {
    const measurement: Measurement = { ...input, id: newId(), createdAt: new Date().toISOString() }
    const s = get()
    const { quantities, lines } = derivedLines(measurement, s)
    const toCanvas = options?.toCanvas !== false
    set((state) => ({
      measurements: [...state.measurements, measurement],
      lines: toCanvas ? relinkLines(state.lines, [measurement], state) : state.lines,
    }))
    return { measurement, quantities, lines: toCanvas ? lines : [] }
  },

  updateMeasurement: (id, patch) =>
    set((s) => {
      const measurements = s.measurements.map((m) => (m.id === id ? { ...m, ...patch, id } : m))
      const changed = measurements.find((m) => m.id === id)
      const owned = s.lines.some((line) => line.measurementId === id)
      return {
        measurements,
        lines: changed && owned ? relinkLines(s.lines, [changed], s) : s.lines,
      }
    }),

  removeMeasurement: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
      lines: s.lines.filter((line) => line.measurementId !== id || line.confirmed),
      chatLineIds: s.chatLineIds.filter((lineId) => s.lines.find((line) => line.id === lineId)?.measurementId !== id),
    })),

  pushMeasurement: (id) => {
    const s = get()
    const measurement = s.measurements.find((m) => m.id === id)
    if (!measurement) return []
    const lines = relinkLines(s.lines, [measurement], s)
    set({ lines, activeTabId: 'canvas' })
    return lines.filter((line) => line.measurementId === id)
  },
}))
