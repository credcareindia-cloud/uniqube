/**
 * UNIQUBE load-bearing wall & foundation engine (spec v0.1). Deterministic: the same plan,
 * inputs and overrides always give the same result. No prices, no guessed values (QA-14).
 */
import { gridAxesFor, planRegionFor, traceFootprint, type PageGeometry, type ScaleCandidate } from '../geometryCore.ts'
import { lbLines, makeFlag, runFraming } from './framing.ts'
import { polygonArea, polygonPerimeter } from './geom.ts'
import { computeQuantities } from './quantities.ts'
import { PARAMETER_SET_VERSION, bandFor, barList, foundationTypeName, param, paramRequired, typeAllowed } from './rules.ts'
import type { EngineInputs, EngineResult, EngineerOverrides, Flag, LevelInfo } from './types.ts'
import { extractWalls } from './walls.ts'

export const ENGINE_VERSION = '0.1.0'

export const EMPTY_OVERRIDES: EngineerOverrides = {
  directions: {},
  promotedWallIds: [],
  beams: [],
  wallClasses: {},
  scaleConfirmed: false,
  approvedBy: null,
  approvedAt: null,
  changeLog: [],
}

export const DEFAULT_INPUTS: EngineInputs = { storeyCount: 1, foundationType: 1, plinthAboveNglMm: null, soilBearingKpa: null, lineLoadPerStoreyKnM: null, parameterOverrides: {} }

export interface EngineRunArgs {
  geo: PageGeometry
  scale: ScaleCandidate
  level: LevelInfo
  inputs: EngineInputs
  overrides?: EngineerOverrides
  /** Other plan levels were uploaded (PI-08); v0.1 frames one level at a time. */
  hasUpperLevels?: boolean
}

