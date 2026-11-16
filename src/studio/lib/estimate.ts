import type {
  Commercials,
  EstimateRevision,
  FloorSpec,
  Measurement,
  PageScale,
  MeasuredQuantities,
  PriceSheetRow,
  ProjectContext,
  TakeoffLine,
} from '../types'
import {
  ELEMENTS,
  SQFT_PER_M2,
  SYSTEMS,
  computeQuantities,
  elementById,
  floorName,
  priceShares,
  sellMultiplier,
  type SystemId,
} from './elements'

export type AllowanceId = 'lgs' | 'hrs' | 'screws' | 'anchors' | 'connectors' | 'installation' | 'logistics' | 'prelims' | 'mep'

export interface Allowance {
  id: AllowanceId
  label: string
  /** System the allowance is billed under; indirects are spread across systems pro rata. */
  system: SystemId | 'indirect'
  qty: number
  unit: string
  rate: number
  direct: number
  material: number
  fab: number
  install: number
  basis: string
}

export interface SystemTotals {
  id: SystemId
  label: string
  material: number
  fab: number
  install: number
  /** Direct cost of lines and system allowances. */
  direct: number
  /** Direct plus the pro-rata share of indirects (installation, logistics, prelims). */
  directWithIndirects: number
  /** Client-facing amount: directWithIndirects × multiplier. */
  sell: number
  aedPerSqft: number
  lineCount: number
}

export interface CbdRow {
  code: string
  label: string
  amount: number
  /** Share of the selling price. */
  pct: number
  subtotal?: boolean
  total?: boolean
}

export interface QtoRow {
  elementId: string
  label: string
  unit: string
  perFloor: Record<number, number>
  total: number
  totalSqft: number | null
}

export interface BenchmarkCheck {
  id: string
  label: string
  value: number
  unit: string
  low: number
  high: number
  status: 'in' | 'low' | 'high' | 'na'
  note: string
}

export interface Estimate {
  gfaM2: number
  gfaSqft: number
  floorAreas: Array<{ level: number; name: string; areaM2: number; source: 'stated' | 'measured' | 'assumed' | 'none' }>
  multiplier: number
  systems: SystemTotals[]
  allowances: Allowance[]
  direct: { material: number; fab: number; install: number; indirect: number; total: number }
  stack: {
    overhead: number
    margin: number
    finance: number
    contingency: number
    design: number
    customs: number
    tax: number
    commission: number
  }
  costTotal: number
  sellTotal: number
  sellRounded: number
  usdTotal: number
  aedPerSqft: number
  usdPerSqft: number
  boq: Array<{ system: SystemId; label: string; text: string; amount: number }>
  cbd: CbdRow[]
  qto: { floors: FloorSpec[]; rows: QtoRow[] }
  benchmarks: BenchmarkCheck[]
  warnings: string[]
  lineCount: number
  unconfirmedCount: number
}

export interface EstimateInput {
  lines: TakeoffLine[]
  measurements: Measurement[]
  pageScales: Record<string, PageScale>
  projectContext: ProjectContext
  priceSheet: PriceSheetRow[]
}

/**
 * Reference figures from the Zuha Island estimates (5335 Staff Accommodation R4, 5340 Admin R4,
 * 5391 SPA R1, 5345 L-shape staff R3). Selling AED per sqft of built-up area unless stated.
 */
