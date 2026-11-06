import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CheckCircle2, ChevronDown, Crosshair, Download, Play, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useAppStore } from '../store'
import { openSettings, settingsFieldFor } from '../lib/settingsDialog'
import { readSession } from './OsChrome'
import type { EngineResult } from '../lib/foundation/types'
import { superBoqCsv } from '../lib/superstructure/engine'
import { SECTION_LISTS, SUPER_PARAMETER_TABLE, SUPER_PARAMETER_SET } from '../lib/superstructure/rules'
import { HRS_SECTIONS, nominalKgPerM, normaliseSection } from '../lib/superstructure/hrsSections'
import { loadFoundationForSuper, loadSuperState, resizeLevels, runSuper, saveSuperState, type SuperState } from '../lib/superstructure/run'
import type { AllowanceRow, BalconyInput, FloorResult, FramingType, HrsDecision, HrsManual, LevelResult, LevelRow, RoofSectionInput, SuperFlag, SuperResult, TrussLineResult, WallRunResult } from '../lib/superstructure/types'

type Tab = 'flags' | 'levels' | 'walls' | 'floors' | 'roof' | 'fixings' | 'hrs' | 'allow' | 'boq' | 'sections' | 'log'

const FRAMING_FLOOR: FramingType[] = ['truss', 'c_joist']
const FRAMING_ROOF: FramingType[] = ['flat_roof_truss', 'flat_roof_c_joist', 'pitched_roof']
const kg = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))
const LB_PER_KG = 2.20462
const SQFT_PER_M2 = 10.7639
const m1 = (v: number | null | undefined) => (v == null ? '—' : (v / 1000).toFixed(2))
const num = (v: string) => (v.trim() === '' ? null : Number(v))

function sectionsFor(framing: FramingType) {
  if (framing === 'c_joist' || framing === 'flat_roof_c_joist') return SECTION_LISTS.c_joists
  return SECTION_LISTS.trusses
}

