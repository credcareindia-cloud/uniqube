import { useEffect, useMemo, useRef, useState } from 'react'
import { loadEngineState } from '../lib/foundation/run'
import { loadSuperState } from '../lib/superstructure/run'
import type { EngineResult } from '../lib/foundation/types'
import type { SuperState } from '../lib/superstructure/run'
import { architectureBlocked, runArchitecture } from '../lib/architecture/engine'
import { loadArchState, saveArchState } from '../lib/architecture/run'
import type { ArchLine, ArchParapet, ArchSettings, ArchSource, ArchState } from '../lib/architecture/types'
import { useAppStore } from '../store'
import { openSettings, settingsFieldFor } from '../lib/settingsDialog'
import { readSession } from './OsChrome'
import { ArchitecturePlan } from './ArchitecturePlan'

type Tab = 'openings' | 'finishes' | 'bill'

function sourceFrom(foundation: EngineResult | null, approved: boolean, structure: SuperState | null): ArchSource {
  const resultLevels = structure?.result?.levels ?? []
  const levels = resultLevels.length
    ? resultLevels.map((level) => ({
        id: level.levelId,
        name: level.name,
        heightMm: level.heightMm,
        isRoof: Boolean(level.roof),
      }))
    : (structure?.inputs.levels ?? []).map((level) => ({
        id: level.id,
        name: level.name,
        heightMm: level.ffhMm,
        isRoof: level.framingType === 'pitched_roof' || level.framingType === 'flat_roof_truss' || level.framingType === 'flat_roof_c_joist',
      }))
  return {
    foundationReady: Boolean(foundation),
    foundationApproved: approved,
    footprintM2: foundation?.footprint.areaM2 ?? 0,
    footprint: foundation?.footprint.polygon ?? [],
    walls: (foundation?.walls ?? []).map((wall) => ({
      id: wall.id,
      external: wall.isExternal,
      lengthMm: wall.length,
      axis: wall.axis,
      pos: wall.pos,
      a: wall.a,
      b: wall.b,
      thickness: wall.thickness,
      openings: wall.openings.map((opening) => ({
        id: opening.id,
        type: opening.type,
        widthMm: opening.width,
        position: opening.position,
      })),
    })),
    rooms: (foundation?.rooms ?? []).map((room) => ({
      id: room.id,
      label: room.label,
      category: room.category,
      areaM2: room.areaM2,
      bbox: room.bbox,
    })),
    levels,
    parapet: parapetFrom(structure),
  }
}

function parapetFrom(structure: SuperState | null): ArchParapet | null {
  const rows = structure?.result?.levels.map((level) => level.parapet).filter((item) => item && item.heightMm > 0) ?? []
  if (!rows.length) return null
  const lengthMm = rows.reduce((sum, item) => sum + item!.runs.reduce((runSum, run) => runSum + run.lengthMm, 0), 0)
  const heightMm = rows[0]!.heightMm
  if (lengthMm <= 0) return null
  return { lengthMm, heightMm }
}

function unitText(unit: ArchLine['unit']) {
  if (unit === 'm2') return 'm²'
  if (unit === 'm') return 'm'
  return 'nr'
}

const BUILD_UPS: Array<{ title: string; layers: Array<{ name: string; thick: string; colour: string }> }> = [
  {
    title: 'External wall',
    layers: [
      { name: '12 mm cement board', thick: '12', colour: '#d6d3d1' },
      { name: 'Vapour barrier', thick: '—', colour: '#fdaa48' },
      { name: '150 mm rockwool', thick: '150', colour: '#fde68a' },
      { name: '12.5 mm gypsum FR', thick: '12.5', colour: '#f8fafc' },
      { name: '15 mm gypsum FR', thick: '15', colour: '#e2e8f0' },
    ],
  },
  {
    title: 'Partition',
    layers: [
      { name: '15 mm gypsum FR', thick: '15', colour: '#e2e8f0' },
      { name: '150 mm rockwool', thick: '150', colour: '#fde68a' },
      { name: '15 mm gypsum FR', thick: '15', colour: '#e2e8f0' },
    ],
  },
  {
    title: 'Wet-room wall',
    layers: [
      { name: '12 mm gypsum MR', thick: '12', colour: '#ccfbf1' },
      { name: '12 mm cement board', thick: '12', colour: '#d6d3d1' },
      { name: '150 mm rockwool', thick: '150', colour: '#fde68a' },
      { name: '15 mm gypsum FR', thick: '15', colour: '#e2e8f0' },
    ],
  },
]

