import { archParam, ARCH_SPEC, type ArchOverrides } from './spec.ts'

/** Lengths are metres and areas m2 unless a name ends in Mm. */

export type DeductionPolicy = 'THRESHOLD' | 'FULL' | 'NONE'
export type Face = 'outer' | 'inner'

export interface Opening {
  kind: 'door' | 'window' | 'void'
  width: number
  height: number
  /** Sill above finished floor; doors and voids sit at 0. */
  sill?: number
  /** Window with an internal sill board selected (GM-09). */
  sillBoard?: boolean
}

export interface QuantityResult {
  net: number
  wastagePct: number
  gross: number
  packSize: number
  purchase: number
}

/** GM-14: intermediate values keep four decimals. */
export function d4(value: number) {
  return Math.round(value * 10_000) / 10_000
}

const mm = (value: number) => value / 1000

/** Ceiling that ignores float noise such as 2.0000000001. */
function roundUp(value: number) {
  return Math.ceil(d4(value) - 1e-9)
}

export class ArchCalcError extends Error {
  readonly ruleId: string
  constructor(ruleId: string, message: string) {
    super(`${ruleId}: ${message}`)
    this.ruleId = ruleId
  }
}

export function openingArea(opening: Opening) {
  return opening.width * opening.height
}

/** GM-08: openings above SMALL_OPENING_AREA are deducted in full; a material may be FULL or NONE instead. */
export function deductible(opening: Opening, policy: DeductionPolicy = 'THRESHOLD', overrides: ArchOverrides = {}) {
  if (policy === 'NONE') return false
  if (policy === 'FULL') return true
  return openingArea(opening) > archParam('SMALL_OPENING_AREA', overrides)
}

/** GM-09: reveal perimeter of one opening on one face. */
export function revealPerimeter(opening: Opening, face: Face) {
  const { width, height } = opening
  if (opening.kind === 'door') return 2 * height + width
  if (face === 'inner' && opening.sillBoard) return 2 * height + width
  return 2 * (height + width)
}

export function revealDepth(face: Face, overrides: ArchOverrides = {}) {
  return mm(archParam(face === 'outer' ? 'REVEAL_DEPTH_EXT' : 'REVEAL_DEPTH_INT', overrides))
}

export interface SurfaceInput {
  length: number
  height: number
  openings: Opening[]
  face: Face
  returnsIntoReveal: boolean
  policy?: DeductionPolicy
  layers?: number
}

/** GM-01 with GM-08, GM-09 and GM-16: net area = length × height − deductible openings + reveals, × layers. */
export function surfaceNetArea(input: SurfaceInput, overrides: ArchOverrides = {}) {
  const gross = input.length * input.height
  const deducted = input.openings.filter((o) => deductible(o, input.policy, overrides)).reduce((sum, o) => sum + openingArea(o), 0)
  if (deducted > gross) throw new ArchCalcError('GM-16', `openings of ${d4(deducted)} m2 exceed the surface area of ${d4(gross)} m2`)
  for (const o of input.openings) {
    if (o.width > input.length || (o.sill ?? 0) + o.height > input.height) {
      throw new ArchCalcError('GM-16', `a ${o.kind} of ${o.width} × ${o.height} m does not fit its ${d4(input.length)} × ${d4(input.height)} m host face`)
    }
  }
  const reveals = input.returnsIntoReveal
    ? input.openings.reduce((sum, o) => sum + revealPerimeter(o, input.face), 0) * revealDepth(input.face, overrides)
    : 0
  return d4((gross - deducted + reveals) * (input.layers ?? 1))
}

/** GM-04: lining height, or the full panel height when the room has no ceiling or the wall is rated. */
export function liningHeight(ceilingHeight: number, opts: { panelHeight?: number; fullHeight?: boolean } = {}, overrides: ArchOverrides = {}) {
  if (opts.fullHeight) {
    if (opts.panelHeight == null) throw new ArchCalcError('GM-04', 'full-height lining needs the structural panel height')
    return opts.panelHeight
  }
  return d4(ceilingHeight + mm(archParam('LINING_OVERRUN', overrides)))
}

/** GM-06: area of an opening that falls inside one finish band. */
export function bandDeduction(opening: Opening, bandBottom: number, bandTop: number) {
  const bottom = opening.sill ?? 0
  const top = bottom + opening.height
  return opening.width * Math.max(0, Math.min(top, bandTop) - Math.max(bottom, bandBottom))
}

/** GM-12 and RF-01. */
export function trueArea(planArea: number, slopeDeg: number) {
  return d4(planArea / Math.cos((slopeDeg * Math.PI) / 180))
}