export const BENCHMARKS: Array<{ id: string; label: string; unit: string; low: number; high: number; note: string }> = [
  { id: 'total', label: 'Selling price per sqft', unit: 'AED/sqft', low: 194, high: 284, note: 'Zuha Island buildings landed between 194 and 284 AED/sqft (53–77 USD/sqft).' },
  { id: 'steel', label: 'Steel structural system', unit: 'AED/sqft', low: 69, high: 95, note: 'LGS + HRS + fixings.' },
  { id: 'wall', label: 'Wall system', unit: 'AED/sqft', low: 28, high: 74, note: 'External and internal walls with boards, insulation and finishes.' },
  { id: 'roof', label: 'Roofing system', unit: 'AED/sqft', low: 8, high: 37, note: 'Single-storey buildings sit at the top of the range.' },
  { id: 'ceiling', label: 'Ceiling system', unit: 'AED/sqft', low: 1.5, high: 3, note: 'Gypsum ceilings.' },
  { id: 'floor', label: 'Floor system', unit: 'AED/sqft', low: 4, high: 22, note: 'Zero on single-storey buildings (ground slab by others).' },
  { id: 'openings', label: 'Aluminium doors and windows', unit: 'AED/sqft', low: 16, high: 29, note: 'Per sqft of built-up area.' },
  { id: 'installation', label: 'Site installation', unit: 'AED/m² GFA', low: 55, high: 111, note: 'Zuha: 55 (staff), 93 (L-shape), 95 (admin), 111 (SPA).' },
  { id: 'lgs', label: 'LGS steel weight', unit: 'kg/sqft', low: 4.4, high: 6.3, note: 'Zuha: 4.49, 6.25, 5.72, 4.41 kg/sqft.' },
  { id: 'hrs', label: 'Hot-rolled steel weight', unit: 'kg/sqft', low: 0.7, high: 1.3, note: 'Zuha: 1.09, 0.71, 1.14, 1.26 kg/sqft.' },
  { id: 'containers', label: 'Containers per 1000 sqft', unit: 'nr', low: 1.2, high: 2.7, note: 'Zuha: 44/36781, 15/5598, 33/21850, 24/15866.' },
]

const SYSTEM_IDS = SYSTEMS.map((system) => system.id)

function num(value: number | undefined | null): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function systemForLine(line: TakeoffLine): SystemId {
  const element = elementById(line.element)
  if (element) return element.system
  const text = `${line.system} ${line.type} ${line.tag}`.toLowerCase()
  if (/footing|foundation|slab|ground beam|substructure/.test(text)) return 'foundation'
  if (/window|door|glaz|curtain|louv/.test(text)) return 'openings'
  if (/roof|sandwich|parapet/.test(text)) return 'roof'
  if (/ceiling|bulkhead/.test(text)) return 'ceiling'
  if (/floor|deck|stair|tread|chequer/.test(text)) return 'floor'
  if (/wall|partition|board|gypsum|rockwool|insulation|cladding|render|facade|façade/.test(text)) return 'wall'
  if (/lgs|steel|hrs|column|beam|truss|frame|structure|anchor|screw/.test(text)) return 'steel'
  if (/mep|electrical|plumb|duct|conduit/.test(text)) return 'mep'
  return 'additional'
}

function splitDirect(line: TakeoffLine, priceSheet: PriceSheetRow[], direct: number) {
  const row = line.rateRowId ? priceSheet.find((item) => item.id === line.rateRowId) : undefined
  if (row && row.unitPrice > 0 && (row.materialCost != null || row.fabCost != null || row.installCost != null)) {
    const m = num(row.materialCost) / row.unitPrice
    const f = num(row.fabCost) / row.unitPrice
    const i = num(row.installCost) / row.unitPrice
    const sum = m + f + i
    if (sum > 0) {
      return { material: (direct * m) / sum, fab: (direct * f) / sum, install: (direct * i) / sum }
    }
  }
  // Unknown split: boards and panels are mostly material; labour is fabrication-heavy in the factory.
  return { material: direct * 0.65, fab: direct * 0.2, install: direct * 0.15 }
}

function floorAreas(input: EstimateInput): Estimate['floorAreas'] {
  const { projectContext: ctx, measurements, pageScales } = input
  const measured = new Map<number, number>()
  const fallback = new Map<number, number>()
  for (const m of measurements) {
    if (m.floor == null) continue
    const scale = pageScales[`${m.fileId}:${m.pageNumber}`] ?? null
    const q = computeQuantities(m, ctx, scale)
    const area = num(q.netM2)
    if (!area) continue
    if (m.elementId === 'floor' || m.elementId === 'ground-slab') measured.set(m.floor, (measured.get(m.floor) ?? 0) + area)
    else if (m.elementId === 'ceiling' || m.elementId === 'wet-ceiling') fallback.set(m.floor, (fallback.get(m.floor) ?? 0) + area)
  }
  const out: Estimate['floorAreas'] = ctx.floors.map((floor) => {
    if (floor.areaM2 && floor.areaM2 > 0) return { level: floor.level, name: floor.name, areaM2: floor.areaM2, source: 'stated' as const }
    const m = measured.get(floor.level) ?? 0
    if (m > 0) return { level: floor.level, name: floor.name, areaM2: round(m, 2), source: 'measured' as const }
    const f = fallback.get(floor.level) ?? 0
    if (f > 0) return { level: floor.level, name: floor.name, areaM2: round(f, 2), source: 'measured' as const }
    return { level: floor.level, name: floor.name, areaM2: 0, source: 'none' as const }
  })
  // The ground floor plate is rarely measured (slab by others): assume it matches the floor above.
  const known = out.filter((floor) => floor.areaM2 > 0)
  if (known.length) {
    for (const floor of out) {
      if (floor.areaM2 === 0) {
        const neighbour = out.find((other) => other.level === floor.level + 1 && other.areaM2 > 0) ?? known[0]
        floor.areaM2 = neighbour.areaM2
        floor.source = 'assumed'
      }
    }
  }
  return out
}