export function SuperstructurePanel({ projectId }: { projectId: string }) {
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const [state, setState] = useState<SuperState | null>(null)
  const [foundation, setFoundation] = useState<{ result: EngineResult | null; approved: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('flags')
  const [showParams, setShowParams] = useState(false)
  const [showSetup, setShowSetup] = useState(true)
  const [focus, setFocus] = useState<PlanFocus | null>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const setupRef = useRef<HTMLElement>(null)
  const dirtyRef = useRef(false)
  const hydrated = useRef(false)
  const user = readSession()?.name ?? 'engineer'

  useEffect(() => {
    if (!showParams) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowParams(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showParams])

  useEffect(() => {
    let alive = true
    hydrated.current = false
    setState(null)
    loadFoundationForSuper(projectId).then(async (f) => {
      if (!alive) return
      setFoundation({ result: f.result, approved: f.approved })
      const loaded = await loadSuperState(projectId, f.storeyCount)
      if (!alive) return
      setState(loaded)
      setShowSetup(!loaded.result)
      hydrated.current = true
    })
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!hydrated.current || !state) return
    void saveSuperState(projectId, state).catch(() => setError('Could not save to the database. Is Docker Postgres running?'))
  }, [projectId, state])

  function change(entity: string, from: string, to: string, patch: (s: SuperState) => SuperState) {
    setState((s) => {
      if (!s) return s
      const next = patch(s)
      dirtyRef.current = true
      return { ...next, overrides: { ...next.overrides, approvedBy: null, approvedAt: null, changeLog: [...next.overrides.changeLog, { at: new Date().toISOString(), user, entity, from, to }] } }
    })
  }

  function run() {
    if (!state || !foundation?.result) return
    setBusy(true)
    setError(null)
    try {
      const next = runSuper(state, foundation.result)
      dirtyRef.current = false
      setState(next)
      setShowSetup(false)
      if (next.result?.flags.length || next.result?.missingInputs.length) setTab('flags')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The superstructure engine could not run.')
    } finally {
      setBusy(false)
    }
  }

  function openSetup() {
    setShowSetup(true)
    setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function showOnPlan(f: Omit<PlanFocus, 'at'>) {
    setFocus({ ...f, at: Date.now() })
    planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function approve() {
    if (!state?.result || state.result.blocked) return
    const next: SuperState = { ...state, overrides: { ...state.overrides, approvedBy: user, approvedAt: new Date().toISOString(), changeLog: [...state.overrides.changeLog, { at: new Date().toISOString(), user, entity: 'review gate', from: 'open', to: 'approved' }] } }
    setState({ ...next, result: { ...next.result!, gateOpen: true } })
  }

  function exportCsv() {
    if (!state?.result) return
    const csv = superBoqCsv(state.result, { project: projectName || projectId, parameter_version: state.result.parameterSetVersion, engine_version: state.result.version, date: state.result.ranAt.slice(0, 10), approver: state.overrides.approvedBy ?? '(not approved)', stud_spacing_mm: String(state.inputs.settings.studSpacingMm) })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `superstructure-boq-${(projectName || projectId).replace(/[^\w-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const result = state?.result ?? null
  const stale = Boolean(result) && dirtyRef.current
  const reds = result?.flags.filter((f) => f.severity === 'red') ?? []
  const ambers = result?.flags.filter((f) => f.severity === 'amber') ?? []
  const unacknowledged = ambers.filter((f) => !state?.overrides.acknowledged.includes(f.key))
  const hasPitched = state?.inputs.levels.some((l) => l.framingType === 'pitched_roof') ?? false

  return (
    <div className="fe ss">
      <header className="agents-chat__head">
        <div>
          <h2>Super structure</h2>
          <span>
            LGS superstructure logic v1.0 · {result ? `ran ${new Date(result.ranAt).toLocaleString()} · s = ${result.settings.studSpacingMm} mm` : foundation?.result ? `foundation ${foundation.approved ? 'approved' : 'run, gate open'} · ${foundation.result.walls.length} walls · ${foundation.result.zones.length} zones` : 'waiting for the foundation run'}
            {stale && ' · inputs changed, run again'}
          </span>
        </div>
        <div className="agents-chat__actions">
          <button type="button" className={clsx('os-btn', showParams && 'is-on')} aria-haspopup="dialog" aria-expanded={showParams} onClick={() => setShowParams(true)}>
            <SlidersHorizontal size={14} /> Parameters
          </button>
          <button type="button" className="os-btn" disabled={!result?.boq.length} onClick={exportCsv} title="Export the superstructure BOQ as CSV">
            <Download size={14} /> CSV
          </button>
          <button type="button" className={clsx('os-btn', !result && 'os-btn--primary')} disabled={busy || !state || !foundation?.result} onClick={run}>
            <Play size={14} /> {busy ? 'Running…' : result ? 'Run again' : 'Run'}
          </button>
          {result && state?.overrides.approvedBy && !stale ? (
            <span className="fe__approved">Approved by {state.overrides.approvedBy}</span>
          ) : (
            <button
              type="button"
              className="os-btn os-btn--primary"
              disabled={!result || result.blocked || stale || unacknowledged.length > 0}
              title={!result ? 'Run the super structure first.' : result?.blocked ? 'Red flags or missing inputs are still open.' : unacknowledged.length ? 'Acknowledge the amber flags on the Flags tab.' : stale ? 'Run again after the input change.' : 'Approve the super structure.'}
              onClick={approve}
            >
              <CheckCircle2 size={14} /> Approve
            </button>
          )}
        </div>
      </header>

      {showParams &&
        createPortal(
          <div className="pages-backdrop" style={{ zIndex: 4000 }} onMouseDown={() => setShowParams(false)}>
            <div className="pages-dialog ss-params" role="dialog" aria-modal="true" aria-labelledby="ss-params-title" onMouseDown={(event) => event.stopPropagation()}>
              <header className="pages-dialog__head">
                <div>
                  <h2 id="ss-params-title">Parameters</h2>
                  <p>Set {SUPER_PARAMETER_SET}. Overrides apply to this project only and are recorded in the change log.</p>
                </div>
                <button type="button" className="pages-dialog__close" aria-label="Close parameters" onClick={() => setShowParams(false)}>
                  <X size={16} />
                </button>
              </header>
              {state ? (
                <div className="fe__params">
                  <p>Section kg/m is supplier data (SUPPLIER).</p>
                  <div className="fe__params-grid">
                    {SUPER_PARAMETER_TABLE.filter((p) => typeof p.value === 'number' || p.value === null).map((p) => (
                      <label key={p.id} title={p.note ?? p.source}>
                        <span>
                          P.{p.id} <small>{p.unit}</small>
                        </span>
                        <input
                          type="number"
                          placeholder={p.value == null ? 'not set' : String(p.value)}
                          value={state.inputs.parameterOverrides[p.id] ?? ''}
                          onChange={(e) => {
                            const v = num(e.target.value)
                            change(`P.${p.id}`, String(state.inputs.parameterOverrides[p.id] ?? p.value ?? ''), String(v ?? p.value ?? ''), (s) => {
                              const parameterOverrides = { ...s.inputs.parameterOverrides }
                              if (v == null) delete parameterOverrides[p.id]
                              else parameterOverrides[p.id] = v
                              return { ...s, inputs: { ...s.inputs, parameterOverrides } }
                            })
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="doc-page__note">Opening the parameters…</p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {error && <p className="fe__error">{error}</p>}

      {!state || !foundation ? (
        <p className="agents-chat__empty">Loading the superstructure state…</p>
      ) : !foundation.result ? (
        <p className="agents-chat__empty">Super structure reads the walls and framing zones from the sub structure run. Run Sub structure, then set the floor-to-floor heights here.</p>
      ) : (
        <>
          <section ref={setupRef} className="ss__setup">
            <button type="button" className="ss__setup-toggle" aria-expanded={showSetup} onClick={() => setShowSetup((v) => !v)}>
              <b>Project settings and level table</b>
              <span>
                {state.inputs.levels.length} level{state.inputs.levels.length > 1 ? 's' : ''} · s = {state.inputs.settings.studSpacingMm} mm · {state.inputs.settings.projectType.replace('_', ' ')} · lowest level {state.inputs.settings.lowestLevel.replace('_', ' ')}
              </span>
              <ChevronDown size={14} className={clsx('fe__chev', showSetup && 'is-open')} />
            </button>
            {showSetup && (
              <div className="ss__setup-body">
                {!foundation.approved && <p className="fe__muted">The foundation review gate is still open; these quantities stay provisional until it is approved.</p>}
                <SettingsRow state={state} change={change} />
                <LevelTable state={state} change={change} />
                {state.inputs.settings.lowestLevel === 'suspended' && <SuspendedRow state={state} change={change} />}
                {hasPitched && <RoofSectionsEditor state={state} change={change} />}
                <BalconyEditor state={state} change={change} />
              </div>
            )}
          </section>

          {!result ? (
            <p className="agents-chat__empty">Enter the floor-to-floor heights from the sections, pick the wall and framing sections per level, then run. Walls, floors, roof, parapets, anchors and rods are quantified per level; unknown inputs block the run instead of becoming zero.</p>
          ) : (
            <div className="fe__body">
              <div className="fe__plan">
                <div ref={planRef} className="ss__plan">
                  <SuperPlan foundation={foundation.result} result={result} decisions={state.overrides.hrsDecisions} focus={focus} onClearFocus={() => setFocus(null)} />
                </div>
                <Summary result={result} />
                <div className="fe__gate">
                  <div>
                    <b>{state.overrides.approvedBy && !stale ? 'Review gate approved' : result.blocked ? 'Review gate blocked' : unacknowledged.length ? 'Amber flags to acknowledge' : 'Review gate open'}</b>
                    <small>
                      {result.blocked
                        ? `${reds.length} red flag${reds.length === 1 ? '' : 's'} and ${result.missingInputs.length} missing input${result.missingInputs.length === 1 ? '' : 's'} block the issue of the estimate.`
                        : state.overrides.approvedBy && !stale
                          ? `Approved by ${state.overrides.approvedBy} on ${new Date(state.overrides.approvedAt ?? '').toLocaleString()}.`
                          : unacknowledged.length
                            ? `${unacknowledged.length} amber flag${unacknowledged.length === 1 ? '' : 's'} need${unacknowledged.length === 1 ? 's' : ''} engineer acknowledgement on the Flags tab.`
                            : 'Check the levels, HRS decisions and allowances, then approve. Quantities stay provisional until then.'}
                    </small>
                  </div>
                </div>
                <LevelsTable result={result} />
              </div>
              <div className="fe__side">
                <nav className="fe__tabs">
                  {(
                    [
                      ['flags', `Flags ${result.flags.length + result.missingInputs.length}`],
                      ['walls', 'Walls'],
                      ['floors', 'Floors'],
                      ['roof', 'Roof'],
                      ['fixings', 'Fixings'],
                      ['hrs', `HRS ${result.hrsMarkups.filter((h) => h.status === 'suggested').length ? result.hrsMarkups.filter((h) => h.status === 'suggested').length + ' open' : result.hrsMarkups.length + result.hrsManual.length}`],
                      ['allow', 'Allowances'],
                      ['boq', `BOQ ${result.boq.length}`],
                      ['sections', 'Sections'],
                      ['log', `Log ${state.overrides.changeLog.length}`],
                    ] as Array<[Tab, string]>
                  ).map(([id, label]) => (
                    <button key={id} type="button" className={clsx(tab === id && 'is-on')} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="fe__tab">
                  {tab === 'flags' && <FlagsTab result={result} state={state} change={change} stale={stale} onRun={run} onShow={showOnPlan} onOpenSetup={openSetup} />}
                  {tab === 'walls' && <WallsTab result={result} />}
                  {tab === 'floors' && <FloorsTab result={result} />}
                  {tab === 'roof' && <RoofTab result={result} />}
                  {tab === 'fixings' && <FixingsTab result={result} />}
                  {tab === 'hrs' && <HrsTab result={result} state={state} change={change} />}
                  {tab === 'allow' && <AllowancesTab result={result} state={state} change={change} />}
                  {tab === 'boq' && <BoqTab result={result} />}
                  {tab === 'sections' && <SectionsTab result={result} />}
                  {tab === 'log' && <LogTab state={state} />}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

type Change = (entity: string, from: string, to: string, patch: (s: SuperState) => SuperState) => void

/** Entities a flag or markup points at; the plan switches to the level and outlines them. */
type PlanFocus = { levelId: string | null; entityIds: string[]; at: number }

/** HRS decision writer shared by the Flags and HRS tabs. */
function hrsDecider(state: SuperState, change: Change) {
  return (id: string, patch: Partial<HrsDecision>) =>
    change(`HRS ${id}`, JSON.stringify(state.overrides.hrsDecisions[id] ?? {}), JSON.stringify(patch), (s) => {
      const current = s.overrides.hrsDecisions[id] ?? { status: 'suggested' as const, section: null, kgPerM: null, lengthMm: null, quantity: null }
      return { ...s, overrides: { ...s.overrides, hrsDecisions: { ...s.overrides.hrsDecisions, [id]: { ...current, ...patch } } } }
    })
}

/** Markup as it stands now: the run result plus any decision made since. */
function liveMarkup(h: SuperResult['hrsMarkups'][number], state: SuperState) {
  return { ...h, ...(state.overrides.hrsDecisions[h.id] ?? {}) }
}

// ——— setup ———

function SettingsRow({ state, change }: { state: SuperState; change: Change }) {
  const st = state.inputs.settings
  const set = <K extends keyof typeof st>(key: K, value: (typeof st)[K]) => change(`settings.${String(key)}`, String(st[key]), String(value), (s) => ({ ...s, inputs: { ...s.inputs, settings: { ...s.inputs.settings, [key]: value } } }))
  return (
    <div className="fe__inputs ss__settings">
      <label>
        Project type
        <select value={st.projectType} onChange={(e) => set('projectType', e.target.value as typeof st.projectType)}>
          <option value="panelised">Panelised</option>
          <option value="volumetric_modular">Volumetric modular (draft rules)</option>
        </select>
      </label>
      <label>
        Lowest level
        <select value={st.lowestLevel} onChange={(e) => set('lowestLevel', e.target.value as typeof st.lowestLevel)}>
          <option value="on_slab">On slab</option>
          <option value="suspended">Suspended (own floor row)</option>
        </select>
      </label>
      <label>
        Flat roof covering
        <select value={st.flatRoofCovering} onChange={(e) => set('flatRoofCovering', e.target.value as typeof st.flatRoofCovering)}>
          <option value="flat_deck">Flat deck</option>
          <option value="sheeting_on_purlins">Sheeting on purlins</option>
        </select>
      </label>
      <label>
        Pitched roof covering
        <select value={st.pitchedRoofCovering} onChange={(e) => set('pitchedRoofCovering', e.target.value as typeof st.pitchedRoofCovering)}>
          <option value="metal_sheet">Metal sheet</option>
          <option value="boards">Boards</option>
          <option value="sandwich_panel">Sandwich panel</option>
        </select>
      </label>
      <label>
        Units
        <select value={st.unitSystem} onChange={(e) => set('unitSystem', e.target.value as typeof st.unitSystem)}>
          <option value="metric">Metric</option>
          <option value="imperial">Imperial (shown beside metric)</option>
        </select>
      </label>
      <label>
        Levels
        <input type="number" min={1} max={20} value={state.inputs.levels.length} onChange={(e) => change('levels', String(state.inputs.levels.length), e.target.value, (s) => ({ ...s, inputs: { ...s.inputs, levels: resizeLevels(s.inputs.levels, Number(e.target.value) || 1) } }))} />
      </label>
    </div>
  )
}

const FRAMING_CHOICE: Record<FramingType, string> = {
  truss: 'Floor trusses',
  c_joist: 'C-joists',
  flat_roof_truss: 'Flat roof, trusses',
  flat_roof_c_joist: 'Flat roof, C-joists',
  pitched_roof: 'Pitched roof',
}

function shortLevel(name: string) {
  return name.replace(/ floor$/i, '')
}

/** "Ground to first (mm)", "Second to roof (mm)": the villa sheet names each height by the two levels it joins. */
function heightLabel(row: LevelRow, next: LevelRow | undefined) {
  const from = shortLevel(row.name)
  if (!next) return `${from} to roof (mm)`
  return `${from} to ${shortLevel(next.name).toLowerCase()} (mm)`
}

function LevelTable({ state, change }: { state: SuperState; change: Change }) {
  const levels = state.inputs.levels
  const top = levels.length - 1
  const spacing = state.inputs.settings.studSpacingMm
  const setRow = (i: number, key: keyof LevelRow, value: LevelRow[keyof LevelRow]) =>
    change(`${levels[i].name}.${String(key)}`, String(levels[i][key] ?? ''), String(value ?? ''), (s) => {
      const rows = s.inputs.levels.map((row, k) => {
        if (k !== i) return row
        const next = { ...row, [key]: value } as LevelRow
        if (key === 'framingType') {
          const list = sectionsFor(next.framingType)
          if (!list.includes(next.framingSection)) next.framingSection = list[0]
          if (next.framingType !== 'flat_roof_truss' && next.framingType !== 'flat_roof_c_joist') next.parapetHeightMm = null
        }
        return next
      })
      return { ...s, inputs: { ...s.inputs, levels: rows } }
    })
  const setSpacing = (value: 450 | 600) => change('settings.studSpacingMm', String(spacing), String(value), (s) => ({ ...s, inputs: { ...s.inputs, settings: { ...s.inputs.settings, studSpacingMm: value } } }))
  return (
    <>
      <section className="ss__group">
        <b>Heights and spacing</b>
        <div className="ss__heights">
          {levels.map((row, i) => (
            <label key={row.id}>
              {heightLabel(row, levels[i + 1])}
              <input type="number" step={50} placeholder="from the sections" value={row.ffhMm ?? ''} onChange={(e) => setRow(i, 'ffhMm', num(e.target.value))} />
              <small>{row.ffhMm == null ? 'From the sections. Nothing is assumed.' : row.framingType === 'pitched_roof' ? 'FFL to eaves, from the sections.' : 'Floor-to-floor, from the sections.'}</small>
            </label>
          ))}
          <label>
            Stud spacing
            <select value={spacing} onChange={(e) => setSpacing(Number(e.target.value) as 450 | 600)}>
              <option value={600}>600 mm</option>
              <option value={450}>450 mm</option>
            </select>
          </label>
        </div>
      </section>
      <section className="ss__group">
        <b>Levels and sections</b>
        {levels.map((row, i) => {
          const isTop = i === top
          const flat = row.framingType === 'flat_roof_truss' || row.framingType === 'flat_roof_c_joist'
          const truss = row.framingType === 'truss' || row.framingType === 'flat_roof_truss'
          return (
            <article key={row.id} className="ss__card">
              <header>
                <b>{isTop ? `${shortLevel(row.name)}, with the roof` : shortLevel(row.name)}</b>
                {i === 0 ? (
                  <small>Walls from the ground plan</small>
                ) : (
                  <select aria-label={`${row.name} plan`} value={row.plan} onChange={(e) => setRow(i, 'plan', e.target.value as LevelRow['plan'])}>
                    <option value="same">Same plan as below</option>
                    <option value="none">No plan</option>
                  </select>
                )}
              </header>
              <div className="ss__pair">
                <label>
                  LB walls
                  <select value={row.lbSection} onChange={(e) => setRow(i, 'lbSection', e.target.value)}>
                    {SECTION_LISTS.walls.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  NLB walls
                  <select value={row.nlbSection} onChange={(e) => setRow(i, 'nlbSection', e.target.value)}>
                    {SECTION_LISTS.walls.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {isTop ? 'Roof' : 'Floor above'}
                  <select value={row.framingType} onChange={(e) => setRow(i, 'framingType', e.target.value as FramingType)}>
                    {(isTop ? FRAMING_ROOF : FRAMING_FLOOR).map((f) => (
                      <option key={f} value={f}>
                        {FRAMING_CHOICE[f]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Section
                  <select value={row.framingSection} onChange={(e) => setRow(i, 'framingSection', e.target.value)}>
                    {sectionsFor(row.framingType).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              {truss && (
                <label className="fe__check">
                  <input type="checkbox" checked={row.reinforcingStuds} onChange={(e) => setRow(i, 'reinforcingStuds', e.target.checked)} /> Reinforcing studs at top and bottom chords
                </label>
              )}
              {flat && (
                <div className="ss__pair">
                  <label>
                    Parapet height (mm)
                    <input type="number" step={50} placeholder="none" value={row.parapetHeightMm ?? ''} onChange={(e) => setRow(i, 'parapetHeightMm', num(e.target.value))} />
                  </label>
                  <label>
                    Parapet section
                    <select value={row.parapetSection ?? ''} onChange={(e) => setRow(i, 'parapetSection', e.target.value || null)}>
                      <option value="">Same as NLB walls</option>
                      {SECTION_LISTS.walls.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </article>
          )
        })}
        <p className="fe__muted">Each level carries its walls and the floor or roof they support.</p>
      </section>
    </>
  )
}

function SuspendedRow({ state, change }: { state: SuperState; change: Change }) {
  const sf = state.inputs.suspendedFloor
  const set = <K extends keyof typeof sf>(key: K, value: (typeof sf)[K]) => change(`suspendedFloor.${String(key)}`, String(sf[key]), String(value), (s) => ({ ...s, inputs: { ...s.inputs, suspendedFloor: { ...s.inputs.suspendedFloor, [key]: value } } }))
  return (
    <div className="fe__inputs ss__settings">
      <label>
        Suspended ground floor framing
        <select value={sf.framingType} onChange={(e) => set('framingType', e.target.value as 'truss' | 'c_joist')}>
          <option value="truss">Floor trusses</option>
          <option value="c_joist">C-joists</option>
        </select>
      </label>
      <label>
        Section
        <select value={sf.section} onChange={(e) => set('section', e.target.value)}>
          {(sf.framingType === 'truss' ? SECTION_LISTS.trusses : SECTION_LISTS.c_joists).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {sf.framingType === 'truss' && (
        <label className="fe__check">
          <input type="checkbox" checked={sf.reinforcingStuds} onChange={(e) => set('reinforcingStuds', e.target.checked)} /> Reinforcing studs
        </label>
      )}
    </div>
  )
}

function RoofSectionsEditor({ state, change }: { state: SuperState; change: Change }) {
  const rows = state.inputs.roofSections
  const update = (id: string, patch: Partial<RoofSectionInput>) => change(`roof ${id}`, '', JSON.stringify(patch), (s) => ({ ...s, inputs: { ...s.inputs, roofSections: s.inputs.roofSections.map((r) => (r.id === id ? { ...r, ...patch } : r)) } }))
  const add = () => change('roof section', '—', 'added', (s) => ({ ...s, inputs: { ...s.inputs, roofSections: [...s.inputs.roofSections, { id: `RS-${s.inputs.roofSections.length + 1}`, type: 'gable', ltMm: null, lengthMm: null, pitchDeg: null, eavesOverhangMm: 0, vergeOverhangMm: 0, hipEnds: 2 }] } }))
  const remove = (id: string) => change(`roof ${id}`, 'section', 'removed', (s) => ({ ...s, inputs: { ...s.inputs, roofSections: s.inputs.roofSections.filter((r) => r.id !== id) } }))
  return (
    <div className="ss__editor">
      <b>Pitched roof sections (from the roof plan)</b>
      <p className="fe__muted">Split the roof into gable, hip, mono-pitch and valley-secondary areas. Lt is the truss span (hip: B; valley secondary: W2); length runs along the ridge; pitch from labels or sections.</p>
      {rows.length > 0 && (
        <table className="fe__table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Shape</th>
              <th>Lt mm</th>
              <th>Length mm</th>
              <th>Pitch °</th>
              <th>Eaves O mm</th>
              <th>Verge G mm</th>
              <th>Hip ends</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  <select value={r.type} onChange={(e) => update(r.id, { type: e.target.value as RoofSectionInput['type'] })}>
                    <option value="gable">Gable</option>
                    <option value="hip">Hip</option>
                    <option value="mono">Mono-pitch</option>
                    <option value="valley_secondary">Valley secondary</option>
                  </select>
                </td>
                <td>
                  <input type="number" className="ss__num" value={r.ltMm ?? ''} onChange={(e) => update(r.id, { ltMm: num(e.target.value) })} />
                </td>
                <td>
                  <input type="number" className="ss__num" value={r.lengthMm ?? ''} onChange={(e) => update(r.id, { lengthMm: num(e.target.value) })} />
                </td>
                <td>
                  <input type="number" step={0.5} className="ss__num" value={r.pitchDeg ?? ''} onChange={(e) => update(r.id, { pitchDeg: num(e.target.value) })} />
                </td>
                <td>
                  <input type="number" className="ss__num" value={r.eavesOverhangMm} onChange={(e) => update(r.id, { eavesOverhangMm: Number(e.target.value) || 0 })} />
                </td>
                <td>
                  <input type="number" className="ss__num" value={r.vergeOverhangMm} onChange={(e) => update(r.id, { vergeOverhangMm: Number(e.target.value) || 0 })} />
                </td>
                <td>
                  {r.type === 'hip' ? (
                    <select value={r.hipEnds} onChange={(e) => update(r.id, { hipEnds: Number(e.target.value) as 1 | 2 })}>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <button type="button" className="ss__icon" aria-label={`Remove ${r.id}`} onClick={() => remove(r.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="os-btn" onClick={add}>
        <Plus size={14} /> Add roof section
      </button>
    </div>
  )
}

function BalconyEditor({ state, change }: { state: SuperState; change: Change }) {
  const rows = state.inputs.balconies
  const levels = state.inputs.levels.slice(1)
  const update = (id: string, patch: Partial<BalconyInput>) => change(`balcony ${id}`, '', JSON.stringify(patch), (s) => ({ ...s, inputs: { ...s.inputs, balconies: s.inputs.balconies.map((b) => (b.id === id ? { ...b, ...patch } : b)) } }))
  const add = () => change('balcony', '—', 'added', (s) => ({ ...s, inputs: { ...s.inputs, balconies: [...s.inputs.balconies, { id: `BAL-${s.inputs.balconies.length + 1}`, levelId: levels[0]?.id ?? 'L1', lengthMm: null, cantileverMm: null, supportAxis: 'h' }] } }))
  const remove = (id: string) => change(`balcony ${id}`, 'balcony', 'removed', (s) => ({ ...s, inputs: { ...s.inputs, balconies: s.inputs.balconies.filter((b) => b.id !== id) } }))
  if (!levels.length) return null
  return (
    <div className="ss__editor">
      <b>Balconies</b>
      {rows.length > 0 && (
        <table className="fe__table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Floor</th>
              <th>Length mm</th>
              <th>Cantilever mm</th>
              <th>Supporting wall</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>
                  <select value={b.levelId} onChange={(e) => update(b.id, { levelId: e.target.value })}>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="number" className="ss__num" value={b.lengthMm ?? ''} onChange={(e) => update(b.id, { lengthMm: num(e.target.value) })} />
                </td>
                <td>
                  <input type="number" className="ss__num" value={b.cantileverMm ?? ''} onChange={(e) => update(b.id, { cantileverMm: num(e.target.value) })} />
                </td>
                <td>
                  <select value={b.supportAxis} onChange={(e) => update(b.id, { supportAxis: e.target.value as 'h' | 'v' })}>
                    <option value="h">runs along x</option>
                    <option value="v">runs along y</option>
                  </select>
                </td>
                <td>
                  <button type="button" className="ss__icon" aria-label={`Remove ${b.id}`} onClick={() => remove(b.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="os-btn" onClick={add}>
        <Plus size={14} /> Add balcony
      </button>
    </div>
  )
}

// ——— plan drawing ———

const RUN_COLOUR: Record<string, string> = { LB: '#DC2626', NLB: '#2563EB' }
const PLAN_COLOUR = { zone: '#EA580C', flagged: '#DC2626', truss: '#1D4ED8', joist: '#1D4ED8', beam: '#EA580C', suggested: '#DC2626', opening: '#7C3AED', focus: '#111827' }

type PlanSelection = { kind: 'run'; id: string } | { kind: 'line'; id: string } | null

function SuperPlan({ foundation, result, decisions, focus, onClearFocus }: { foundation: EngineResult; result: SuperResult; decisions: Record<string, HrsDecision>; focus: PlanFocus | null; onClearFocus: () => void }) {
  const levelsTopFirst = useMemo(() => [...result.levels].reverse(), [result.levels])
  const [levelId, setLevelId] = useState<string>(result.levels[0]?.levelId ?? '')
  const [layers, setLayers] = useState({ walls: true, framing: true, hrs: true, foundation: false })
  const [selected, setSelected] = useState<PlanSelection>(null)

  useEffect(() => {
    if (!result.levels.some((l) => l.levelId === levelId) && levelId !== 'SUSPENDED') setLevelId(result.levels[0]?.levelId ?? '')
    setSelected(null)
  }, [result, levelId])

  useEffect(() => {
    if (!focus) return
    if (focus.levelId && (focus.levelId === 'SUSPENDED' || result.levels.some((l) => l.levelId === focus.levelId))) setLevelId(focus.levelId)
    setSelected(null)
  }, [focus, result.levels])

  const highlight = useMemo(() => new Set(focus?.entityIds ?? []), [focus])

  const level = result.levels.find((l) => l.levelId === levelId) ?? null
  const isSuspended = levelId === 'SUSPENDED'
  const floor: FloorResult | null = isSuspended ? result.suspendedFloor : (level?.floor ?? null)
  const runs: WallRunResult[] = isSuspended ? [] : (level?.wallRuns ?? [])
  // decisions made since the run show on the plan straight away; the quantities follow on the next run
  const markups = result.hrsMarkups.map((m) => ({ ...m, ...(decisions[m.id] ?? {}) })).filter((m) => m.levelId === levelId && m.status !== 'deleted')
  const flaggedZones = new Set(result.flags.filter((f) => f.levelId === levelId && f.code === 'F-SPAN').flatMap((f) => f.entityIds))

  const isLowest = isSuspended || levelId === result.levels[0]?.levelId
  const selectedRun = selected?.kind === 'run' ? runs.find((r) => r.id === selected.id) ?? null : null
  const selectedLine = selected?.kind === 'line' ? floor?.trussLines.find((l) => l.id === selected.id) ?? null : null
  const toggle = (k: keyof typeof layers) => setLayers((v) => ({ ...v, [k]: !v[k] }))

  return (
    <>
      <div className="fe__plan-bar ss__plan-bar">
        <select className="ss__picker" aria-label="Plan level" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          {levelsTopFirst.map((l) => (
            <option key={l.levelId} value={l.levelId}>
              {l.name}
              {l.floor ? ` · ${l.floor.isRoof ? 'roof' : 'floor'} over` : l.roof ? ' · pitched roof' : ''}
            </option>
          ))}
          {result.suspendedFloor && <option value="SUSPENDED">Suspended ground floor</option>}
        </select>
        <span className="fe__legend">
          <i style={{ background: RUN_COLOUR.LB }} /> LB <i style={{ background: RUN_COLOUR.NLB }} /> NLB
          <i style={{ background: PLAN_COLOUR.truss }} /> {floor?.family === 'c_joist' ? 'joists' : 'trusses'}
          <i style={{ background: PLAN_COLOUR.beam }} /> HRS accepted <i style={{ background: PLAN_COLOUR.suggested }} /> HRS open
        </span>
        <span className="ss__layers">
          <label className="fe__check">
            <input type="checkbox" checked={layers.walls} onChange={() => toggle('walls')} /> Walls
          </label>
          <label className="fe__check">
            <input type="checkbox" checked={layers.framing} onChange={() => toggle('framing')} /> Framing
          </label>
          <label className="fe__check">
            <input type="checkbox" checked={layers.hrs} onChange={() => toggle('hrs')} /> HRS
          </label>
          {isLowest && foundation.elements.length > 0 && (
            <label className="fe__check">
              <input type="checkbox" checked={layers.foundation} onChange={() => toggle('foundation')} /> Foundation
            </label>
          )}
        </span>
      </div>
      {highlight.size > 0 && (
        <p className="ss__focus">
          <Crosshair size={13} /> Showing {[...highlight].join(', ')}
          <button type="button" onClick={onClearFocus}>
            clear
          </button>
        </p>
      )}
      <SuperPlanSvg foundation={foundation} result={result} levelId={levelId} runs={runs} floor={floor} markups={markups} flaggedZones={flaggedZones} highlight={highlight} layers={{ ...layers, foundation: layers.foundation && isLowest }} selected={selected} onSelect={setSelected} />
      <p className="fe__muted ss__plan-note">
        {level?.skipped
          ? `${level.name}: skipped (${level.skipped}).`
          : isSuspended
            ? `Suspended ground floor: ${floor?.label ?? ''}, ${floor?.section ?? ''}${floor?.reinforcing ? ' reinforced' : ''}.`
            : level
              ? `${level.name}: ${runs.length} wall runs (${runs.filter((r) => r.status === 'LB').length} LB) at H ${level.heightMm ?? '—'} mm${floor ? ` · ${floor.label}: ${floor.family === 'truss' ? `${floor.trussLines.length} truss lines, ${floor.blocking.reduce((s, b) => s + b.lines, 0)} blocking trusses` : `${floor.joistZones.reduce((s, z) => s + z.joists, 0)} joists in ${floor.joistZones.length} zones`}, ${floor.section}` : level.roof ? ` · pitched roof over ${level.roof.sections.length} section${level.roof.sections.length === 1 ? '' : 's'} (see the Roof tab; the plan shows the walls only)` : ''}.`
              : ''}
        {markups.length > 0 && ` HRS on this level: ${markups.filter((m) => m.status === 'accepted').length} accepted, ${markups.filter((m) => m.status === 'suggested').length} open.`}
      </p>
      {selectedRun && <RunCard run={selectedRun} />}
      {selectedLine && <LineCard line={selectedLine} floor={floor} />}
    </>
  )
}

function SuperPlanSvg({
  foundation,
  result,
  levelId,
  runs,
  floor,
  markups,
  flaggedZones,
  highlight,
  layers,
  selected,
  onSelect,
}: {
  foundation: EngineResult
  result: SuperResult
  levelId: string
  runs: WallRunResult[]
  floor: FloorResult | null
  markups: SuperResult['hrsMarkups']
  flaggedZones: Set<string>
  highlight: Set<string>
  layers: { walls: boolean; framing: boolean; hrs: boolean; foundation: boolean }
  selected: PlanSelection
  onSelect: (s: PlanSelection) => void
}) {
  const poly = foundation.footprint.polygon
  const box = useMemo(() => {
    const xs = poly.map((p) => p.x)
    const ys = poly.map((p) => p.y)
    const pad = 1500
    return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
  }, [poly])
  if (!poly.length) return <p className="fe__error">No footprint was traced in the foundation run; nothing to draw.</p>
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const stroke = Math.max(40, w / 900)
  const zoneById = new Map(foundation.zones.map((z) => [z.id, z]))
  const zoneDirection = (zoneId: string): 'x' | 'y' => {
    const z = zoneById.get(zoneId)
    if (!z) return 'x'
    return foundation.decisions.find((d) => d.zoneId === zoneId)?.direction ?? (z.Lx <= z.Ly ? 'x' : 'y')
  }
  const splits: Record<string, number> = {}
  for (const m of markups) {
    if (m.status === 'accepted' && m.id.startsWith(`HRS-SPAN-${levelId}-`)) splits[m.entityIds[0]] = Math.max(1, Math.round(m.quantity ?? m.suggestedQuantity))
  }
  const spacing = result.settings.studSpacingMm
  const fontSize = Math.max(250, w / 60)
  const ext = { x0: box.x0 + 1500, y0: box.y0 + 1500, x1: box.x1 - 1500, y1: box.y1 - 1500 }
  const dimOff = 700
  const dimText = Math.max(320, w / 50)

  return (
    <svg className="fe__svg ss__svg" viewBox={`${box.x0} ${box.y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect(null)}>
      <polygon points={poly.map((p) => `${p.x},${p.y}`).join(' ')} fill="#f8fafc" stroke="#334155" strokeWidth={stroke} />

      {layers.foundation &&
        foundation.elements.map((el) =>
          el.rects.map((r, i) => (
            <rect key={`${el.id}-${i}`} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={el.type === 'pad' ? 'rgba(220,38,38,0.55)' : el.type === 'column' ? '#EA580C' : el.type === 'slab' ? 'none' : 'rgba(234,88,12,0.42)'} stroke={el.type === 'slab' ? 'none' : '#C2410C'} strokeWidth={stroke}>
              <title>
                {el.id} · {el.type} · {Object.entries(el.section).map(([k, v]) => `${k} ${v}`).join(', ')}
              </title>
            </rect>
          )),
        )}

      <g stroke="#64748b" strokeWidth={stroke / 3} fill="#64748b" fontSize={dimText}>
        <line x1={ext.x0} y1={ext.y1 + dimOff} x2={ext.x1} y2={ext.y1 + dimOff} />
        <line x1={ext.x0} y1={ext.y1 + dimOff - 200} x2={ext.x0} y2={ext.y1 + dimOff + 200} />
        <line x1={ext.x1} y1={ext.y1 + dimOff - 200} x2={ext.x1} y2={ext.y1 + dimOff + 200} />
        <text x={(ext.x0 + ext.x1) / 2} y={ext.y1 + dimOff + dimText * 1.3} textAnchor="middle" stroke="none">
          {((ext.x1 - ext.x0) / 1000).toFixed(2)} m
        </text>
        <line x1={ext.x1 + dimOff} y1={ext.y0} x2={ext.x1 + dimOff} y2={ext.y1} />
        <line x1={ext.x1 + dimOff - 200} y1={ext.y0} x2={ext.x1 + dimOff + 200} y2={ext.y0} />
        <line x1={ext.x1 + dimOff - 200} y1={ext.y1} x2={ext.x1 + dimOff + 200} y2={ext.y1} />
        <text x={ext.x1 + dimOff + dimText * 0.5} y={(ext.y0 + ext.y1) / 2} textAnchor="start" dominantBaseline="middle" stroke="none">
          {((ext.y1 - ext.y0) / 1000).toFixed(2)} m
        </text>
      </g>

      {foundation.zones.map((z) => {
        const flagged = flaggedZones.has(z.id)
        const hl = highlight.has(z.id)
        const colour = flagged ? PLAN_COLOUR.flagged : PLAN_COLOUR.zone
        return (
          <g key={z.id}>
            <rect x={z.bbox.x0} y={z.bbox.y0} width={z.Lx} height={z.Ly} fill={colour} fillOpacity={hl ? 0.42 : flagged ? 0.34 : 0.22} stroke={hl ? PLAN_COLOUR.focus : colour} strokeWidth={hl ? stroke * 2.5 : stroke * 1.2} strokeDasharray={hl ? undefined : `${stroke * 3} ${stroke * 3}`}>
              <title>
                {z.id} · {(z.Lx / 1000).toFixed(2)} × {(z.Ly / 1000).toFixed(2)} m · spans along {zoneDirection(z.id)}
                {flagged ? ' · F-SPAN' : ''}
              </title>
            </rect>
            {flagged && (
              <text x={(z.bbox.x0 + z.bbox.x1) / 2} y={(z.bbox.y0 + z.bbox.y1) / 2} textAnchor="middle" fontSize={fontSize} fill={PLAN_COLOUR.flagged} fontWeight={700}>
                F-SPAN
              </text>
            )}
          </g>
        )
      })}

      {layers.framing &&
        floor &&
        floor.family === 'truss' &&
        floor.trussLines.map((line) => {
          const zones = line.zoneIds.map((id) => zoneById.get(id)).filter((z): z is NonNullable<typeof z> => Boolean(z))
          if (!zones.length) return null
          const from = Math.min(...zones.map((z) => (line.direction === 'x' ? z.bbox.x0 : z.bbox.y0)))
          const to = Math.max(...zones.map((z) => (line.direction === 'x' ? z.bbox.x1 : z.bbox.y1)))
          const isSel = selected?.kind === 'line' && selected.id === line.id
          return (
            <line
              key={line.id}
              className="ss__line"
              x1={line.direction === 'x' ? from : line.positionMm}
              y1={line.direction === 'x' ? line.positionMm : from}
              x2={line.direction === 'x' ? to : line.positionMm}
              y2={line.direction === 'x' ? line.positionMm : to}
              stroke={PLAN_COLOUR.truss}
              strokeOpacity={1}
              strokeWidth={isSel ? stroke * 2.4 : stroke * 1.4}
              onClick={(e) => {
                e.stopPropagation()
                onSelect({ kind: 'line', id: line.id })
              }}
            >
              <title>
                {line.id} · {line.pieces.length} piece{line.pieces.length === 1 ? '' : 's'} · {line.spansMm.map((s) => (s / 1000).toFixed(2)).join(' + ')} m
              </title>
            </line>
          )
        })}

      {layers.framing &&
        floor &&
        floor.family === 'c_joist' &&
        foundation.zones.map((z) => {
          const dir = zoneDirection(z.id)
          const lines: number[] = []
          const start = dir === 'x' ? z.bbox.y0 : z.bbox.x0
          const end = dir === 'x' ? z.bbox.y1 : z.bbox.x1
          for (let pos = start; pos <= end + 1; pos += spacing) lines.push(pos)
          return (
            <g key={`J-${z.id}`} stroke={PLAN_COLOUR.joist} strokeOpacity={0.9} strokeWidth={stroke * 1.1}>
              {lines.map((pos) => (
                <line key={pos} x1={dir === 'x' ? z.bbox.x0 : pos} y1={dir === 'x' ? pos : z.bbox.y0} x2={dir === 'x' ? z.bbox.x1 : pos} y2={dir === 'x' ? pos : z.bbox.y1} />
              ))}
            </g>
          )
        })}

      {layers.hrs &&
        markups.map((m) => {
          const colour = m.status === 'accepted' ? PLAN_COLOUR.beam : PLAN_COLOUR.suggested
          const hl = highlight.has(m.id) || m.entityIds.some((e) => highlight.has(e))
          const bold = hl ? 1.8 : 1
          const title = `${m.id} · ${m.memberType} · ${m.status}${m.section ? ` · ${m.section}` : ''}${m.lengthMm ? ` · ${(m.lengthMm / 1000).toFixed(2)} m` : ''}`
          if (m.id.startsWith('HRS-SPAN-') || m.id.startsWith('HRS-VOID-')) {
            const target = zoneById.get(m.entityIds[0]) ?? foundation.rooms.find((r) => r.id === m.entityIds[0])
            if (!target) return null
            const bbox = target.bbox
            if (m.id.startsWith('HRS-VOID-')) {
              return (
                <rect key={m.id} x={bbox.x0} y={bbox.y0} width={bbox.x1 - bbox.x0} height={bbox.y1 - bbox.y0} fill="none" stroke={colour} strokeWidth={stroke * 1.5 * bold} strokeDasharray={`${stroke * 4} ${stroke * 2}`}>
                  <title>{title}</title>
                </rect>
              )
            }
            const dir = zoneDirection(target.id)
            const q = m.status === 'accepted' ? (splits[target.id] ?? 1) : Math.max(1, Math.round(m.suggestedQuantity))
            const span = dir === 'x' ? bbox.x1 - bbox.x0 : bbox.y1 - bbox.y0
            return (
              <g key={m.id} stroke={colour} strokeWidth={stroke * 2 * bold} strokeDasharray={`${stroke * 5} ${stroke * 2.5}`}>
                <title>{title}</title>
                {Array.from({ length: q }, (_, k) => {
                  const at = (dir === 'x' ? bbox.x0 : bbox.y0) + (span * (k + 1)) / (q + 1)
                  return <line key={k} x1={dir === 'x' ? at : bbox.x0} y1={dir === 'x' ? bbox.y0 : at} x2={dir === 'x' ? at : bbox.x1} y2={dir === 'x' ? bbox.y1 : at} />
                })}
                {hl && (
                  <text x={(bbox.x0 + bbox.x1) / 2} y={bbox.y1 - fontSize * 0.6} textAnchor="middle" fontSize={fontSize} fill={colour} stroke="none" fontWeight={700}>
                    {m.status === 'accepted' ? `${q} × ${m.memberType}${m.section ? ` ${m.section}` : ''}` : `${q} × ${m.memberType} (open)`}
                  </text>
                )}
              </g>
            )
          }
          const run = runs.find((r) => r.id === m.entityIds[0])
          if (!run) return null
          const cx = run.axis === 'h' ? (run.a + run.b) / 2 : run.pos
          const cy = run.axis === 'h' ? run.pos : (run.a + run.b) / 2
          const r = stroke * 5 * bold
          return (
            <g key={m.id} fill={m.id.startsWith('HRS-OPEN-') ? PLAN_COLOUR.opening : colour} stroke={hl ? PLAN_COLOUR.focus : '#fff'} strokeWidth={hl ? stroke : stroke / 2}>
              <title>{title}</title>
              <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} />
            </g>
          )
        })}

      {layers.walls &&
        runs.map((run) => {
          const isSel = (selected?.kind === 'run' && selected.id === run.id) || highlight.has(run.id)
          const t = run.external ? stroke * 2.4 : stroke * 1.6
          const x = run.axis === 'h' ? run.a : run.pos - t / 2
          const y = run.axis === 'h' ? run.pos - t / 2 : run.a
          return (
            <rect
              key={run.id}
              className="fe__wall"
              x={x}
              y={y}
              width={run.axis === 'h' ? run.b - run.a : t}
              height={run.axis === 'h' ? t : run.b - run.a}
              fill={RUN_COLOUR[run.status] ?? RUN_COLOUR.NLB}
              stroke={isSel ? '#111827' : 'none'}
              strokeWidth={stroke}
              onClick={(e) => {
                e.stopPropagation()
                onSelect({ kind: 'run', id: run.id })
              }}
            >
              <title>
                {run.id} · {run.status} · {run.section} · {(run.lengthMm / 1000).toFixed(2)} m × H {run.heightMm} mm · {run.panels} panel{run.panels === 1 ? '' : 's'} · openings {run.openings.length}
              </title>
            </rect>
          )
        })}

      {foundation.rooms.map((r) => (
        <text key={r.id} x={(r.bbox.x0 + r.bbox.x1) / 2} y={r.bbox.y0 + Math.max(300, w / 60) * 1.4} textAnchor="middle" fontSize={Math.max(220, w / 80)} fill="#64748b">
          {r.label === 'UNLABELLED' ? '' : r.label}
        </text>
      ))}
    </svg>
  )
}

function RunCard({ run }: { run: WallRunResult }) {
  return (
    <div className="fe__card">
      <header>
        <b>
          {run.id} · {run.status} {run.external ? 'external' : 'internal'} wall
        </b>
        <span>
          {run.section} · {(run.lengthMm / 1000).toFixed(2)} m × H {run.heightMm} mm · from {run.sourceWallIds.length} traced wall{run.sourceWallIds.length === 1 ? '' : 's'}
        </span>
      </header>
      <dl className="ss__facts">
        <dt>Panels</dt>
        <dd>
          {run.panels} × {run.panelLengthMm} mm
        </dd>
        <dt>Studs</dt>
        <dd>
          {run.studsRegular} regular · {run.studsJamb} jamb · {run.studsJunction} junction · {run.noggingRows} nogging row{run.noggingRows === 1 ? '' : 's'}
        </dd>
        <dt>Junctions</dt>
        <dd>
          L {run.junctions.L} · T {run.junctions.T} · X {run.junctions.X}
        </dd>
        <dt>Openings</dt>
        <dd>{run.openings.length ? run.openings.map((o) => `${o} mm`).join(', ') : 'none'}</dd>
        <dt>Members</dt>
        <dd>
          studs {m1(run.studsMm)} · tracks {m1(run.tracksMm)} · nogging {m1(run.noggingMm)} m
        </dd>
        <dt>Weight</dt>
        <dd>
          <b>{kg(run.kg)} kg</b>
        </dd>
        {run.stackedLengthMm < run.lengthMm && (
          <>
            <dt>Stacked below</dt>
            <dd>
              {(run.stackedLengthMm / 1000).toFixed(2)} of {(run.lengthMm / 1000).toFixed(2)} m sits on a wall below
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}

function LineCard({ line, floor }: { line: TrussLineResult; floor: FloorResult | null }) {
  return (
    <div className="fe__card">
      <header>
        <b>
          {line.id} · truss line along {line.direction}
        </b>
        <span>
          {floor?.section}
          {floor?.reinforcing ? ' reinforced' : ''} · spans {line.spansMm.map((s) => (s / 1000).toFixed(2)).join(' + ')} m · zones {line.zoneIds.join(', ')}
        </span>
      </header>
      <table className="fe__table">
        <thead>
          <tr>
            <th>Piece</th>
            <th className="is-num">Length m</th>
            <th className="is-num">Panels</th>
            <th className="is-num">Chords m</th>
            <th className="is-num">Verticals m</th>
            <th className="is-num">Diagonals m</th>
            <th className="is-num">Total m</th>
          </tr>
        </thead>
        <tbody>
          {line.pieces.map((p, i) => (
            <tr key={i}>
              <td>{p.spansMm.map((s) => (s / 1000).toFixed(2)).join(' + ')}</td>
              <td className="is-num">{m1(p.lengthMm)}</td>
              <td className="is-num">{p.panels}</td>
              <td className="is-num">{m1(p.chordsMm)}</td>
              <td className="is-num">{m1(p.verticalsMm)}</td>
              <td className="is-num">{m1(p.diagonalsMm)}</td>
              <td className="is-num">
                <b>{m1(p.totalMm)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ——— results ———

function Summary({ result }: { result: SuperResult }) {
  const t = result.totals
  const imperial = result.settings.unitSystem === 'imperial'
  const areaM2 = result.levels.filter((l) => !l.skipped).reduce((s, l) => s + l.areaM2, 0)
  const perM2 = areaM2 > 0 ? t.grossLgsKg / areaM2 : null
  const cards: Array<[string, string, string]> = [
    ['Net LGS', `${kg(t.netLgsKg)} kg`, `calculated ${kg(t.calculatedLgsKg)} + allowances ${kg(t.allowancesKg)}`],
    ['Gross LGS', `${kg(t.grossLgsKg)} kg`, imperial ? `${kg(t.grossLgsKg * LB_PER_KG)} lb · net × 1.05` : 'net × 1.05'],
    ['Floor area', `${areaM2.toLocaleString('en-US', { maximumFractionDigits: 1 })} m²`, imperial ? `${kg(areaM2 * SQFT_PER_M2)} sq ft · ${result.levels.filter((l) => !l.skipped).length} levels` : `${result.levels.filter((l) => !l.skipped).length} levels on the ground footprint`],
    ['Gross LGS per m²', perM2 == null ? '—' : `${perM2.toFixed(1)} kg/m²`, imperial && perM2 != null ? `${((perM2 * LB_PER_KG) / SQFT_PER_M2).toFixed(2)} lb/sq ft` : 'gross over the floor area'],
    ['Screws', kg(t.screws), '7 per kg net'],
    ['Connectors', `${t.connectorsAed.toLocaleString('en-US', { maximumFractionDigits: 0 })} AED`, '0.1 AED per kg net'],
    ['Anchors', `${kg(t.anchorsM10)} M10 · ${kg(t.anchorsM8)} M8`, 'lowest level'],
    ['Rods M16', `${kg(t.rodsCount)}`, `${t.rodsLengthM.toFixed(1)} m of rod`],
    ['HRS', `${kg(t.hrsKg)} kg`, `markups ${kg(t.hrsMarkupKg)} · manual ${kg(t.hrsManualKg)}`],
    ['Stud packs', `${kg(t.studPackKg)} kg`, `${result.loadPath.padsToSubstructure} pads to substructure`],
  ]
  return (
    <div className="ss__kpis">
      {cards.map(([label, value, note]) => (
        <div key={label} className="ss__kpi">
          <span>{label}</span>
          <b>{value}</b>
          <small>{note}</small>
        </div>
      ))}
    </div>
  )
}

function LevelsTable({ result }: { result: SuperResult }) {
  return (
    <div className="ss__scroll">
    <table className="fe__table ss__levels-out">
      <thead>
        <tr>
          <th>Level</th>
          <th className="is-num">H mm</th>
          <th className="is-num">LB walls kg</th>
          <th className="is-num">NLB walls kg</th>
          <th className="is-num">Floor / roof kg</th>
          <th className="is-num">Purlins + bracing</th>
          <th className="is-num">Parapets</th>
          <th className="is-num">Total kg</th>
          <th className="is-num">kg/m²</th>
        </tr>
      </thead>
      <tbody>
        {[...result.levels].reverse().map((l: LevelResult) => (
          <tr key={l.levelId}>
            <td>
              <b>{l.name}</b>
              {l.skipped && <small>skipped: {l.skipped}</small>}
              {l.floor && <small>{l.floor.label}</small>}
              {l.roof && <small>pitched roof · {l.roof.sections.length} section{l.roof.sections.length === 1 ? '' : 's'}</small>}
            </td>
            <td className="is-num">{l.heightMm ?? '—'}</td>
            <td className="is-num">{kg(l.kg.wallsLb)}</td>
            <td className="is-num">{kg(l.kg.wallsNlb)}</td>
            <td className="is-num">{kg(l.kg.floor + l.kg.roof + l.kg.balconies)}</td>
            <td className="is-num">{kg(l.kg.purlins + l.kg.bracing)}</td>
            <td className="is-num">{kg(l.kg.parapets)}</td>
            <td className="is-num">
              <b>{kg(l.kg.total)}</b>
            </td>
            <td className="is-num">{l.kgPerM2 == null ? '—' : l.kgPerM2.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

function FlagsTab({ result, state, change, stale, onRun, onShow, onOpenSetup }: { result: SuperResult; state: SuperState; change: Change; stale: boolean; onRun: () => void; onShow: (f: Omit<PlanFocus, 'at'>) => void; onOpenSetup: () => void }) {
  const ack = (f: SuperFlag, on: boolean) =>
    change(`acknowledge ${f.code}`, on ? 'open' : 'acknowledged', on ? 'acknowledged' : 'open', (s) => ({ ...s, overrides: { ...s.overrides, acknowledged: on ? [...new Set([...s.overrides.acknowledged, f.key])] : s.overrides.acknowledged.filter((k) => k !== f.key) } }))
  const levelName = (id: string | null) => result.levels.find((l) => l.levelId === id)?.name ?? (id === 'SUSPENDED' ? 'Suspended floor' : id ?? 'Project')
  const decide = hrsDecider(state, change)
  /** The HRS markup a flag is about: F-HRS-PENDING names the markup; F-SPAN / F-STACK / F-CANTILEVER name the zone, run or balcony it was raised for. */
  const markupFor = (f: SuperFlag) => result.hrsMarkups.find((h) => f.entityIds.includes(h.id) || (h.levelId === f.levelId && h.entityIds.some((e) => f.entityIds.includes(e)))) ?? null
  const drawable = (f: SuperFlag) => f.entityIds.length > 0 && f.entityIds[0] !== 'footprint'
  const hrsOutstanding = result.flags.filter((f) => f.code === 'F-HRS-PENDING').length + new Set(result.missingInputs.filter((m) => /^HRS-/.test(m)).map((m) => m.split(':')[0])).size
  return (
    <>
      {hrsOutstanding > 1 && (
        <HrsBulk result={result} state={state} change={change} title={`${hrsOutstanding} HRS markups to decide — do them by type`} />
      )}
      {hrsOutstanding > 1 && stale && (
        <div className="ss__flag-actions">
          <button type="button" className="os-btn os-btn--primary" onClick={onRun}>
            <Play size={13} /> Run again to apply
          </button>
        </div>
      )}
      {result.missingInputs.length > 0 && (
        <>
          <h4 className="ss__h4">Missing inputs ({result.missingInputs.length})</h4>
          <ul className="fe__flags">
            {result.missingInputs.map((m) => {
              const hrsId = /^(HRS-\S+?):/.exec(m)?.[1] ?? null
              const markup = hrsId ? result.hrsMarkups.find((h) => h.id === hrsId) ?? null : null
              const live = markup ? liveMarkup(markup, state) : null
              const resolved = live != null && (live.status === 'deleted' || (live.status === 'accepted' && live.section && live.kgPerM != null && live.lengthMm != null && live.quantity != null) || live.status === 'suggested')
              return (
                <li key={m} className={clsx('is-stop', resolved && 'is-resolved')}>
                  <b>Input required</b>
                  <span>{m}</span>
                  {markup && live && <HrsFix markup={live} decide={decide} resolved={Boolean(resolved)} />}
                  <div className="ss__flag-actions">
                    {markup ? (
                      <button type="button" className="os-btn" onClick={() => onShow({ levelId: markup.levelId, entityIds: [markup.id, ...markup.entityIds] })}>
                        <Crosshair size={13} /> Show on plan
                      </button>
                    ) : (
                      <button type="button" className="os-btn" onClick={onOpenSetup}>
                        <SlidersHorizontal size={13} /> Open the level table
                      </button>
                    )}
                    {stale && (
                      <button type="button" className="os-btn os-btn--primary" onClick={onRun}>
                        <Play size={13} /> Run again to apply
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {!result.flags.length && !result.missingInputs.length && <p className="fe__muted">No flags. Every level ran clean against the v1.0 rules.</p>}
      {result.flags.length > 0 && (
        <ul className="fe__flags">
          {result.flags.map((f) => {
            const markup = markupFor(f)
            const live = markup ? liveMarkup(markup, state) : null
            const resolved = live != null && live.status !== 'suggested' && (live.status === 'deleted' || (live.section && live.kgPerM != null && live.lengthMm != null && live.quantity != null))
            return (
              <li key={f.key} className={clsx(f.severity === 'red' && 'is-stop', resolved && 'is-resolved')}>
                <b>
                  {f.code} <small>{f.severity} · {levelName(f.levelId)}</small>
                </b>
                {settingsFieldFor(f.message) ? (
                  <button type="button" className="settings-jump" onClick={() => openSettings(settingsFieldFor(f.message))}>
                    {f.message}
                  </button>
                ) : (
                  <span>{f.message}</span>
                )}
                <em>{f.action}</em>
                {f.severity === 'amber' && (
                  <label className="fe__check">
                    <input type="checkbox" checked={state.overrides.acknowledged.includes(f.key)} onChange={(e) => ack(f, e.target.checked)} /> Acknowledged by the engineer
                  </label>
                )}
                {markup && live && <HrsFix markup={live} decide={decide} resolved={Boolean(resolved)} />}
                {(drawable(f) || markup) && (
                  <div className="ss__flag-actions">
                    <button type="button" className="os-btn" onClick={() => onShow({ levelId: f.levelId ?? markup?.levelId ?? null, entityIds: [...new Set([...f.entityIds, ...(markup ? [markup.id, ...markup.entityIds] : [])])] })}>
                      <Crosshair size={13} /> Show on plan
                    </button>
                    {markup && stale && (
                      <button type="button" className="os-btn os-btn--primary" onClick={onRun}>
                        <Play size={13} /> Run again to apply
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {result.notes.map((n) => (
        <p key={n} className="fe__muted">
          {n}
        </p>
      ))}
    </>
  )
}

type LiveMarkup = ReturnType<typeof liveMarkup>
type Decide = ReturnType<typeof hrsDecider>

/**
 * One decision for every markup of a member type (all header beams, all intermediate beams…),
 * the way a villa sheet says "Header beams over 10 ft openings: Accepted · UB 305x165x40".
 * Length and quantity default to the engine's suggestion where the engineer left them blank.
 */
function HrsBulk({ result, state, change, title }: { result: SuperResult; state: SuperState; change: Change; title?: string }) {
  const types = [...new Set(result.hrsMarkups.map((h) => h.memberType))]
  const [drafts, setDrafts] = useState<Record<string, { status: HrsDecision['status']; section: string; kgPerM: number | null }>>({})
  if (!types.length) return null
  const live = result.hrsMarkups.map((h) => liveMarkup(h, state))
  const draftFor = (type: string) => {
    if (drafts[type]) return drafts[type]
    const first = live.find((h) => h.memberType === type && h.section)
    return { status: 'accepted' as const, section: first?.section ?? '', kgPerM: first?.kgPerM ?? null }
  }
  const apply = (type: string) => {
    const d = draftFor(type)
    const ids = result.hrsMarkups.filter((h) => h.memberType === type).map((h) => h.id)
    const section = d.section ? normaliseSection(d.section) : null
    const kgPerM = d.kgPerM ?? nominalKgPerM(section)
    change(`HRS all ${type}`, `${ids.length} markups`, `${d.status}${section ? ` · ${section}` : ''}${kgPerM != null ? ` · ${kgPerM} kg/m` : ''}`, (s) => {
      const hrsDecisions = { ...s.overrides.hrsDecisions }
      for (const h of result.hrsMarkups) {
        if (h.memberType !== type) continue
        const current = hrsDecisions[h.id] ?? { status: 'suggested' as const, section: null, kgPerM: null, lengthMm: null, quantity: null }
        hrsDecisions[h.id] =
          d.status === 'accepted'
            ? { status: 'accepted', section: section ?? current.section, kgPerM: kgPerM ?? current.kgPerM, lengthMm: current.lengthMm ?? h.suggestedLengthMm, quantity: current.quantity ?? h.suggestedQuantity }
            : { ...current, status: d.status }
      }
      return { ...s, overrides: { ...s.overrides, hrsDecisions } }
    })
  }
  return (
    <div className="ss__bulk">
      <b>{title ?? 'Decide by member type'}</b>
      <span>Applies one status and section to every markup of that type. Nominal kg/m comes from a UB / UC / PFC designation; type the supplier value to replace it.</span>
      {types.map((type) => {
        const d = draftFor(type)
        const set = (patch: Partial<typeof d>) => setDrafts((v) => ({ ...v, [type]: { ...d, ...patch } }))
        const mine = live.filter((h) => h.memberType === type)
        const open = mine.filter((h) => h.status === 'suggested').length
        const accepted = mine.filter((h) => h.status === 'accepted').length
        const incomplete = mine.filter((h) => h.status === 'accepted' && !(h.section && h.kgPerM != null && h.lengthMm != null && h.quantity != null)).length
        const nominal = d.kgPerM ?? nominalKgPerM(d.section)
        return (
          <div key={type} className="ss__bulk-row">
            <div className="ss__bulk-head">
              <b>{type}</b>
              <small>
                {mine.length} markup{mine.length === 1 ? '' : 's'} · {open} open · {accepted} accepted{incomplete ? ` (${incomplete} without a section)` : ''}
              </small>
            </div>
            <div className="ss__hrs-row">
              <select value={d.status} onChange={(e) => set({ status: e.target.value as HrsDecision['status'] })}>
                <option value="accepted">Accept all</option>
                <option value="deleted">Delete all</option>
                <option value="suggested">Reopen all</option>
              </select>
              {d.status === 'accepted' && (
                <>
                  <HrsSectionSelect value={d.section} onChange={(section) => set({ section, kgPerM: nominalKgPerM(section) })} />
                  <input type="number" className="ss__num" placeholder={nominal != null ? `${nominal} nominal` : 'kg/m'} value={d.kgPerM ?? ''} onChange={(e) => set({ kgPerM: num(e.target.value) })} />
                </>
              )}
              <button type="button" className="os-btn os-btn--primary" disabled={d.status === 'accepted' && !d.section} onClick={() => apply(type)}>
                <CheckCircle2 size={13} /> Apply to {mine.length}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Inline resolution of the HRS markup behind a flag: accept with the suggested length and quantity (section and kg/m stay the engineer's), or delete. */
function HrsFix({ markup: h, decide, resolved }: { markup: LiveMarkup; decide: Decide; resolved: boolean }) {
  const acceptSuggested = () => decide(h.id, { status: 'accepted', lengthMm: h.lengthMm ?? h.suggestedLengthMm, quantity: h.quantity ?? h.suggestedQuantity })
  return (
    <div className={clsx('ss__fix', h.status === 'accepted' && 'is-accepted', h.status === 'deleted' && 'is-deleted')}>
      <b>
        Fix: {h.memberType} <small>{h.id}</small>
      </b>
      <span>
        {h.status === 'deleted'
          ? 'Deleted; the flag clears on the next run and the zone keeps its span flag unless a wall is added.'
          : h.status === 'accepted'
            ? resolved
              ? `Accepted ${h.quantity} × ${h.lengthMm} mm in ${h.section} at ${h.kgPerM} kg/m; run again to split the zone and clear the flag.`
              : 'Accepted; enter the section and supplier kg/m (UB, UC, PFC, SHS, RHS, CHS, angle) to complete it.'
            : `Suggested ${h.suggestedQuantity} × ${h.suggestedLengthMm ?? '—'} mm · ${h.beamEnds * Math.max(1, Math.round(h.suggestedQuantity))} beam ends onto LGS walls`}
      </span>
      {h.status === 'suggested' && (
        <div className="ss__flag-actions">
          <button type="button" className="os-btn os-btn--primary" onClick={acceptSuggested}>
            <CheckCircle2 size={13} /> Accept {h.suggestedQuantity} × {h.suggestedLengthMm ?? '—'} mm
          </button>
          <button type="button" className="os-btn" onClick={() => decide(h.id, { status: 'deleted' })}>
            <Trash2 size={13} /> Delete markup
          </button>
        </div>
      )}
      <HrsDecisionRow h={h} decide={decide} />
    </div>
  )
}

/** Section text plus the kg/m that goes with it: nominal from a UB/UC/PFC designation, otherwise whatever is already set. */
function sectionPatch(text: string, currentKgPerM: number | null): Partial<HrsDecision> {
  const section = text ? normaliseSection(text) : null
  const nominal = nominalKgPerM(section)
  return { section, kgPerM: nominal ?? currentKgPerM }
}

function HrsSectionSelect({ value, onChange }: { value: string; onChange: (section: string) => void }) {
  const known = HRS_SECTIONS.some((s) => s.designation === value)
  return (
    <select aria-label="HRS section" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a section</option>
      {(['UB', 'UC', 'PFC'] as const).map((family) => (
        <optgroup key={family} label={family}>
          {HRS_SECTIONS.filter((s) => s.family === family).map((s) => (
            <option key={s.designation} value={s.designation}>
              {s.designation} · {s.kgPerM} kg/m
            </option>
          ))}
        </optgroup>
      ))}
      {value && !known ? <option value={value}>{value}</option> : null}
    </select>
  )
}

function HrsDecisionRow({ h, decide }: { h: LiveMarkup; decide: Decide }) {
  const nominal = nominalKgPerM(h.section)
  return (
    <div className="ss__hrs-row">
      <select value={h.status} onChange={(e) => decide(h.id, { status: e.target.value as HrsDecision['status'] })}>
        <option value="suggested">Open</option>
        <option value="accepted">Accepted</option>
        <option value="deleted">Deleted</option>
      </select>
      <HrsSectionSelect value={h.section ?? ''} onChange={(section) => decide(h.id, sectionPatch(section, h.kgPerM))} />
      <input type="number" className="ss__num" placeholder="kg/m" title={nominal != null && nominal === h.kgPerM ? 'Nominal kg/m from the designation; overwrite with the supplier value' : 'Supplier kg/m'} value={h.kgPerM ?? ''} onChange={(e) => decide(h.id, { kgPerM: num(e.target.value) })} />
      <input type="number" className="ss__num" placeholder="length mm" value={h.lengthMm ?? ''} onChange={(e) => decide(h.id, { lengthMm: num(e.target.value) })} />
      <input type="number" className="ss__num" placeholder="qty" value={h.quantity ?? ''} onChange={(e) => decide(h.id, { quantity: num(e.target.value) })} />
      <b className="is-num">{h.kg == null ? '—' : `${kg(h.kg)} kg`}</b>
    </div>
  )
}

function WallsTab({ result }: { result: SuperResult }) {
  const [levelId, setLevelId] = useState(result.levels[0]?.levelId ?? '')
  const level = result.levels.find((l) => l.levelId === levelId) ?? result.levels[0]
  if (!level) return null
  const runs = [...level.wallRuns].sort((a, b) => b.kg - a.kg)
  return (
    <>
      <LevelPicker result={result} value={level.levelId} onChange={setLevelId} />
      <p className="fe__muted">
        {runs.length} runs · {runs.filter((r) => r.status === 'LB').length} LB · stud height {level.heightMm} mm (FFH − {level.deductionMm} mm) · junctions L {runs.reduce((s, r) => s + r.junctions.L, 0)} T {runs.reduce((s, r) => s + r.junctions.T, 0)} X {runs.reduce((s, r) => s + r.junctions.X, 0)}
      </p>
      <table className="fe__table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Status</th>
            <th className="is-num">L m</th>
            <th className="is-num">Panels</th>
            <th className="is-num">Studs</th>
            <th className="is-num">Nogging rows</th>
            <th className="is-num">kg</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} title={`${r.sourceWallIds.join(', ')} · openings ${r.openings.join(', ') || 'none'} · junctions L${r.junctions.L} T${r.junctions.T} X${r.junctions.X}`}>
              <td>
                {r.id}
                <small>
                  {r.axis === 'h' ? 'y' : 'x'} = {r.pos} · {r.external ? 'external' : 'internal'} · {r.section}
                </small>
              </td>
              <td>{r.status}</td>
              <td className="is-num">{m1(r.lengthMm)}</td>
              <td className="is-num">{r.panels}</td>
              <td className="is-num">
                {r.studsRegular + r.studsJamb + r.studsJunction}
                <small>
                  {r.studsRegular} + {r.studsJamb} jamb + {r.studsJunction} jn
                </small>
              </td>
              <td className="is-num">{r.noggingRows}</td>
              <td className="is-num">{kg(r.kg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {level.parapet && (
        <p className="fe__muted">
          Parapet: {level.parapet.runs.length} external runs at {level.parapet.heightMm} mm in {level.parapet.section} · {kg(level.parapet.kg)} kg.
        </p>
      )}
    </>
  )
}

function LevelPicker({ result, value, onChange }: { result: SuperResult; value: string; onChange: (id: string) => void }) {
  return (
    <div className="agents-view ss__picker">
      {result.levels.map((l) => (
        <button key={l.levelId} type="button" className={clsx(value === l.levelId && 'is-on')} onClick={() => onChange(l.levelId)}>
          {l.name}
        </button>
      ))}
    </div>
  )
}

function FloorsTab({ result }: { result: SuperResult }) {
  const floors = [...(result.suspendedFloor ? [result.suspendedFloor] : []), ...result.levels.flatMap((l) => (l.floor ? [l.floor] : []))]
  if (!floors.length) return <p className="fe__muted">No floor or flat roof framing on this run.</p>
  return (
    <>
      {floors.map((f) => (
        <div key={`${f.carriedBy}-${f.label}`} className="ss__block">
          <h4 className="ss__h4">
            {f.label} <small>{f.section}{f.reinforcing ? ' · reinforcing studs' : ''}</small>
          </h4>
          {f.family === 'truss' ? (
            <>
              <p className="fe__muted">
                {f.trussLines.length} truss lines · {f.trussLines.reduce((s, l) => s + l.pieces.length, 0)} pieces · members {(f.membersMm / 1000).toFixed(0)} m · blocking {f.blocking.reduce((s, b) => s + b.lines, 0)} lines {(f.blockingMm / 1000).toFixed(0)} m · <b>{kg(f.kg)} kg</b>
              </p>
              <table className="fe__table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Spans mm</th>
                    <th>Pieces mm</th>
                    <th className="is-num">Panels</th>
                    <th className="is-num">m</th>
                  </tr>
                </thead>
                <tbody>
                  {groupLines(f.trussLines).map((g) => (
                    <tr key={g.key}>
                      <td>
                        {g.count} × {g.direction === 'x' ? 'along x' : 'along y'}
                        <small>{g.zoneIds.join(' → ')}</small>
                      </td>
                      <td>{g.spans.map((s) => Math.round(s)).join(' + ')}</td>
                      <td>{g.pieces.map((p) => Math.round(p)).join(' | ')}</td>
                      <td className="is-num">{g.panels}</td>
                      <td className="is-num">{(g.totalMm / 1000).toFixed(1)} each</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <p className="fe__muted">
                {f.joistZones.reduce((s, z) => s + z.joists, 0)} joists · {(f.membersMm / 1000).toFixed(0)} m · blocking {(f.blockingMm / 1000).toFixed(0)} m · rims {(f.rimsMm / 1000).toFixed(0)} m · <b>{kg(f.kg)} kg</b>
              </p>
              <table className="fe__table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th className="is-num">W mm</th>
                    <th className="is-num">Span mm</th>
                    <th className="is-num">Joists</th>
                    <th className="is-num">Rows</th>
                    <th className="is-num">m</th>
                  </tr>
                </thead>
                <tbody>
                  {f.joistZones.map((z, i) => (
                    <tr key={`${z.zoneId}-${i}`}>
                      <td>{z.zoneId}</td>
                      <td className="is-num">{Math.round(z.widthMm)}</td>
                      <td className="is-num">{Math.round(z.spanMm)}</td>
                      <td className="is-num">{z.joists}</td>
                      <td className="is-num">{z.blockingRows}</td>
                      <td className="is-num">{(z.totalMm / 1000).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {f.purlinsKg > 0 && (
            <p className="fe__muted">
              Purlins {f.purlinsM.toFixed(1)} m ({kg(f.purlinsKg)} kg) · strap bracing {f.bracingM.toFixed(1)} m ({kg(f.bracingKg)} kg).
            </p>
          )}
        </div>
      ))}
    </>
  )
}

function groupLines(lines: TrussLineResult[]) {
  const groups = new Map<string, { key: string; direction: 'x' | 'y'; zoneIds: string[]; spans: number[]; pieces: number[]; panels: number; totalMm: number; count: number }>()
  for (const line of lines) {
    const key = `${line.direction}:${line.zoneIds.join('|')}:${line.spansMm.map((s) => Math.round(s)).join('+')}`
    const g = groups.get(key)
    if (g) g.count += 1
    else groups.set(key, { key, direction: line.direction, zoneIds: line.zoneIds, spans: line.spansMm, pieces: line.pieces.map((p) => p.lengthMm), panels: line.pieces.reduce((s, p) => s + p.panels, 0), totalMm: line.totalMm, count: 1 })
  }
  return [...groups.values()]
}

function RoofTab({ result }: { result: SuperResult }) {
  const roofs = result.levels.flatMap((l) => (l.roof ? [{ level: l, roof: l.roof }] : []))
  const flat = result.levels.flatMap((l) => (l.floor?.isRoof ? [l] : []))
  if (!roofs.length && !flat.length) return <p className="fe__muted">No roof framing on this run.</p>
  return (
    <>
      {flat.map((l) => (
        <p key={l.levelId} className="fe__muted">
          {l.floor!.label}: framed as a floor in {l.floor!.section} · {kg(l.floor!.kg)} kg{l.floor!.purlinsKg ? ` · purlins ${kg(l.floor!.purlinsKg)} kg · bracing ${kg(l.floor!.bracingKg)} kg` : ' · flat deck, no purlins or bracing'}. Details on the Floors tab.
        </p>
      ))}
      {roofs.map(({ level, roof }) =>
        roof.sections.map((r) => (
          <div key={r.id} className="ss__block">
            <h4 className="ss__h4">
              {r.id} · {r.type.replace('_', ' ')} <small>{level.name} · {roof.section} · {r.pitchDeg}°</small>
            </h4>
            <table className="fe__table">
              <tbody>
                <tr>
                  <td>Common trusses</td>
                  <td className="is-num">{r.commonCount}</td>
                  <td className="is-num">{(r.commonMm / 1000).toFixed(1)} m</td>
                </tr>
                {r.jackCount > 0 && (
                  <tr>
                    <td>Jack trusses</td>
                    <td className="is-num">{r.jackCount}</td>
                    <td className="is-num">{(r.jackMm / 1000).toFixed(1)} m</td>
                  </tr>
                )}
                {r.hipRafterCount > 0 && (
                  <tr>
                    <td>Hip rafter members</td>
                    <td className="is-num">{r.hipRafterCount}</td>
                    <td className="is-num">{(r.hipRafterMm / 1000).toFixed(1)} m</td>
                  </tr>
                )}
                {r.valleyTrussCount > 0 && (
                  <tr>
                    <td>Valley trusses and members</td>
                    <td className="is-num">{r.valleyTrussCount}</td>
                    <td className="is-num">{((r.valleyTrussMm + r.valleyMemberMm) / 1000).toFixed(1)} m</td>
                  </tr>
                )}
                <tr>
                  <td>Verge outriggers and verge members</td>
                  <td className="is-num">{r.outriggerCount}</td>
                  <td className="is-num">{((r.outriggerMm + r.vergeMemberMm) / 1000).toFixed(1)} m</td>
                </tr>
                <tr>
                  <td>Fascia</td>
                  <td />
                  <td className="is-num">{(r.fasciaMm / 1000).toFixed(1)} m</td>
                </tr>
                <tr>
                  <td>
                    <b>Roof framing</b>
                  </td>
                  <td />
                  <td className="is-num">
                    <b>{kg(r.framingKg)} kg</b>
                  </td>
                </tr>
                <tr>
                  <td>Purlins 362S162-33 at 1200</td>
                  <td className="is-num">{r.slopeAreaM2.toFixed(1)} m² slope</td>
                  <td className="is-num">
                    {r.purlinsM.toFixed(1)} m · {kg(r.purlinsKg)} kg
                  </td>
                </tr>
                <tr>
                  <td>Strap bracing</td>
                  <td className="is-num">
                    top {r.bracingTopM.toFixed(1)} m · bottom {r.bracingBottomM.toFixed(1)} m
                  </td>
                  <td className="is-num">{kg(r.bracingKg)} kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        )),
      )}
    </>
  )
}

function FixingsTab({ result }: { result: SuperResult }) {
  return (
    <table className="fe__table">
      <thead>
        <tr>
          <th>Level</th>
          <th className="is-num">M10 × 200</th>
          <th className="is-num">M8 × 100</th>
          <th className="is-num">Rods external</th>
          <th className="is-num">Rods internal</th>
          <th className="is-num">Rod mm</th>
        </tr>
      </thead>
      <tbody>
        {[...result.levels].reverse().map((l) => (
          <tr key={l.levelId}>
            <td>
              {l.name}
              <small>{l.index === 0 ? (result.settings.lowestLevel === 'suspended' ? 'suspended: anchor rules off' : 'anchors into the slab') : `${l.anchors.corners} corners + external runs at 4572 mm; stacked internal LB at 6096 mm`}</small>
            </td>
            <td className="is-num">{l.anchors.m10x200 || '—'}</td>
            <td className="is-num">{l.anchors.m8x100 || '—'}</td>
            <td className="is-num">{l.anchors.rodsExternal || '—'}</td>
            <td className="is-num">{l.anchors.rodsInternal || '—'}</td>
            <td className="is-num">{l.anchors.rodLengthMm ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HrsTab({ result, state, change }: { result: SuperResult; state: SuperState; change: Change }) {
  const decide = hrsDecider(state, change)
  const manual = state.overrides.hrsManual
  const updateManual = (id: string, patch: Partial<HrsManual>) => change(`manual HRS ${id}`, '', JSON.stringify(patch), (s) => ({ ...s, overrides: { ...s.overrides, hrsManual: s.overrides.hrsManual.map((m) => (m.id === id ? { ...m, ...patch } : m)) } }))
  const addManual = () => change('manual HRS', '—', 'added', (s) => ({ ...s, overrides: { ...s.overrides, hrsManual: [...s.overrides.hrsManual, { id: `HRS-M${s.overrides.hrsManual.length + 1}`, description: '', levelId: s.inputs.levels[0].id, section: '', kgPerM: null, lengthMm: null, quantity: 1, directKg: null }] } }))
  const removeManual = (id: string) => change(`manual HRS ${id}`, 'row', 'removed', (s) => ({ ...s, overrides: { ...s.overrides, hrsManual: s.overrides.hrsManual.filter((m) => m.id !== id) } }))
  const levelName = (id: string) => result.levels.find((l) => l.levelId === id)?.name ?? id
  return (
    <>
      <p className="fe__muted">Suggested markups come from the flags. Accept one with a section and supplier kg/m (UB, UC, PFC, SHS, RHS, CHS, angles) or delete it; an open suggestion keeps F-HRS-PENDING red. Weight = length × kg/m × qty × 1.05 × 1.05. Accepted beams split their zone and add stud packs down to the foundation on the next run.</p>
      {!result.hrsMarkups.length && <p className="fe__muted">No HRS suggestions on this run.</p>}
      {result.hrsMarkups.length > 1 && <HrsBulk result={result} state={state} change={change} />}
      {result.hrsMarkups.map((raw) => {
        const h = liveMarkup(raw, state)
        return (
          <div key={h.id} className={clsx('ss__hrs', h.status === 'accepted' && 'is-accepted', h.status === 'deleted' && 'is-deleted')}>
            <header>
              <b>
                {h.memberType} <small>{h.id}</small>
              </b>
              <span>
                {levelName(h.levelId)} · {h.trigger} · {h.entityIds.join(', ')} · suggested {h.suggestedQuantity} × {h.suggestedLengthMm ?? '—'} mm
              </span>
            </header>
            <HrsDecisionRow h={h} decide={decide} />
          </div>
        )
      })}
      <h4 className="ss__h4">Manual HRS</h4>
      {manual.map((m) => (
        <div key={m.id} className="ss__hrs">
          <div className="ss__hrs-row">
            <input placeholder="description" value={m.description} onChange={(e) => updateManual(m.id, { description: e.target.value })} />
            <select value={m.levelId} onChange={(e) => updateManual(m.id, { levelId: e.target.value })}>
              {state.inputs.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input placeholder="section" value={m.section} onChange={(e) => updateManual(m.id, { section: e.target.value })} />
            <input type="number" className="ss__num" placeholder="kg/m" value={m.kgPerM ?? ''} onChange={(e) => updateManual(m.id, { kgPerM: num(e.target.value) })} />
            <input type="number" className="ss__num" placeholder="length mm" value={m.lengthMm ?? ''} onChange={(e) => updateManual(m.id, { lengthMm: num(e.target.value) })} />
            <input type="number" className="ss__num" placeholder="qty" value={m.quantity} onChange={(e) => updateManual(m.id, { quantity: Number(e.target.value) || 1 })} />
            <input type="number" className="ss__num" placeholder="direct kg" value={m.directKg ?? ''} onChange={(e) => updateManual(m.id, { directKg: num(e.target.value) })} />
            <b className="is-num">{kg(result.hrsManual.find((x) => x.id === m.id)?.kg ?? null)} kg</b>
            <button type="button" className="ss__icon" aria-label={`Remove ${m.id}`} onClick={() => removeManual(m.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="os-btn" onClick={addManual}>
        <Plus size={14} /> Add manual HRS
      </button>
      {result.loadPath.studPacks.length > 0 && (
        <p className="fe__muted">
          Load path: {result.loadPath.beamEndsOnLgsWalls} beam ends on LGS walls → {result.loadPath.studPackStuds} studs in packs ({kg(result.loadPath.studPackKg)} kg) · {result.loadPath.padsToSubstructure} pad footings passed to the substructure.
        </p>
      )}
    </>
  )
}

function AllowancesTab({ result, state, change }: { result: SuperResult; state: SuperState; change: Change }) {
  const rows = state.overrides.allowances
  const update = (id: string, patch: Partial<AllowanceRow>) => change(`allowance ${id}`, '', JSON.stringify(patch), (s) => ({ ...s, overrides: { ...s.overrides, allowances: s.overrides.allowances.map((r) => (r.id === id ? { ...r, ...patch } : r)) } }))
  return (
    <>
      <p className="fe__muted">Allowances sit on the calculated LGS ({kg(result.totals.calculatedLgsKg)} kg). A blank value stays blank; nothing is written as zero.</p>
      <table className="fe__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Mode</th>
            <th className="is-num">Value</th>
            <th className="is-num">Units</th>
            <th className="is-num">kg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.item}</td>
              <td>
                <select value={r.mode} onChange={(e) => update(r.id, { mode: e.target.value as AllowanceRow['mode'] })}>
                  <option value="percent">% of calculated</option>
                  <option value="fixed_kg">fixed kg</option>
                  <option value="fixed_kg_per_unit">kg per unit</option>
                </select>
              </td>
              <td className="is-num">
                <input type="number" className="ss__num" value={r.value ?? ''} onChange={(e) => update(r.id, { value: num(e.target.value) })} />
              </td>
              <td className="is-num">{r.mode === 'fixed_kg_per_unit' ? <input type="number" className="ss__num" placeholder="flights / modules" value={r.units ?? ''} onChange={(e) => update(r.id, { units: num(e.target.value) })} /> : '—'}</td>
              <td className="is-num">{kg(result.totals.allowanceRows.find((a) => a.item === r.item)?.kg ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function BoqTab({ result }: { result: SuperResult }) {
  const groups = [...new Set(result.boq.map((r) => r.group))]
  return (
    <>
      {groups.map((group) => (
        <table key={group} className="fe__table">
          <thead>
            <tr>
              <th colSpan={4}>{group}</th>
            </tr>
          </thead>
          <tbody>
            {result.boq
              .filter((r) => r.group === group)
              .map((r) => (
                <tr key={r.id} title={r.ruleIds.join(' ')}>
                  <td>{r.code}</td>
                  <td>
                    {r.description}
                    <small>
                      {r.lgsSection ? `${r.lgsSection} · ` : ''}
                      {r.basis}
                    </small>
                  </td>
                  <td className="is-num">{r.qty == null ? '' : r.unit === 'kg' || r.unit === 'nr' ? kg(r.qty) : r.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td>{r.unit}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}
    </>
  )
}

function SectionsTab({ result }: { result: SuperResult }) {
  return (
    <>
      <p className="fe__muted">Metres and kg per section for coil planning (net, before wastage).</p>
      <table className="fe__table">
        <thead>
          <tr>
            <th>Section</th>
            <th className="is-num">m</th>
            <th className="is-num">kg</th>
          </tr>
        </thead>
        <tbody>
          {result.bySection.map((s) => (
            <tr key={s.section}>
              <td>{s.section}</td>
              <td className="is-num">{s.m ? Math.round(s.m).toLocaleString('en-US') : '—'}</td>
              <td className="is-num">{kg(s.kg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function LogTab({ state }: { state: SuperState }) {
  const log = [...state.overrides.changeLog].reverse()
  if (!log.length) return <p className="fe__muted">No engineer changes yet.</p>
  return (
    <ul className="fe__log">
      {log.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <b>{e.entity}</b> {e.from ? `${e.from} → ` : ''}
          {e.to}
          <small>
            {e.user} · {new Date(e.at).toLocaleString()}
          </small>
        </li>
      ))}
    </ul>
  )
}
