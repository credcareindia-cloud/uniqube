import { useAppStore } from '../store'
import { apiJson } from './api'
import { architectureBlocked, runArchitecture } from './architecture/engine'
import { loadArchState, saveArchState } from './architecture/run'
import type { ArchSource, ArchState } from './architecture/types'
import { collectSources, loadDryCost, mergeDryCost, sheetTotal } from './dryCost'
import { roundedBoq } from './foundation/engine'
import { loadEngineState, runEngineForProject, saveEngineState, type EngineState } from './foundation/run'
import { mepBlocked, runMep } from './mep/engine'
import { mepFromPlan, mergePlanTrades } from './mep/fromPlan'
import { loadMepState, saveMepState } from './mep/run'
import { syncMeasuredLabour, syncMeasuredSteel } from './measured'
import type { MepState } from './mep/types'
import { loadSuperState, resizeLevels, runSuper, saveSuperState, type SuperState } from './superstructure/run'
import type { HrsDecision, SuperResult } from './superstructure/types'

const TYPICAL_HRS: Pick<HrsDecision, 'section' | 'kgPerM'> = { section: 'UB 305x165x40', kgPerM: 40 }

function openHrs(result: SuperResult | null) {
  return (result?.hrsMarkups ?? []).filter((row) => row.status === 'suggested' || (row.status === 'accepted' && (row.section == null || row.kgPerM == null)))
}

function structureChoice(result: SuperResult | null): RunChoice | null {
  const open = openHrs(result)
  if (!open.length) return null
  const first = open[0]
  const count = open.length
  return {
    id: 'hrs-typical',
    title: count === 1 ? `${first.memberType} needed` : `${count} steel markups needed`,
    detail: `${first.trigger}: accept typical ${TYPICAL_HRS.section} at ${TYPICAL_HRS.kgPerM} kg/m so the span flag can clear.`,
    acceptLabel: count === 1 ? `Accept ${TYPICAL_HRS.section}` : `Accept typical beams (${count})`,
  }
}

export const RUN_STAGES = ['documents', 'settings', 'foundation', 'structure', 'architecture', 'mep', 'done'] as const
export type RunStage = (typeof RUN_STAGES)[number]

export const RUN_LABELS: Record<RunStage, string> = {
  documents: 'Documents',
  settings: 'Settings',
  foundation: 'Sub structure',
  structure: 'Super structure',
  architecture: 'Architecture',
  mep: 'MEP',
  done: 'Result',
}

export interface MissingField {
  id: string
  label: string
  suffix?: string
  kind: 'text' | 'number'
  value: string
  hint: string
  example?: string
}

export interface RunFlag {
  id: string
  level: 'red' | 'amber'
  text: string
}

export interface RunChoice {
  id: string
  title: string
  detail: string
  acceptLabel: string
}

export interface StageSnapshot {
  stage: RunStage
  ready: boolean
  approved: boolean
  summary: string
  missing: MissingField[]
  flags: RunFlag[]
  lines: Array<{ code: string; text: string; qty: string }>
  choice: RunChoice | null
}