/** GM-13. */
export function skirtingLength(roomPerimeter: number, doorWidths: number[]) {
  return d4(roomPerimeter - doorWidths.reduce((sum, w) => sum + w, 0))
}

/** BD-03: wastage when the sheet is longer than the board height. */
export function heightFitWastage(defaultPct: number, boardHeight: number, sheetLength: number, overrides: ArchOverrides = {}) {
  if (boardHeight > sheetLength) return defaultPct
  const fit = (sheetLength / boardHeight - 1) * 100 + archParam('HEIGHT_FIT_ALLOWANCE', overrides)
  return Math.max(defaultPct, d4(fit))
}

/** BD-05: shortest stocked screw not shorter than the boards + allowance; drill point on thicker steel. */
export function screwSelection(totalBoardMm: number, studSteelMm: number, stockedLengthsMm: number[], overrides: ArchOverrides = {}) {
  const need = totalBoardMm + archParam('SCREW_PENETRATION_ALLOWANCE', overrides)
  const fits = stockedLengthsMm.filter((length) => length >= need).sort((a, b) => a - b)
  return {
    lengthMm: fits[0] ?? null,
    point: studSteelMm > archParam('DRILL_POINT_STEEL', overrides) ? ('drill' as const) : ('sharp' as const),
  }
}

/** DP-01: screws per sheet and the per-m2 rate. `across` is the sheet dimension running across the supports. */
export function screwRate(sheet: { widthMm: number; lengthMm: number }, across: 'width' | 'length', supportSpacingMm: number, screwSpacingMm: number) {
  const acrossMm = across === 'width' ? sheet.widthMm : sheet.lengthMm
  const alongMm = across === 'width' ? sheet.lengthMm : sheet.widthMm
  const perSheet = (Math.floor(acrossMm / supportSpacingMm) + 1) * (Math.floor(alongMm / screwSpacingMm) + 1)
  return { perSheet, ratePerM2: Math.ceil(perSheet / (mm(sheet.widthMm) * mm(sheet.lengthMm))) }
}

/** WR-01, WR-02 and GM-14: net → gross → purchase units, rounding only the purchase quantity, up. */
export function quantity(net: number, wastagePct: number, packSize: number, minimumOrder = 0): QuantityResult & { belowMinimum: boolean } {
  const n = d4(net)
  const gross = d4(n * (1 + wastagePct / 100))
  const packs = packSize > 0 ? roundUp(gross / packSize) : 0
  return { net: n, wastagePct, gross, packSize, purchase: Math.max(packs, minimumOrder), belowMinimum: packs < minimumOrder }
}

/** BD-02: sheets for a board slot. */
export function boardSheets(net: number, wastagePct: number, sheet: { widthMm: number; lengthMm: number }) {
  return quantity(net, wastagePct, d4(mm(sheet.widthMm) * mm(sheet.lengthMm)))
}

/** EF-04, CL-11 and the paint consumption rows: litres = area × coats ÷ coverage. */
export function paintLitres(area: number, coats: number, coverageM2PerL: number) {
  return d4((area * coats) / coverageM2PerL)
}

/** IN-06: wet-room waterproofing area. */
export function wetRoomWaterproofingArea(floorArea: number, perimeter: number, showerWallLength: number, overrides: ArchOverrides = {}) {
  return d4(floorArea + perimeter * mm(archParam('WP_UPTURN', overrides)) + showerWallLength * mm(archParam('WP_SHOWER_HEIGHT', overrides)))
}

/** IN-07 and RF-07: roof or terrace waterproofing area. */
export function roofWaterproofingArea(planArea: number, parapetLength: number, penetrationPerimeters: number[] = [], overrides: ArchOverrides = {}) {
  const upstand = mm(archParam('WP_UPSTAND', overrides))
  return d4(planArea + parapetLength * upstand + penetrationPerimeters.reduce((sum, p) => sum + p * upstand, 0))
}

/** EF-03: vertical movement joints per elevation. */
export function movementJoints(elevationLength: number, overrides: ArchOverrides = {}) {
  return Math.floor(d4(elevationLength / archParam('MJ_SPACING', overrides)))
}

/** OT-03: control joints in a lining run, and their length. */
export function controlJoints(runLength: number, liningH: number, overrides: ArchOverrides = {}) {
  const count = Math.floor(d4(runLength / archParam('CJ_SPACING', overrides)))
  return { count, length: d4(count * liningH) }
}

/** TF-02: tile wastage by layout. */
export function tileWastage(longestSideMm: number, layout: 'straight' | 'diagonal' | 'herringbone') {
  if (layout !== 'straight') return 15
  return longestSideMm >= 900 ? 10 : 8
}

