/**
 * Browser-side runner: picks the plan sheet(s), resolves the scale, runs the engine and persists
 * inputs, engineer overrides and the last result per project.
 */
import { pageScaleKey, useAppStore } from '../../store'
import { apiJson } from '../api'
import type { ClientDocument } from '../../types'
import { sheetSummary, type PageGeometry, type ScaleCandidate } from '../geometryCore'
import { DEFAULT_INPUTS, EMPTY_OVERRIDES, runFoundationEngine } from './engine.ts'
import type { EngineInputs, EngineResult, EngineerOverrides, LevelInfo } from './types.ts'

export interface EngineState {
  inputs: EngineInputs
  overrides: EngineerOverrides
  /** fileId:pageNumber chosen as the ground-floor plan; null = auto. */
  planKey: string | null
  result: EngineResult | null
}

export const engineStorageKey = (projectId: string) => `uniqube-foundation-engine-${projectId}`

function freshEngineState(): EngineState {
  const floors = useAppStore.getState().projectContext.floors
  return { inputs: { ...DEFAULT_INPUTS, storeyCount: Math.max(1, floors.filter((f) => f.level >= 0).length || 1) }, overrides: { ...EMPTY_OVERRIDES }, planKey: null, result: null }
}

function withDefaults(parsed: Partial<EngineState>): EngineState {
  return {
    inputs: { ...DEFAULT_INPUTS, ...(parsed.inputs ?? {}) },
    overrides: { ...EMPTY_OVERRIDES, ...(parsed.overrides ?? {}) },
    planKey: parsed.planKey ?? null,
    result: parsed.result ?? null,
  }
}

export async function loadEngineState(projectId: string): Promise<EngineState> {
  try {
    const remote = await apiJson<Partial<EngineState> | null>(`/api/projects/${projectId}/engine`)
    if (remote?.inputs) return withDefaults(remote)
  } catch {
    /* database down: start from the project floors */
  }
  try {
    const raw = localStorage.getItem(engineStorageKey(projectId))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EngineState>
      const state = withDefaults(parsed)
      void saveEngineState(projectId, state).then(() => localStorage.removeItem(engineStorageKey(projectId)))
      return state
    }
  } catch {
    /* ignore a broken local copy */
  }
  return freshEngineState()
}

export async function saveEngineState(projectId: string, state: EngineState) {
  try {
    await apiJson(`/api/projects/${projectId}/engine`, { method: 'PUT', body: JSON.stringify(state) })
  } catch {
    await apiJson(`/api/projects/${projectId}/engine`, { method: 'PUT', body: JSON.stringify({ ...state, result: null }) })
  }
  const { bumpSidebarMarks } = await import('../sidebarMarks')
  bumpSidebarMarks()
}

export interface PlanCandidate {
  key: string
  fileId: string
  fileName: string
  pageNumber: number
  drawingNo: string | null
  title: string | null
  kind: string
  dimensionCount: number
  autoScale: ScaleCandidate | null
}

/** Every plan-like sheet across the ready PDFs, best first. */
export async function listPlanCandidates(): Promise<PlanCandidate[]> {
  const projectId = useAppStore.getState().projectId
  if (projectId) {
    const { restoreMissingDrawings } = await import('../restoreDrawing')
    await restoreMissingDrawings(projectId)
  }
  const s = useAppStore.getState()
  const { getPageGeometry } = await import('../geometry')
  const out: PlanCandidate[] = []
  for (const doc of s.documents.filter((d): d is ClientDocument => d.status === 'ready' && !!d.analysis && !(/MEP/i.test(d.name) && !/ARCH/i.test(d.name)))) {
    for (let pageNumber = 1; pageNumber <= (doc.analysis?.pageCount ?? 0); pageNumber++) {
      const geo = await getPageGeometry(doc, pageNumber, s.projectContext.units)
      const sheet = sheetSummary(geo)
      if (sheet.kind !== 'plan' || !sheet.hasPlanRegion) continue
      out.push({
        key: `${doc.id}:${pageNumber}`,
        fileId: doc.id,
        fileName: doc.name,
        pageNumber,
        drawingNo: sheet.drawingNo,
        title: sheet.title,
        kind: sheet.kind,
        dimensionCount: sheet.dimensionCount,
        autoScale: geo.scaleCandidates.find((c) => c.method === 'auto') ?? null,
      })
    }
  }
  const groundish = (c: PlanCandidate) => /GROUND|LEVEL\s*0|\bGF\b|FOUNDATION/i.test(`${c.title ?? ''} ${c.drawingNo ?? ''}`)
  return out.sort((a, b) => Number(groundish(b)) - Number(groundish(a)) || b.dimensionCount - a.dimensionCount)
}

/**
 * Scale for the plan itself. A sheet with inset details splits the vote, so the plan cluster can
 * sit under 0.6 confidence even when dozens of dimension strings agree. The cluster with the most
 * samples is the plan; a tight little cluster is a detail.
 */
function planScale(geo: PageGeometry): ScaleCandidate | null {
  const autos = geo.scaleCandidates.filter((c) => c.method === 'auto')
  if (!autos.length) return null
  const best = [...autos].sort((a, b) => b.samples - a.samples || b.confidence - a.confidence)[0]
  if (best.confidence >= 0.6) return best
  if (best.samples >= 12 && best.confidence >= 0.4) return best
  return null
}

export interface RunOutcome {
  result: EngineResult
  geo: PageGeometry
  plan: PlanCandidate
  planCount: number
}

export async function runEngineForProject(state: EngineState): Promise<RunOutcome> {
  const s = useAppStore.getState()
  const candidates = await listPlanCandidates()
  if (!candidates.length) throw new Error('No plan sheet with a plan region was found in the ready PDFs.')
  const plan = (state.planKey && candidates.find((c) => c.key === state.planKey)) || candidates[0]
  const doc = s.documents.find((d) => d.id === plan.fileId)
  if (!doc) throw new Error('The plan PDF is no longer in the project.')
  const { getPageGeometry } = await import('../geometry')
  const geo = await getPageGeometry(doc, plan.pageNumber, s.projectContext.units)
  const set = s.pageScales[pageScaleKey(doc.id, plan.pageNumber)]
  const scale: ScaleCandidate | null = set
    ? { mmPerPt: set.mmPerPt, label: set.label, method: set.method === 'stated' ? 'stated' : 'auto', confidence: set.confidence, samples: set.samples }
    : planScale(geo)
  if (!scale) throw new Error(`No reliable scale for ${plan.drawingNo ?? plan.fileName} p${plan.pageNumber}. Set the page scale first.`)
  const sheet = sheetSummary(geo)
  const level: LevelInfo = {
    id: (sheet.drawingNo ?? `P${plan.pageNumber}`).replace(/[^A-Z0-9]/gi, ''),
    name: sheet.title ?? `Page ${plan.pageNumber}`,
    elevationMm: sheet.levels.find((l) => /GROUND|GF|FFL/i.test(l.label))?.mm ?? null,
    sourcePage: plan.pageNumber,
    fileId: doc.id,
    drawingNo: sheet.drawingNo,
  }
  const result = runFoundationEngine({ geo, scale, level, inputs: state.inputs, overrides: state.overrides, hasUpperLevels: candidates.length > 1 })
  return { result, geo, plan, planCount: candidates.length }
}