/** Share of a measured figure that may differ from the ratio before the estimator is told. */
const RATIO_TOLERANCE = 0.25

function allowances(c: Commercials, gfaM2: number, directLines: number, measured: MeasuredQuantities | null | undefined, warnings: string[]): Allowance[] {
  const out: Allowance[] = []
  const gfaSqft = gfaM2 * SQFT_PER_M2
  const steel = measured && measured.lgsGrossKg > 0 ? measured : null
  if (c.includeSteelAllowance && (gfaM2 > 0 || steel)) {
    const ratioLgsKg = gfaM2 * c.lgsKgPerM2
    const lgsKg = steel ? steel.lgsGrossKg : ratioLgsKg
    const hrsKg = steel ? steel.hrsKg : gfaM2 * c.hrsKgPerM2
    const lgsMaterialShare = 3.5 / 5.9
    const measuredBasis = steel
      ? `measured: super structure ${steel.superApprovedBy ? `approved by ${steel.superApprovedBy}` : 'NOT approved'} · net ${round(steel.lgsNetKg)} kg + wastage`
      : ''
    if (steel) {
      if (!steel.superApprovedBy) warnings.push('Steel is priced from a super structure run that is not approved yet.')
      if (gfaM2 > 0 && ratioLgsKg > 0 && Math.abs(lgsKg - ratioLgsKg) / ratioLgsKg > RATIO_TOLERANCE) {
        warnings.push(`Measured LGS is ${round(lgsKg / gfaM2, 1)} kg/m², the ratio says ${round(c.lgsKgPerM2, 1)} kg/m². Check the super structure before quoting.`)
      }
    } else {
      warnings.push(`Steel is priced from the ${round(c.lgsKgPerM2, 1)} kg/m² ratio, not measured. Run and approve the super structure to price measured steel.`)
    }
    out.push({
      id: 'lgs',
      label: 'LGS structure',
      system: 'steel',
      qty: round(lgsKg),
      unit: 'kg',
      rate: c.lgsRatePerKg,
      direct: lgsKg * c.lgsRatePerKg,
      material: lgsKg * c.lgsRatePerKg * lgsMaterialShare,
      fab: lgsKg * c.lgsRatePerKg * (1 - lgsMaterialShare),
      install: 0,
      basis: steel ? measuredBasis : `RATIO ${round(c.lgsKgPerM2, 1)} kg/m² × ${round(gfaM2)} m² (${round(lgsKg / gfaSqft, 2)} kg/sqft)`,
    })
    out.push({
      id: 'hrs',
      label: 'Hot-rolled steel (outsourced, incl. installation)',
      system: 'steel',
      qty: round(hrsKg),
      unit: 'kg',
      rate: c.hrsRatePerKg,
      direct: hrsKg * c.hrsRatePerKg,
      material: hrsKg * c.hrsRatePerKg,
      fab: 0,
      install: 0,
      basis: steel ? `measured: HRS markups and manual members` : `RATIO ${round(c.hrsKgPerM2, 1)} kg/m² × ${round(gfaM2)} m² (${round(hrsKg / gfaSqft, 2)} kg/sqft)`,
    })
    const screws = steel && steel.screws > 0 ? steel.screws : gfaM2 * c.screwsPerM2
    out.push({
      id: 'screws',
      label: 'Self-drilling screws',
      system: 'steel',
      qty: round(screws),
      unit: 'nr',
      rate: c.screwRate,
      direct: screws * c.screwRate,
      material: screws * c.screwRate,
      fab: 0,
      install: 0,
      basis: steel && steel.screws > 0 ? 'measured: super structure' : `${round(c.screwsPerM2)} nr/m²`,
    })
    const anchors = steel && steel.anchors > 0 ? steel.anchors : c.anchorsCount
    out.push({
      id: 'anchors',
      label: 'Anchor bolts',
      system: 'steel',
      qty: anchors,
      unit: 'nr',
      rate: c.anchorRate,
      direct: anchors * c.anchorRate,
      material: anchors * c.anchorRate,
      fab: 0,
      install: 0,
      basis: steel && steel.anchors > 0 ? 'measured: M10 + M8 from the super structure' : 'lump allowance',
    })
    const connectors = steel && steel.connectorsAed > 0 ? steel.connectorsAed : lgsKg * c.connectorsPerKgLgs
    out.push({
      id: 'connectors',
      label: 'LGS connectors and accessories',
      system: 'steel',
      qty: 1,
      unit: 'LS',
      rate: connectors,
      direct: connectors,
      material: connectors,
      fab: 0,
      install: 0,
      basis: steel && steel.connectorsAed > 0 ? 'measured: super structure' : `${round(c.connectorsPerKgLgs, 3)} AED per kg of LGS`,
    })
  }
  if (c.includeMep && gfaM2 > 0) {
    const panels = Math.ceil(gfaM2 * c.mepPanelsPerM2)
    out.push({
      id: 'mep',
      label: 'MEP first-fix installation on LGS panels (material by others)',
      system: 'mep',
      qty: panels,
      unit: 'panels',
      rate: c.mepRatePerPanel,
      direct: panels * c.mepRatePerPanel,
      material: 0,
      fab: 0,
      install: panels * c.mepRatePerPanel,
      basis: `${round(c.mepPanelsPerM2, 3)} panels/m²`,
    })
  }
  if (c.includeInstallation && gfaM2 > 0) {
    const model = measured?.labourAed && measured.labourAed > 0 ? measured : null
    const useModel = Boolean(model && !model.labourUnmatched)
    if (model && !useModel) {
      warnings.push(`Labour model has ${model.labourUnmatched} in-scope row${model.labourUnmatched === 1 ? '' : 's'} with no gang-days or rate; installation falls back to ${c.installPerM2} AED/m².`)
    } else if (!model) {
      warnings.push(`Installation is the ${c.installPerM2} AED/m² allowance. Open Dry cost to build it from productivity norms.`)
    }
    const amount = useModel ? model!.labourAed! : gfaM2 * c.installPerM2
    if (useModel) {
      const perM2 = amount / gfaM2
      const band = BENCHMARKS.find((b) => b.id === 'installation')!
      if (perM2 < band.low || perM2 > band.high) warnings.push(`Labour model gives ${round(perM2)} AED/m² installation; Zuha jobs ran ${band.low}–${band.high}. Check the norms.`)
    }
    out.push({
      id: 'installation',
      label: 'Site installation labour',
      system: 'indirect',
      qty: useModel ? model!.labourGangDays ?? 0 : round(gfaM2, 1),
      unit: useModel ? 'gang-days' : 'm²',
      rate: useModel ? round(amount / Math.max(1, model!.labourGangDays ?? 1), 2) : c.installPerM2,
      direct: amount,
      material: 0,
      fab: 0,
      install: amount,
      basis: useModel ? `labour model: ${model!.labourGangDays} gang-days from productivity norms (${round(amount / gfaM2)} AED/m²)` : `ALLOWANCE ${c.installPerM2} AED/m² of built-up area`,
    })
  }
  if (c.includeLogistics && gfaM2 > 0) {
    const containers = Math.max(1, Math.ceil(gfaM2 / Math.max(1, c.m2PerContainer)))
    const perContainer = c.trailerPerContainer + c.palletPerContainer
    out.push({
      id: 'logistics',
      label: `Logistics: ${containers} × 40 ft containers (trailer + wooden pallets)`,
      system: 'indirect',
      qty: containers,
      unit: 'containers',
      rate: perContainer,
      direct: containers * perContainer,
      material: containers * c.palletPerContainer,
      fab: 0,
      install: containers * c.trailerPerContainer,
      basis: `1 container per ${round(c.m2PerContainer, 1)} m²; ${c.trailerPerContainer} trailer + ${c.palletPerContainer} pallets`,
    })
  }
  if (c.includePrelims) {
    const base = directLines + out.reduce((sum, item) => sum + item.direct, 0)
    const amount = c.prelimsLumpSum > 0 ? c.prelimsLumpSum : (base * c.prelimsPct) / 100
    if (amount > 0) {
      out.push({
        id: 'prelims',
        label: 'Preliminaries (site staff, security, plant)',
        system: 'indirect',
        qty: 1,
        unit: 'LS',
        rate: amount,
        direct: amount,
        material: 0,
        fab: 0,
        install: amount,
        basis: c.prelimsLumpSum > 0 ? 'lump sum' : `${c.prelimsPct}% of direct cost`,
      })
    }
  }
  return out
}