/** TF-04: tile adhesive kg per m2 by the longest tile side. */
export function tileAdhesiveRate(longestSideMm: number) {
  const row = ARCH_SPEC.tile_adhesive_rates.rows.find(
    (r) => longestSideMm >= r.longest_tile_side_mm_from && (r.longest_tile_side_mm_to == null || longestSideMm <= r.longest_tile_side_mm_to),
  )
  if (!row) throw new ArchCalcError('TF-04', `no adhesive rate for a ${longestSideMm} mm tile`)
  return row.rate_kg_per_m2
}

/** TF-05: grout kg per m2. */
export function groutKgPerM2(tileLMm: number, tileWMm: number, jointWMm: number, jointDMm: number, overrides: ArchOverrides = {}) {
  return d4(((tileLMm + tileWMm) / (tileLMm * tileWMm)) * jointWMm * jointDMm * archParam('GROUT_DENSITY_FACTOR', overrides))
}

/** TF-09: bagged screed kg, and the average thickness of a screed to falls. */
export function screedKg(area: number, thicknessMm: number, kind: 'sand_cement' | 'self_levelling', overrides: ArchOverrides = {}) {
  const rate = archParam(kind === 'sand_cement' ? 'SCREED_SAND_CEMENT_RATE' : 'SCREED_SELF_LEVELLING_RATE', overrides)
  return d4(area * thicknessMm * rate)
}

export function screedToFallsThicknessMm(minimumMm: number, fallRatio: number, longestRun: number) {
  return d4(minimumMm + (fallRatio * longestRun * 1000) / 2)
}

/** DW-03: finished wall thickness for the frame depth. */
export function finishedWallThicknessMm(studDepthMm: number, boardThicknessesMm: number[], tiledFaces: number, overrides: ArchOverrides = {}) {
  return studDepthMm + boardThicknessesMm.reduce((sum, t) => sum + t, 0) + tiledFaces * archParam('TILED_FACE_THICKNESS', overrides)
}

/** DW-04: hinges per leaf. */
export function hingesPerLeaf(leafHeightMm: number, fireRated: boolean, overrides: ArchOverrides = {}) {
  return fireRated || leafHeightMm > archParam('HINGE_HEIGHT_LIMIT', overrides)
    ? archParam('HINGES_PER_LEAF_TALL_OR_FIRE', overrides)
    : archParam('HINGES_PER_LEAF_STANDARD', overrides)
}

/** DW-05: door surround quantities. */
export function doorSurround(width: number, height: number, facesWithArchitrave: number, overrides: ArchOverrides = {}) {
  const perimeter = 2 * height + width
  return {
    architrave: d4(perimeter * facesWithArchitrave * archParam('ARCHITRAVE_FACTOR', overrides)),
    perimeterSealant: d4(perimeter * 2),
    frameFixings: archParam('FRAME_FIXINGS_PER_FRAME', overrides),
  }
}

/** DW-07: window surround quantities. */
export function windowSurround(width: number, height: number, overrides: ArchOverrides = {}) {
  const perimeter = 2 * (width + height)
  return {
    flashingTape: d4(perimeter + archParam('FLASHING_TAPE_EXTRA', overrides)),
    externalSealant: d4(perimeter),
    internalSealant: d4(perimeter),
    anchors: roundUp(perimeter / archParam('WINDOW_ANCHOR_SPACING', overrides)),
    sill: d4(width + archParam('SILL_EXTRA_LENGTH', overrides)),
  }
}

/** DW-08: glazing that needs a tempered or laminated specification. */
export function needsSafetyGlazing(opening: Opening, besideDoor = false, overrides: ArchOverrides = {}) {
  if (opening.kind === 'door' || besideDoor) return true
  return opening.kind === 'window' && (opening.sill ?? 0) * 1000 < archParam('SAFETY_SILL', overrides)
}

/** RF-04: suggested downpipe count and their length. */
export function downpipes(planArea: number, eavesHeight: number, count?: number, overrides: ArchOverrides = {}) {
  const suggested = Math.max(archParam('DOWNPIPE_MIN_COUNT', overrides), roundUp(planArea / archParam('DP_AREA', overrides)))
  const used = count ?? suggested
  return { suggested, length: d4(used * (eavesHeight + archParam('DOWNPIPE_EXTRA_LENGTH', overrides))) }
}

/** DP-06: metres of bead per cartridge. */
export function sealantMetresPerCartridge(overrides: ArchOverrides = {}) {
  return d4(archParam('SEALANT_PACK_VOLUME', overrides) / (archParam('SEALANT_BEAD_WIDTH', overrides) * archParam('SEALANT_BEAD_DEPTH', overrides)))
}

/** OT-07: balustrade posts. */
export function balustradePosts(length: number, postSpacing: number) {
  return roundUp(length / postSpacing) + 1
}
