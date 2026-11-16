/**
 * Keeps projectContext.measured in step with the engines, so pricing reads measured quantities
 * instead of kg/m² ratios. Written on every super-structure save and every dry-cost save.
 */
import { useEffect } from 'react'
import { useAppStore } from '../store'
import type { MeasuredQuantities } from '../types'
import { inScopeLabour, loadDryCost, type DryCostSheet } from './dryCost'
import { loadEngineState } from './foundation/run'
import { loadSuperState, type SuperState } from './superstructure/run'

function current(projectId: string): MeasuredQuantities | null | undefined {
  const store = useAppStore.getState()
  if (store.projectId !== projectId) return undefined
  return store.projectContext.measured ?? null
}

function write(next: MeasuredQuantities | null) {
  useAppStore.getState().setProjectContext({ measured: next })
}

/** Steel figures from a super-structure state, or null when it has not produced a result. */
export function steelFromSuper(state: SuperState): Omit<MeasuredQuantities, 'labourAed' | 'labourGangDays' | 'labourUnmatched' | 'labourSavedAt'> | null {
  const result = state.result
  if (!result) return null
  const t = result.totals
  return {
    lgsGrossKg: Math.round(t.grossLgsKg),
    lgsNetKg: Math.round(t.netLgsKg),
    hrsKg: Math.round(t.hrsKg),
    screws: Math.round(t.screws),
    connectorsAed: Math.round(t.connectorsAed * 100) / 100,
    anchors: Math.round((t.anchorsM10 ?? 0) + (t.anchorsM8 ?? 0)),
    superRanAt: result.ranAt,
    // A blocked result is never priced, even if someone approved an older run.
    superApprovedBy: !result.blocked && state.overrides.approvedBy ? state.overrides.approvedBy : null,
  }
}

export function syncMeasuredSteel(projectId: string, state: SuperState) {
  const was = current(projectId)
  if (was === undefined) return
  const steel = steelFromSuper(state)
  if (!steel) {
    write(was ? { ...was, lgsGrossKg: 0, lgsNetKg: 0, hrsKg: 0, screws: 0, connectorsAed: 0, anchors: 0, superRanAt: '', superApprovedBy: null } : null)
    return
  }
  write({ ...(was ?? {}), ...steel })
}

export function syncMeasuredLabour(projectId: string, sheet: DryCostSheet) {
  const was = current(projectId)
  if (was === undefined) return
  const labour = inScopeLabour(sheet)
  const base: MeasuredQuantities = was ?? { lgsGrossKg: 0, lgsNetKg: 0, hrsKg: 0, screws: 0, connectorsAed: 0, anchors: 0, superRanAt: '', superApprovedBy: null }
  write({ ...base, labourAed: labour.amount, labourGangDays: labour.gangDays, labourUnmatched: labour.unmatched, labourSavedAt: new Date().toISOString() })
}

/** Reload both from the server (used when a page that prices opens). */
export async function refreshMeasured(projectId: string): Promise<MeasuredQuantities | null> {
  const engine = await loadEngineState(projectId).catch(() => null)
  const superState = await loadSuperState(projectId, engine?.inputs.storeyCount ?? 1).catch(() => null)
  if (superState) syncMeasuredSteel(projectId, superState)
  const dry = await loadDryCost(projectId).catch(() => null)
  if (dry) syncMeasuredLabour(projectId, dry)
  return current(projectId) ?? null
}

/** Pull the measured quantities for the open project when a pricing view mounts. */
export function useMeasuredRefresh() {
  const projectId = useAppStore((s) => s.projectId)
  useEffect(() => {
    if (projectId) void refreshMeasured(projectId).catch(() => undefined)
  }, [projectId])
}