function qtoRows(input: EstimateInput): QtoRow[] {
  const { projectContext: ctx, measurements, pageScales } = input
  const rows = new Map<string, QtoRow>()
  for (const element of ELEMENTS) {
    if (!ctx.elements.includes(element.id)) continue
    rows.set(element.id, {
      elementId: element.id,
      label: element.label,
      unit: element.measure === 'count' ? 'nr' : element.unit === 'm³' ? 'm³' : element.measure === 'length' && element.unit === 'm' ? 'm' : 'm²',
      perFloor: {},
      total: 0,
      totalSqft: null,
    })
  }
  for (const m of measurements) {
    let row = rows.get(m.elementId)
    if (!row) {
      const element = elementById(m.elementId)
      if (!element) continue
      row = { elementId: element.id, label: element.label, unit: element.unit === 'm³' ? 'm³' : element.measure === 'count' ? 'nr' : element.unit, perFloor: {}, total: 0, totalSqft: null }
      rows.set(element.id, row)
    }
    const scale = pageScales[`${m.fileId}:${m.pageNumber}`] ?? null
    const q = computeQuantities(m, ctx, scale)
    const value = row.unit === 'm²' ? num(q.netM2) || (q.unit === 'm²' ? q.qty : 0) : row.unit === 'nr' ? num(q.count) : q.qty
    const level = m.floor ?? -1
    row.perFloor[level] = (row.perFloor[level] ?? 0) + value
    row.total += value
  }
  return [...rows.values()]
    .filter((row) => row.total > 0 || ctx.elements.includes(row.elementId))
    .map((row) => ({
      ...row,
      total: round(row.total, 2),
      perFloor: Object.fromEntries(Object.entries(row.perFloor).map(([k, v]) => [k, round(v, 2)])),
      totalSqft: row.unit === 'm²' ? round(row.total * SQFT_PER_M2) : null,
    }))
}

