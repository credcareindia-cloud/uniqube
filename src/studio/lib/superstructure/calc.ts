/**
 * Pure superstructure formulas (spec v1.0 sections 4–12). Every function takes the parameter
 * overrides so a project can tune a value without touching the code. Checked against T01–T20.
 */
import { P, PN, kgPerM, type Overrides } from './rules.ts'
import type { TrussPieceResult } from './types.ts'

const ceil = Math.ceil
const floor = Math.floor
const rad = (deg: number) => (deg * Math.PI) / 180

// ——— 4. wall height ———

export function wallHeight(ffhMm: number, deductionMm: number, o: Overrides = {}) {
  return ffhMm - deductionMm - P('floor_buildup_mm', o)
}

// ——— 5. walls ———

export function wallPanels(lengthMm: number, spacingMm: number, o: Overrides = {}) {
  const panels = Math.max(1, ceil(lengthMm / P('panel_max_length_mm', o)))
  const panelLengthMm = lengthMm / panels
  const studsRegular = panels * (ceil(panelLengthMm / spacingMm - 1e-9) + 1)
  return { panels, panelLengthMm, studsRegular }
}

export function noggingRows(heightMm: number, o: Overrides = {}) {
  return Math.max(0, floor((heightMm - 1) / P('nogging_spacing_mm', o)))
}

export interface WallRunInput {
  lengthMm: number
  heightMm: number
  spacingMm: number
  section: string
  openings: number
  junctions: { L: number; T: number; X: number }
}

export function wallRunQuantities(input: WallRunInput, o: Overrides = {}) {
  const { lengthMm: L, heightMm: H, spacingMm: s } = input
  const { panels, panelLengthMm, studsRegular } = wallPanels(L, s, o)
  const studsJamb = input.openings * 2 * P('jamb_studs_per_side', o)
  const studsJunction = input.junctions.L * PN('junction_studs', 'L', o) + input.junctions.T * PN('junction_studs', 'T', o) + input.junctions.X * PN('junction_studs', 'X', o)
  const rows = noggingRows(H, o)
  const maxH = P('panel_max_height_mm', o)
  const extraTrackMm = H > maxH ? 2 * L * (ceil(H / maxH) - 1) : 0
  const studsMm = (studsRegular + studsJamb + studsJunction) * H
  const tracksMm = 2 * L
  const noggingMm = rows * L
  const totalMm = studsMm + tracksMm + noggingMm + extraTrackMm
  const kg = (totalMm / 1000) * kgPerM(input.section, o)
  return { panels, panelLengthMm, studsRegular, studsJamb, studsJunction, noggingRows: rows, studsMm, tracksMm, noggingMm, extraTrackMm, totalMm, kg }
}

// ——— 6. floor trusses ———

/** Walk the line; extend the piece while piece + next span stays under the piece limit, else cut at that wall. */
export function cutPieces(spansMm: number[], o: Overrides = {}): number[][] {
  const limit = P('truss_piece_max_length_mm', o)
  const pieces: number[][] = []
  let current: number[] = []
  let length = 0
  for (const span of spansMm) {
    if (current.length && length + span >= limit) {
      pieces.push(current)
      current = []
      length = 0
    }
    current.push(span)
    length += span
  }
  if (current.length) pieces.push(current)
  return pieces
}

export function trussPiece(spansMm: number[], reinforcing: boolean, o: Overrides = {}): TrussPieceResult {
  const panel = P('truss_panel_mm', o)
  const lengthMm = spansMm.reduce((a, b) => a + b, 0)
  const panels = spansMm.reduce((sum, span) => sum + ceil(span / panel - 1e-9), 0)
  const chordsMm = 2 * lengthMm
  const verticalsMm = (panels + 1) * P('truss_vertical_mm', o)
  const diagonalsMm = panels * P('truss_diagonal_mm', o)
  const reinforcingMm = reinforcing ? 2 * lengthMm : 0
  return { spansMm, lengthMm, panels, chordsMm, verticalsMm, diagonalsMm, reinforcingMm, totalMm: chordsMm + verticalsMm + diagonalsMm + reinforcingMm }
}

/** Blocking trusses longer than the piece limit split into equal pieces; the member total is unchanged. */
export function blockingTruss(lengthMm: number, reinforcing: boolean, o: Overrides = {}): TrussPieceResult {
  const limit = P('truss_piece_max_length_mm', o)
  const n = Math.max(1, ceil(lengthMm / limit))
  const piece = trussPiece([lengthMm / n], reinforcing, o)
  return { ...piece, spansMm: Array(n).fill(lengthMm / n), lengthMm, panels: piece.panels * n, chordsMm: piece.chordsMm * n, verticalsMm: piece.verticalsMm * n, diagonalsMm: piece.diagonalsMm * n, reinforcingMm: piece.reinforcingMm * n, totalMm: piece.totalMm * n }
}

// ——— 7. C-joists ———

