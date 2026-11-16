import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { apiJson } from '../lib/api'
import { loadEngineState } from '../lib/foundation/run'
import { loadSuperState } from '../lib/superstructure/run'
import { loadMepState } from '../lib/mep/run'
import type { ArchState } from '../lib/architecture/types'
import { useAppStore } from '../store'
import type { AgentFocus, OsScreen } from './OsChrome'

type Dest = { screen: OsScreen; agent?: AgentFocus }

type StepState = 'done' | 'progress' | 'open'

type Step = {
  id: string
  label: string
  state: StepState
}

function workState(value: 'none' | 'run' | 'approved' | null): StepState {
  if (value === 'approved') return 'done'
  if (value === 'run') return 'progress'
  return 'open'
}

export function ProjectHome({
  projectId,
  projectName,
  onContinue,
  onDelete,
}: {
  projectId: string
  projectName: string
  onContinue: (dest: Dest) => void
  onDelete: () => void
}) {
  const documents = useAppStore((s) => s.documents)
  const [foundation, setFoundation] = useState<'none' | 'run' | 'approved' | null>(null)
  const [structure, setStructure] = useState<'none' | 'run' | 'approved' | null>(null)
  const [architecture, setArchitecture] = useState<'none' | 'run' | 'approved' | null>(null)
  const [mep, setMep] = useState<'none' | 'run' | 'approved' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFoundation(null)
    setStructure(null)
    setArchitecture(null)
    setMep(null)
    Promise.all([
      loadEngineState(projectId),
      loadSuperState(projectId, 1),
      loadMepState(projectId),
      apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`).catch(() => null),
    ])
      .then(([engine, superState, mepState, archState]) => {
        if (cancelled) return
        setFoundation(!engine.result ? 'none' : engine.overrides.approvedBy ? 'approved' : 'run')
        setStructure(!superState.result ? 'none' : superState.overrides.approvedBy ? 'approved' : 'run')
        const archLines = archState?.result?.lines?.length ?? 0
        setArchitecture(archState?.overrides?.approvedBy ? 'approved' : archLines ? 'run' : 'none')
        const counted = mepState.inputs.fixtures.some((row) => row.count > 0) || Boolean(mepState.inputs.settings.coolingWm2) || Boolean(mepState.inputs.settings.sanitary.wc)
        setMep(mepState.overrides.approvedBy ? 'approved' : counted ? 'run' : 'none')
      })
      .catch(() => {
        if (cancelled) return
        setFoundation('none')
        setStructure('none')
        setArchitecture('none')
        setMep('none')
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const drawings = documents.length
  const ready = foundation !== null && structure !== null && architecture !== null && mep !== null

  const steps: Step[] = [
    { id: 'drawings', label: 'Drawings', state: drawings > 0 ? 'done' : 'open' },
    { id: 'foundation', label: 'Sub structure', state: workState(foundation) },
    { id: 'structure', label: 'Super structure', state: workState(structure) },
    { id: 'mep', label: 'MEP', state: workState(mep) },
    { id: 'architecture', label: 'Architecture', state: workState(architecture) },
    { id: 'boq', label: 'Bill of quantities', state: 'open' },
    { id: 'packages', label: 'Packages', state: 'open' },
    { id: 'workspace', label: 'Estimation Agent', state: 'open' },
    { id: 'offer', label: 'Offer', state: 'open' },
  ]

  return (
    <div className="est-sheet">
      {!ready ? (
        <p className="est-sheet__wait">Checking this project…</p>
      ) : (
        <div className="est-table-wrap">
            <table className="est-table">
              <thead>
                <tr>
                  <th className="est-num">#</th>
                  <th>Step</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => {
                  const dest: Dest | null =
                    step.id === 'drawings'
                      ? { screen: 'documents' }
                      : step.id === 'foundation'
                      ? { screen: 'agents', agent: 'foundation' }
                      : step.id === 'structure'
                        ? { screen: 'agents', agent: 'structure' }
                        : step.id === 'mep'
                          ? { screen: 'agents', agent: 'mep' }
                          : step.id === 'architecture'
                            ? { screen: 'agents', agent: 'architecture' }
                            : step.id === 'boq'
                              ? { screen: 'boq' }
                              : step.id === 'packages'
                                ? { screen: 'packages' }
                                : step.id === 'workspace'
                                  ? { screen: 'workspace' }
                                  : step.id === 'offer'
                                    ? { screen: 'share' }
                                    : null
                  const label = step.state === 'done' ? 'Done' : step.state === 'progress' ? 'In progress' : 'Open'
                  return (
                    <tr key={step.id} className={dest ? 'is-open' : undefined} onClick={() => { if (dest) onContinue(dest) }}>
                      <td className="est-num">{step.state === 'done' ? <Check size={14} /> : index + 1}</td>
                      <td>{step.label}</td>
                      <td>
                        <span className={`est-pill is-${step.state}`}>{label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      )}
      <div className="uq-guide__delete">
        {confirmDelete ? (
          <>
            <span>Delete {projectName.trim() || 'this project'}?</span>
            <button type="button" className="os-btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button type="button" className="os-btn uq-guide__danger" onClick={onDelete}>
              Delete
            </button>
          </>
        ) : (
          <button type="button" className="uq-quiet" onClick={() => setConfirmDelete(true)}>
            Delete this project
          </button>
        )}
      </div>
    </div>
  )
}