export function buildEstimate(input: EstimateInput): Estimate {
  const { lines, projectContext: ctx, priceSheet } = input
  const c = ctx.commercials
  const warnings: string[] = []
  const multiplier = sellMultiplier(c)

  const areas = floorAreas(input)
  const gfaM2 = round(areas.reduce((sum, floor) => sum + floor.areaM2, 0), 2)
  const gfaSqft = round(gfaM2 * SQFT_PER_M2)
  if (!gfaM2) warnings.push('Built-up area is 0. Set floor areas in Project context or measure each floor plate; steel, installation and logistics allowances depend on it.')
  if (areas.some((floor) => floor.source === 'assumed')) warnings.push('Some floor areas are assumed equal to the floor above. Set them in Project context to confirm.')

  const systems = new Map<SystemId, SystemTotals>(
    SYSTEM_IDS.map((id) => [
      id,
      { id, label: SYSTEMS.find((s) => s.id === id)!.label, material: 0, fab: 0, install: 0, direct: 0, directWithIndirects: 0, sell: 0, aedPerSqft: 0, lineCount: 0 },
    ]),
  )

  let unconfirmed = 0
  let unpriced = 0
  for (const line of lines) {
    const direct = num(line.quantity) * num(line.unitPrice)
    if (!line.confirmed) unconfirmed += 1
    if (num(line.quantity) > 0 && !num(line.unitPrice)) unpriced += 1
    const system = systems.get(systemForLine(line))!
    const split = splitDirect(line, priceSheet, direct)
    system.material += split.material
    system.fab += split.fab
    system.install += split.install
    system.direct += direct
    system.lineCount += 1
  }
  if (unpriced) warnings.push(`${unpriced} canvas line${unpriced === 1 ? ' has' : 's have'} a quantity but no rate.`)
  if (unconfirmed) warnings.push(`${unconfirmed} canvas line${unconfirmed === 1 ? ' is' : 's are'} not confirmed yet; the summary prices every line on the canvas.`)

  const directLines = [...systems.values()].reduce((sum, system) => sum + system.direct, 0)
  const allowanceRows = allowances(c, gfaM2, directLines, ctx.measured, warnings)
  for (const allowance of allowanceRows) {
    if (allowance.system === 'indirect') continue
    const system = systems.get(allowance.system)!
    system.material += allowance.material
    system.fab += allowance.fab
    system.install += allowance.install
    system.direct += allowance.direct
  }

  const indirect = allowanceRows.filter((item) => item.system === 'indirect').reduce((sum, item) => sum + item.direct, 0)
  const directSystems = [...systems.values()].reduce((sum, system) => sum + system.direct, 0)
  const directTotal = directSystems + indirect
  for (const system of systems.values()) {
    const share = directSystems > 0 ? system.direct / directSystems : 0
    system.directWithIndirects = system.direct + indirect * share
    system.sell = system.directWithIndirects * multiplier
    system.aedPerSqft = gfaSqft > 0 ? system.sell / gfaSqft : 0
  }

  const prelims = allowanceRows.find((a) => a.id === 'prelims')?.direct ?? 0
  const logistics = allowanceRows.find((a) => a.id === 'logistics')?.direct ?? 0
  const installationAllowance = allowanceRows.find((a) => a.id === 'installation')?.direct ?? 0
  const material = [...systems.values()].reduce((sum, s) => sum + s.material, 0)
  const fab = [...systems.values()].reduce((sum, s) => sum + s.fab, 0)
  const install = [...systems.values()].reduce((sum, s) => sum + s.install, 0) + installationAllowance

  // Commercial build-up. Risk and engineering sit on cost; customs on imported material only;
  // overhead on the cost subtotal; margin and commission are shares of the final selling price.
  const contingency = directTotal * (c.contingencyPct / 100)
  const design = directTotal * (c.designPct / 100)
  const finance = (directTotal + contingency + design) * (c.financePct / 100)
  const importedShare = Math.min(100, Math.max(0, c.importedMaterialPct ?? 100)) / 100
  const customs = material * importedShare * (c.customsPct / 100)
  const costBeforeOverhead = directTotal + contingency + design + finance + customs
  const overhead = costBeforeOverhead * (c.overheadPct / 100)
  const costTotal = costBeforeOverhead + overhead
  const { marginShare, commissionShare } = priceShares(c)
  const sellTotal = costTotal / (1 - marginShare - commissionShare)
  const margin = sellTotal * marginShare
  const commission = sellTotal * commissionShare
  const tax = 0
  if (c.corporateTaxPct > 0) warnings.push('Corporate tax is charged on profit, not added to the price. The corporate tax % is ignored; set the margin to cover it.')
  const effectiveMultiplier = directTotal > 0 ? sellTotal / directTotal : multiplier
  for (const system of systems.values()) {
    system.sell = system.directWithIndirects * effectiveMultiplier
    system.aedPerSqft = gfaSqft > 0 ? system.sell / gfaSqft : 0
  }
  const sellRounded = Math.round(sellTotal / 10) * 10
  const usdTotal = c.usdRate > 0 ? sellTotal / c.usdRate : 0

  const pct = (value: number) => (sellTotal > 0 ? value / sellTotal : 0)
  const labourFab = fab
  const labourInstall = install
  const materialsOnly = material
  const cbd: CbdRow[] = [
    { code: 'A', label: 'Direct costs – materials and supply', amount: materialsOnly, pct: pct(materialsOnly), subtotal: true },
    { code: 'B1', label: 'Fabrication charges', amount: labourFab, pct: pct(labourFab) },
    { code: 'B2', label: 'Installation charges', amount: labourInstall, pct: pct(labourInstall) },
    { code: 'B', label: 'Direct costs – labour', amount: labourFab + labourInstall, pct: pct(labourFab + labourInstall), subtotal: true },
    { code: 'C1', label: 'Preliminary charges', amount: prelims, pct: pct(prelims) },
    { code: 'C2', label: 'Logistic charges', amount: logistics, pct: pct(logistics) },
    { code: 'C', label: 'Preliminaries and logistics', amount: prelims + logistics, pct: pct(prelims + logistics), subtotal: true },
    { code: 'D', label: 'Design and engineering', amount: design, pct: pct(design), subtotal: true },
    { code: 'F', label: 'Contingency (on direct cost)', amount: contingency, pct: pct(contingency), subtotal: true },
    { code: 'G', label: 'Finance charges', amount: finance, pct: pct(finance), subtotal: true },
    ...(customs ? [{ code: 'G2', label: 'Customs (imported material)', amount: customs, pct: pct(customs), subtotal: true }] : []),
    { code: 'E', label: 'Head office overheads', amount: overhead, pct: pct(overhead), subtotal: true },
    { code: '', label: 'Total project cost (A to G)', amount: costTotal, pct: pct(costTotal), total: true },
    { code: 'H', label: 'Margin / profit', amount: margin, pct: pct(margin), subtotal: true },
    { code: '', label: 'Total project value (cost + margin)', amount: costTotal + margin, pct: pct(costTotal + margin), total: true },
    { code: 'J', label: 'Commission', amount: commission, pct: pct(commission), subtotal: true },
    { code: '', label: 'Total final project value (selling price)', amount: sellTotal, pct: 1, total: true },
  ]

  const boq = SYSTEMS.filter((system) => (systems.get(system.id)?.sell ?? 0) > 0).map((system) => ({
    system: system.id,
    label: system.label,
    text: system.boqText,
    amount: Math.round((systems.get(system.id)!.sell) / 10) * 10,
  }))

  const bySystem = (id: SystemId) => systems.get(id)!
  const lgsKg = allowanceRows.find((a) => a.id === 'lgs')?.qty ?? 0
  const hrsKg = allowanceRows.find((a) => a.id === 'hrs')?.qty ?? 0
  const containers = allowanceRows.find((a) => a.id === 'logistics')?.qty ?? 0
  const checks: Array<[string, number]> = [
    ['total', gfaSqft ? sellTotal / gfaSqft : 0],
    ['steel', bySystem('steel').aedPerSqft],
    ['wall', bySystem('wall').aedPerSqft],
    ['roof', bySystem('roof').aedPerSqft],
    ['ceiling', bySystem('ceiling').aedPerSqft],
    ['floor', bySystem('floor').aedPerSqft],
    ['openings', bySystem('openings').aedPerSqft],
    ['installation', c.includeInstallation ? c.installPerM2 : 0],
    ['lgs', gfaSqft ? lgsKg / gfaSqft : 0],
    ['hrs', gfaSqft ? hrsKg / gfaSqft : 0],
    ['containers', gfaSqft ? (containers / gfaSqft) * 1000 : 0],
  ]
  const benchmarks: BenchmarkCheck[] = checks.map(([id, value]) => {
    const ref = BENCHMARKS.find((item) => item.id === id)!
    const status: BenchmarkCheck['status'] = !gfaSqft || value === 0 ? 'na' : value < ref.low ? 'low' : value > ref.high ? 'high' : 'in'
    return { id, label: ref.label, value: round(value, 2), unit: ref.unit, low: ref.low, high: ref.high, status, note: ref.note }
  })

  return {
    gfaM2,
    gfaSqft,
    floorAreas: areas,
    multiplier: round(effectiveMultiplier, 4),
    systems: [...systems.values()],
    allowances: allowanceRows,
    direct: { material, fab, install, indirect, total: directTotal },
    stack: { overhead, margin, finance, contingency, design, customs, tax, commission },
    costTotal,
    sellTotal,
    sellRounded,
    usdTotal,
    aedPerSqft: gfaSqft ? sellTotal / gfaSqft : 0,
    usdPerSqft: gfaSqft && c.usdRate ? sellTotal / c.usdRate / gfaSqft : 0,
    boq,
    cbd,
    qto: { floors: ctx.floors, rows: qtoRows(input) },
    benchmarks,
    warnings,
    lineCount: lines.length,
    unconfirmedCount: unconfirmed,
  }
}

