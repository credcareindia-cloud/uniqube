import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Sparkles, X } from 'lucide-react'
import { useAppStore } from '../store'
import type { DisciplineId, MaterialSelection } from '../types'
import {
  DISCIPLINES,
  FLOOR_OPTIONS,
  componentLabel,
  componentsForDisciplines,
  materialsForComponent,
} from '../lib/projectCatalog'

export function ProjectSetupWizard() {
  const open = useAppStore((s) => s.setupWizard.open)
  const step = useAppStore((s) => s.setupWizard.step)
  const currentFloor = useAppStore((s) => s.setupWizard.currentFloor)
  const prefillStatus = useAppStore((s) => s.setupWizard.prefillStatus)
  const prefillNote = useAppStore((s) => s.setupWizard.prefillNote)
  const projectSetup = useAppStore((s) => s.projectSetup)
  const setSetupDetails = useAppStore((s) => s.setSetupDetails)
  const toggleFloorComponent = useAppStore((s) => s.toggleFloorComponent)
  const toggleMaterialSelection = useAppStore((s) => s.toggleMaterialSelection)
  const wizardNext = useAppStore((s) => s.wizardNext)
  const wizardBack = useAppStore((s) => s.wizardBack)
  const closeSetupWizard = useAppStore((s) => s.closeSetupWizard)
  const prefillSetupFromAi = useAppStore((s) => s.prefillSetupFromAi)

  const [search, setSearch] = useState('')

  const availableComponents = useMemo(
    () => componentsForDisciplines(projectSetup.disciplines),
    [projectSetup.disciplines],
  )

  const selectedIds = projectSetup.floorComponents[currentFloor] ?? []
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableComponents
    return availableComponents.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.discipline.toLowerCase().includes(q),
    )
  }, [availableComponents, search])

  if (!open) return null

  const canNextDetails =
    projectSetup.projectName.trim().length > 0 && projectSetup.disciplines.length > 0
  const canNextComponents = selectedIds.length > 0
  const isLastFloor = currentFloor >= projectSetup.floors
  const nextLabel =
    step === 'materials'
      ? isLastFloor
        ? 'Finish'
        : `Next — Floor ${currentFloor + 1}`
      : 'Next'

  const canNext =
    step === 'details'
      ? canNextDetails
      : step === 'components'
        ? canNextComponents
        : true

  const stepTitle =
    step === 'details'
      ? 'Project details'
      : step === 'components'
        ? 'Building component'
        : `Materials — Floor ${currentFloor}`

  const stepHint =
    step === 'details'
      ? 'Name the project, choose floors, and pick disciplines.'
      : step === 'components'
        ? `Floor ${currentFloor} of ${projectSetup.floors} — select components for this floor.`
        : `Choose materials and variants for Floor ${currentFloor} components.`

  function toggleDiscipline(id: DisciplineId) {
    const has = projectSetup.disciplines.includes(id)
    const next = has
      ? projectSetup.disciplines.filter((d) => d !== id)
      : [...projectSetup.disciplines, id]
    setSetupDetails({ disciplines: next })
  }

  function isMaterialSelected(
    componentId: string,
    selection: MaterialSelection,
  ): boolean {
    const list = projectSetup.floorMaterials[currentFloor]?.[componentId] ?? []
    return list.some(
      (m) =>
        m.materialId === selection.materialId && m.variantId === selection.variantId,
    )
  }

  return (
    <div className="setup-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="setup-dialog">
        <header className="setup-header">
          <div>
            <p className="setup-eyebrow">Project setup</p>
            <h2 id="setup-title">{stepTitle}</h2>
            <p className="setup-hint">{stepHint}</p>
          </div>
          <div className="setup-header-right">
            <div className="setup-header-actions">
              <button
                type="button"
                className="setup-btn setup-btn--ai"
                disabled={prefillStatus === 'running'}
                onClick={() => void prefillSetupFromAi()}
              >
                <Sparkles size={14} />
                {prefillStatus === 'running' ? 'Suggesting…' : 'Suggest with AI'}
              </button>
              <button
                type="button"
                className="setup-close"
                aria-label="Close setup"
                title="Close"
                onClick={() => closeSetupWizard()}
              >
                <X size={18} />
              </button>
            </div>
            <div className="setup-steps" aria-hidden>
              <span className={clsx('setup-dot', step === 'details' && 'is-active')} />
              <span
                className={clsx(
                  'setup-dot',
                  (step === 'components' || step === 'materials') && 'is-active',
                )}
              />
              <span className={clsx('setup-dot', step === 'materials' && 'is-active')} />
            </div>
          </div>
        </header>

        {prefillStatus !== 'idle' && (
          <div
            className={clsx(
              'setup-prefill',
              prefillStatus === 'running' && 'is-running',
              prefillStatus === 'done' && 'is-done',
              prefillStatus === 'error' && 'is-error',
            )}
            role="status"
          >
            {prefillStatus === 'running' && (prefillNote || 'AI suggesting setup…')}
            {prefillStatus === 'done' &&
              `AI filled this form — review before Next. ${prefillNote}`}
            {prefillStatus === 'error' &&
              `AI suggest failed — fill manually or retry. ${prefillNote}`}
          </div>
        )}

        <div className="setup-body">
          {step === 'details' && (
            <div className="setup-details">
              <label className="setup-field">
                <span>Project name</span>
                <input
                  type="text"
                  value={projectSetup.projectName}
                  onChange={(e) => setSetupDetails({ projectName: e.target.value })}
                  placeholder="e.g. Marina Tower – Phase 1"
                  autoFocus
                />
              </label>

              <label className="setup-field">
                <span>No. of floors</span>
                <select
                  value={projectSetup.floors}
                  onChange={(e) =>
                    setSetupDetails({ floors: Number(e.target.value) })
                  }
                >
                  {FLOOR_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="setup-field setup-disciplines">
                <legend>Disciplines</legend>
                <div className="setup-chip-row">
                  {DISCIPLINES.map((d) => {
                    const on = projectSetup.disciplines.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={clsx('setup-chip', on && 'is-on')}
                        aria-pressed={on}
                        onClick={() => toggleDiscipline(d.id)}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {step === 'components' && (
            <div className="setup-split">
              <div className="setup-pane setup-pane--list">
                <div className="setup-pane-head">
                  <h3>Floor {currentFloor}</h3>
                  <input
                    type="search"
                    className="setup-search"
                    placeholder="Search components…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search components"
                  />
                </div>
                <ul className="setup-check-list">
                  {filtered.map((c) => {
                    const checked = selectedSet.has(c.id)
                    return (
                      <li key={c.id}>
                        <label className={clsx('setup-check', checked && 'is-checked')}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleFloorComponent(currentFloor, c.id)
                            }
                          />
                          <span className="setup-check-label">{c.label}</span>
                          <span className="setup-check-meta">{c.discipline}</span>
                        </label>
                      </li>
                    )
                  })}
                  {filtered.length === 0 && (
                    <li className="setup-empty">No components match “{search}”</li>
                  )}
                </ul>
              </div>

              <div className="setup-pane setup-pane--selected">
                <div className="setup-pane-head">
                  <h3>Selected</h3>
                  <span className="setup-count">{selectedIds.length}</span>
                </div>
                <ul className="setup-selected-list">
                  {selectedIds.map((id) => (
                    <li key={id}>
                      <span>{componentLabel(id)}</span>
                      <button
                        type="button"
                        className="setup-remove"
                        aria-label={`Remove ${componentLabel(id)}`}
                        onClick={() => toggleFloorComponent(currentFloor, id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {selectedIds.length === 0 && (
                    <li className="setup-empty">Check items on the left</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {step === 'materials' && (
            <div className="setup-materials">
              {selectedIds.length === 0 ? (
                <p className="setup-empty">No components selected for this floor.</p>
              ) : (
                selectedIds.map((componentId) => {
                  const materials = materialsForComponent(componentId)
                  return (
                    <section key={componentId} className="setup-mat-block">
                      <h3>{componentLabel(componentId)}</h3>
                      {materials.length === 0 ? (
                        <p className="setup-empty">No materials catalogued yet.</p>
                      ) : (
                        <div className="setup-mat-grid">
                          {materials.map((mat) => (
                            <div key={mat.id} className="setup-mat-card">
                              <p className="setup-mat-name">{mat.label}</p>
                              <div className="setup-variant-row">
                                {mat.variants.map((v) => {
                                  const sel: MaterialSelection = {
                                    materialId: mat.id,
                                    variantId: v.id,
                                  }
                                  const on = isMaterialSelected(componentId, sel)
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      className={clsx('setup-variant', on && 'is-on')}
                                      aria-pressed={on}
                                      onClick={() =>
                                        toggleMaterialSelection(
                                          currentFloor,
                                          componentId,
                                          sel,
                                        )
                                      }
                                    >
                                      {v.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })
              )}
            </div>
          )}
        </div>

        <footer className="setup-footer">
          <button
            type="button"
            className="setup-btn setup-btn--ghost"
            onClick={wizardBack}
            disabled={step === 'details'}
          >
            Back
          </button>
          <div className="setup-footer-meta">
            {step !== 'details' && (
              <span>
                Floor {currentFloor} / {projectSetup.floors}
              </span>
            )}
          </div>
          <button
            type="button"
            className="setup-btn setup-btn--primary"
            onClick={() => {
              if (step === 'components') setSearch('')
              wizardNext()
            }}
            disabled={!canNext}
          >
            {nextLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
