import type { EngineState } from './run'
import type { EngineerOverrides } from './types'

export interface PlanRevision {
  summary: string
  foundationType?: 1 | 2 | 3
  storeyCount?: number
  plinthAboveNglMm?: number | null
  soilBearingKpa?: number | null
  lineLoadPerStoreyKnM?: number | null
  addBeams?: Array<{ axis: 'h' | 'v'; pos: number; a: number; b: number }>
  removeBeamIds?: string[]
  directions?: Array<{ zoneId: string; direction: 'x' | 'y' | null }>
  wallClasses?: Array<{ wallId: string; class: 'LB' | 'NLB' | null }>
  promoteWallIds?: string[]
  demoteWallIds?: string[]
  clearEdits?: boolean
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** The plan facts the revision chat is allowed to use. Coordinates are millimetres. */
export function describePlan(state: EngineState): string {
  const result = state.result
  if (!result) return 'The foundation plan has not been run.'
  const xs = result.footprint.polygon.map((p) => p.x)
  const ys = result.footprint.polygon.map((p) => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const zones = result.zones.map((zone) => {
    const decision = result.decisions.find((item) => item.zoneId === zone.id)
    const direction = state.overrides.directions[zone.id] ?? decision?.direction ?? 'auto'
    const span = decision?.spanMm != null ? ` span=${(decision.spanMm / 1000).toFixed(2)}m` : ''
    return `${zone.id} Lx=${Math.round(zone.Lx)} Ly=${Math.round(zone.Ly)}${span} x=${Math.round(zone.bbox.x0)}–${Math.round(zone.bbox.x1)} y=${Math.round(zone.bbox.y0)}–${Math.round(zone.bbox.y1)} dir=${direction} status=${decision?.status ?? 'none'}`
  })
  const walls = result.walls.map((wall) => {
    const cls = state.overrides.wallClasses[wall.id] ?? result.wallClasses.find((item) => item.wallId === wall.id)?.class ?? '?'
    const support = state.overrides.promotedWallIds.includes(wall.id) ? ' support' : ''
    return `${wall.id} ${wall.axis} pos=${Math.round(wall.pos)} ${Math.round(wall.a)}–${Math.round(wall.b)} ${cls}${wall.isExternal ? ' ext' : ' int'}${support} ${(wall.length / 1000).toFixed(2)}m`
  })
  const beams = state.overrides.beams.map((beam) => `${beam.id} ${beam.axis} pos=${beam.pos} ${beam.a}–${beam.b}`).join('; ') || 'none'
  const flags = result.flags.map((flag) => `${flag.code} ${flag.severity}: ${flag.message}`).join(' | ') || 'none'
  return [
    `Sheet ${result.level.drawingNo ?? 'plan'} page ${result.level.sourcePage}, ${result.level.name}, scale ${result.scale.label}.`,
    `Outline bbox x ${Math.round(x0)}–${Math.round(x1)} mm, y ${Math.round(y0)}–${Math.round(y1)} mm. Area ${result.footprint.areaM2.toFixed(1)} m². Coordinates are millimetres.`,
    `Inputs: foundation type ${state.inputs.foundationType}, storeys ${state.inputs.storeyCount}, plinth ${state.inputs.plinthAboveNglMm ?? 'missing'} mm, soil ${state.inputs.soilBearingKpa ?? 'missing'} kPa, line load ${state.inputs.lineLoadPerStoreyKnM ?? 'missing'} kN/m.`,
    `Beams: ${beams}.`,
    `Flags: ${flags}.`,
    'Zones:',
    ...zones,
    'Walls:',
    ...walls,
  ].join('\n')
}

function asRevision(raw: unknown): PlanRevision | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'The revision was empty.' }
  const row = raw as Record<string, unknown>
  const summary = typeof row.summary === 'string' ? row.summary.trim() : ''
  if (!summary) return { error: 'The revision needs a one-line summary.' }
  const patch: PlanRevision = { summary: summary.slice(0, 240) }
  if (row.foundationType != null) {
    const type = num(row.foundationType)
    if (type !== 1 && type !== 2 && type !== 3) return { error: 'Foundation type must be 1, 2, or 3.' }
    patch.foundationType = type
  }
  if (row.storeyCount != null) {
    const count = num(row.storeyCount)
    if (count == null || !Number.isInteger(count) || count < 1 || count > 20) return { error: 'Storeys must be a whole number from 1 to 20.' }
    patch.storeyCount = count
  }
  if (row.plinthAboveNglMm !== undefined) patch.plinthAboveNglMm = row.plinthAboveNglMm == null ? null : num(row.plinthAboveNglMm)
  if (row.soilBearingKpa !== undefined) patch.soilBearingKpa = row.soilBearingKpa == null ? null : num(row.soilBearingKpa)
  if (row.lineLoadPerStoreyKnM !== undefined) patch.lineLoadPerStoreyKnM = row.lineLoadPerStoreyKnM == null ? null : num(row.lineLoadPerStoreyKnM)
  if (Array.isArray(row.addBeams)) {
    patch.addBeams = []
    for (const beam of row.addBeams) {
      if (!beam || typeof beam !== 'object') return { error: 'A beam was not complete.' }
      const item = beam as Record<string, unknown>
      const axis = item.axis === 'h' || item.axis === 'v' ? item.axis : null
      const pos = num(item.pos)
      const a = num(item.a)
      const b = num(item.b)
      if (!axis || pos == null || a == null || b == null || a === b) return { error: 'Each beam needs an axis, a position, and two different ends, in millimetres.' }
      patch.addBeams.push({ axis, pos, a, b })
    }
  }
  const ids = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined)
  patch.removeBeamIds = ids(row.removeBeamIds)
  patch.promoteWallIds = ids(row.promoteWallIds)
  patch.demoteWallIds = ids(row.demoteWallIds)
  if (Array.isArray(row.directions)) {
    patch.directions = row.directions.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const zone = item as Record<string, unknown>
      if (typeof zone.zoneId !== 'string') return []
      const direction = zone.direction === 'x' || zone.direction === 'y' ? zone.direction : null
      return [{ zoneId: zone.zoneId, direction }]
    })
  }
  if (Array.isArray(row.wallClasses)) {
    patch.wallClasses = row.wallClasses.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const wall = item as Record<string, unknown>
      if (typeof wall.wallId !== 'string') return []
      const cls = wall.class === 'LB' || wall.class === 'NLB' ? wall.class : null
      return [{ wallId: wall.wallId, class: cls }]
    })
  }
  if (row.clearEdits === true) patch.clearEdits = true
  return patch
}