export function revisionFromEstimate(estimate: Estimate, label: string, note: string): EstimateRevision {
  return {
    id: `rev-${Date.now().toString(36)}`,
    label,
    savedAt: new Date().toISOString(),
    note,
    gfaM2: estimate.gfaM2,
    directAed: round(estimate.direct.total),
    sellAed: estimate.sellRounded,
    systems: Object.fromEntries(estimate.systems.map((system) => [system.id, round(system.sell)])),
    lineCount: estimate.lineCount,
  }
}

export function nextRevisionLabel(revisions: EstimateRevision[]): string {
  const numbers = revisions.map((rev) => Number(/^R(\d+)/i.exec(rev.label)?.[1])).filter((n) => Number.isFinite(n))
  return `R${numbers.length ? Math.max(...numbers) + 1 : 0}`
}

export function fmtAed(value: number, digits = 0): string {
  return value.toLocaleString('en-AE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Compact text version of the estimate for the chat agent. */
export function estimateSummaryText(estimate: Estimate, currency: string): string {
  const lines: string[] = []
  lines.push(
    `Built-up area ${fmtAed(estimate.gfaM2)} m² (${fmtAed(estimate.gfaSqft)} sqft) from ${estimate.floorAreas
      .map((floor) => `${floor.name} ${fmtAed(floor.areaM2)} m² (${floor.source})`)
      .join('; ')}`,
  )
  lines.push(
    `Direct cost ${fmtAed(estimate.direct.total)} ${currency} (material ${fmtAed(estimate.direct.material)}, fabrication ${fmtAed(estimate.direct.fab)}, installation ${fmtAed(estimate.direct.install)}, of which indirects ${fmtAed(estimate.direct.indirect)}). Multiplier ${estimate.multiplier}. Selling ${fmtAed(estimate.sellRounded)} ${currency} = ${fmtAed(estimate.usdTotal)} USD; ${estimate.aedPerSqft.toFixed(1)} ${currency}/sqft, ${estimate.usdPerSqft.toFixed(1)} USD/sqft.`,
  )
  lines.push('Systems (selling incl. pro-rata indirects):')
  for (const system of estimate.systems) {
    if (system.sell <= 0) continue
    lines.push(`- ${system.label}: ${fmtAed(system.sell)} (${system.aedPerSqft.toFixed(1)}/sqft, ${system.lineCount} lines, direct ${fmtAed(system.direct)})`)
  }
  lines.push('Allowances:')
  for (const allowance of estimate.allowances) {
    lines.push(`- ${allowance.label}: ${fmtAed(allowance.qty, allowance.unit === 'm²' ? 1 : 0)} ${allowance.unit} × ${fmtAed(allowance.rate, 2)} = ${fmtAed(allowance.direct)} (${allowance.basis})`)
  }
  const flagged = estimate.benchmarks.filter((check) => check.status === 'low' || check.status === 'high')
  if (flagged.length) {
    lines.push('Benchmark flags against Zuha Island projects:')
    for (const check of flagged) lines.push(`- ${check.label}: ${check.value} ${check.unit} is ${check.status} vs ${check.low}–${check.high}. ${check.note}`)
  } else {
    lines.push('All benchmarks within the Zuha Island range (or not applicable).')
  }
  if (estimate.qto.rows.some((row) => row.total > 0)) {
    lines.push('Quantities by floor:')
    for (const row of estimate.qto.rows) {
      if (row.total <= 0) continue
      const floors = Object.entries(row.perFloor)
        .map(([level, value]) => `${Number(level) < 0 ? 'no floor' : floorName(Number(level))} ${value}`)
        .join(', ')
      lines.push(`- ${row.label}: ${row.total} ${row.unit}${row.totalSqft ? ` (${fmtAed(row.totalSqft)} sqft)` : ''} [${floors}]`)
    }
  }
  if (estimate.warnings.length) lines.push(`Warnings: ${estimate.warnings.join(' ')}`)
  return lines.join('\n')
}