export interface RunTotals {
  foundationType: string
  foundationLines: number
  lgsKg: number | null
  occupiedM2: number | null
  doors: number
  windows: number
  mepLines: number
  dryMaterial: number
  dryLabour: number
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const QUOTE_WINDOW_MS = 5 * 60 * 1000

export function formatPreciseClock(ms: number) {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const hundredths = Math.floor((total % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

function job() {
  return useAppStore.getState().projectContext.jobInputs
}

function floors() {
  return useAppStore.getState().projectContext.floors.filter((floor) => floor.level >= 0)
}

const HINTS: Record<string, { hint: string; example?: string }> = {
  client: { hint: 'Who is this quotation for?', example: 'Zuha Admin' },
  location: { hint: 'City or plot', example: 'Hamriyah, Sharjah' },
  storeys: { hint: 'Floors above ground', example: '2' },
  doorHeight: { hint: 'Typical leaf height', example: '2100' },
  windowHeight: { hint: 'Typical light height', example: '1200' },
  plinth: { hint: 'Plinth above NGL', example: '450' },
  soil: { hint: 'Bearing pressure if there is no report', example: '150' },
  lineLoad: { hint: 'Line load per storey', example: '40' },
  cooling: { hint: 'Cooling load to start from', example: '180' },
  ffh: { hint: 'Floor to floor, from the sections', example: '3200' },
}

function field(id: string, label: string, value: string | number | null | undefined, kind: MissingField['kind'] = 'number', suffix?: string): MissingField {
  const copy = HINTS[id]
  return {
    id,
    label,
    suffix,
    kind,
    value: value == null || value === '' ? '' : String(value),
    hint: copy?.hint ?? 'Fill this, then we move.',
    example: copy?.example,
  }
}

export async function inspectStage(projectId: string, stage: RunStage): Promise<StageSnapshot> {
  if (stage === 'documents') {
    const documents = useAppStore.getState().documents
    const ready = documents.filter((doc) => doc.status === 'ready')
    const reading = documents.filter((doc) => doc.status === 'analyzing' || doc.status === 'idle')
    return {
      stage,
      ready: ready.length > 0,
      approved: ready.length > 0,
      summary: ready.length ? `${ready.length} drawing${ready.length === 1 ? '' : 's'} ready` : reading.length ? 'The drawings are still being read.' : 'Add a PDF drawing before the engines can run.',
      missing: ready.length ? [] : [],
      flags: reading.length ? [{ id: 'docs-read', level: 'amber', text: `${reading.length} file${reading.length === 1 ? '' : 's'} still reading.` }] : [],
      lines: ready.map((doc) => ({ code: doc.category, text: doc.name, qty: `${doc.analysis?.pageCount ?? 1} p` })),
      choice: null,
    }
  }

  if (stage === 'settings') {
    const ctx = useAppStore.getState().projectContext
    const inputs = job()
    const storeys = floors().length
    const structure = await loadSuperState(projectId, Math.max(1, storeys || 1)).catch(() => null)
    const ffh =
      inputs?.floorToFloorMm ??
      structure?.inputs.levels.find((level) => (level.ffhMm ?? 0) > 0)?.ffhMm ??
      null
    const missing = [
      field('client', 'Client', ctx.client, 'text'),
      field('location', 'Location', ctx.location, 'text'),
      field('storeys', 'Number of levels', storeys || '', 'number'),
      field('doorHeight', 'Door height', inputs?.doorHeightMm, 'number', 'mm'),
      field('windowHeight', 'Window height', inputs?.windowHeightMm, 'number', 'mm'),
      field('plinth', 'Plinth above NGL', inputs?.plinthAboveNglMm, 'number', 'mm'),
      field('soil', 'Soil bearing', inputs?.soilBearingKpa, 'number', 'kPa'),
      field('lineLoad', 'Line load / storey', inputs?.lineLoadKnM, 'number', 'kN/m'),
      field('cooling', 'Cooling', inputs?.coolingWm2, 'number', 'W/m²'),
      field('ffh', 'Floor-to-floor height', ffh, 'number', 'mm'),
    ].filter((item) => item.value.trim() === '')
    return {
      stage,
      ready: missing.length === 0,
      approved: missing.length === 0,
      summary: missing.length ? `${missing.length} value${missing.length === 1 ? '' : 's'} still needed` : 'Project inputs are complete.',
      missing,
      flags: [],
      lines: [],
      choice: null,
    }
  }

  if (stage === 'foundation') {
    const state = await loadEngineState(projectId)
    const result = state.result
    const flags = (result?.flags ?? []).map((flag) => ({
      id: flag.code,
      level: flag.severity === 'stop' ? 'red' as const : 'amber' as const,
      text: flag.message,
    }))
    const rows = result ? roundedBoq(result) : []
    return {
      stage,
      ready: Boolean(result && !result.blocked),
      approved: Boolean(state.overrides.approvedBy),
      summary: result
        ? `Type ${result.foundationType} · ${rows.length} bill lines${state.overrides.approvedBy ? ` · approved by ${state.overrides.approvedBy}` : ''}`
        : 'The sub structure has not been run yet.',
      missing: [],
      flags,
      lines: rows.slice(0, 8).map((row) => ({ code: row.boqCode, text: row.description, qty: `${row.grossQty} ${row.unit}` })),
      choice: null,
    }
  }

  if (stage === 'structure') {
    const engine = await loadEngineState(projectId)
    const state = await loadSuperState(projectId, engine.inputs.storeyCount)
    const result = state.result
    const sharedHeight = job()?.floorToFloorMm
    const missingHeights = state.inputs.levels.filter((level) => !(level.ffhMm && level.ffhMm > 0))
    const needsHeight = missingHeights.length > 0 && !(sharedHeight && sharedHeight > 0)
    const flags = (result?.flags ?? []).map((flag) => ({
      id: flag.key,
      level: flag.severity === 'red' ? 'red' as const : 'amber' as const,
      text: flag.message,
    }))
    return {
      stage,
      ready: Boolean(result && !result.blocked),
      approved: Boolean(state.overrides.approvedBy),
      summary: result
        ? `Net ${Math.round(result.totals.netLgsKg).toLocaleString('en-US')} kg LGS${state.overrides.approvedBy ? ` · approved by ${state.overrides.approvedBy}` : ''}`
        : engine.result
          ? 'The super structure is ready to run from the plan.'
          : 'Run the sub structure first.',
      missing: needsHeight
        ? [field('ffh', 'Floor-to-floor height', null, 'number', 'mm')]
        : [],
      flags,
      lines: (result?.boq ?? []).filter((row) => row.qty != null && !row.group.startsWith('Totals') && row.group !== 'kg/m²').slice(0, 8).map((row) => ({
        code: row.code,
        text: row.description,
        qty: `${row.qty} ${row.unit}`,
      })),
      choice: needsHeight ? null : structureChoice(result),
    }
  }

  if (stage === 'architecture') {
    const source = await architectureSource(projectId)
    const state = await loadArchState(projectId, source)
    const result = state.result
    return {
      stage,
      ready: Boolean(result && !architectureBlocked(result)),
      approved: Boolean(state.overrides.approvedBy),
      summary: result
        ? `${result.summary.storeys} floors · ${result.summary.doors} doors · ${result.summary.windows} windows${state.overrides.approvedBy ? ` · approved by ${state.overrides.approvedBy}` : ''}`
        : 'Architecture will measure the approved plan.',
      missing: [],
      flags: (result?.flags ?? []).map((flag) => ({ id: flag.id, level: flag.level, text: flag.text })),
      lines: (result?.lines ?? []).slice(0, 8).map((row) => ({ code: row.code, text: row.description, qty: `${row.qty} ${row.unit}` })),
      choice: null,
    }
  }

  if (stage === 'mep') {
    const state = await loadMepState(projectId)
    const result = state.result ?? runMep(state.inputs)
    return {
      stage,
      ready: Boolean(result.boq.length && !mepBlocked(result)),
      approved: Boolean(state.overrides.approvedBy),
      summary: result.boq.length
        ? `${result.boq.length} MEP lines${state.overrides.approvedBy ? ` · approved by ${state.overrides.approvedBy}` : ''}`
        : 'MEP will count fixtures from the rooms.',
      missing: [],
      flags: result.flags.map((flag) => ({ id: flag.id, level: flag.level, text: flag.text })),
      lines: result.boq.slice(0, 8).map((row) => ({ code: row.code, text: row.description, qty: `${row.final} ${row.unit}` })),
      choice: null,
    }
  }

  return { stage, ready: true, approved: true, summary: 'Estimate complete.', missing: [], flags: [], lines: [], choice: null }
}

export function applyRunFields(values: Record<string, string>) {
  const store = useAppStore.getState()
  const ctx = store.projectContext
  const current = ctx.jobInputs ?? {
    doorHeightMm: null,
    windowHeightMm: null,
    plinthAboveNglMm: null,
    soilBearingKpa: null,
    lineLoadKnM: null,
    coolingWm2: null,
    measurementUnit: 'm2' as const,
    quoteValidUntil: '',
  }
  const num = (id: string) => {
    const text = values[id]
    if (text == null || text.trim() === '') return undefined
    const value = Number(text)
    return Number.isFinite(value) ? value : undefined
  }
  const storeys = num('storeys')
  if (storeys != null) store.setFloorCount(Math.max(0, Math.round(storeys)))
  store.setProjectContext({
    client: values.client?.trim() || ctx.client,
    location: values.location?.trim() || ctx.location,
    jobInputs: {
      ...current,
      doorHeightMm: num('doorHeight') ?? current.doorHeightMm,
      windowHeightMm: num('windowHeight') ?? current.windowHeightMm,
      plinthAboveNglMm: num('plinth') ?? current.plinthAboveNglMm,
      soilBearingKpa: num('soil') ?? current.soilBearingKpa,
      lineLoadKnM: num('lineLoad') ?? current.lineLoadKnM,
      coolingWm2: num('cooling') ?? current.coolingWm2,
      floorToFloorMm: num('ffh') ?? current.floorToFloorMm ?? null,
    },
  })
}

export async function persistFloorHeight(projectId: string, ffh: number) {
  if (!(ffh > 0)) return
  const engine = await loadEngineState(projectId).catch(() => null)
  const count = Math.max(1, floors().length, engine?.inputs.storeyCount ?? 1)
  const state = await loadSuperState(projectId, count)
  await saveSuperState(projectId, {
    ...state,
    inputs: {
      ...state.inputs,
      levels: resizeLevels(state.inputs.levels, count).map((level) => ({
        ...level,
        ffhMm: (level.ffhMm ?? 0) > 0 ? level.ffhMm : ffh,
      })),
    },
  })
}

export async function resolveStructureChoice(projectId: string): Promise<StageSnapshot> {
  const engine = await loadEngineState(projectId)
  if (!engine.result) throw new Error('Run the sub structure first.')
  const state = await loadSuperState(projectId, engine.inputs.storeyCount)
  const open = openHrs(state.result)
  if (!open.length) return inspectStage(projectId, 'structure')
  const hrsDecisions = { ...state.overrides.hrsDecisions }
  for (const row of open) {
    hrsDecisions[row.id] = {
      status: 'accepted',
      section: row.section ?? TYPICAL_HRS.section,
      kgPerM: row.kgPerM ?? TYPICAL_HRS.kgPerM,
      lengthMm: row.lengthMm ?? row.suggestedLengthMm,
      quantity: row.quantity ?? row.suggestedQuantity ?? 1,
    }
  }
  const next = runSuper(
    { ...state, overrides: { ...state.overrides, hrsDecisions, approvedBy: null, approvedAt: null } },
    engine.result,
  )
  await saveSuperState(projectId, next)
  return inspectStage(projectId, 'structure')
}

export async function runStage(projectId: string, stage: RunStage, user: string, values: Record<string, string> = {}) {
  applyRunFields(values)
  const inputs = job()
  const ffh = values.ffh ? Number(values.ffh) : inputs?.floorToFloorMm ?? null
  if (ffh && ffh > 0) await persistFloorHeight(projectId, ffh)

  if (stage === 'foundation') {
    let state = await loadEngineState(projectId)
    state = {
      ...state,
      inputs: {
        ...state.inputs,
        storeyCount: Math.max(1, floors().length || state.inputs.storeyCount || 1),
        plinthAboveNglMm: inputs?.plinthAboveNglMm ?? state.inputs.plinthAboveNglMm,
        soilBearingKpa: inputs?.soilBearingKpa ?? state.inputs.soilBearingKpa,
        lineLoadPerStoreyKnM: inputs?.lineLoadKnM ?? state.inputs.lineLoadPerStoreyKnM,
      },
      overrides: { ...state.overrides, approvedBy: null, approvedAt: null },
    }
    const outcome = await runEngineForProject(state)
    const next: EngineState = { ...state, result: outcome.result }
    await saveEngineState(projectId, next)
    return inspectStage(projectId, stage)
  }

  if (stage === 'structure') {
    const engine = await loadEngineState(projectId)
    if (!engine.result) throw new Error('Run the sub structure first.')
    let state = await loadSuperState(projectId, engine.inputs.storeyCount)
    if (ffh && ffh > 0) {
      state = {
        ...state,
        inputs: {
          ...state.inputs,
          levels: resizeLevels(state.inputs.levels, engine.inputs.storeyCount).map((level) => ({
            ...level,
            ffhMm: (level.ffhMm ?? 0) > 0 ? level.ffhMm : ffh,
          })),
        },
      }
    }
    const next = runSuper({ ...state, overrides: { ...state.overrides, approvedBy: null, approvedAt: null } }, engine.result)
    await saveSuperState(projectId, next)
    return inspectStage(projectId, stage)
  }

  if (stage === 'architecture') {
    const source = await architectureSource(projectId)
    const loaded = await loadArchState(projectId, source)
    const settings = {
      doorHeightMm: inputs?.doorHeightMm ?? loaded.settings.doorHeightMm,
      windowHeightMm: inputs?.windowHeightMm ?? loaded.settings.windowHeightMm,
    }
    const next: ArchState = {
      settings,
      overrides: { approvedBy: null, approvedAt: null },
      result: runArchitecture(source, settings),
    }
    await saveArchState(projectId, next)
    return inspectStage(projectId, stage)
  }

  if (stage === 'mep') {
    const loaded = await loadMepState(projectId)
    const engine = await loadEngineState(projectId)
    let next: MepState = {
      ...loaded,
      inputs: {
        ...loaded.inputs,
        settings: { ...loaded.inputs.settings, coolingWm2: inputs?.coolingWm2 ?? loaded.inputs.settings.coolingWm2 },
      },
      overrides: { approvedBy: null, approvedAt: null },
    }
    if (engine.result?.rooms.length) {
      const built = mepFromPlan({ footprint: engine.result.footprint.polygon, walls: engine.result.walls, rooms: engine.result.rooms })
      const merged = mergePlanTrades(next.inputs, built)
      next = {
        ...next,
        inputs: {
          ...next.inputs,
          ...merged,
          building: next.inputs.building?.occupiedM2 ? next.inputs.building : built.building,
        },
      }
    }
    next = { ...next, result: runMep(next.inputs) }
    await saveMepState(projectId, next)
    return inspectStage(projectId, stage)
  }

  void user
  return inspectStage(projectId, stage)
}

export async function approveStage(projectId: string, stage: RunStage, user: string) {
  if (stage === 'foundation') {
    const state = await loadEngineState(projectId)
    if (!state.result || state.result.blocked) throw new Error('The sub structure still has a stop flag.')
    await saveEngineState(projectId, {
      ...state,
      overrides: {
        ...state.overrides,
        approvedBy: user,
        approvedAt: new Date().toISOString(),
        changeLog: [...state.overrides.changeLog, { at: new Date().toISOString(), user, entity: 'review gate', from: 'open', to: 'approved' }],
      },
    })
  }
  if (stage === 'structure') {
    const engine = await loadEngineState(projectId)
    const state = await loadSuperState(projectId, engine.inputs.storeyCount)
    if (!state.result || state.result.blocked) throw new Error('The super structure is still blocked.')
    const keys = state.result.flags.filter((flag) => flag.severity === 'amber').map((flag) => flag.key)
    const next: SuperState = {
      ...state,
      overrides: {
        ...state.overrides,
        acknowledged: [...new Set([...state.overrides.acknowledged, ...keys])],
        approvedBy: user,
        approvedAt: new Date().toISOString(),
        changeLog: [...state.overrides.changeLog, { at: new Date().toISOString(), user, entity: 'review gate', from: 'open', to: 'approved' }],
      },
    }
    await saveSuperState(projectId, { ...next, result: { ...next.result!, gateOpen: true } })
  }
  if (stage === 'architecture') {
    const source = await architectureSource(projectId)
    const state = await loadArchState(projectId, source)
    const result = state.result ?? runArchitecture(source, state.settings)
    if (architectureBlocked(result)) throw new Error('Architecture still has a missing input.')
    await saveArchState(projectId, { ...state, result, overrides: { approvedBy: user, approvedAt: new Date().toISOString() } })
  }
  if (stage === 'mep') {
    const state = await loadMepState(projectId)
    const result = state.result ?? runMep(state.inputs)
    if (mepBlocked(result)) throw new Error('MEP still has a missing input.')
    await saveMepState(projectId, { ...state, result, overrides: { approvedBy: user, approvedAt: new Date().toISOString() } })
  }
  return inspectStage(projectId, stage)
}

export async function collectRunTotals(projectId: string): Promise<RunTotals> {
  const engine = await loadEngineState(projectId).catch(() => null)
  const storeys = engine?.inputs.storeyCount ?? 1
  const superState = await loadSuperState(projectId, storeys).catch(() => null)
  const arch = await apiJson<ArchState | null>(`/api/projects/${projectId}/architecture`).catch(() => null)
  const mep = await loadMepState(projectId).catch(() => null)
  const sources = await collectSources(projectId).catch(() => [])
  const dry = mergeDryCost(await loadDryCost(projectId).catch(() => null), sources, useAppStore.getState().projectContext.commercials.labourDayRate)
  if (superState) syncMeasuredSteel(projectId, superState)
  syncMeasuredLabour(projectId, dry)
  return {
    foundationType: engine?.result ? `Type ${engine.result.foundationType}` : '—',
    foundationLines: engine?.result ? roundedBoq(engine.result).length : 0,
    lgsKg: superState?.result ? Math.round(superState.result.totals.netLgsKg) : null,
    occupiedM2: arch?.result?.summary.occupiedM2 ?? null,
    doors: arch?.result?.summary.doors ?? 0,
    windows: arch?.result?.summary.windows ?? 0,
    mepLines: mep?.result?.boq.length ?? 0,
    dryMaterial: sheetTotal(dry.material),
    dryLabour: sheetTotal(dry.labour),
  }
}

async function architectureSource(projectId: string): Promise<ArchSource> {
  const engine = await loadEngineState(projectId)
  const structure = await loadSuperState(projectId, engine.inputs.storeyCount)
  const resultLevels = structure.result?.levels ?? []
  const levels = resultLevels.length
    ? resultLevels.map((level) => ({
        id: level.levelId,
        name: level.name,
        heightMm: level.heightMm,
        isRoof: Boolean(level.roof),
      }))
    : structure.inputs.levels.map((level) => ({
        id: level.id,
        name: level.name,
        heightMm: level.ffhMm,
        isRoof: level.framingType === 'pitched_roof' || level.framingType === 'flat_roof_truss' || level.framingType === 'flat_roof_c_joist',
      }))
  return {
    foundationReady: Boolean(engine.result),
    foundationApproved: Boolean(engine.overrides.approvedBy),
    footprintM2: engine.result?.footprint.areaM2 ?? 0,
    footprint: engine.result?.footprint.polygon ?? [],
    walls: (engine.result?.walls ?? []).map((wall) => ({
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
    rooms: (engine.result?.rooms ?? []).map((room) => ({
      id: room.id,
      label: room.label,
      category: room.category,
      areaM2: room.areaM2,
      bbox: room.bbox,
    })),
    levels,
    parapet: null,
  }
}
