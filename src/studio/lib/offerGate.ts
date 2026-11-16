/**
 * What must be true before an offer can leave the building. The checks live in offerGateCore.ts
 * (pure, tested); this file gathers the engine approvals for one project.
 */
import { apiJson } from './api'
import { architectureBlocked } from './architecture/engine'
import type { ArchState } from './architecture/types'
import { loadEngineState } from './foundation/run'
import { mepBlocked } from './mep/engine'
import { loadMepState } from './mep/run'
import { loadSuperState } from './superstructure/run'
import type { GateInput, StageApproval } from './offerGateCore'

export { evaluateOfferGate, type GateInput, type OfferGate, type StageApproval } from './offerGateCore'

function approval(result: unknown, blocked: boolean, approvedBy: string | null | undefined): StageApproval {
  return { ran: Boolean(result), blocked: Boolean(result) && blocked, approvedBy: approvedBy ?? null }
}

/** Engine approvals for one project, read fresh from the server. */
export async function loadStageApprovals(projectId: string): Promise<Pick<GateInput, 'structure' | 'architecture' | 'mep'>> {
  const engine = await loadEngineState(projectId).catch(() => null)
  const [superState, arch, mep] = await Promise.all([
    loadSuperState(projectId, engine?.inputs.storeyCount ?? 1).catch(() => null),
    apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`).catch(() => null),
    loadMepState(projectId).catch(() => null),
  ])
  const sr = superState?.result ?? null
  const ar = arch?.result ?? null
  const mr = mep?.result ?? null
  return {
    structure: approval(sr, Boolean(sr?.blocked), superState?.overrides.approvedBy),
    architecture: approval(ar, ar ? architectureBlocked(ar) : false, arch?.overrides?.approvedBy),
    mep: approval(mr && mr.boq.length ? mr : null, mr ? mepBlocked(mr) : false, mep?.overrides.approvedBy),
  }
}
