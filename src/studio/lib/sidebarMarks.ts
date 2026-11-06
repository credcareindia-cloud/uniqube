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
  share: false,
}

/** A tick means the step is finished. Everything else stays a clock. */
export function useSidebarMarks(projectId: string | null): SidebarMarks {
  const documents = useAppStore((s) => s.documents)
  const client = useAppStore((s) => s.projectContext.client)
  const location = useAppStore((s) => s.projectContext.location)
  const buildingType = useAppStore((s) => s.projectContext.buildingType)
  const scopeNotes = useAppStore((s) => s.projectContext.scopeNotes)
  const lines = useAppStore((s) => s.lines)
  const [agents, setAgents] = useState({ foundation: false, structure: false, mep: false, architecture: false, dryCost: false, packages: false })

  useEffect(() => {
    if (!projectId) {
      setAgents({ foundation: false, structure: false, mep: false, architecture: false, dryCost: false, packages: false })
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
        setAgents({
          foundation: Boolean(engine.result && engine.overrides.approvedBy),
          structure: Boolean(superState.result && superState.overrides.approvedBy),
          mep: Boolean(mepState.overrides.approvedBy),
          architecture: Boolean(archState?.overrides?.approvedBy),
          dryCost: Boolean(dryCost && sheetTotal(dryCost.material) > 0 && sheetTotal(dryCost.labour) > 0),
          packages: Boolean(packages && packages.library.length > 0 && packages.packages.length > 0),
        })
      })
      .catch(() => {
        if (!cancelled) setAgents({ foundation: false, structure: false, mep: false, architecture: false, dryCost: false, packages: false })
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (!projectId) return EMPTY

  const foundation = agents.foundation
  const structure = agents.structure
  const mep = agents.mep
  const architecture = agents.architecture
  const boq = foundation && structure && mep && architecture

  return {
    documents: documents.some((doc) => doc.status === 'ready'),
    setup: Boolean(client.trim() || location.trim() || buildingType.trim() || scopeNotes.trim()),
    costing: lines.some((line) => line.quantity > 0 && line.unitPrice > 0),
    packages: agents.packages,
    rules: false,
    foundation,
    structure,
    mep,
    architecture,
    boq,
    dryCost: agents.dryCost,
    share: boq,
  }
}
