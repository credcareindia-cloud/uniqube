import { apiJson } from '../api'
import { DEFAULT_SETTINGS, runMep } from './engine'
import type { MepInputs, MepOverrides, MepState } from './types'

export function emptyMepState(): MepState {
  const inputs: MepInputs = { drawings: [], legend: [], fixtures: [], marks: [], settings: { ...DEFAULT_SETTINGS }, building: null }
  return { inputs, overrides: { approvedBy: null, approvedAt: null }, result: runMep(inputs) }
}

function withDefaults(parsed: Partial<MepState>): MepState {
  const inputs: MepInputs = {
    drawings: (parsed.inputs?.drawings ?? []).map((drawing) => ({
      ...drawing,
      pageWidth: drawing.pageWidth || 0,
      pageHeight: drawing.pageHeight || 0,
    })),
    legend: parsed.inputs?.legend ?? [],
    fixtures: parsed.inputs?.fixtures ?? [],
    marks: parsed.inputs?.marks ?? [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(parsed.inputs?.settings ?? {}),
      sanitary: { ...DEFAULT_SETTINGS.sanitary, ...(parsed.inputs?.settings?.sanitary ?? {}) },
    },
    building: parsed.inputs?.building ?? null,
  }
  const overrides: MepOverrides = { approvedBy: null, approvedAt: null, ...(parsed.overrides ?? {}) }
  return { inputs, overrides, result: parsed.result ?? runMep(inputs) }
}

export async function loadMepState(projectId: string): Promise<MepState> {
  try {
    const remote = await apiJson<Partial<MepState> | null>(`/api/projects/${projectId}/mep`)
    if (remote?.inputs) return withDefaults(remote)
  } catch {
    /* database down: start empty */
  }
  return emptyMepState()
}

export async function saveMepState(projectId: string, state: MepState) {
  await apiJson(`/api/projects/${projectId}/mep`, { method: 'PUT', body: JSON.stringify(state) })
}
