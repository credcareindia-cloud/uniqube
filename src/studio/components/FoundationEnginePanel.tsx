import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CheckCircle2, Download, Play, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useAppStore } from '../store'
import { openSettings, settingsFieldFor } from '../lib/settingsDialog'
import { readSession } from './OsChrome'
import { boqCsv, roundedBoq } from '../lib/foundation/engine'
import { PARAMETER_TABLE, foundationTypeName } from '../lib/foundation/rules'
import { loadEngineState, runEngineForProject, saveEngineState, type EngineState, type PlanCandidate } from '../lib/foundation/run'
import { applyPlanRevision, describePlan } from '../lib/foundation/revise'
import { PlanRevisionChat } from './PlanRevisionChat'
import type { EngineResult, FramingDecision, FramingZone, Wall } from '../lib/foundation/types'

type Tab = 'flags' | 'walls' | 'boq' | 'rebar' | 'checks' | 'log'

const CLASS_COLOUR: Record<string, string> = { LB: '#DC2626', SHEAR: '#7C3AED', NLB: '#2563EB', REVIEW: '#EA580C' }
const STATUS_COLOUR: Record<FramingDecision['status'], string> = { auto: '#15803D', 'tie-break': '#EA580C', flagged: '#DC2626', 'engineer-set': '#1D4ED8', none: '#64748B' }