function hasChange(patch: PlanRevision) {
  return (
    patch.foundationType != null ||
    patch.storeyCount != null ||
    patch.plinthAboveNglMm !== undefined ||
    patch.soilBearingKpa !== undefined ||
    patch.lineLoadPerStoreyKnM !== undefined ||
    (patch.addBeams?.length ?? 0) > 0 ||
    (patch.removeBeamIds?.length ?? 0) > 0 ||
    (patch.directions?.length ?? 0) > 0 ||
    (patch.wallClasses?.length ?? 0) > 0 ||
    (patch.promoteWallIds?.length ?? 0) > 0 ||
    (patch.demoteWallIds?.length ?? 0) > 0 ||
    patch.clearEdits === true
  )
}

/** Apply a chat revision onto the saved engine inputs. The caller re-runs the engine so the drawing updates. */
export function applyPlanRevision(state: EngineState, raw: unknown, user: string): { error: string } | { state: EngineState; summary: string } {
  const parsed = asRevision(raw)
  if ('error' in parsed) return parsed
  if (!state.result) return { error: 'Run the engine before revising the plan.' }
  if (!hasChange(parsed)) return { error: 'No drawing change was specified.' }
  const zoneIds = new Set(state.result.zones.map((zone) => zone.id))
  const wallIds = new Set(state.result.walls.map((wall) => wall.id))
  const unknownZone = parsed.directions?.find((item) => !zoneIds.has(item.zoneId))
  if (unknownZone) return { error: `No zone ${unknownZone.zoneId} on this plan.` }
  const wallMentions = [...(parsed.wallClasses ?? []).map((item) => item.wallId), ...(parsed.promoteWallIds ?? []), ...(parsed.demoteWallIds ?? [])]
  const unknownWall = wallMentions.find((id) => !wallIds.has(id))
  if (unknownWall) return { error: `No wall ${unknownWall} on this plan.` }
  const span = Math.max(
    ...state.result.footprint.polygon.map((p) => p.x),
    ...state.result.footprint.polygon.map((p) => p.y),
  )
  if (span > 10000) {
    const small = parsed.addBeams?.find((beam) => Math.max(Math.abs(beam.pos), Math.abs(beam.a), Math.abs(beam.b)) < 1000)
    if (small) return { error: 'Beam positions are millimetres. A value under 1000 mm is inside the linework, not a length in metres.' }
  }

  const overrides: EngineerOverrides = parsed.clearEdits
    ? { ...state.overrides, directions: {}, promotedWallIds: [], beams: [], wallClasses: {}, scaleConfirmed: false }
    : {
        ...state.overrides,
        directions: { ...state.overrides.directions },
        beams: [...state.overrides.beams],
        wallClasses: { ...state.overrides.wallClasses },
        promotedWallIds: [...state.overrides.promotedWallIds],
      }
  const inputs = { ...state.inputs }
  if (parsed.foundationType) inputs.foundationType = parsed.foundationType
  if (parsed.storeyCount) inputs.storeyCount = parsed.storeyCount
  if (parsed.plinthAboveNglMm !== undefined) inputs.plinthAboveNglMm = parsed.plinthAboveNglMm
  if (parsed.soilBearingKpa !== undefined) inputs.soilBearingKpa = parsed.soilBearingKpa
  if (parsed.lineLoadPerStoreyKnM !== undefined) inputs.lineLoadPerStoreyKnM = parsed.lineLoadPerStoreyKnM
  if (parsed.removeBeamIds?.length) {
    const drop = new Set(parsed.removeBeamIds)
    overrides.beams = overrides.beams.filter((beam) => !drop.has(beam.id))
  }
  for (const beam of parsed.addBeams ?? []) {
    const next = overrides.beams.reduce((max, item) => Math.max(max, Number(/^BEAM-(\d+)$/.exec(item.id)?.[1] ?? 0)), 0) + 1
    overrides.beams.push({ id: `BEAM-${next}`, axis: beam.axis, pos: beam.pos, a: Math.min(beam.a, beam.b), b: Math.max(beam.a, beam.b) })
  }
  for (const item of parsed.directions ?? []) {
    if (item.direction) overrides.directions[item.zoneId] = item.direction
    else delete overrides.directions[item.zoneId]
  }
  for (const item of parsed.wallClasses ?? []) {
    if (item.class) overrides.wallClasses[item.wallId] = item.class
    else delete overrides.wallClasses[item.wallId]
  }
  if (parsed.promoteWallIds?.length) overrides.promotedWallIds = [...new Set([...overrides.promotedWallIds, ...parsed.promoteWallIds])]
  if (parsed.demoteWallIds?.length) {
    const drop = new Set(parsed.demoteWallIds)
    overrides.promotedWallIds = overrides.promotedWallIds.filter((id) => !drop.has(id))
  }
  overrides.changeLog = [
    ...overrides.changeLog,
    { at: new Date().toISOString(), user, entity: 'plan revision', from: 'chat', to: parsed.summary },
  ]
  overrides.approvedBy = null
  overrides.approvedAt = null
  return { state: { ...state, inputs, overrides, result: state.result }, summary: parsed.summary }
}