export function runFoundationEngine(args: EngineRunArgs): EngineResult {
  const { geo, scale, level, inputs } = args
  const overrides = args.overrides ?? EMPTY_OVERRIDES
  const ov = inputs.parameterOverrides ?? {}
  const P = (id: Parameters<typeof paramRequired>[0]) => paramRequired(id, ov)
  const flags: Flag[] = []
  const mmPerPt = scale.mmPerPt

  // PI-03 / PI-04: units and scale cross-check against written dimensions.
  // Compare in millimetres for every dimension that has a line (mm, m, ft, cm all store valueMm).
  const matched = geo.dimensions.filter((d) => d.segment && d.valueMm > 0)
  const within = matched.filter((d) => Math.abs(d.segment!.len * mmPerPt - d.valueMm) / d.valueMm <= P('scale_tol') / 100)
  if (!geo.dimensions.length) flags.push(makeFlag('F-UNITS', [level.id], 'No dimension strings were read on this sheet, so units could not be confirmed.'))
  if (within.length < 2 && !overrides.scaleConfirmed) {
    flags.push(
      makeFlag(
        'F-SCALE',
        [level.id],
        `Only ${within.length} written dimension(s) agree with the scale ${scale.label} within ${P('scale_tol')} % (need 2).`,
      ),
    )
  }

  const region = planRegionFor(geo)
  const footprintPt = traceFootprint(geo, mmPerPt)
  if (!region || !footprintPt.ok) {
    flags.push(makeFlag('F-NOWALLS', [level.id], 'The plan region or the building outline could not be traced on this sheet.'))
  }
  const base = {
    version: ENGINE_VERSION,
    parameterSetVersion: PARAMETER_SET_VERSION,
    ranAt: new Date().toISOString(),
    level,
    scale: { mmPerPt, label: scale.label, method: scale.method, confidence: scale.confidence, samples: scale.samples },
    originPt: { x: region?.x0 ?? 0, y: region?.y0 ?? 0 },
  }
  const band = bandFor(inputs.storeyCount)
  const stop = () => flags.some((f) => f.severity === 'stop')

  if (!region || !footprintPt.ok) {
    return { ...base, footprint: { polygon: [], areaM2: 0, perimeterM: 0 }, walls: [], rooms: [], supportLines: [], zones: [], decisions: [], wallClasses: [], lbLines: [], band, foundationType: inputs.foundationType, elements: [], nodes: [], rebar: [], boq: [], flags, gateOpen: false, blocked: true, checks: [], summary: {} }
  }

  // Module 1
  const walls = extractWalls({
    geo,
    mmPerPt,
    region,
    footprintPt: footprintPt.polygon,
    gridAxes: gridAxesFor(geo),
    levelId: level.id,
    wallThkMin: P('wall_thk_min'),
    wallThkMax: P('wall_thk_max'),
    nodeSnapTol: P('node_snap_tol'),
  })
  if (!walls.walls.length) flags.push(makeFlag('F-NOWALLS', [level.id], 'No wall pairs (75–400 mm apart) were found inside the plan region.'))
  else if (walls.confidence < 0.6) flags.push(makeFlag('F-LOWCONF', [level.id], walls.notes.join(' ')))
  const footprint = walls.footprintMm
  const sunkenNoted = geo.texts.some((t) => /sunken|dropped slab|drop slab/i.test(t.text))

  // Modules 2–7
  const framing = runFraming({
    levelId: level.id,
    storeyCount: inputs.storeyCount,
    walls: walls.walls,
    rooms: walls.rooms,
    footprint,
    hasUpperLevels: Boolean(args.hasUpperLevels),
    overrides,
    sunkenNoted,
    params: {
      spanMax: P('span_max'),
      spanRatioTolPct: P('span_ratio_tol'),
      intWallContinuityPct: P('int_wall_continuity'),
      intWallMaxOpening: P('int_wall_max_opening'),
      cantileverMax: P('cantilever_max'),
      voidMax: P('void_max'),
      shearWallMinLen: P('shear_wall_min_len'),
      nodeSnapTol: P('node_snap_tol'),
    },
  })
  flags.push(...framing.flags)
  const lines = lbLines(walls.walls, framing.wallClasses, P('node_snap_tol'))

  // Module 8: foundation type gate
  const type = inputs.foundationType
  if (!typeAllowed(type, band)) flags.push(makeFlag('F-TYPE3', [`type-${type}`], `${foundationTypeName(type)} is not allowed for band ${band} (${inputs.storeyCount} storeys).`))
  const plinth = inputs.plinthAboveNglMm ?? param('plinth_above_NGL', ov)
  if (plinth == null) flags.push(makeFlag('F-INPUT', ['P.plinth_above_NGL'], 'Plinth level above NGL (mm) is a required project input.'))
  const soil = inputs.soilBearingKpa ?? param('soil_bearing', ov)
  if (type === 3 && soil == null) flags.push(makeFlag('F-INPUT', ['P.soil_bearing'], 'Soil bearing capacity (kPa) is required for Type 3.'))

  // Module 6 gate
  const approved = Boolean(overrides.approvedBy)
  const gateOpen = approved && !stop()
  if (!approved && !stop()) flags.push(makeFlag('F-GATE', [level.id], 'Framing and wall classes have not been approved at the review gate; quantities below are provisional.'))

  const blocked = stop()
  let elements: EngineResult['elements'] = []
  let nodes: EngineResult['nodes'] = []
  let rebar: EngineResult['rebar'] = []
  let boq: EngineResult['boq'] = []
  let checks: EngineResult['checks'] = []
  let summary: Record<string, number> = {}
  if (!blocked && plinth != null && lines.length) {
    const q = computeQuantities({
      type,
      band,
      storeyCount: inputs.storeyCount,
      plinthMm: plinth,
      soilBearingKpa: soil,
      lineLoadPerStoreyKnM: inputs.lineLoadPerStoreyKnM ?? param('line_load_per_storey', ov),
      footprint,
      lines,
      params: {
        pccFooting: P('pcc_footing'),
        pccSlab: P('pcc_slab'),
        workSpace: P('work_space'),
        subbaseThk: P('subbase_thk'),
        concreteWastePct: P('concrete_waste'),
        rebarLapWastePct: P('rebar_lap_waste'),
        coverEarth: P('cover_earth'),
        coverFormed: P('cover_formed'),
        coverSlab: P('cover_slab'),
        spacingStep: P('spacing_step'),
        wallBarSpacingMax: P('wall_bar_spacing_max'),
        fy: P('fy'),
        padSpacingMax: P('pad_spacing_max'),
        padSpacingMin: P('pad_spacing_min'),
        tieBeamMax: P('tie_beam_max'),
        nodeSnapTol: P('node_snap_tol'),
        barList: barList(ov),
      },
    })
    elements = q.elements
    nodes = q.nodes
    rebar = q.rebar
    checks = q.checks
    summary = q.summary
    flags.push(...q.flags)
    const provisional = gateOpen ? [] : ['F-GATE']
    boq = q.boq.map((r) => ({ ...r, flags: [...r.flags, ...provisional] }))
  }

  return {
    ...base,
    footprint: { polygon: footprint, areaM2: Math.round(polygonArea(footprint) / 1e4) / 100, perimeterM: Math.round(polygonPerimeter(footprint) / 10) / 100 },
    walls: walls.walls,
    rooms: walls.rooms,
    supportLines: framing.supportLines,
    zones: framing.zones,
    decisions: framing.decisions,
    wallClasses: framing.wallClasses,
    lbLines: lines,
    band,
    foundationType: type,
    elements,
    nodes,
    rebar,
    boq,
    flags: dedupeFlags(flags),
    gateOpen,
    blocked: flags.some((f) => f.severity === 'stop'),
    checks,
    summary: { ...summary, walls: walls.walls.length, rooms: walls.rooms.length, zones: framing.zones.length, lbLines: lines.length },
  }
}

function dedupeFlags(flags: Flag[]) {
  const seen = new Set<string>()
  return flags.filter((f) => {
    const k = `${f.code}|${f.entityIds.join(',')}|${f.message}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Rounded copy for display / export (BQ-03: round only at output). */
export function roundedBoq(result: EngineResult) {
  return result.boq.map((r) => ({
    ...r,
    netQty: r.unit === 'kg' ? Math.round(r.netQty) : Math.round(r.netQty * 100) / 100,
    grossQty: r.unit === 'kg' ? Math.round(r.grossQty) : Math.round(r.grossQty * 100) / 100,
  }))
}

export function boqCsv(result: EngineResult, header: Record<string, string>) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = Object.entries(header).map(([k, v]) => `${esc(k)},${esc(v)}`)
  const cols = ['boq_code', 'section', 'description', 'element_type', 'band', 'unit', 'net_qty', 'waste_pct', 'gross_qty', 'rule_ids', 'element_ids', 'flags', 'basis']
  const rows = roundedBoq(result).map((r) => [r.boqCode, r.section, r.description, r.elementType, r.band, r.unit, r.netQty, r.wastePct, r.grossQty, r.ruleIds.join(' '), r.elementIds.join(' '), r.flags.join(' '), r.basis].map(esc).join(','))
  return [...head, '', cols.map(esc).join(','), ...rows].join('\n')
}