export function cJoistZone(widthMm: number, spanMm: number, spacingMm: number, section: string, o: Overrides = {}) {
  const joists = ceil(widthMm / spacingMm - 1e-9) + 1
  const blockingRows = Math.max(0, ceil(spanMm / P('joist_blocking_spacing_mm', o) - 1e-9) - 1)
  const joistsMm = joists * spanMm
  const blockingMm = blockingRows * (joists - 1) * spacingMm
  const rimsMm = 2 * widthMm
  const totalMm = joistsMm + blockingMm + rimsMm
  return { joists, blockingRows, joistsMm, blockingMm, rimsMm, totalMm, kg: (totalMm / 1000) * kgPerM(section, o) }
}

// ——— 8. balconies ———

export function balconyQuantities(lengthMm: number, cantileverMm: number, spacingMm: number, family: 'truss' | 'c_joist', reinforcing: boolean, o: Overrides = {}) {
  const members = ceil(lengthMm / spacingMm - 1e-9) + 1
  const memberLengthMm = cantileverMm + P('balcony_backspan_ratio', o) * cantileverMm
  const membersMm = family === 'truss' ? members * trussPiece([memberLengthMm], reinforcing, o).totalMm : members * memberLengthMm
  const edgeLengthMm = lengthMm + 2 * cantileverMm
  const edgesMm = family === 'truss' ? blockingTruss(edgeLengthMm, reinforcing, o).totalMm : edgeLengthMm
  return { members, memberLengthMm, membersMm, edgesMm, totalMm: membersMm + edgesMm }
}

// ——— 9. pitched roofs ———

export interface TrussGeometry {
  bottomChordMm: number
  topChordMm: number
  verticalsMm: number[]
  diagonalsMm: number[]
  totalMm: number
}

/** PR2 dual-pitch common truss: verticals at x = 0, panel, … < Lt/2 on each half plus the apex. */
export function commonTruss(ltMm: number, overhangMm: number, pitchDeg: number, heelMm: number, o: Overrides = {}): TrussGeometry {
  const panel = P('truss_panel_mm', o)
  const flange = P('s162_flange_mm', o)
  const t = Math.tan(rad(pitchDeg))
  const half = ltMm / 2
  const v = (x: number) => heelMm + x * t - 2 * flange
  const xs: number[] = []
  for (let x = 0; x < half - 1e-6; x += panel) xs.push(x)
  const halfVerticals = xs.map(v)
  const halfDiagonals = xs.map((x) => {
    const width = Math.min(panel, half - x)
    return Math.sqrt(width * width + v(x) * v(x))
  })
  const verticalsMm = [...halfVerticals, ...halfVerticals, v(half)]
  const diagonalsMm = [...halfDiagonals, ...halfDiagonals]
  const topChordMm = (2 * (half + overhangMm)) / Math.cos(rad(pitchDeg))
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  return { bottomChordMm: ltMm, topChordMm, verticalsMm, diagonalsMm, totalMm: ltMm + topChordMm + sum(verticalsMm) + sum(diagonalsMm) }
}

/** Mono-pitch truss / jack of span a: verticals from the heel up to hh + a·tanθ. */
export function monoTruss(spanMm: number, overhangLowMm: number, overhangHighMm: number, pitchDeg: number, heelMm: number, o: Overrides = {}): TrussGeometry {
  const panel = P('truss_panel_mm', o)
  const flange = P('s162_flange_mm', o)
  const t = Math.tan(rad(pitchDeg))
  const v = (x: number) => heelMm + x * t - 2 * flange
  const xs: number[] = []
  for (let x = 0; x < spanMm - 1e-6; x += panel) xs.push(x)
  const verticalsMm = [...xs.map(v), v(spanMm)]
  const diagonalsMm = xs.map((x) => {
    const width = Math.min(panel, spanMm - x)
    return Math.sqrt(width * width + v(x) * v(x))
  })
  const topChordMm = (spanMm + overhangLowMm + overhangHighMm) / Math.cos(rad(pitchDeg))
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  return { bottomChordMm: spanMm, topChordMm, verticalsMm, diagonalsMm, totalMm: spanMm + topChordMm + sum(verticalsMm) + sum(diagonalsMm) }
}

/** PR4: rake length and outriggers per rake. */
export function gableVerge(ltMm: number, overhangMm: number, vergeMm: number, pitchDeg: number, spacingMm: number, o: Overrides = {}) {
  const rakeMm = (ltMm / 2 + overhangMm) / Math.cos(rad(pitchDeg))
  const outriggers = ceil(rakeMm / spacingMm - 1e-9) + 1
  const outriggerMm = vergeMm * (1 + P('verge_backspan_ratio', o))
  return { rakeMm, outriggers, outriggerMm }
}

