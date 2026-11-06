import { apiJson } from '../api'
import { emptyArchSettings, runArchitecture } from './engine'
import type { ArchSettings, ArchSource, ArchState } from './types'

export function emptyArchState(source: ArchSource | null = null): ArchState {
  const settings = emptyArchSettings()
  return {
    settings,
    overrides: { approvedBy: null, approvedAt: null },
    result: source ? runArchitecture(source, settings) : null,
  }
}

function withDefaults(parsed: Partial<ArchState>, source: ArchSource): ArchState {
  const settings: ArchSettings = { ...emptyArchSettings(), ...(parsed.settings ?? {}) }
  return {
    settings,
    overrides: { approvedBy: null, approvedAt: null, ...(parsed.overrides ?? {}) },
    result: runArchitecture(source, settings),
  }
}

export async function loadArchState(projectId: string, source: ArchSource): Promise<ArchState> {
  try {
    const remote = await apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`)
    if (remote?.settings || remote?.overrides) return withDefaults(remote, source)
  } catch {
    /* database down: measure from the current plan */
  }
  return emptyArchState(source)
}

export async function saveArchState(projectId: string, state: ArchState) {
  await apiJson(`/api/projects/${projectId}/architecture`, {
    method: 'PUT',
    body: JSON.stringify({ settings: state.settings, overrides: state.overrides, result: state.result }),
  })
}
