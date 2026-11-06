import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { openSettings, settingsFieldFor } from '../lib/settingsDialog'
import { readSession } from './OsChrome'
import { mepBlocked, runMep } from '../lib/mep/engine'
import { readElectricalSheets } from '../lib/mep/readSheets'
import { mepSheetName } from '../lib/mep/estimateSheets'
import { mepFromPlan, mergePlanTrades, planDrawings, type MepPlanLayout } from '../lib/mep/fromPlan'
import { loadEngineState } from '../lib/foundation/run'
import { restoreMissingDrawings } from '../lib/restoreDrawing'
import { loadMepState, saveMepState } from '../lib/mep/run'
import type { FixtureRow, MepBuilding, MepModule, MepState, SanitaryCounts } from '../lib/mep/types'
import { apiJson } from '../lib/api'
import type { ArchState } from '../lib/architecture/types'
import { MepPlan } from './MepPlan'

type Tab = 'drawings' | 'fixtures' | 'settings' | 'boq'

const MODULES: Array<MepModule | 'unknown'> = ['ceiling', 'wall', 'mechanical', 'plumbing', 'fire', 'underground', 'unknown']

export function MepPanel({ projectId }: { projectId: string }) {
  const documents = useAppStore((s) => s.documents)
  const [state, setState] = useState<MepState | null>(null)
  const [tab, setTab] = useState<Tab>('drawings')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [layout, setLayout] = useState<MepPlanLayout | null>(null)
  const hydrated = useRef(false)
  const user = readSession()?.name ?? 'engineer'

  useEffect(() => {
    let alive = true
    hydrated.current = false
    setState(null)
    void loadMepState(projectId).then(async (loaded) => {
      if (!alive) return
      let building: MepBuilding | null = loaded.inputs.building
      let inputs = loaded.inputs
      try {
        const arch = await apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`)
        const summary = arch?.result?.summary
        if (summary?.occupiedM2) {
          building = {
            occupiedM2: summary.occupiedM2,
            wetM2: summary.wetM2,
            storeys: summary.storeys,
            meanWallHeightM: summary.meanWallHeightM,
          }
        }
      } catch {
        /* architecture has not been saved yet */
      }
      try {
        const engine = await loadEngineState(projectId)
        const result = engine.result
        if (result?.rooms.length) {
          const built = mepFromPlan(result)
          const merged = mergePlanTrades(inputs, built)
          inputs = { ...inputs, ...merged }
          if (!building?.occupiedM2) building = { ...built.building, meanWallHeightM: building?.meanWallHeightM ?? null }
          if (alive) setLayout({ footprint: result.footprint.polygon, walls: result.walls, rooms: result.rooms })
          setNote(
            planDrawings(inputs.drawings)
              ? 'Electrical, mechanical, plumbing and fire are counted from the rooms on the sub structure plan.'
              : 'Mechanical, plumbing and fire are counted from the rooms. Lighting and power stay on the sheets you read.',
          )
        }
      } catch {
        /* the sub structure plan has not been run */
      }
      if (!alive) return
      setState({ ...loaded, inputs: { ...inputs, building }, overrides: inputs === loaded.inputs ? loaded.overrides : { approvedBy: null, approvedAt: null } })
      hydrated.current = true
    })
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!hydrated.current || !state) return
    const handle = window.setTimeout(() => {
      void saveMepState(projectId, { ...state, result: runMep(state.inputs) }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The MEP quantities could not be saved.')
      })
    }, 400)
    return () => window.clearTimeout(handle)
  }, [projectId, state])

  const result = useMemo(() => (state ? runMep(state.inputs) : null), [state])
  const pdfs = documents.filter((doc) => doc.file && doc.status !== 'error')

  const jobInputs = useAppStore((s) => s.projectContext.jobInputs)

  const edit = (patch: (current: MepState) => MepState) => {
    setState((current) => {
      if (!current) return current
      const next = patch(current)
      return { ...next, overrides: { approvedBy: null, approvedAt: null } }
    })
  }

  useEffect(() => {
    if (!jobInputs || !state || jobInputs.coolingWm2 == null) return
    if (state.inputs.settings.coolingWm2 === jobInputs.coolingWm2) return
    edit((current) => ({
      ...current,
      inputs: { ...current.inputs, settings: { ...current.inputs.settings, coolingWm2: jobInputs.coolingWm2 } },
    }))
  }, [jobInputs, state])

  const read = async () => {
    setBusy(true)
    setError(null)
    try {
      await restoreMissingDrawings(projectId)
      const engine = await loadEngineState(projectId)
      const stored = () =>
        useAppStore
          .getState()
          .documents.filter((doc) => doc.file && doc.file.size > 0)
          .map((doc) => ({ id: doc.id, name: doc.name, file: doc.file }))
      const files = stored()
      const generated = new Set(files.filter((file) => /ARCH/i.test(file.name)).map((file) => mepSheetName(file.name)))
      const real = files.filter((file) => !generated.has(file.name))
      const namedElectrical = real.some((file) => /LIGHT|POWER|ELECTR|\bEL\b|\bEP\b/i.test(file.name))
      const readResult = namedElectrical ? await readElectricalSheets(real) : { drawings: [], legend: [], fixtures: [], marks: [], sourceText: '', note: null }
      const built = engine.result?.rooms.length ? mepFromPlan(engine.result) : null
      if (engine.result?.rooms.length) {
        setLayout({ footprint: engine.result.footprint.polygon, walls: engine.result.walls, rooms: engine.result.rooms })
      }
      edit((current) => {
        const electrical = readResult.drawings.length
          ? {
              drawings: readResult.drawings,
              legend: readResult.legend,
              fixtures: [...current.inputs.fixtures.filter((row) => row.source === 'manual'), ...readResult.fixtures],
              marks: readResult.marks,
            }
          : current.inputs
        const merged = built ? mergePlanTrades(electrical, built) : electrical
        return {
          ...current,
          inputs: {
            ...current.inputs,
            ...merged,
            building: current.inputs.building?.occupiedM2 ? current.inputs.building : built?.building ?? current.inputs.building,
          },
        }
      })
      setNote(
        readResult.drawings.length && !planDrawings(readResult.drawings)
          ? 'Mechanical, plumbing and fire are counted from the rooms. Lighting and power stay on the sheets you read.'
          : 'Electrical, mechanical, plumbing and fire are counted from the rooms on the sub structure plan.',
      )
      setTab('fixtures')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The sheets could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const approve = () => {
    if (!state || !result || mepBlocked(result)) return
    setState({ ...state, result, overrides: { approvedBy: user, approvedAt: new Date().toISOString() } })
  }

  if (!state || !result) return <p className="doc-page__note">Opening the MEP estimate…</p>

  const approved = state.overrides.approvedBy
  const reds = result.flags.filter((flag) => flag.level === 'red')

  return (
    <div className="fe">
      <header className="agents-chat__head mep__head">
        <div>
          <h2>MEP quantities</h2>
          <span>Electrical, mechanical, plumbing and fire from the rooms on the sub structure plan. Hover a mark for its annotation.</span>
        </div>
        <div className="mep__actions">
          <button type="button" className="os-btn" disabled={busy || pdfs.length === 0} onClick={() => void read()}>
            {busy ? 'Reading…' : 'Read drawings'}
          </button>
          {approved ? (
            <span className="fe__approved">Approved by {approved}</span>
          ) : (
            <button type="button" className="os-btn os-btn--primary" disabled={reds.length > 0} onClick={approve}>
              Approve MEP
            </button>
          )}
        </div>
      </header>
      {error ? <p className="projects__error">{error}</p> : null}
      <div className="fe__body">
        <div className="fe__plan">
          <MepPlan projectId={projectId} drawings={state.inputs.drawings} fixtures={state.inputs.fixtures} marks={state.inputs.marks} documents={documents} layout={layout} />
        </div>
        <div className="fe__side">
      {note ? <p className="fe__flag is-amber">{note}</p> : null}
      {result.flags.map((flag) => {
        const field = settingsFieldFor(flag.text)
        const className = `fe__flag is-${flag.level === 'red' ? 'red' : 'amber'}`
        return field ? (
          <button key={flag.id} type="button" className={`${className} settings-jump`} onClick={() => openSettings(field)}>
            {flag.text}
          </button>
        ) : (
          <p key={flag.id} className={className}>
            {flag.text}
          </p>
        )
      })}
      <div className="fe__tabs">
        {(['drawings', 'fixtures', 'settings', 'boq'] as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? 'is-on' : ''} onClick={() => setTab(item)}>
            {item === 'boq' ? 'Bill' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'drawings' ? (
        <table className="fe__table">
          <thead>
            <tr>
              <th>File</th>
              <th>Title</th>
              <th>Floor</th>
              <th>Module</th>
            </tr>
          </thead>
          <tbody>
            {state.inputs.drawings.length === 0 ? (
              <tr>
                <td colSpan={4}>Add the lighting and power PDFs, then read them. A file is not assumed to be a floor.</td>
              </tr>
            ) : (
              state.inputs.drawings.map((drawing) => (
                <tr key={drawing.id}>
                  <td>
                    {drawing.name}
                    <small>{drawing.number}</small>
                  </td>
                  <td>{drawing.title}</td>
                  <td>{drawing.floor || '—'}</td>
                  <td>
                    <select
                      value={drawing.module}
                      onChange={(event) => {
                        const module = event.target.value as MepModule | 'unknown'
                        edit((current) => ({
                          ...current,
                          inputs: {
                            ...current.inputs,
                            drawings: current.inputs.drawings.map((item) => (item.id === drawing.id ? { ...item, module } : item)),
                          },
                        }))
                      }}
                    >
                      {MODULES.map((module) => (
                        <option key={module} value={module}>
                          {module}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {tab === 'fixtures' ? (
        <table className="fe__table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Module</th>
              <th>Count</th>
              <th>Per box</th>
            </tr>
          </thead>
          <tbody>
            {state.inputs.fixtures.length === 0 ? (
              <tr>
                <td colSpan={5}>No fixtures yet. Graphic symbols stay at zero until you confirm them.</td>
              </tr>
            ) : (
              state.inputs.fixtures.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>
                    <input
                      value={row.description}
                      onChange={(event) => updateFixture(edit, row.id, { description: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={row.module}
                      onChange={(event) => updateFixture(edit, row.id, { module: event.target.value as MepModule })}
                    >
                      <option value="ceiling">lighting</option>
                      <option value="wall">power</option>
                      <option value="mechanical">mechanical</option>
                      <option value="plumbing">plumbing</option>
                      <option value="fire">fire</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={row.count}
                      onChange={(event) => updateFixture(edit, row.id, { count: Number(event.target.value) || 0, source: 'manual' })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={row.gang}
                      onChange={(event) => updateFixture(edit, row.id, { gang: Math.max(1, Number(event.target.value) || 1) })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {tab === 'settings' ? (
        <div className="fe__inputs">
          <label>
            Conduit
            <select
              value={state.inputs.settings.conduitMaterial}
              onChange={(event) => patchSettings(edit, { conduitMaterial: event.target.value as 'PVC' | 'EMT' | 'GI' })}
            >
              <option value="PVC">PVC</option>
              <option value="EMT">EMT</option>
              <option value="GI">GI</option>
            </select>
          </label>
          <label>
            Back box
            <select
              value={state.inputs.settings.boxMaterial}
              onChange={(event) => patchSettings(edit, { boxMaterial: event.target.value as 'plastic' | 'metal' })}
            >
              <option value="plastic">plastic</option>
              <option value="metal">metal</option>
            </select>
          </label>
          <label>
            Wall conduit mm
            <input type="number" min={1} value={state.inputs.settings.wallConduitMm} onChange={(event) => patchSettings(edit, { wallConduitMm: Number(event.target.value) || 25 })} />
          </label>
          <label>
            Ceiling conduit mm
            <input type="number" min={1} value={state.inputs.settings.ceilingConduitMm} onChange={(event) => patchSettings(edit, { ceilingConduitMm: Number(event.target.value) || 25 })} />
          </label>
          <label>
            Wall drop m
            <input type="number" min={0} step={0.1} value={state.inputs.settings.wallDropM} onChange={(event) => patchSettings(edit, { wallDropM: Number(event.target.value) || 0 })} />
          </label>
          <label>
            Ceiling run m
            <input type="number" min={0} step={0.1} value={state.inputs.settings.ceilingRunM} onChange={(event) => patchSettings(edit, { ceilingRunM: Number(event.target.value) || 0 })} />
          </label>
          <label>
            Allowance %
            <input type="number" min={0} value={state.inputs.settings.allowancePct} onChange={(event) => patchSettings(edit, { allowancePct: Number(event.target.value) || 0 })} />
          </label>
          <label className="fe__check">
            <input
              type="checkbox"
              checked={state.inputs.settings.undergroundInScope}
              onChange={(event) => patchSettings(edit, { undergroundInScope: event.target.checked })}
            />
            Underground in scope
          </label>
          {state.inputs.settings.undergroundInScope ? (
            <label>
              Underground length m
              <input
                type="number"
                min={0}
                step={0.1}
                value={state.inputs.settings.undergroundLengthM ?? ''}
                onChange={(event) => patchSettings(edit, { undergroundLengthM: event.target.value === '' ? null : Number(event.target.value) })}
              />
            </label>
          ) : null}
          <label className="fe__check">
            <input
              type="checkbox"
              checked={state.inputs.settings.mechanicalInScope}
              onChange={(event) => patchSettings(edit, { mechanicalInScope: event.target.checked })}
            />
            Mechanical in scope
          </label>
          {state.inputs.settings.mechanicalInScope ? (
            <>
              <p className="fe__muted">The cooling rate is set in Settings{state.inputs.settings.coolingWm2 ? ` (${state.inputs.settings.coolingWm2} W/m²)` : ''}.</p>
              <label>
                Occupancy
                <input
                  type="number"
                  min={0}
                  value={state.inputs.settings.occupancy ?? ''}
                  onChange={(event) => patchSettings(edit, { occupancy: event.target.value === '' ? null : Number(event.target.value) })}
                />
              </label>
              <label>
                Fresh air L/s per person
                <input
                  type="number"
                  min={0}
                  value={state.inputs.settings.freshAirLsPerPerson ?? ''}
                  onChange={(event) => patchSettings(edit, { freshAirLsPerPerson: event.target.value === '' ? null : Number(event.target.value) })}
                />
              </label>
              <label>
                Wet-area air changes per hour
                <input
                  type="number"
                  min={0}
                  value={state.inputs.settings.wetAirChanges ?? ''}
                  onChange={(event) => patchSettings(edit, { wetAirChanges: event.target.value === '' ? null : Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}
          <label className="fe__check">
            <input
              type="checkbox"
              checked={state.inputs.settings.plumbingInScope}
              onChange={(event) => patchSettings(edit, { plumbingInScope: event.target.checked })}
            />
            Plumbing in scope
          </label>
          {state.inputs.settings.plumbingInScope ? (
            <>
              <p className="fe__muted">Counts come from the wet rooms. Type a number here only to replace the plan count.</p>
              {(['wc', 'basin', 'shower', 'sink'] as Array<keyof SanitaryCounts>).map((key) => (
                <label key={key}>
                  {key === 'wc' ? 'WC' : key[0].toUpperCase() + key.slice(1)}
                  <input
                    type="number"
                    min={0}
                    value={state.inputs.settings.sanitary[key] ?? ''}
                    onChange={(event) =>
                      patchSettings(edit, {
                        sanitary: { ...state.inputs.settings.sanitary, [key]: event.target.value === '' ? null : Number(event.target.value) },
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Waste run m per fitting
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={state.inputs.settings.wasteRunM ?? ''}
                  onChange={(event) => patchSettings(edit, { wasteRunM: event.target.value === '' ? null : Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}
          <label className="fe__check">
            <input
              type="checkbox"
              checked={state.inputs.settings.fireInScope}
              onChange={(event) => patchSettings(edit, { fireInScope: event.target.checked })}
            />
            Fire in scope
          </label>
        </div>
      ) : null}

      {tab === 'boq' ? (
        <table className="fe__table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Basis</th>
              <th className="is-num">Base</th>
              <th className="is-num">Extra</th>
              <th className="is-num">Final</th>
            </tr>
          </thead>
          <tbody>
            {result.boq.length === 0 ? (
              <tr>
                <td colSpan={6}>The bill is empty until fixture counts are confirmed.</td>
              </tr>
            ) : (
              result.boq.map((line) => (
                <tr key={line.code}>
                  <td>
                    {line.code}
                    <small>{line.module}</small>
                  </td>
                  <td>{line.description}</td>
                  <td>{line.basis}</td>
                  <td className="is-num">{line.base} {line.unit}</td>
                  <td className="is-num">{line.extra}</td>
                  <td className="is-num">{line.final} {line.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
        </div>
      </div>
    </div>
  )
}

function updateFixture(edit: (patch: (current: MepState) => MepState) => void, id: string, patch: Partial<FixtureRow>) {
  edit((current) => ({
    ...current,
    inputs: {
      ...current.inputs,
      fixtures: current.inputs.fixtures.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      legend: current.inputs.legend.map((entry) =>
        entry.id === id && patch.description ? { ...entry, description: patch.description } : entry,
      ),
    },
  }))
}

function patchSettings(edit: (patch: (current: MepState) => MepState) => void, patch: Partial<MepState['inputs']['settings']>) {
  edit((current) => ({
    ...current,
    inputs: { ...current.inputs, settings: { ...current.inputs.settings, ...patch } },
  }))
}