/** PR5: hip end on a roof of width B. */
export function hipEnd(bMm: number, spacingMm: number, overhangMm: number, pitchDeg: number, o: Overrides = {}) {
  const t = Math.tan(rad(pitchDeg))
  const endJackSpans: number[] = []
  const endCount = ceil(bMm / spacingMm - 1e-9) - 1
  for (let k = 1; k <= endCount; k++) {
    const y = k * spacingMm
    endJackSpans.push(Math.min(y, bMm - y))
  }
  const sideJackSpans: number[] = []
  const sideCount = ceil(bMm / 2 / spacingMm - 1e-9) - 1
  for (let k = 1; k <= sideCount; k++) sideJackSpans.push(k * spacingMm)
  const hipRafterMm = Math.SQRT2 * (bMm / 2 + overhangMm) * Math.sqrt(1 + 0.5 * t * t)
  return { endJackSpans, sideJackSpans, hipRafters: 2, hipRafterMm, hipRafterPly: P('hip_rafter_ply', o) }
}

/** PR6: valley trusses on a secondary roof of width W2. */
export function valley(w2Mm: number, spacingMm: number, pitchDeg: number, o: Overrides = {}) {
  const count = floor(w2Mm / 2 / spacingMm)
  const spans: number[] = []
  for (let k = 1; k <= count; k++) {
    const span = w2Mm - 2 * k * spacingMm
    if (span >= P('min_valley_truss_span_mm', o)) spans.push(span)
  }
  const plan = (w2Mm / 2) * Math.SQRT2
  const rise = (w2Mm / 2) * Math.tan(rad(pitchDeg))
  return { spans, valleyMemberMm: Math.sqrt(plan * plan + rise * rise) }
}

// ——— 10. purlins and bracing ———

export function purlins(planAreaM2: number, pitchDeg: number, eavesM: number, o: Overrides = {}) {
  const slopeAreaM2 = planAreaM2 / Math.cos(rad(pitchDeg))
  const purlinsM = slopeAreaM2 / (P('purlin_spacing_mm', o) / 1000) + eavesM
  return { slopeAreaM2, purlinsM }
}

/** Strap X-bracing: braced bays per slope and strap per bay; slopes and halves summed by the caller. */
export function bracing(lengthMm: number, slopeMm: number, o: Overrides = {}) {
  const bays = ceil(lengthMm / P('braced_bay_max_distance_mm', o) - 1e-9) + 1
  const strapPerBayMm = 2 * Math.SQRT2 * slopeMm
  return { bays, strapPerBayMm, totalMm: bays * strapPerBayMm }
}

// ——— 12. anchors and rods ———

export function anchors(lengthMm: number, spacingMm: number) {
  return lengthMm > 0 ? ceil(lengthMm / spacingMm - 1e-9) + 1 : 0
}

export function externalRods(runLengthsMm: number[], corners: number, o: Overrides = {}) {
  const s = P('rod_external_spacing_mm', o)
  return corners + runLengthsMm.reduce((sum, L) => sum + Math.max(0, ceil(L / s - 1e-9) - 1), 0)
}

export function internalRods(stackedLengthMm: number, o: Overrides = {}) {
  if (stackedLengthMm <= 0) return 0
  return ceil(stackedLengthMm / P('rod_internal_spacing_mm', o) - 1e-9) + 1
}

export function rodLength(floorZoneDepthMm: number, o: Overrides = {}) {
  return floorZoneDepthMm + 2 * P('rod_projection_mm', o)
}

// ——— 13–14. HRS, load path and factors ———

export function hrsMarkupKg(lengthMm: number, kgPerMetre: number, quantity: number, o: Overrides = {}) {
  return (lengthMm / 1000) * kgPerMetre * quantity * (1 + P('hrs_connection_allowance', o)) * (1 + P('hrs_wastage', o))
}

export function hrsDirectKg(directKg: number, o: Overrides = {}) {
  return directKg * (1 + P('hrs_wastage', o))
}

export function loadPath(beamEndsOnLgsWalls: number, levelsBelow: number, o: Overrides = {}) {
  return { studPackStuds: beamEndsOnLgsWalls * levelsBelow * P('stud_pack_studs', o), padsToSubstructure: beamEndsOnLgsWalls }
}

/** Calculation order 1–5. hrsRawKg is length × kg/m × quantity before the connection and wastage factors. */
export function factors(calculatedLgsKg: number, allowancesKg: number, hrsRawKg: number, hrsManualDirectKg: number, o: Overrides = {}) {
  const netLgsKg = calculatedLgsKg + allowancesKg
  return {
    netLgsKg,
    screws: P('screws_per_kg', o) * netLgsKg,
    connectorsAed: P('connector_aed_per_kg', o) * netLgsKg,
    grossLgsKg: netLgsKg * (1 + P('lgs_wastage', o)),
    hrsKg: hrsRawKg * (1 + P('hrs_connection_allowance', o)) * (1 + P('hrs_wastage', o)) + hrsDirectKg(hrsManualDirectKg, o),
  }
}
