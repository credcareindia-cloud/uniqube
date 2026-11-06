/**
 * Browser-side runner for the superstructure engine: loads the project state, reads the approved
 * foundation result, runs the engine and persists inputs, engineer decisions and the last result.
 */
import { apiJson } from '../api'
import { loadEngineState } from '../foundation/run'
import type { EngineResult } from '../foundation/types'
import { EMPTY_SUPER_OVERRIDES, defaultInputs, defaultLevelRow, runSuperstructure } from './engine.ts'
import { defaultAllowances } from './rules.ts'
import type { LevelRow, SuperInputs, SuperOverrides, SuperResult } from './types.ts'

export interface SuperState {
  inputs: SuperInputs
  overrides: SuperOverrides
  result: SuperResult | null
}

function withDefaults(parsed: Partial<SuperState>, storeyCount: number): SuperState {
  const base = defaultInputs(storeyCount)
  const inputs: SuperInputs = {
    ...base,
    ...(parsed.inputs ?? {}),
    settings: { ...base.settings, ...(parsed.inputs?.settings ?? {}) },
    suspendedFloor: { ...base.suspendedFloor, ...(parsed.inputs?.suspendedFloor ?? {}) },
    levels: (parsed.inputs?.levels?.length ? parsed.inputs.levels : base.levels).map((row, i, all) => ({ ...defaultLevelRow(i, i === all.length - 1), ...row })),
    roofSections: parsed.inputs?.roofSections ?? [],
    balconies: parsed.inputs?.balconies ?? [],
    parameterOverrides: parsed.inputs?.parameterOverrides ?? {},
  }
  const overrides: SuperOverrides = {
    ...EMPTY_SUPER_OVERRIDES,
    ...(parsed.overrides ?? {}),
    allowances: parsed.overrides?.allowances?.length ? parsed.overrides.allowances : defaultAllowances(),
  }
  return { inputs, overrides, result: parsed.result ?? null }
}

export async function loadSuperState(projectId: string, storeyCount: number): Promise<SuperState> {
  try {
    const remote = await apiJson<Partial<SuperState> | null>(`/api/projects/${projectId}/superstructure`)
    if (remote?.inputs) return withDefaults(remote, storeyCount)
  } catch {
    /* database down: start fresh */
  }
  return withDefaults({}, storeyCount)
}

export async function saveSuperState(projectId: string, state: SuperState) {
  try {
    await apiJson(`/api/projects/${projectId}/superstructure`, { method: 'PUT', body: JSON.stringify(state) })
  } catch {
    await apiJson(`/api/projects/${projectId}/superstructure`, { method: 'PUT', body: JSON.stringify({ ...state, result: null }) })
  }
}

/** The approved (or at least run) foundation result this project's superstructure builds on. */
export async function loadFoundationForSuper(projectId: string): Promise<{ result: EngineResult | null; approved: boolean; storeyCount: number }> {
  const state = await loadEngineState(projectId)
  return { result: state.result, approved: Boolean(state.overrides.approvedBy), storeyCount: state.inputs.storeyCount }
}

/** Resize the level table, keeping the rows already filled in. */
export function resizeLevels(levels: LevelRow[], count: number): LevelRow[] {
  const n = Math.max(1, Math.min(20, Math.floor(count)))
  const rows = Array.from({ length: n }, (_, i) => levels[i] ?? defaultLevelRow(i, i === n - 1))
  return rows.map((row, i) => {
    const isTop = i === n - 1
    const wasTop = i === levels.length - 1 && n !== levels.length
    if (isTop && !['flat_roof_truss', 'flat_roof_c_joist', 'pitched_roof'].includes(row.framingType)) return { ...row, framingType: 'flat_roof_truss' as const }
    if (!isTop && (wasTop || ['flat_roof_truss', 'flat_roof_c_joist', 'pitched_roof'].includes(row.framingType))) return { ...row, framingType: 'truss' as const, parapetHeightMm: null }
    return row
  })
}

export function runSuper(state: SuperState, foundation: EngineResult): SuperState {
  const result = runSuperstructure({ foundation, inputs: state.inputs, overrides: state.overrides })
  return { ...state, result }
}