export function ArchitecturePanel({ projectId }: { projectId: string }) {
  const [state, setState] = useState<ArchState | null>(null)
  const [source, setSource] = useState<ArchSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('openings')
  const hydrated = useRef(false)
  const user = readSession()?.name ?? 'engineer'

  useEffect(() => {
    let alive = true
    hydrated.current = false
    setState(null)
    Promise.all([loadEngineState(projectId), loadSuperState(projectId, 1)])
      .then(async ([engine, structure]) => {
        if (!alive) return
        const nextSource = sourceFrom(engine.result, Boolean(engine.overrides.approvedBy), structure)
        const loaded = await loadArchState(projectId, nextSource)
        if (!alive) return
        setSource(nextSource)
        setState(loaded)
        hydrated.current = true
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(err instanceof Error ? err.message : 'The architectural quantities could not be opened.')
      })
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!hydrated.current || !state) return
    const handle = window.setTimeout(() => {
      void saveArchState(projectId, state).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The architectural quantities could not be saved.')
      })
    }, 400)
    return () => window.clearTimeout(handle)
  }, [projectId, state])

  const result = useMemo(() => (state && source ? runArchitecture(source, state.settings) : state?.result ?? null), [source, state])

  const jobInputs = useAppStore((s) => s.projectContext.jobInputs)

  const edit = (settings: Partial<ArchSettings>) => {
    setState((current) => {
      if (!current || !source) return current
      const next = { ...current.settings, ...settings }
      return { ...current, settings: next, overrides: { approvedBy: null, approvedAt: null }, result: runArchitecture(source, next) }
    })
  }

  useEffect(() => {
    if (!jobInputs || !state || !source) return
    const doorHeightMm = jobInputs.doorHeightMm ?? state.settings.doorHeightMm
    const windowHeightMm = jobInputs.windowHeightMm ?? state.settings.windowHeightMm
    if (state.settings.doorHeightMm === doorHeightMm && state.settings.windowHeightMm === windowHeightMm) return
    edit({ doorHeightMm, windowHeightMm })
  }, [jobInputs, source, state])

  const approve = () => {
    if (!state || !result || architectureBlocked(result)) return
    setState({ ...state, result, overrides: { approvedBy: user, approvedAt: new Date().toISOString() } })
  }

  if (!state || !result || !source) return <p className="doc-page__note">Opening the architectural quantities…</p>

  const approved = state.overrides.approvedBy
  const reds = result.flags.filter((flag) => flag.level === 'red')
  const openings = result.lines.filter((line) => line.group === 'openings')
  const finishes = result.lines.filter((line) => line.group === 'finishes')
  const measured = result.lines.filter((line) => line.group === 'measured')
  const shown = tab === 'openings' ? openings : tab === 'finishes' ? finishes : result.lines

  return (
    <div className="fe">
      <header className="agents-chat__head mep__head">
        <div>
          <h2>Architecture quantities</h2>
          <span>Walls, openings, rooms and the wall build-up from the sub structure plan. Hover a mark for its annotation.</span>
        </div>
        <div className="mep__actions">
          {approved ? (
            <span className="fe__approved">Approved by {approved}</span>
          ) : (
            <button type="button" className="os-btn os-btn--primary" disabled={reds.length > 0} onClick={approve}>
              Approve architecture
            </button>
          )}
        </div>
      </header>
      {error ? <p className="projects__error">{error}</p> : null}
      <div className="fe__body">
        <div className="fe__plan">
          <ArchitecturePlan source={source} doorHeightMm={state.settings.doorHeightMm} windowHeightMm={state.settings.windowHeightMm} />
          <p className="fe__muted">
            {source.walls.length} walls · {source.rooms.length} rooms · {result.summary.doors} doors · {result.summary.windows} windows
            {result.summary.occupiedM2 != null ? ` · ${result.summary.occupiedM2} m² occupied` : ''}
            {result.summary.wetM2 != null ? ` · ${result.summary.wetM2} m² wet` : ''}
          </p>
        </div>
        <div className="fe__side">
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
          <p className="fe__muted">Door height, window height and the other shared values are set in Settings.</p>
          <div className="fe__tabs">
            {(['openings', 'finishes', 'bill'] as Tab[]).map((item) => (
              <button key={item} type="button" className={tab === item ? 'is-on' : ''} onClick={() => setTab(item)}>
                {item === 'bill' ? 'Bill' : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          {tab === 'finishes' ? (
            <div className="arch__builds">
              {BUILD_UPS.map((build) => (
                <figure key={build.title}>
                  <figcaption>{build.title}</figcaption>
                  <ol>
                    {build.layers.map((layer) => (
                      <li key={layer.name}>
                        <i style={{ background: layer.colour }} />
                        <span>{layer.name}</span>
                        <small>{layer.thick === '—' ? '' : `${layer.thick} mm`}</small>
                      </li>
                    ))}
                  </ol>
                </figure>
              ))}
            </div>
          ) : null}
          <table className="fe__table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className="is-num">Qty</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    {tab === 'openings'
                      ? 'No doors or windows on this plan yet.'
                      : tab === 'finishes'
                        ? 'Finish layers appear after the wall and floor areas are measured.'
                        : 'Nothing is measured until the foundation plan and the floor heights are in.'}
                  </td>
                </tr>
              ) : (
                shown.map((item) => (
                  <tr key={item.code}>
                    <td>
                      {item.code}
                      <small>{item.basis}</small>
                    </td>
                    <td>{item.description}</td>
                    <td className="is-num">
                      {item.qty} {unitText(item.unit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {tab === 'bill' && measured.length ? (
            <p className="fe__muted">Measured areas stay on the bill. Finish layers are the UNIQUBE wall and ceiling build-up on those areas.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