export function FoundationEnginePanel({ projectId }: { projectId: string }) {
  const documents = useAppStore((s) => s.documents)
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const [state, setState] = useState<EngineState>({ inputs: { storeyCount: 1, foundationType: 1, plinthAboveNglMm: null, soilBearingKpa: null, lineLoadPerStoreyKnM: null, parameterOverrides: {} }, overrides: { directions: {}, promotedWallIds: [], beams: [], wallClasses: {}, approvedBy: null, approvedAt: null, changeLog: [] }, planKey: null, result: null })
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('flags')
  const [showParams, setShowParams] = useState(false)
  const [showFoundation, setShowFoundation] = useState(true)
  const [selected, setSelected] = useState<{ kind: 'zone' | 'wall'; id: string } | null>(null)
  const [plans, setPlans] = useState<PlanCandidate[] | null>(null)
  const [beamDraft, setBeamDraft] = useState({ axis: 'h' as 'h' | 'v', pos: '', a: '', b: '' })
  const dirtyRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const result = state.result
  const readyCount = documents.filter((d) => d.status === 'ready' && d.analysis).length
  const user = readSession()?.name ?? 'engineer'

  useEffect(() => {
    let alive = true
    setHydrated(false)
    loadEngineState(projectId).then((loaded) => {
      if (!alive) return
      setState(loaded)
      setHydrated(true)
    })
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!showParams) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowParams(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showParams])

  const jobInputs = useAppStore((s) => s.projectContext.jobInputs)
  const levelCount = useAppStore((s) => s.projectContext.floors.length)

  useEffect(() => {
    if (!hydrated || !jobInputs) return
    const storeys = Math.max(1, levelCount || 1)
    setState((current) => {
      const plinthAboveNglMm = jobInputs.plinthAboveNglMm ?? current.inputs.plinthAboveNglMm
      const soilBearingKpa = jobInputs.soilBearingKpa ?? current.inputs.soilBearingKpa
      const lineLoadPerStoreyKnM = jobInputs.lineLoadKnM ?? current.inputs.lineLoadPerStoreyKnM
      if (
        current.inputs.storeyCount === storeys &&
        current.inputs.plinthAboveNglMm === plinthAboveNglMm &&
        current.inputs.soilBearingKpa === soilBearingKpa &&
        current.inputs.lineLoadPerStoreyKnM === lineLoadPerStoreyKnM
      ) {
        return current
      }
      return {
        ...current,
        inputs: { ...current.inputs, storeyCount: storeys, plinthAboveNglMm, soilBearingKpa, lineLoadPerStoreyKnM },
      }
    })
  }, [hydrated, jobInputs, levelCount])

  useEffect(() => {
    if (!hydrated) return
    void saveEngineState(projectId, state).catch(() => setError('Could not save to the database. Is Docker Postgres running?'))
  }, [projectId, state, hydrated])

  useEffect(() => {
    if (!readyCount) return
    let alive = true
    import('../lib/foundation/run').then(({ listPlanCandidates }) => listPlanCandidates().then((list) => alive && setPlans(list)).catch(() => alive && setPlans([])))
    return () => {
      alive = false
    }
  }, [readyCount])

  async function run(next?: EngineState) {
    const base = next ?? state
    setBusy(true)
    setError(null)
    try {
      const outcome = await runEngineForProject(base)
      setState({ ...base, result: outcome.result })
      dirtyRef.current = false
      if (outcome.result.flags.length) setTab('flags')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The engine could not run.')
    } finally {
      setBusy(false)
    }
  }

  /** Any engineer change after approval re-opens the gate (RG-04 change log). */
  function change(entity: string, from: string, to: string, patch: (s: EngineState) => EngineState) {
    setState((s) => {
      const next = patch(s)
      const log = [...next.overrides.changeLog, { at: new Date().toISOString(), user, entity, from, to }]
      dirtyRef.current = true
      return { ...next, overrides: { ...next.overrides, changeLog: log, approvedBy: null, approvedAt: null } }
    })
  }

  function setInput<K extends keyof EngineState['inputs']>(key: K, value: EngineState['inputs'][K]) {
    change(`input.${String(key)}`, String(state.inputs[key] ?? ''), String(value ?? ''), (s) => ({ ...s, inputs: { ...s.inputs, [key]: value } }))
  }

  function setDirection(zone: FramingZone, direction: 'x' | 'y' | null) {
    const current = state.overrides.directions[zone.id] ?? result?.decisions.find((d) => d.zoneId === zone.id)?.direction ?? '—'
    change(`zone ${zone.id}`, String(current), direction ?? 'auto', (s) => {
      const directions = { ...s.overrides.directions }
      if (direction) directions[zone.id] = direction
      else delete directions[zone.id]
      return { ...s, overrides: { ...s.overrides, directions } }
    })
  }

  function setWallClass(wall: Wall, cls: 'LB' | 'NLB' | null) {
    const current = state.overrides.wallClasses[wall.id] ?? result?.wallClasses.find((c) => c.wallId === wall.id)?.class ?? '—'
    change(`wall ${wall.id}`, String(current), cls ?? 'auto', (s) => {
      const wallClasses = { ...s.overrides.wallClasses }
      if (cls) wallClasses[wall.id] = cls
      else delete wallClasses[wall.id]
      return { ...s, overrides: { ...s.overrides, wallClasses } }
    })
  }

  function togglePromote(wall: Wall) {
    const on = state.overrides.promotedWallIds.includes(wall.id)
    change(`support ${wall.id}`, on ? 'support line' : 'wall', on ? 'wall' : 'support line', (s) => ({
      ...s,
      overrides: { ...s.overrides, promotedWallIds: on ? s.overrides.promotedWallIds.filter((id) => id !== wall.id) : [...s.overrides.promotedWallIds, wall.id] },
    }))
  }

  function addBeam() {
    const pos = Number(beamDraft.pos)
    const a = Number(beamDraft.a)
    const b = Number(beamDraft.b)
    if (![pos, a, b].every(Number.isFinite) || a === b) return
    const id = `BEAM-${state.overrides.beams.length + 1}`
    change(id, '—', `${beamDraft.axis === 'h' ? 'y' : 'x'}=${pos} ${Math.min(a, b)}–${Math.max(a, b)}`, (s) => ({ ...s, overrides: { ...s.overrides, beams: [...s.overrides.beams, { id, axis: beamDraft.axis, pos, a: Math.min(a, b), b: Math.max(a, b) }] } }))
    setBeamDraft({ axis: beamDraft.axis, pos: '', a: '', b: '' })
  }

  function removeBeam(id: string) {
    change(id, 'beam', 'removed', (s) => ({ ...s, overrides: { ...s.overrides, beams: s.overrides.beams.filter((x) => x.id !== id) } }))
  }

  async function approve() {
    if (!result || result.blocked) return
    const next: EngineState = {
      ...state,
      overrides: {
        ...state.overrides,
        approvedBy: user,
        approvedAt: new Date().toISOString(),
        changeLog: [...state.overrides.changeLog, { at: new Date().toISOString(), user, entity: 'review gate', from: 'open', to: 'approved' }],
      },
    }
    setState(next)
    try {
      await saveEngineState(projectId, next)
    } catch {
      setError('Could not save the approval. Is Docker Postgres running?')
      return
    }
  }

  function resetOverrides() {
    change('overrides', 'engineer edits', 'cleared', (s) => ({ ...s, overrides: { ...s.overrides, directions: {}, promotedWallIds: [], beams: [], wallClasses: {} } }))
  }

  function exportCsv() {
    if (!result) return
    const csv = boqCsv(result, {
      project: projectName || projectId,
      foundation_type: `Type ${result.foundationType} — ${foundationTypeName(result.foundationType)}`,
      storey_band: result.band,
      parameter_version: result.parameterSetVersion,
      engine_version: result.version,
      date: result.ranAt.slice(0, 10),
      approver: state.overrides.approvedBy ?? '(not approved)',
      plan_sheet: `${result.level.drawingNo ?? ''} p${result.level.sourcePage}`,
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foundation-boq-${(projectName || projectId).replace(/[^\w-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stopFlags = result?.flags.filter((f) => f.severity === 'stop') ?? []
  const warnFlags = result?.flags.filter((f) => f.severity === 'warn') ?? []
  const stale = Boolean(result) && dirtyRef.current
  const selectedZone = selected?.kind === 'zone' ? result?.zones.find((z) => z.id === selected.id) ?? null : null
  const selectedWall = selected?.kind === 'wall' ? result?.walls.find((w) => w.id === selected.id) ?? null : null

  return (
    <div className="fe">
      <header className="agents-chat__head">
        <div>
          <h2>Sub structure</h2>
          <span>
            Load-bearing wall &amp; foundation logic v0.1 · {result ? `${result.level.drawingNo ?? 'plan'} p${result.level.sourcePage} · ${result.scale.label} · ran ${new Date(result.ranAt).toLocaleString()}` : readyCount ? `${readyCount} PDF${readyCount > 1 ? 's' : ''} ready` : 'waiting for a PDF'}
            {stale && ' · inputs changed, run again'}
          </span>
        </div>
        <div className="agents-chat__actions">
          <button type="button" className={clsx('os-btn', showParams && 'is-on')} aria-haspopup="dialog" aria-expanded={showParams} onClick={() => setShowParams(true)}>
            <SlidersHorizontal size={14} /> Parameters
          </button>
          <button type="button" className="os-btn" disabled={!result?.boq.length} onClick={exportCsv} title="Export BOQ as CSV (BQ-05 header)">
            <Download size={14} /> CSV
          </button>
          <button type="button" className="os-btn os-btn--primary" disabled={busy || !readyCount} onClick={() => run()}>
            <Play size={14} /> {busy ? 'Running…' : result ? 'Run again' : 'Run'}
          </button>
        </div>
      </header>

      {showParams &&
        createPortal(
          <div className="pages-backdrop" style={{ zIndex: 4000 }} onMouseDown={() => setShowParams(false)}>
            <div className="pages-dialog ss-params" role="dialog" aria-modal="true" aria-labelledby="sub-params-title" onMouseDown={(event) => event.stopPropagation()}>
              <header className="pages-dialog__head">
                <div>
                  <h2 id="sub-params-title">Parameters</h2>
                  <p>Overrides apply to this project only and are recorded in the change log.</p>
                </div>
                <button type="button" className="pages-dialog__close" aria-label="Close parameters" onClick={() => setShowParams(false)}>
                  <X size={16} />
                </button>
              </header>
              <div className="fe__params">
          <div className="fe__inputs">
            <label className="fe__wide">
              Plan sheet
              <select value={state.planKey ?? ''} onChange={(e) => change('plan sheet', state.planKey ?? 'auto', e.target.value || 'auto', (s) => ({ ...s, planKey: e.target.value || null }))}>
                <option value="">Auto (ground floor plan)</option>
                {(plans ?? []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.drawingNo ?? p.fileName} p{p.pageNumber} — {p.title ?? 'plan'}
                  </option>
                ))}
              </select>
            </label>
            <p className="fe__muted">Storeys, plinth, soil bearing and line load are set in Settings. This run uses {state.inputs.storeyCount} {state.inputs.storeyCount === 1 ? 'storey' : 'storeys'}.</p>
            <label className="fe__wide">
              Foundation type
              <select value={state.inputs.foundationType} title={foundationTypeName(state.inputs.foundationType)} onChange={(e) => setInput('foundationType', Number(e.target.value) as 1 | 2 | 3)}>
                <option value={1}>Type 1 — {foundationTypeName(1)}</option>
                <option value={2}>Type 2 — {foundationTypeName(2)}</option>
                <option value={3}>Type 3 — {foundationTypeName(3)}</option>
              </select>
            </label>
          </div>
          <p>
            Parameter set {result?.parameterSetVersion ?? PARAMETER_TABLE.length + ' parameters'}. Overrides apply to this project only and are recorded in the change log.
          </p>
          <div className="fe__params-grid">
            {PARAMETER_TABLE.filter((p) => typeof p.value === 'number' || p.value === null).map((p) => (
              <label key={p.id} title={p.label}>
                <span>
                  P.{p.id} <small>{p.unit}</small>
                </span>
                <input
                  type="number"
                  placeholder={p.value == null ? 'project input' : String(p.value)}
                  value={state.inputs.parameterOverrides[p.id] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
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
            </div>
          </div>,
          document.body,
        )}

      {error && <p className="fe__error">{error}</p>}

      {!result ? (
        <p className="agents-chat__empty">
          Run the engine to read walls and rooms from the plan, build support lines and framing zones, classify walls, and quantify the chosen foundation type with ACI minimum reinforcement. Nothing is priced; unknown inputs stop the run instead of becoming zero.
        </p>
      ) : (
        <div className="fe__body">
          <div className="fe__plan">
            <div className="fe__plan-bar">
              <span className="fe__legend">
                <i style={{ background: CLASS_COLOUR.LB }} /> LB <i style={{ background: CLASS_COLOUR.SHEAR }} /> Shear <i style={{ background: CLASS_COLOUR.NLB }} /> NLB
                <i style={{ background: STATUS_COLOUR.auto }} /> auto <i style={{ background: STATUS_COLOUR['tie-break'] }} /> tie-break <i style={{ background: STATUS_COLOUR.flagged }} /> stop
              </span>
              <label className="fe__check">
                <input type="checkbox" checked={showFoundation} onChange={(e) => setShowFoundation(e.target.checked)} /> Foundation plan
              </label>
            </div>
            <PlanOverlay result={result} overrides={state.overrides} selected={selected} onSelect={setSelected} showFoundation={showFoundation} />
            <PlanRevisionChat
              projectId={projectId}
              context={() => describePlan(stateRef.current)}
              onRevise={async (patch) => {
                const applied = applyPlanRevision(stateRef.current, patch, user)
                if ('error' in applied) return applied
                setBusy(true)
                setError(null)
                try {
                  const outcome = await runEngineForProject(applied.state)
                  const next = { ...applied.state, result: outcome.result }
                  dirtyRef.current = false
                  setState(next)
                  const drawn = outcome.result
                  const xs = drawn.footprint.polygon.map((p) => p.x)
                  const ys = drawn.footprint.polygon.map((p) => p.y)
                  return {
                    applied: applied.summary,
                    sheet: `${drawn.level.drawingNo ?? 'plan'} p${drawn.level.sourcePage}`,
                    scale: drawn.scale.label,
                    areaM2: Math.round(drawn.footprint.areaM2 * 100) / 100,
                    widthM: Math.round((Math.max(...xs) - Math.min(...xs)) / 10) / 100,
                    depthM: Math.round((Math.max(...ys) - Math.min(...ys)) / 10) / 100,
                    foundationType: drawn.foundationType,
                    walls: drawn.walls.length,
                    zones: drawn.zones.length,
                    beams: next.overrides.beams.map((beam) => `${beam.id} ${beam.axis}=${beam.pos}`),
                    flags: drawn.flags.map((flag) => `${flag.code}: ${flag.message}`),
                    note: 'The plan drawing has been redrawn from this run.',
                  }
                } catch (e) {
                  return { error: e instanceof Error ? e.message : 'The plan could not be redrawn.' }
                } finally {
                  setBusy(false)
                }
              }}
            />
            <div className="fe__gate">
              <div>
                <b>{result.gateOpen ? 'Review gate approved' : result.blocked ? 'Review gate blocked' : 'Review gate open'}</b>
                <small>
                  {result.blocked
                    ? `${stopFlags.length} stop flag${stopFlags.length > 1 ? 's' : ''} must be resolved (RG-03).`
                    : state.overrides.approvedBy
                      ? `Approved by ${state.overrides.approvedBy} on ${new Date(state.overrides.approvedAt ?? '').toLocaleString()}.`
                      : 'Check the overlay, flip or set zones, mark walls, then approve. Quantities stay provisional until then.'}
                </small>
              </div>
              <div className="agents-chat__actions">
                {(Object.keys(state.overrides.directions).length > 0 || state.overrides.promotedWallIds.length > 0 || state.overrides.beams.length > 0 || Object.keys(state.overrides.wallClasses).length > 0) && (
                  <button type="button" className="os-btn" onClick={resetOverrides}>
                    <RotateCcw size={14} /> Clear edits
                  </button>
                )}
                {state.overrides.approvedBy ? null : (
                  <button type="button" className="os-btn os-btn--primary" disabled={result.blocked || stale} onClick={() => void approve()}>
                    <CheckCircle2 size={14} /> Approve
                  </button>
                )}
              </div>
            </div>
            {selectedZone && <ZoneCard zone={selectedZone} result={result} override={state.overrides.directions[selectedZone.id]} onSet={(d) => setDirection(selectedZone, d)} />}
            {selectedWall && (
              <WallCard wall={selectedWall} result={result} override={state.overrides.wallClasses[selectedWall.id]} promoted={state.overrides.promotedWallIds.includes(selectedWall.id)} onClass={(c) => setWallClass(selectedWall, c)} onPromote={() => togglePromote(selectedWall)} />
            )}
            <div className="fe__beam">
              <b>Add beam (support line)</b>
              <select value={beamDraft.axis} onChange={(e) => setBeamDraft({ ...beamDraft, axis: e.target.value as 'h' | 'v' })}>
                <option value="h">along x (y = …)</option>
                <option value="v">along y (x = …)</option>
              </select>
              <input type="number" placeholder={beamDraft.axis === 'h' ? 'y mm' : 'x mm'} value={beamDraft.pos} onChange={(e) => setBeamDraft({ ...beamDraft, pos: e.target.value })} />
              <input type="number" placeholder="from mm" value={beamDraft.a} onChange={(e) => setBeamDraft({ ...beamDraft, a: e.target.value })} />
              <input type="number" placeholder="to mm" value={beamDraft.b} onChange={(e) => setBeamDraft({ ...beamDraft, b: e.target.value })} />
              <button type="button" className="os-btn" onClick={addBeam}>
                Add
              </button>
              {state.overrides.beams.map((b) => (
                <span key={b.id} className="fe__chip">
                  {b.id} {b.axis === 'h' ? 'y' : 'x'}={b.pos} {b.a}–{b.b}
                  <button type="button" onClick={() => removeBeam(b.id)} aria-label={`Remove ${b.id}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="fe__side">
            <nav className="fe__tabs">
              {(
                [
                  ['flags', `Flags ${result.flags.length}`],
                  ['walls', `Walls ${result.walls.length}`],
                  ['boq', `BOQ ${result.boq.length}`],
                  ['rebar', 'Rebar'],
                  ['checks', `Checks ${result.checks.length}`],
                  ['log', `Log ${state.overrides.changeLog.length}`],
                ] as Array<[Tab, string]>
              ).map(([id, label]) => (
                <button key={id} type="button" className={clsx(tab === id && 'is-on')} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="fe__tab">
              {tab === 'flags' && <FlagsTab result={result} stop={stopFlags} warn={warnFlags} />}
              {tab === 'walls' && <WallsTab result={result} onSelect={(id) => setSelected({ kind: 'wall', id })} />}
              {tab === 'boq' && <BoqTab result={result} approver={state.overrides.approvedBy} projectName={projectName || projectId} />}
              {tab === 'rebar' && <RebarTab result={result} />}
              {tab === 'checks' && <ChecksTab result={result} />}
              {tab === 'log' && <LogTab state={state} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ——— overlay ———

function PlanOverlay({ result, overrides, selected, onSelect, showFoundation }: { result: EngineResult; overrides: EngineState['overrides']; selected: { kind: 'zone' | 'wall'; id: string } | null; onSelect: (s: { kind: 'zone' | 'wall'; id: string } | null) => void; showFoundation: boolean }) {
  const poly = result.footprint.polygon
  const box = useMemo(() => {
    const xs = poly.map((p) => p.x)
    const ys = poly.map((p) => p.y)
    const pad = 1500
    return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad, x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad }
  }, [poly])
  if (!poly.length) return <p className="fe__error">No footprint was traced; nothing to draw.</p>
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const classOf = (id: string) => overrides.wallClasses[id] ?? result.wallClasses.find((c) => c.wallId === id)?.class ?? 'NLB'
  const stroke = Math.max(40, w / 900)
  return (
    <svg className="fe__svg" viewBox={`${box.x0} ${box.y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" onClick={() => onSelect(null)}>
      <polygon points={poly.map((p) => `${p.x},${p.y}`).join(' ')} fill="#f8fafc" stroke="#334155" strokeWidth={stroke} />
      {showFoundation &&
        result.elements.map((el) =>
          el.rects.map((r, i) => (
            <rect key={`${el.id}-${i}`} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={el.type === 'pad' ? 'rgba(220,38,38,0.55)' : el.type === 'column' ? '#EA580C' : el.type === 'slab' ? 'none' : 'rgba(234,88,12,0.42)'} stroke={el.type === 'slab' ? 'none' : '#C2410C'} strokeWidth={stroke}>
              <title>
                {el.id} · {el.type} · {Object.entries(el.section).map(([k, v]) => `${k} ${v}`).join(', ')}
              </title>
            </rect>
          )),
        )}
      {result.zones.map((z) => {
        const d = result.decisions.find((x) => x.zoneId === z.id)
        const status = d?.status ?? 'none'
        const dir = overrides.directions[z.id] ?? d?.direction
        const cx = (z.bbox.x0 + z.bbox.x1) / 2
        const cy = (z.bbox.y0 + z.bbox.y1) / 2
        const len = Math.min(z.Lx, z.Ly) * 0.35
        const isSel = selected?.kind === 'zone' && selected.id === z.id
        return (
          <g
            key={z.id}
            className="fe__zone"
            onClick={(e) => {
              e.stopPropagation()
              onSelect({ kind: 'zone', id: z.id })
            }}
          >
            <rect x={z.bbox.x0} y={z.bbox.y0} width={z.Lx} height={z.Ly} fill={STATUS_COLOUR[status]} fillOpacity={isSel ? 0.5 : 0.32} stroke={STATUS_COLOUR[status]} strokeWidth={isSel ? stroke * 2.2 : stroke * 1.3} strokeDasharray={status === 'none' ? `${stroke * 3} ${stroke * 3}` : undefined} />
            {dir && (
              <g stroke={STATUS_COLOUR[status]} strokeWidth={stroke} fill="none">
                {dir === 'x' ? (
                  <>
                    <line x1={cx - len} y1={cy} x2={cx + len} y2={cy} />
                    <polyline points={`${cx + len - stroke * 3},${cy - stroke * 3} ${cx + len},${cy} ${cx + len - stroke * 3},${cy + stroke * 3}`} />
                    <polyline points={`${cx - len + stroke * 3},${cy - stroke * 3} ${cx - len},${cy} ${cx - len + stroke * 3},${cy + stroke * 3}`} />
                  </>
                ) : (
                  <>
                    <line x1={cx} y1={cy - len} x2={cx} y2={cy + len} />
                    <polyline points={`${cx - stroke * 3},${cy + len - stroke * 3} ${cx},${cy + len} ${cx + stroke * 3},${cy + len - stroke * 3}`} />
                    <polyline points={`${cx - stroke * 3},${cy - len + stroke * 3} ${cx},${cy - len} ${cx + stroke * 3},${cy - len + stroke * 3}`} />
                  </>
                )}
              </g>
            )}
            <text x={cx} y={cy + (dir === 'x' ? stroke * 8 : 0)} textAnchor="middle" fontSize={Math.max(250, w / 60)} fill="#1c2430">
              {d?.spanMm ? `${(d.spanMm / 1000).toFixed(2)} m` : status === 'flagged' ? 'F-SPAN' : status === 'none' ? '' : ''}
            </text>
          </g>
        )
      })}
      {result.walls.map((wl) => {
        const cls = classOf(wl.id)
        const isSel = selected?.kind === 'wall' && selected.id === wl.id
        const t = Math.max(wl.thickness, stroke * 1.5)
        const x = wl.axis === 'h' ? wl.a : wl.pos - t / 2
        const y = wl.axis === 'h' ? wl.pos - t / 2 : wl.a
        return (
          <rect
            key={wl.id}
            className="fe__wall"
            x={x}
            y={y}
            width={wl.axis === 'h' ? wl.length : t}
            height={wl.axis === 'h' ? t : wl.length}
            fill={CLASS_COLOUR[cls]}
            stroke={isSel ? '#111827' : overrides.promotedWallIds.includes(wl.id) ? '#EA580C' : 'none'}
            strokeWidth={stroke}
            onClick={(e) => {
              e.stopPropagation()
              onSelect({ kind: 'wall', id: wl.id })
            }}
          >
            <title>
              {wl.id} · {cls} · {wl.thickness} mm · {(wl.length / 1000).toFixed(2)} m · openings {wl.openings.length}
            </title>
          </rect>
        )
      })}
      {overrides.beams.map((b) => (
        <line key={b.id} x1={b.axis === 'h' ? b.a : b.pos} y1={b.axis === 'h' ? b.pos : b.a} x2={b.axis === 'h' ? b.b : b.pos} y2={b.axis === 'h' ? b.pos : b.b} stroke="#EA580C" strokeWidth={stroke * 3} strokeDasharray={`${stroke * 4} ${stroke * 2}`} />
      ))}
      {result.rooms.map((r) => (
        <text key={r.id} x={(r.bbox.x0 + r.bbox.x1) / 2} y={r.bbox.y0 + Math.max(300, w / 60) * 1.4} textAnchor="middle" fontSize={Math.max(220, w / 80)} fill="#64748b">
          {r.label === 'UNLABELLED' ? '' : r.label}
        </text>
      ))}
    </svg>
  )
}

// ——— cards ———

function ZoneCard({ zone, result, override, onSet }: { zone: FramingZone; result: EngineResult; override?: 'x' | 'y'; onSet: (d: 'x' | 'y' | null) => void }) {
  const d = result.decisions.find((x) => x.zoneId === zone.id)
  return (
    <div className="fe__card">
      <header>
        <b>
          Zone {(zone.Lx / 1000).toFixed(2)} × {(zone.Ly / 1000).toFixed(2)} m
        </b>
        <span>
          case {d?.case ?? '—'} · {d?.status ?? '—'} · {d?.ruleIds.join(', ')}
        </span>
      </header>
      <p>{d?.note}</p>
      {d?.scoreBreakdown.length ? (
        <table className="fe__table">
          <thead>
            <tr>
              <th>Criterion</th>
              {d.scoreBreakdown.map((s) => (
                <th key={s.direction}>{s.direction}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.scoreBreakdown[0].parts.map((p, i) => (
              <tr key={p.criterion}>
                <td>
                  {p.criterion} <small>w{p.weight}</small>
                </td>
                {d.scoreBreakdown.map((s) => (
                  <td key={s.direction}>{s.parts[i].points}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>
                <b>Total</b>
              </td>
              {d.scoreBreakdown.map((s) => (
                <td key={s.direction}>
                  <b>{s.total}</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}
      <p>
        Receiving walls: {d?.receivingWallIds.length ? d.receivingWallIds.join(', ') : 'none'}
        {zone.voidIds.length ? ` · voids: ${zone.voidIds.join(', ')}` : ''}
      </p>
      <div className="agents-chat__actions">
        <button type="button" className={clsx('os-btn', (override ?? d?.direction) === 'x' && 'is-on')} onClick={() => onSet('x')}>
          Joists along x
        </button>
        <button type="button" className={clsx('os-btn', (override ?? d?.direction) === 'y' && 'is-on')} onClick={() => onSet('y')}>
          Joists along y
        </button>
        {override && (
          <button type="button" className="os-btn" onClick={() => onSet(null)}>
            Back to auto
          </button>
        )}
      </div>
    </div>
  )
}

function WallCard({ wall, result, override, promoted, onClass, onPromote }: { wall: Wall; result: EngineResult; override?: 'LB' | 'NLB'; promoted: boolean; onClass: (c: 'LB' | 'NLB' | null) => void; onPromote: () => void }) {
  const c = result.wallClasses.find((x) => x.wallId === wall.id)
  return (
    <div className="fe__card">
      <header>
        <b>
          {wall.id} · {override ?? c?.class} {override ? '(engineer)' : ''}
        </b>
        <span>
          {wall.isExternal ? 'external' : 'internal'} · {wall.thickness} mm · {(wall.length / 1000).toFixed(2)} m · openings {wall.openings.map((o) => `${o.type} ${o.width}`).join(', ') || 'none'} · ratio {wall.openingRatio}
        </span>
      </header>
      <p>
        {c?.reason} <small>[{c?.reasonRuleIds.join(', ')}]</small> · read at page pt {wall.axis === 'h' ? 'y' : 'x'}={wall.source.pagePt.pos}, {wall.source.pagePt.a}–{wall.source.pagePt.b} (face gap {wall.source.faceGapPt} pt)
      </p>
      <div className="agents-chat__actions">
        <button type="button" className={clsx('os-btn', override === 'LB' && 'is-on')} onClick={() => onClass('LB')}>
          Load-bearing
        </button>
        <button type="button" className={clsx('os-btn', override === 'NLB' && 'is-on')} onClick={() => onClass('NLB')}>
          Non-load-bearing
        </button>
        {override && (
          <button type="button" className="os-btn" onClick={() => onClass(null)}>
            Back to auto
          </button>
        )}
        {!wall.isExternal && (
          <button type="button" className={clsx('os-btn', promoted && 'is-on')} onClick={onPromote}>
            {promoted ? 'Support line ✓' : 'Promote to support line'}
          </button>
        )}
      </div>
    </div>
  )
}

// ——— tabs ———

function FlagsTab({ result, stop, warn }: { result: EngineResult; stop: EngineResult['flags']; warn: EngineResult['flags'] }) {
  if (!result.flags.length) return <p className="fe__muted">No flags.</p>
  return (
    <ul className="fe__flags">
      {[...stop, ...warn].map((f, i) => (
        <li key={`${f.code}-${i}`} className={clsx(f.severity === 'stop' ? 'is-stop' : 'is-warn')}>
          <b>
            {f.code} <small>{f.rule}</small>
          </b>
          {settingsFieldFor(f.message) ? (
            <button type="button" className="settings-jump" onClick={() => openSettings(settingsFieldFor(f.message))}>
              {f.message}
            </button>
          ) : (
            <span>{f.message}</span>
          )}
          <em>{f.action}</em>
        </li>
      ))}
    </ul>
  )
}

function WallsTab({ result, onSelect }: { result: EngineResult; onSelect: (id: string) => void }) {
  return (
    <table className="fe__table">
      <thead>
        <tr>
          <th>Wall</th>
          <th>t</th>
          <th>L (m)</th>
          <th>Open.</th>
          <th>Class</th>
          <th>Rule</th>
        </tr>
      </thead>
      <tbody>
        {result.walls.map((w) => {
          const c = result.wallClasses.find((x) => x.wallId === w.id)
          return (
            <tr key={w.id} onClick={() => onSelect(w.id)} className="is-click">
              <td>
                {w.axis}
                {w.isExternal ? ' ext' : ' int'} @{w.pos}
              </td>
              <td>{w.thickness}</td>
              <td>{(w.length / 1000).toFixed(2)}</td>
              <td>{w.openingRatio ? `${Math.round(w.openingRatio * 100)} %` : '—'}</td>
              <td style={{ color: CLASS_COLOUR[c?.class ?? 'NLB'] }}>{c?.class}</td>
              <td>{c?.reasonRuleIds.join(' ')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function BoqTab({ result, approver, projectName }: { result: EngineResult; approver: string | null; projectName: string }) {
  const rows = roundedBoq(result)
  if (!rows.length) return <p className="fe__muted">No quantities: a stop flag or a missing input blocks the BOQ (QA-05, QA-14). Nothing is reported as zero.</p>
  const sections = [...new Set(rows.map((r) => r.section))]
  return (
    <div>
      <p className="fe__muted">
        {projectName} · Type {result.foundationType} {foundationTypeName(result.foundationType)} · band {result.band} · {result.parameterSetVersion} · {result.ranAt.slice(0, 10)} · approver {approver ?? '—'}
        {!result.gateOpen && ' · PROVISIONAL (gate not approved)'}
      </p>
      {sections.map((section) => (
        <table key={section} className="fe__table fe__table--boq">
          <thead>
            <tr>
              <th colSpan={4}>{section}</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.section === section)
              .map((r) => (
                <tr key={r.id} title={r.basis}>
                  <td>{r.boqCode}</td>
                  <td>
                    {r.description}
                    <small>
                      {r.basis} · {r.ruleIds.join(' ')}
                    </small>
                  </td>
                  <td className="is-num">
                    {r.netQty.toLocaleString()}
                    {r.wastePct ? <small>+{r.wastePct} % = {r.grossQty.toLocaleString()}</small> : null}
                  </td>
                  <td>{r.unit === 'm3' ? 'm³' : r.unit === 'm2' ? 'm²' : r.unit}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}
      <p className="fe__muted">
        Totals: concrete {result.summary.concreteM3 ?? 0} m³ · rebar {result.summary.rebarKg ?? 0} kg · excavation {result.summary.excavationM3 ?? 0} m³ · formwork {result.summary.formworkM2 ?? 0} m²
      </p>
    </div>
  )
}

function RebarTab({ result }: { result: EngineResult }) {
  if (!result.rebar.length) return <p className="fe__muted">No reinforcement yet.</p>
  const byDia = new Map<number, number>()
  for (const r of result.rebar) byDia.set(r.barDia, (byDia.get(r.barDia) ?? 0) + r.totalKg)
  return (
    <div>
      <table className="fe__table">
        <thead>
          <tr>
            <th>Element</th>
            <th>Arrangement</th>
            <th>Bar</th>
            <th>kg</th>
            <th>per</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {result.rebar.map((r, i) => (
            <tr key={i}>
              <td>{r.elementType}</td>
              <td>{r.role}</td>
              <td>
                T{r.barDia}
                {r.spacingMm ? ` @${r.spacingMm}` : ''} · {r.lengthEachMm} mm
              </td>
              <td className="is-num">{Math.round(r.totalKg).toLocaleString()}</td>
              <td>
                {r.kgPerUnit} kg/{r.perUnit}
              </td>
              <td>{r.ruleIds.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fe__muted">By diameter (BQ-02): {[...byDia.entries()].sort((a, b) => a[0] - b[0]).map(([d, kg]) => `T${d} ${Math.round(kg).toLocaleString()} kg`).join(' · ')}</p>
    </div>
  )
}

function ChecksTab({ result }: { result: EngineResult }) {
  if (!result.checks.length) return <p className="fe__muted">No checks ran (the BOQ is blocked).</p>
  return (
    <ul className="fe__checks">
      {result.checks.map((c) => (
        <li key={c.id} className={c.ok ? 'is-ok' : 'is-bad'}>
          <b>{c.id}</b>
          <span>{c.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function LogTab({ state }: { state: EngineState }) {
  if (!state.overrides.changeLog.length) return <p className="fe__muted">No engineer changes yet (RG-04).</p>
  return (
    <ul className="fe__log">
      {[...state.overrides.changeLog].reverse().map((e, i) => (
        <li key={i}>
          <small>
            {new Date(e.at).toLocaleString()} · {e.user}
          </small>
          <span>
            {e.entity}: {e.from} → {e.to}
          </span>
        </li>
      ))}
    </ul>
  )
}
