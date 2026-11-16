import { useEffect, useState } from 'react'
import { apiJson } from './api'
import type { ArchState } from './architecture/types'
import { loadDryCost, sheetTotal } from './dryCost'
import { loadPackageRegister } from './packageRegister'
import { loadEngineState } from './foundation/run'
import { loadMepState } from './mep/run'
import { loadSuperState } from './superstructure/run'
import { useAppStore } from '../store'

export interface SidebarMarks {
  documents: boolean
  setup: boolean
  costing: boolean
  packages: boolean
  rules: boolean
  foundation: boolean
  structure: boolean
  mep: boolean
  architecture: boolean
  boq: boolean
  dryCost: boolean
  workspace: boolean
  share: boolean
}

const EMPTY: SidebarMarks = {
  documents: false,
  setup: false,
  costing: false,
  packages: false,
  rules: false,
  foundation: false,
  structure: false,
  mep: false,
  architecture: false,
  boq: false,
  dryCost: false,
  workspace: false,
  share: false,
}

type AgentMarks = {
  foundation: boolean
  structure: boolean
  mep: boolean
  architecture: boolean
  foundationApproved: boolean
  structureApproved: boolean
  mepApproved: boolean
  architectureApproved: boolean
  dryCost: boolean
  packages: boolean
}

const EMPTY_AGENTS: AgentMarks = {
  foundation: false,
  structure: false,
  mep: false,
  architecture: false,
  foundationApproved: false,
  structureApproved: false,
  mepApproved: false,
  architectureApproved: false,
  dryCost: false,
  packages: false,
}

const listeners = new Set<() => void>()
let bumpTimer: ReturnType<typeof setTimeout> | null = null

/** Call after any estimate step save so the rail ticks refresh without a page reload. */
export function bumpSidebarMarks() {
  if (bumpTimer) clearTimeout(bumpTimer)
  bumpTimer = setTimeout(() => {
    bumpTimer = null
    for (const listener of listeners) listener()
  }, 150)
}

function subscribeSidebarMarks(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A tick means the step has been run. BOQ / Offer still wait for approvals. */
export function useSidebarMarks(projectId: string | null): SidebarMarks {
  const documents = useAppStore((s) => s.documents)
  const client = useAppStore((s) => s.projectContext.client)
  const location = useAppStore((s) => s.projectContext.location)
  const buildingType = useAppStore((s) => s.projectContext.buildingType)
  const scopeNotes = useAppStore((s) => s.projectContext.scopeNotes)
  const lines = useAppStore((s) => s.lines)
  const [agents, setAgents] = useState<AgentMarks>(EMPTY_AGENTS)
  const [epoch, setEpoch] = useState(0)

  useEffect(() => subscribeSidebarMarks(() => setEpoch((value) => value + 1)), [])

  useEffect(() => {
    if (!projectId) {
      setAgents(EMPTY_AGENTS)
      return
    }
    let cancelled = false
    Promise.all([
      loadEngineState(projectId),
      loadSuperState(projectId, 1),
      loadMepState(projectId),
      apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`).catch(() => null),
      loadDryCost(projectId).catch(() => null),
      loadPackageRegister().catch(() => null),
    ])
      .then(([engine, superState, mepState, archState, dryCost, packages]) => {
        if (cancelled) return
        const mepCounted =
          mepState.inputs.fixtures.some((row) => row.count > 0) ||
          Boolean(mepState.inputs.settings.coolingWm2) ||
          Boolean(mepState.inputs.settings.sanitary.wc) ||
          Boolean(mepState.result?.boq?.length)
        setAgents({
          foundation: Boolean(engine.result),
          structure: Boolean(superState.result),
          mep: mepCounted,
          architecture: Boolean(archState?.result?.lines?.length),
          foundationApproved: Boolean(engine.result && engine.overrides.approvedBy),
          structureApproved: Boolean(superState.result && superState.overrides.approvedBy),
          mepApproved: Boolean(mepState.overrides.approvedBy),
          architectureApproved: Boolean(archState?.overrides?.approvedBy),
          dryCost: Boolean(dryCost && sheetTotal(dryCost.material) > 0 && sheetTotal(dryCost.labour) > 0),
          packages: Boolean(packages && packages.library.length > 0 && packages.packages.length > 0),
        })
      })
      .catch(() => {
        if (!cancelled) setAgents(EMPTY_AGENTS)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, epoch])

  if (!projectId) return EMPTY

  const boq =
    agents.foundationApproved && agents.structureApproved && agents.mepApproved && agents.architectureApproved

  return {
    documents: documents.some((doc) => doc.status === 'ready'),
    setup: Boolean(client.trim() || location.trim() || buildingType.trim() || scopeNotes.trim()),
    costing: lines.some((line) => line.quantity > 0 && line.unitPrice > 0),
    packages: agents.packages,
    rules: false,
    foundation: agents.foundation,
    structure: agents.structure,
    mep: agents.mep,
    architecture: agents.architecture,
    boq,
    dryCost: agents.dryCost,
    workspace: agents.foundation && agents.structure && agents.mep && agents.architecture,
    share: boq,
  }
}
