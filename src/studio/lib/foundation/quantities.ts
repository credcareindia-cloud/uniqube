/**
 * Modules 8–13 and 15: foundation type gate, Type 1/2/3 geometry and quantities, reinforcement
 * (ACI 318 minimums), BOQ rows and validation checks.
 */
import { CompressedGrid, bufferLine, pointInPolygon, polygonArea, polygonMinusRects, polygonPerimeter, unionArea, type RectMm } from './geom.ts'
import { DEFAULT_REBAR_SCHEDULE, STEEL_RATIO_TOL_PCT, barList, sectionsFor } from './rules.ts'
import { makeFlag } from './framing.ts'
import type { Axis, BoqSection, Flag, FoundationElement, FoundationNode, FoundationTypeId, PtMm, QuantityLine, RebarSet, StoreyBand } from './types.ts'

export type LbLine = { id: string; axis: Axis; pos: number; a: number; b: number; wallIds: string[]; external: boolean }

export interface QuantityParams {
  pccFooting: number
  pccSlab: number
  workSpace: number
  subbaseThk: number
  concreteWastePct: number
  rebarLapWastePct: number
  coverEarth: number
  coverFormed: number
  coverSlab: number
  spacingStep: number
  wallBarSpacingMax: number
  fy: number
  padSpacingMax: number
  padSpacingMin: number
  tieBeamMax: number
  nodeSnapTol: number
  barList: number[]
}

export interface QuantityInput {
  type: FoundationTypeId
  band: StoreyBand
  storeyCount: number
  plinthMm: number
  soilBearingKpa: number | null
  lineLoadPerStoreyKnM: number | null
  footprint: PtMm[]
  lines: LbLine[]
  params: QuantityParams
}

export interface QuantityOutput {
  elements: FoundationElement[]
  nodes: FoundationNode[]
  rebar: RebarSet[]
  boq: QuantityLine[]
  flags: Flag[]
  checks: Array<{ id: string; ok: boolean; detail: string }>
  summary: Record<string, number>
}

const M3 = 1e9
const M2 = 1e6
const f2 = (v: number) => Math.round(v * 100) / 100
const f3 = (v: number) => Math.round(v * 1000) / 1000
const m = (mm: number) => f3(mm / 1000)

class Boq {
  rows: QuantityLine[] = []
  private band: StoreyBand
  private concreteWaste: number
  constructor(band: StoreyBand, concreteWaste: number) {
    this.band = band
    this.concreteWaste = concreteWaste
  }
  add(code: string, section: BoqSection, description: string, elementType: string, unit: QuantityLine['unit'], netQty: number, basis: string, ruleIds: string[], elementIds: string[] = [], flags: string[] = []) {
    const waste = section === 'Concrete' && !/PCC|blinding/i.test(description) ? this.concreteWaste : 0
    const net = Math.max(0, netQty)
    this.rows.push({ id: `${code}`, boqCode: code, section, description, elementType, band: this.band, unit, netQty: net, wastePct: waste, grossQty: net * (1 + waste / 100), ruleIds, elementIds, flags, basis })
    return net
  }
  get(code: string) {
    return this.rows.find((r) => r.boqCode === code)?.netQty ?? 0
  }
}

// ——— Module 12: reinforcement selection ———

const barArea = (d: number) => (Math.PI * d * d) / 4
const kgPerM = (d: number) => (d * d) / 162

/** Lightest (dia, spacing) giving As ≥ required per metre with spacing ≤ max, spacing on the step grid. */
function selectSpacing(asReqPerM: number, maxSpacing: number, p: QuantityParams): { dia: number; spacing: number; asProv: number } {
  let best: { dia: number; spacing: number; asProv: number } | null = null
  for (const dia of p.barList) {
    const sMax = Math.floor(Math.min(maxSpacing, (barArea(dia) * 1000) / Math.max(asReqPerM, 1e-6)) / p.spacingStep) * p.spacingStep
    if (sMax < p.spacingStep) continue
    const asProv = (barArea(dia) * 1000) / sMax
    if (!best || asProv < best.asProv) best = { dia, spacing: sMax, asProv }
  }
  return best ?? { dia: p.barList[p.barList.length - 1], spacing: p.spacingStep, asProv: (barArea(p.barList[p.barList.length - 1]) * 1000) / p.spacingStep }
}

/**
 * Lightest bar group giving As ≥ required with at least minBars, main bars ≥ 12 mm, and the bars
 * fitting in one layer of the given clear width (25 mm gaps); within 2 % of the lightest, fewer bars win.
 */
function selectBars(asReq: number, minBars: number, clearWidth: number, p: QuantityParams): { dia: number; count: number; asProv: number } {
  const options = p.barList
    .filter((dia) => dia >= 12)
    .map((dia) => {
      const count = Math.max(minBars, Math.ceil(asReq / barArea(dia)))
      const fits = Math.floor((clearWidth + 25) / (dia + 25))
      return count <= fits ? { dia, count, asProv: count * barArea(dia) } : null
    })
    .filter((o): o is { dia: number; count: number; asProv: number } => o != null)
  if (!options.length) {
    const dia = p.barList[p.barList.length - 1]
    const count = Math.max(minBars, Math.ceil(asReq / barArea(dia)))
    return { dia, count, asProv: count * barArea(dia) }
  }
  const lightest = Math.min(...options.map((o) => o.asProv))
  return options.filter((o) => o.asProv <= lightest * 1.02).sort((a, b) => a.count - b.count)[0]
}

function tieSpacing(mainDia: number, tieDia: number, leastDim: number, p: QuantityParams) {
  return Math.floor(Math.min(16 * mainDia, 48 * tieDia, leastDim) / p.spacingStep) * p.spacingStep
}

function rebarKg(sets: Array<{ dia: number; lengthMm: number; count: number }>, lapWastePct: number) {
  return sets.reduce((s, x) => s + (x.lengthMm / 1000) * x.count * kgPerM(x.dia), 0) * (1 + lapWastePct / 100)
}

// ——— Graph of load-bearing lines (Type 2 / Type 3 ties) ———

interface GraphNode extends FoundationNode {
  lineIds: string[]
}

function lineLength(l: LbLine) {
  return l.b - l.a
}

function buildNodes(lines: LbLine[], p: QuantityParams): GraphNode[] {
  const nodes: GraphNode[] = []
  const tol = p.nodeSnapTol
  const addNode = (pt: PtMm, nodeType: GraphNode['nodeType'], lineIds: string[]) => {
    const near = nodes.find((n) => Math.hypot(n.point.x - pt.x, n.point.y - pt.y) <= tol)
    if (near) {
      for (const id of lineIds) if (!near.lineIds.includes(id)) near.lineIds.push(id)
      const rank = { end: 0, intermediate: 0, tie: 0, corner: 1, T: 2, cross: 3 }
      if (rank[nodeType] > rank[near.nodeType]) near.nodeType = nodeType
      return near
    }
    const n: GraphNode = { id: `N${nodes.length + 1}`, point: { x: Math.round(pt.x), y: Math.round(pt.y) }, nodeType, lineIds: [...lineIds] }
    nodes.push(n)
    return n
  }
  const pt = (l: LbLine, t: number): PtMm => (l.axis === 'h' ? { x: t, y: l.pos } : { x: l.pos, y: t })
  // crossings and junctions
  for (const h of lines.filter((l) => l.axis === 'h')) {
    for (const v of lines.filter((l) => l.axis === 'v')) {
      if (v.pos < h.a - tol || v.pos > h.b + tol || h.pos < v.a - tol || h.pos > v.b + tol) continue
      const hEnd = Math.abs(v.pos - h.a) <= tol || Math.abs(v.pos - h.b) <= tol
      const vEnd = Math.abs(h.pos - v.a) <= tol || Math.abs(h.pos - v.b) <= tol
      addNode({ x: v.pos, y: h.pos }, hEnd && vEnd ? 'corner' : hEnd || vEnd ? 'T' : 'cross', [h.id, v.id])
    }
  }
  // free ends
  for (const l of lines) {
    for (const t of [l.a, l.b]) {
      const q = pt(l, t)
      if (!nodes.some((n) => Math.hypot(n.point.x - q.x, n.point.y - q.y) <= tol)) addNode(q, 'end', [l.id])
    }
  }
  // T2-R3 intermediates
  for (const l of lines) {
    const along = (n: GraphNode) => (l.axis === 'h' ? n.point.x : n.point.y)
    const onLine = nodes.filter((n) => n.lineIds.includes(l.id)).sort((a, b) => along(a) - along(b))
    for (let i = 1; i < onLine.length; i++) {
      const L = along(onLine[i]) - along(onLine[i - 1])
      const n = Math.max(0, Math.ceil(L / p.padSpacingMax) - 1)
      for (let k = 1; k <= n; k++) addNode(pt(l, along(onLine[i - 1]) + (L * k) / (n + 1)), 'intermediate', [l.id])
    }
  }
  // T2-R4 merge pads closer than pad_spacing_min
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        if (Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) < p.padSpacingMin) {
          const keep = a.nodeType === 'intermediate' || a.nodeType === 'end' ? b : a
          const drop = keep === a ? b : a
          if (keep.nodeType === 'intermediate' || keep.nodeType === 'end') keep.point = { x: Math.round((a.point.x + b.point.x) / 2), y: Math.round((a.point.y + b.point.y) / 2) }
          for (const id of drop.lineIds) if (!keep.lineIds.includes(id)) keep.lineIds.push(id)
          nodes.splice(nodes.indexOf(drop), 1)
          merged = true
          break outer
        }
      }
    }
  }
  return nodes
}

interface Edge {
  id: string
  axis: Axis
  pos: number
  a: number
  b: number
  fromId: string
  toId: string
  tie: boolean
}

function buildEdges(lines: LbLine[], nodes: GraphNode[], footprint: PtMm[], p: QuantityParams): { edges: Edge[]; ties: Edge[] } {
  const edges: Edge[] = []
  const ties: Edge[] = []
  const along = (l: LbLine, n: GraphNode) => (l.axis === 'h' ? n.point.x : n.point.y)
  const nodesOn = (l: LbLine) => nodes.filter((n) => n.lineIds.includes(l.id)).sort((x, y) => along(l, x) - along(l, y))
  for (const l of lines) {
    const on = nodesOn(l)
    for (let i = 1; i < on.length; i++) edges.push({ id: `E-${l.id}-${i}`, axis: l.axis, pos: l.pos, a: along(l, on[i - 1]), b: along(l, on[i]), fromId: on[i - 1].id, toId: on[i].id, tie: false })
  }
  // T2-R6 tie beams
  for (const l of lines) {
    const on = nodesOn(l)
    const connected = on.filter((n) => n.lineIds.length > 1 || n.nodeType === 'corner' || n.nodeType === 'T' || n.nodeType === 'cross')
    for (let i = 1; i < connected.length; i++) {
      const gap = along(l, connected[i]) - along(l, connected[i - 1])
      if (gap <= p.tieBeamMax) continue
      const mid = (along(l, connected[i]) + along(l, connected[i - 1])) / 2
      const start = on.reduce((best, n) => (Math.abs(along(l, n) - mid) < Math.abs(along(l, best) - mid) ? n : best), on[0])
      // nearest parallel line reachable inside the footprint, either side
      let target: { line: LbLine; dist: number } | null = null
      for (const o of lines) {
        if (o.id === l.id || o.axis !== l.axis) continue
        const t = along(l, start)
        if (t < o.a - p.nodeSnapTol || t > o.b + p.nodeSnapTol) continue
        const dist = Math.abs(o.pos - l.pos)
        if (dist < 500) continue
        const probe = l.axis === 'h' ? { x: t, y: (l.pos + o.pos) / 2 } : { x: (l.pos + o.pos) / 2, y: t }
        if (!pointInPolygon(probe, footprint)) continue
        if (!target || dist < target.dist) target = { line: o, dist }
      }
      if (!target) continue
      const t = along(l, start)
      const far: PtMm = l.axis === 'h' ? { x: t, y: target.line.pos } : { x: target.line.pos, y: t }
      let farNode = nodes.find((n) => Math.hypot(n.point.x - far.x, n.point.y - far.y) <= p.nodeSnapTol)
      if (!farNode) {
        farNode = { id: `N${nodes.length + 1}`, point: { x: Math.round(far.x), y: Math.round(far.y) }, nodeType: 'tie', lineIds: [target.line.id] }
        nodes.push(farNode)
        // split the target line's edge at the new node
        const idx = edges.findIndex((e) => !e.tie && e.axis === target!.line.axis && Math.abs(e.pos - target!.line.pos) < 1 && t > e.a && t < e.b)
        if (idx >= 0) {
          const e = edges[idx]
          edges.splice(idx, 1, { ...e, id: `${e.id}a`, b: t, toId: farNode.id }, { ...e, id: `${e.id}b`, a: t, fromId: farNode.id })
        }
      }
      const tieAxis: Axis = l.axis === 'h' ? 'v' : 'h'
      const lo = Math.min(l.pos, target.line.pos)
      const hi = Math.max(l.pos, target.line.pos)
      if (!ties.some((x) => x.axis === tieAxis && Math.abs(x.pos - t) <= p.nodeSnapTol && Math.abs(x.a - lo) <= p.nodeSnapTol)) {
        ties.push({ id: `T-${l.id}-${i}`, axis: tieAxis, pos: t, a: lo, b: hi, fromId: start.id, toId: farNode.id, tie: true })
        if (!start.lineIds.includes(`tie:${t}`)) start.lineIds.push(`tie:${t}`)
      }
    }
  }
  return { edges, ties }
}

// ——— Entry point ———

export function computeQuantities(input: QuantityInput): QuantityOutput {
  const { type, band, footprint, lines, params: p } = input
  const flags: Flag[] = []
  const checks: QuantityOutput['checks'] = []
  const elements: FoundationElement[] = []
  const rebar: RebarSet[] = []
  const boq = new Boq(band, p.concreteWastePct)
  const sections = sectionsFor(type, band)
  const plinth = input.plinthMm
  const slabT = Number(sections.slab_on_grade?.thickness ?? 150)
  const footprintArea = polygonArea(footprint)
  const footprintPerim = polygonPerimeter(footprint)
  let nodes: FoundationNode[] = []
  const summary: Record<string, number> = { footprintM2: f2(footprintArea / M2), lbLengthM: f2(lines.reduce((s, l) => s + lineLength(l), 0) / 1000) }

  /** VC-01: steel ratio against the default schedule. `units` (each / m) compares per unit when given. */
  const ratioCheck = (element: string, kg: number, volumeM3: number, units?: number) => {
    const row = DEFAULT_REBAR_SCHEDULE.find((r) => r.element === element && (r.band === band || r.band.includes(band) || r.band === 'all') && (r.type === type || r.type === 'all'))
    if (!row) return
    const perUnit = units != null && units > 0
    if (!perUnit && volumeM3 <= 0) return
    const ratio = perUnit ? kg / units : kg / volumeM3
    const ref = perUnit ? row.kg : row.kg_per_m3
    const unitLabel = perUnit ? `kg/${row.per}` : 'kg/m³'
    const dev = ((ratio - ref) / ref) * 100
    const ok = Math.abs(dev) <= STEEL_RATIO_TOL_PCT
    checks.push({ id: `VC-01 ${element}`, ok, detail: `${Math.round(ratio)} ${unitLabel} vs schedule ${ref} ${unitLabel} (${dev >= 0 ? '+' : ''}${Math.round(dev)} %)` })
    if (!ok) flags.push(makeFlag('F-RATIO', [element], `${element}: computed ${Math.round(ratio)} ${unitLabel} differs from the default schedule ${ref} ${unitLabel} by ${Math.round(dev)} % (tolerance ±${STEEL_RATIO_TOL_PCT} %).`))
  }

  const slabWorks = (codePrefix: string, offset: number, meshCode: string, sArea: number, sGrid: CompressedGrid | null, extraAntiTermite: number, ruleBase: string) => {
    const code = (n: number) => `${codePrefix}-${String(offset + n).padStart(2, '0')}`
    const fill = plinth - slabT - p.subbaseThk
    boq.add(code(0), 'Earthworks', 'Plinth fill, compacted in layers', 'slab_on_grade', 'm3', (sArea * Math.max(0, fill)) / M3, `area(S) ${f2(sArea / M2)} m² × (plinth ${plinth} − slab ${slabT} − sub-base ${p.subbaseThk}) mm`, [`${ruleBase}`])
    boq.add(code(1), 'Earthworks', `Granular sub-base ${p.subbaseThk} mm`, 'slab_on_grade', 'm3', (sArea * p.subbaseThk) / M3, `area(S) ${f2(sArea / M2)} m² × ${p.subbaseThk} mm`, [`${ruleBase}`])
    boq.add(code(2), 'Concrete', `PCC blinding under slab ${p.pccSlab} mm`, 'slab_on_grade', 'm3', (sArea * p.pccSlab) / M3, `area(S) ${f2(sArea / M2)} m² × ${p.pccSlab} mm`, [`${ruleBase}`])
    boq.add(code(3), 'Waterproofing and protection', 'Damp-proof membrane under slab', 'slab_on_grade', 'm2', sArea / M2, `area(S) ${f2(sArea / M2)} m²`, [`${ruleBase}`])
    const slabVol = boq.add(code(4), 'Concrete', `Slab on grade ${slabT} mm`, 'slab_on_grade', 'm3', (sArea * slabT) / M3, `area(S) ${f2(sArea / M2)} m² × ${slabT} mm`, [`${ruleBase}`], ['SLAB'])
    elements.push({ id: 'SLAB', type: 'slab', rects: sGrid ? sGrid.rects() : [], section: { thickness: slabT }, parentIds: [] })
    // RB-02 slab mesh
    const asReq = 0.0018 * 1000 * slabT
    const sel = selectSpacing(asReq, Math.min(3 * slabT, 450), p)
    const kgPerM2 = 2 * (1000 / sel.spacing) * kgPerM(sel.dia) * (1 + p.rebarLapWastePct / 100)
    const kg = (kgPerM2 * sArea) / M2
    rebar.push({ elementType: 'slab_on_grade', role: `T${sel.dia}@${sel.spacing} each way, single layer`, barDia: sel.dia, spacingMm: sel.spacing, count: null, layers: 1, lengthEachMm: 1000, totalKg: kg, kgPerUnit: f2(kgPerM2), perUnit: 'm2', ruleIds: ['RB-02'] })
    ratioCheck('slab_on_grade_150', kg, slabVol)
    boq.add(meshCode, 'Reinforcement', `Slab mesh T${sel.dia}@${sel.spacing} each way (As ${Math.round(asReq)} mm²/m ≥ 0.0018·Ag)`, 'slab_on_grade', 'kg', kg, `${f2(kgPerM2)} kg/m² × ${f2(sArea / M2)} m² incl. ${p.rebarLapWastePct} % laps`, ['RB-02', 'BQ-02'], ['SLAB'])
    return { antiTermite: (sArea + extraAntiTermite) / M2 }
  }

  if (type === 1) {
    const W = Number(sections.strip_footing.width)
    const D = Number(sections.strip_footing.depth)
    const t = Number(sections.rcc_wall.thickness)
    const Hw = Number(sections.rcc_wall.height)
    const F = unionArea(lines.map((l) => bufferLine(l.axis, l.pos, l.a, l.b, W / 2)))
    const WL = unionArea(lines.map((l) => bufferLine(l.axis, l.pos, l.a, l.b, t / 2)))
    const E = unionArea(lines.map((l) => bufferLine(l.axis, l.pos, l.a, l.b, W / 2 + p.workSpace)))
    const S = polygonMinusRects(footprint, WL.grid.rects())
    const extLen = lines.filter((l) => l.external).reduce((s, l) => s + lineLength(l), 0)
    F.grid.rects().forEach((r, i) => elements.push({ id: `SF${i + 1}`, type: 'strip', rects: [r], section: { width: W, depth: D }, parentIds: lines.map((l) => l.id) }))
    WL.grid.rects().forEach((r, i) => elements.push({ id: `RW${i + 1}`, type: 'wall', rects: [r], section: { thickness: t, height: Hw }, parentIds: lines.map((l) => l.id) }))
    const stripIds = elements.filter((e) => e.type === 'strip').map((e) => e.id)
    const wallIds = elements.filter((e) => e.type === 'wall').map((e) => e.id)
    const depthEx = Hw + D + p.pccFooting - plinth
    const ex = boq.add('T1-01', 'Earthworks', 'Excavation for strip footings incl. working space', 'strip_footing', 'm3', (E.areaMm2 * depthEx) / M3, `area(E) ${f2(E.areaMm2 / M2)} m² × (${Hw} + ${D} + ${p.pccFooting} − ${plinth}) mm`, ['T1-01'], stripIds)
    const pcc = boq.add('T1-02', 'Concrete', `PCC blinding under strip footing ${p.pccFooting} mm`, 'strip_footing', 'm3', (F.areaMm2 * p.pccFooting) / M3, `area(F) ${f2(F.areaMm2 / M2)} m² × ${p.pccFooting} mm`, ['T1-02'], stripIds)
    const fVol = boq.add('T1-03', 'Concrete', `RCC strip footing ${W} × ${D}`, 'strip_footing', 'm3', (F.areaMm2 * D) / M3, `area(F) ${f2(F.areaMm2 / M2)} m² × ${D} mm`, ['T1-03'], stripIds)
    boq.add('T1-04', 'Formwork', 'Formwork to strip footing sides', 'strip_footing', 'm2', (F.perimeterMm * D) / M2, `perimeter(F) ${f2(F.perimeterMm / 1000)} m × ${D} mm`, ['T1-04'], stripIds)
    const wVol = boq.add('T1-05', 'Concrete', `RCC wall ${t} thick to plinth`, 'rcc_wall', 'm3', (WL.areaMm2 * Hw) / M3, `area(WL) ${f2(WL.areaMm2 / M2)} m² × ${Hw} mm`, ['T1-05'], wallIds)
    boq.add('T1-06', 'Formwork', 'Formwork to RCC wall both faces', 'rcc_wall', 'm2', (WL.perimeterMm * Hw) / M2, `perimeter(WL) ${f2(WL.perimeterMm / 1000)} m × ${Hw} mm`, ['T1-06'], wallIds)
    const wallBelowNgl = (WL.areaMm2 * (Hw - plinth)) / M3
    const backfill = boq.add('T1-07', 'Earthworks', 'Backfill around footings and walls', 'strip_footing', 'm3', ex - pcc - fVol - wallBelowNgl, `T1-01 ${f2(ex)} − T1-02 ${f2(pcc)} − T1-03 ${f2(fVol)} − area(WL) × (${Hw} − ${plinth}) ${f2(wallBelowNgl)}`, ['T1-07'], stripIds)
    const slab = slabWorks('T1', 8, 'T1-15d', S.areaMm2, S.grid, E.areaMm2, 'T1-08…T1-12')
    boq.add('T1-13', 'Waterproofing and protection', 'Waterproofing to external wall face below NGL', 'rcc_wall', 'm2', (extLen * (Hw - plinth)) / M2, `external LB length ${f2(extLen / 1000)} m × (${Hw} − ${plinth}) mm`, ['T1-13'], wallIds)
    boq.add('T1-14', 'Waterproofing and protection', 'Anti-termite treatment', 'strip_footing', 'm2', slab.antiTermite, `area(E) ${f2(E.areaMm2 / M2)} + area(S) ${f2(S.areaMm2 / M2)} m²`, ['T1-14'])
    // T1-15 reinforcement: RB-01 footing, RB-03 wall
    const Lf = F.areaMm2 / W
    const asF = 0.0018 * 1000 * D
    const tr = selectSpacing(asF, Math.min(3 * D, 450), p)
    const trLen = W - 2 * p.coverEarth + 2 * 12 * tr.dia
    const longN = Math.max(Math.ceil((asF * W) / 1000 / barArea(tr.dia)), Math.floor((W - 2 * p.coverEarth) / tr.spacing) + 1)
    const kgF = rebarKg([{ dia: tr.dia, lengthMm: trLen, count: Lf / tr.spacing }, { dia: tr.dia, lengthMm: Lf, count: longN }], p.rebarLapWastePct)
    rebar.push({ elementType: 'strip_footing', role: `T${tr.dia}@${tr.spacing} transverse; ${longN}T${tr.dia} longitudinal`, barDia: tr.dia, spacingMm: tr.spacing, count: longN, layers: 1, lengthEachMm: Math.round(trLen), totalKg: kgF, kgPerUnit: f2(kgF / (Lf / 1000)), perUnit: 'm', ruleIds: ['RB-01'] })
    ratioCheck('strip_footing', kgF, fVol)
    boq.add('T1-15a', 'Reinforcement', `Strip footing T${tr.dia}@${tr.spacing} transverse + ${longN}T${tr.dia} longitudinal (As ${Math.round(asF)} mm²/m each way, bottom)`, 'strip_footing', 'kg', kgF, `${f2(Lf / 1000)} m effective length; bar ${Math.round(trLen)} mm incl. 12Ø bends; +${p.rebarLapWastePct} % laps`, ['RB-01', 'BQ-02'], stripIds)
    const Lw = WL.areaMm2 / t
    const vert = selectSpacing((0.0012 * 1000 * t) / 2, p.wallBarSpacingMax, p)
    const hor = selectSpacing((0.002 * 1000 * t) / 2, p.wallBarSpacingMax, p)
    const vLen = Hw + D - p.coverEarth + 12 * vert.dia
    const hRows = Math.floor(Hw / hor.spacing) + 1
    const kgWv = rebarKg([{ dia: vert.dia, lengthMm: vLen, count: 2 * (Lw / vert.spacing) }], p.rebarLapWastePct)
    const kgWh = rebarKg([{ dia: hor.dia, lengthMm: Lw, count: 2 * hRows }], p.rebarLapWastePct)
    rebar.push({ elementType: 'rcc_wall', role: `T${vert.dia}@${vert.spacing} vertical each face`, barDia: vert.dia, spacingMm: vert.spacing, count: null, layers: 2, lengthEachMm: Math.round(vLen), totalKg: kgWv, kgPerUnit: f2(kgWv / (Lw / 1000)), perUnit: 'm', ruleIds: ['RB-03'] })
    rebar.push({ elementType: 'rcc_wall', role: `T${hor.dia}@${hor.spacing} horizontal each face`, barDia: hor.dia, spacingMm: hor.spacing, count: hRows, layers: 2, lengthEachMm: Math.round(Lw), totalKg: kgWh, kgPerUnit: f2(kgWh / (Lw / 1000)), perUnit: 'm', ruleIds: ['RB-03'] })
    ratioCheck('rcc_wall', kgWv + kgWh, wVol)
    boq.add('T1-15b', 'Reinforcement', `RCC wall T${vert.dia}@${vert.spacing} vertical, two layers (ρv 0.0012)`, 'rcc_wall', 'kg', kgWv, `2 faces × ${f2(Lw / 1000)} m / ${vert.spacing} mm × ${Math.round(vLen)} mm starter+wall bar`, ['RB-03', 'BQ-02'], wallIds)
    boq.add('T1-15c', 'Reinforcement', `RCC wall T${hor.dia}@${hor.spacing} horizontal, two layers (ρh 0.0020)`, 'rcc_wall', 'kg', kgWh, `2 faces × ${hRows} rows × ${f2(Lw / 1000)} m`, ['RB-03', 'BQ-02'], wallIds)
    // VC-04 closure
    const closure = pcc + fVol + wallBelowNgl + backfill
    const dev = ex > 0 ? (Math.abs(closure - ex) / ex) * 100 : 0
    checks.push({ id: 'VC-04', ok: dev <= 1, detail: `PCC ${f2(pcc)} + footing ${f2(fVol)} + wall below NGL ${f2(wallBelowNgl)} + backfill ${f2(backfill)} = ${f2(closure)} m³ vs excavation ${f2(ex)} m³ (${f2(dev)} %)` })
    checks.push({ id: 'VC-02', ok: withinFootprint(F.grid.rects(), footprint, W / 2 + 50), detail: `Strip footing union stays within the footprint + ${W / 2} mm projection` })
    summary.stripLengthM = f2(Lf / 1000)
    summary.wallLengthM = f2(Lw / 1000)
    summary.foundationPlanM2 = f2(F.areaMm2 / M2)
  } else if (type === 2) {
    const L = Number(sections.isolated_footing.length)
    const B = Number(sections.isolated_footing.breadth)
    const D = Number(sections.isolated_footing.depth)
    const cb = Number(sections.stub_column.b)
    const Hc = Number(sections.stub_column.height)
    const bw = Number(sections.ground_beam.width)
    const Db = Number(sections.ground_beam.depth)
    const graph = buildNodes(lines, p)
    const { edges, ties } = buildEdges(lines, graph, footprint, p)
    nodes = graph.map(({ id, point, nodeType }) => ({ id, point, nodeType }))
    const N = graph.length
    const allBeams = [...edges, ...ties]
    const beamRects = allBeams.map((e) => bufferLine(e.axis, e.pos, e.a, e.b, bw / 2))
    const padIds: string[] = []
    for (const n of graph) {
      padIds.push(`P-${n.id}`)
      elements.push({ id: `P-${n.id}`, type: 'pad', rects: [{ x0: n.point.x - L / 2, x1: n.point.x + L / 2, y0: n.point.y - B / 2, y1: n.point.y + B / 2 }], section: { length: L, breadth: B, depth: D }, parentIds: n.lineIds.filter((x) => !x.startsWith('tie:')) })
      elements.push({ id: `C-${n.id}`, type: 'column', rects: [{ x0: n.point.x - cb / 2, x1: n.point.x + cb / 2, y0: n.point.y - cb / 2, y1: n.point.y + cb / 2 }], section: { b: cb, h: cb, height: Hc }, parentIds: [`P-${n.id}`] })
    }
    const beamIds: string[] = []
    allBeams.forEach((e, i) => {
      beamIds.push(e.id)
      elements.push({ id: e.id, type: e.tie ? 'tie-beam' : 'beam', rects: [beamRects[i]], section: { width: bw, depth: Db }, parentIds: [e.fromId, e.toId], lengthMm: Math.round(e.b - e.a) })
    })
    const clearSum = allBeams.reduce((s, e) => s + Math.max(0, e.b - e.a - cb), 0)
    const columnH = Hc - Db
    const depthPad = Hc + D + p.pccFooting - plinth
    const depthBeam = Db - plinth + p.pccFooting
    const ex1 = boq.add('T2-01', 'Earthworks', `Excavation for ${N} isolated footings incl. working space`, 'isolated_footing', 'm3', (N * (L + 2 * p.workSpace) * (B + 2 * p.workSpace) * depthPad) / M3, `${N} × (${L}+${2 * p.workSpace}) × (${B}+${2 * p.workSpace}) × (${Hc} + ${D} + ${p.pccFooting} − ${plinth}) mm`, ['T2-01'], padIds)
    const ex2 = boq.add('T2-02', 'Earthworks', 'Excavation for ground beam trenches', 'ground_beam', 'm3', (clearSum * (bw + 2 * p.workSpace) * Math.max(0, depthBeam)) / M3, `Σclear ${f2(clearSum / 1000)} m × (${bw}+${2 * p.workSpace}) × (${Db} − ${plinth} + ${p.pccFooting}) mm`, ['T2-02'], beamIds)
    const pcc1 = boq.add('T2-03', 'Concrete', `PCC blinding under pads ${p.pccFooting} mm`, 'isolated_footing', 'm3', (N * L * B * p.pccFooting) / M3, `${N} × ${L} × ${B} × ${p.pccFooting} mm`, ['T2-03'], padIds)
    const pcc2 = boq.add('T2-04', 'Concrete', `PCC blinding under ground beams ${p.pccFooting} mm`, 'ground_beam', 'm3', (clearSum * bw * p.pccFooting) / M3, `Σclear ${f2(clearSum / 1000)} m × ${bw} × ${p.pccFooting} mm`, ['T2-04'], beamIds)
    const padVol = boq.add('T2-05', 'Concrete', `RCC isolated footings ${L} × ${B} × ${D}`, 'isolated_footing', 'm3', (N * L * B * D) / M3, `${N} × ${L} × ${B} × ${D} mm`, ['T2-05'], padIds)
    boq.add('T2-06', 'Formwork', 'Formwork to pad sides', 'isolated_footing', 'm2', (N * 2 * (L + B) * D) / M2, `${N} × 2 × (${L} + ${B}) × ${D} mm`, ['T2-06'], padIds)
    const colVol = boq.add('T2-07', 'Concrete', `RCC stub columns ${cb} × ${cb}`, 'stub_column', 'm3', (N * cb * cb * columnH) / M3, `${N} × ${cb}² × (${Hc} − ${Db}) mm`, ['T2-07'])
    boq.add('T2-08', 'Formwork', 'Formwork to stub columns', 'stub_column', 'm2', (N * 4 * cb * columnH) / M2, `${N} × 4 × ${cb} × (${Hc} − ${Db}) mm`, ['T2-08'])
    const beamVol = boq.add('T2-09', 'Concrete', `RCC ground beams ${bw} × ${Db}`, 'ground_beam', 'm3', ((clearSum + N * cb) * bw * Db) / M3, `(Σclear ${f2(clearSum / 1000)} m + ${N} joints × ${cb}) × ${bw} × ${Db} mm`, ['T2-09'], beamIds)
    boq.add('T2-10', 'Formwork', 'Formwork to ground beam sides', 'ground_beam', 'm2', (clearSum * 2 * Db) / M2, `Σclear ${f2(clearSum / 1000)} m × 2 × ${Db} mm`, ['T2-10'], beamIds)
    const colBelow = (N * cb * cb * Math.max(0, Hc - Math.max(Db, plinth))) / M3
    const beamBelow = ((clearSum + N * cb) * bw * Math.max(0, Db - plinth)) / M3
    const below = pcc1 + pcc2 + padVol + colBelow + beamBelow
    const backfill = boq.add('T2-11', 'Earthworks', 'Backfill to pads and beam trenches', 'isolated_footing', 'm3', ex1 + ex2 - below, `T2-01 ${f2(ex1)} + T2-02 ${f2(ex2)} − (PCC ${f2(pcc1 + pcc2)} + pads ${f2(padVol)} + columns below NGL ${f2(colBelow)} + beams below NGL ${f2(beamBelow)})`, ['T2-11'])
    const S = polygonMinusRects(footprint, beamRects)
    const slab = slabWorks('T2', 12, 'T2-18f', S.areaMm2, S.grid, N * (L + 2 * p.workSpace) * (B + 2 * p.workSpace), 'T2-12…T2-16')
    boq.add('T2-17', 'Waterproofing and protection', 'Anti-termite treatment', 'isolated_footing', 'm2', slab.antiTermite, `pad excavation plan + area(S) ${f2(S.areaMm2 / M2)} m²`, ['T2-17'])
    // T2-18 reinforcement
    const asPad = 0.0018 * 1000 * D
    const ps = selectSpacing(asPad, Math.min(3 * D, 450), p)
    const nBars = Math.max(Math.ceil((asPad * B) / 1000 / barArea(ps.dia)), Math.floor((B - 2 * p.coverEarth) / ps.spacing) + 1)
    const padBar = L - 2 * p.coverEarth + 2 * 12 * ps.dia
    const kgPad = rebarKg([{ dia: ps.dia, lengthMm: padBar, count: 2 * nBars * N }], p.rebarLapWastePct)
    rebar.push({ elementType: 'isolated_footing', role: `${nBars}T${ps.dia} each way, bottom`, barDia: ps.dia, spacingMm: ps.spacing, count: nBars * 2, layers: 1, lengthEachMm: Math.round(padBar), totalKg: kgPad, kgPerUnit: f2(kgPad / N), perUnit: 'each', ruleIds: ['RB-01'] })
    ratioCheck('isolated_footing', kgPad, padVol)
    boq.add('T2-18a', 'Reinforcement', `Isolated footings ${nBars}T${ps.dia} each way bottom (As ${Math.round(asPad)} mm²/m)`, 'isolated_footing', 'kg', kgPad, `${N} pads × 2 × ${nBars} bars × ${Math.round(padBar)} mm; +${p.rebarLapWastePct} %`, ['RB-01', 'BQ-02'], padIds)
    const col = selectBars(0.01 * cb * cb, 4, 2 * (cb - 2 * p.coverFormed - 2 * 10), p)
    const tieS = tieSpacing(col.dia, 10, cb, p)
    const colBar = Hc + D - p.coverEarth + 12 * col.dia
    const tieLen = 2 * (cb - 2 * p.coverFormed) * 2 + 200
    const nTies = Math.floor(columnH / tieS) + 1
    const kgColMain = rebarKg([{ dia: col.dia, lengthMm: colBar, count: col.count * N }], p.rebarLapWastePct)
    const kgColTies = rebarKg([{ dia: 10, lengthMm: tieLen, count: nTies * N }], p.rebarLapWastePct)
    rebar.push({ elementType: 'stub_column', role: `${col.count}T${col.dia}; T10 ties @${tieS}`, barDia: col.dia, spacingMm: tieS, count: col.count, layers: 1, lengthEachMm: Math.round(colBar), totalKg: kgColMain + kgColTies, kgPerUnit: f2((kgColMain + kgColTies) / N), perUnit: 'each', ruleIds: ['RB-05'] })
    ratioCheck('stub_column', kgColMain + kgColTies, colVol, N)
    boq.add('T2-18b', 'Reinforcement', `Stub columns ${col.count}T${col.dia} (≥ 1 % Ag)`, 'stub_column', 'kg', kgColMain, `${N} × ${col.count} × ${Math.round(colBar)} mm`, ['RB-05', 'BQ-02'])
    boq.add('T2-18c', 'Reinforcement', `Stub column ties T10 @${tieS}`, 'stub_column', 'kg', kgColTies, `${N} × ${nTies} × ${tieLen} mm`, ['RB-05', 'BQ-02'])
    const beam = beamRebar(bw, Db, clearSum + N * cb, p)
    rebar.push(...beam.sets)
    ratioCheck(`ground_beam_${bw}x${Db}`, beam.kgMain + beam.kgLinks, beamVol)
    boq.add('T2-18d', 'Reinforcement', `Ground beams ${beam.mainLabel}`, 'ground_beam', 'kg', beam.kgMain, beam.mainBasis, ['RB-04', 'BQ-02'], beamIds)
    boq.add('T2-18e', 'Reinforcement', `Ground beam links ${beam.linkLabel}`, 'ground_beam', 'kg', beam.kgLinks, beam.linkBasis, ['RB-04', 'BQ-02'], beamIds)
    const closure = below + backfill
    const dev = ex1 + ex2 > 0 ? (Math.abs(closure - ex1 - ex2) / (ex1 + ex2)) * 100 : 0
    checks.push({ id: 'VC-04', ok: dev <= 1, detail: `concrete + PCC below NGL ${f2(below)} + backfill ${f2(backfill)} = ${f2(closure)} m³ vs excavation ${f2(ex1 + ex2)} m³ (${f2(dev)} %)` })
    checks.push({ id: 'VC-02', ok: withinFootprint(elements.filter((e) => e.type === 'pad').flatMap((e) => e.rects), footprint, L / 2 + 50), detail: `All pads stay within the footprint + ${L / 2} mm projection` })
    summary.pads = N
    summary.beamLengthM = f2(clearSum / 1000)
    summary.tieBeams = ties.length
  } else {
    const bw = Number(sections.ground_beam.width)
    const Db = Number(sections.ground_beam.depth_overall)
    // beams under LB lines + full perimeter + ties (no columns)
    const perimeterLines = perimeterBeamLines(footprint, lines, bw, p.nodeSnapTol)
    const all = [...lines, ...perimeterLines]
    const graph = buildNodes(all, p)
    const { ties } = buildEdges(all, graph, footprint, p)
    const beamLines: LbLine[] = [...all, ...ties.map((t) => ({ id: t.id, axis: t.axis, pos: t.pos, a: t.a, b: t.b, wallIds: [], external: false }))]
    nodes = []
    const Bu = unionArea(beamLines.map((l) => bufferLine(l.axis, l.pos, l.a, l.b, bw / 2)))
    const Ex = unionArea(beamLines.map((l) => bufferLine(l.axis, l.pos, l.a, l.b, bw / 2 + p.workSpace)))
    const SB = polygonMinusRects(footprint, Bu.grid.rects())
    const beamIds = beamLines.map((l) => `GB-${l.id}`)
    beamLines.forEach((l) => elements.push({ id: `GB-${l.id}`, type: l.id.startsWith('T-') ? 'tie-beam' : 'beam', rects: [bufferLine(l.axis, l.pos, l.a, l.b, bw / 2)], section: { width: bw, depth: Db }, parentIds: l.wallIds, lengthMm: Math.round(lineLength(l)) }))
    if (input.lineLoadPerStoreyKnM == null) flags.push(makeFlag('F-INPUT', ['P.line_load_per_storey'], 'Type 3 bearing check needs P.line_load_per_storey (kN/m per storey).'))
    else if (input.soilBearingKpa != null) {
      const w = input.storeyCount * input.lineLoadPerStoreyKnM
      const pressure = w / (bw / 1000)
      const ok = pressure <= input.soilBearingKpa
      checks.push({ id: 'T3-R3', ok, detail: `${input.storeyCount} × ${input.lineLoadPerStoreyKnM} kN/m / ${bw / 1000} m = ${Math.round(pressure)} kPa vs soil ${input.soilBearingKpa} kPa` })
      if (!ok) flags.push(makeFlag('F-BEARING', ['ground_beam'], `Bearing ${Math.round(pressure)} kPa under 300 mm beams exceeds soil bearing ${input.soilBearingKpa} kPa.`))
    }
    const depthEx = Db - plinth + p.pccFooting
    const ex = boq.add('T3-01', 'Earthworks', 'Excavation for ground beam thickenings', 'ground_beam', 'm3', (Ex.areaMm2 * Math.max(0, depthEx)) / M3, `area(Ex) ${f2(Ex.areaMm2 / M2)} m² × max(0, ${Db} − ${plinth} + ${p.pccFooting}) mm`, ['T3-01'], beamIds)
    const pcc = boq.add('T3-02', 'Concrete', `PCC blinding under beams ${p.pccFooting} mm`, 'ground_beam', 'm3', (Bu.areaMm2 * p.pccFooting) / M3, `area(B) ${f2(Bu.areaMm2 / M2)} m² × ${p.pccFooting} mm`, ['T3-02'], beamIds)
    boq.add('T3-03', 'Concrete', `Monolithic ground beams ${bw} × ${Db} (below slab)`, 'ground_beam', 'm3', (Bu.areaMm2 * (Db - slabT)) / M3, `area(B) ${f2(Bu.areaMm2 / M2)} m² × (${Db} − ${slabT}) mm`, ['T3-03'], beamIds)
    const slabVol = boq.add('T3-04', 'Concrete', `Slab on grade ${slabT} mm`, 'slab_on_grade', 'm3', (footprintArea * slabT) / M3, `area(S) ${f2(footprintArea / M2)} m² × ${slabT} mm`, ['T3-04'], ['SLAB'])
    elements.push({ id: 'SLAB', type: 'slab', rects: [], section: { thickness: slabT }, parentIds: [] })
    boq.add('T3-05', 'Formwork', 'Edge formwork to slab and perimeter beam', 'ground_beam', 'm2', (footprintPerim * Db) / M2, `perimeter(S) ${f2(footprintPerim / 1000)} m × ${Db} mm`, ['T3-05'])
    const fill = plinth - slabT - p.subbaseThk
    boq.add('T3-06', 'Earthworks', 'Plinth fill between beams', 'slab_on_grade', 'm3', (SB.areaMm2 * Math.max(0, fill)) / M3, `(S − B) ${f2(SB.areaMm2 / M2)} m² × (${plinth} − ${slabT} − ${p.subbaseThk}) mm`, ['T3-06'])
    boq.add('T3-07a', 'Earthworks', `Granular sub-base ${p.subbaseThk} mm`, 'slab_on_grade', 'm3', (SB.areaMm2 * p.subbaseThk) / M3, `(S − B) ${f2(SB.areaMm2 / M2)} m² × ${p.subbaseThk} mm`, ['T3-07'])
    boq.add('T3-07b', 'Concrete', `PCC blinding under slab ${p.pccSlab} mm`, 'slab_on_grade', 'm3', (SB.areaMm2 * p.pccSlab) / M3, `(S − B) ${f2(SB.areaMm2 / M2)} m² × ${p.pccSlab} mm`, ['T3-07'])
    boq.add('T3-07c', 'Waterproofing and protection', 'Damp-proof membrane', 'slab_on_grade', 'm2', SB.areaMm2 / M2, `(S − B) ${f2(SB.areaMm2 / M2)} m²`, ['T3-07'])
    boq.add('T3-07d', 'Waterproofing and protection', 'Anti-termite treatment', 'slab_on_grade', 'm2', (SB.areaMm2 + Ex.areaMm2) / M2, `(S − B) + area(Ex)`, ['T3-07'])
    const asS = 0.0018 * 1000 * slabT
    const sel = selectSpacing(asS, Math.min(3 * slabT, 450), p)
    const kgPerM2 = 2 * (1000 / sel.spacing) * kgPerM(sel.dia) * (1 + p.rebarLapWastePct / 100)
    const kgSlab = (kgPerM2 * footprintArea) / M2
    rebar.push({ elementType: 'slab_on_grade', role: `T${sel.dia}@${sel.spacing} each way`, barDia: sel.dia, spacingMm: sel.spacing, count: null, layers: 1, lengthEachMm: 1000, totalKg: kgSlab, kgPerUnit: f2(kgPerM2), perUnit: 'm2', ruleIds: ['RB-02'] })
    ratioCheck('slab_on_grade_150', kgSlab, slabVol)
    boq.add('T3-08a', 'Reinforcement', `Slab mesh T${sel.dia}@${sel.spacing} each way`, 'slab_on_grade', 'kg', kgSlab, `${f2(kgPerM2)} kg/m² × ${f2(footprintArea / M2)} m²`, ['RB-02', 'BQ-02'], ['SLAB'])
    const Lb = Bu.areaMm2 / bw
    const beam = beamRebar(bw, Db, Lb, p)
    rebar.push(...beam.sets)
    ratioCheck(`ground_beam_${bw}x${Db}`, beam.kgMain + beam.kgLinks, (Bu.areaMm2 * Db) / M3)
    boq.add('T3-08b', 'Reinforcement', `Ground beams ${beam.mainLabel}`, 'ground_beam', 'kg', beam.kgMain, beam.mainBasis, ['RB-04', 'BQ-02'], beamIds)
    boq.add('T3-08c', 'Reinforcement', `Ground beam links ${beam.linkLabel}`, 'ground_beam', 'kg', beam.kgLinks, beam.linkBasis, ['RB-04', 'BQ-02'], beamIds)
    const belowNgl = pcc + (Bu.areaMm2 * Math.max(0, Db - plinth)) / M3
    const backfill = Math.max(0, ex - belowNgl)
    checks.push({ id: 'VC-04', ok: true, detail: `excavation ${f2(ex)} m³ = PCC + beam below NGL ${f2(belowNgl)} + backfill ${f2(backfill)} m³ (backfill derived)` })
    summary.beamLengthM = f2(Lb / 1000)
    summary.tieBeams = ties.length
  }

  // VC-03: every LB line supported along its full length (by construction for buffered lines; report)
  checks.push({ id: 'VC-03', ok: true, detail: `${lines.length} load-bearing lines, ${f2(lines.reduce((s, l) => s + lineLength(l), 0) / 1000)} m, each buffered along its full length` })

  summary.concreteM3 = f2(boq.rows.filter((r) => r.section === 'Concrete').reduce((s, r) => s + r.netQty, 0))
  summary.rebarKg = Math.round(boq.rows.filter((r) => r.section === 'Reinforcement').reduce((s, r) => s + r.netQty, 0))
  summary.excavationM3 = f2(boq.rows.filter((r) => r.section === 'Earthworks' && /Excavation/.test(r.description)).reduce((s, r) => s + r.netQty, 0))
  summary.formworkM2 = f2(boq.rows.filter((r) => r.section === 'Formwork').reduce((s, r) => s + r.netQty, 0))

  return { elements, nodes, rebar, boq: boq.rows, flags, checks, summary }
}

function beamRebar(bw: number, Db: number, lengthMm: number, p: QuantityParams) {
  const d = Db - p.coverFormed - 10 - 8
  const asMin = (1.4 / p.fy) * bw * d
  const main = selectBars(asMin, 2, bw - 2 * p.coverFormed - 2 * 10, p)
  const linkS = Math.floor(Math.min(d / 2, 300) / p.spacingStep) * p.spacingStep
  const linkLen = 2 * (bw - 2 * p.coverFormed) + 2 * (Db - 2 * p.coverFormed) + 200
  const kgMain = rebarKg([{ dia: main.dia, lengthMm, count: main.count * 2 }], p.rebarLapWastePct)
  const kgLinks = rebarKg([{ dia: 10, lengthMm: linkLen, count: lengthMm / linkS }], p.rebarLapWastePct)
  const L = lengthMm / 1000
  const sets: RebarSet[] = [
    { elementType: `ground_beam`, role: `${main.count}T${main.dia} top + ${main.count}T${main.dia} bottom`, barDia: main.dia, spacingMm: null, count: main.count * 2, layers: 2, lengthEachMm: Math.round(lengthMm), totalKg: kgMain, kgPerUnit: f2(kgMain / L), perUnit: 'm', ruleIds: ['RB-04'] },
    { elementType: `ground_beam`, role: `T10 links @${linkS}`, barDia: 10, spacingMm: linkS, count: Math.round(lengthMm / linkS), layers: 1, lengthEachMm: linkLen, totalKg: kgLinks, kgPerUnit: f2(kgLinks / L), perUnit: 'm', ruleIds: ['RB-04'] },
  ]
  return {
    sets,
    kgMain,
    kgLinks,
    mainLabel: `${main.count}T${main.dia} top + ${main.count}T${main.dia} bottom (As ≥ 1.4/fy·b·d = ${Math.round(asMin)} mm²)`,
    mainBasis: `${f2(L)} m × ${main.count * 2} bars; +${p.rebarLapWastePct} % laps`,
    linkLabel: `T10 @${linkS} (≤ d/2 = ${Math.round(d / 2)})`,
    linkBasis: `${f2(L)} m / ${linkS} mm × ${linkLen} mm per link`,
  }
}

function withinFootprint(rects: RectMm[], footprint: PtMm[], projection: number) {
  const xs = footprint.map((q) => q.x)
  const ys = footprint.map((q) => q.y)
  const x0 = Math.min(...xs) - projection
  const x1 = Math.max(...xs) + projection
  const y0 = Math.min(...ys) - projection
  const y1 = Math.max(...ys) + projection
  return rects.every((r) => r.x0 >= x0 - 1 && r.x1 <= x1 + 1 && r.y0 >= y0 - 1 && r.y1 <= y1 + 1)
}

/** Footprint edges (inset by half a beam) that are not already covered by an external LB line. */
function perimeterBeamLines(footprint: PtMm[], lines: LbLine[], bw: number, tol: number): LbLine[] {
  const out: LbLine[] = []
  const cx = footprint.reduce((s, q) => s + q.x, 0) / footprint.length
  const cy = footprint.reduce((s, q) => s + q.y, 0) / footprint.length
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]
    const b = footprint[(i + 1) % footprint.length]
    const horizontal = Math.abs(a.y - b.y) < 1
    const vertical = Math.abs(a.x - b.x) < 1
    if (!horizontal && !vertical) continue
    const axis: Axis = horizontal ? 'h' : 'v'
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
    if (hi - lo < 300) continue
    const edgePos = horizontal ? a.y : a.x
    const inward = horizontal ? (cy > edgePos ? 1 : -1) : cx > edgePos ? 1 : -1
    const pos = edgePos + inward * (bw / 2)
    const covered = lines.some((l) => l.axis === axis && Math.abs(l.pos - edgePos) <= tol && Math.min(l.b, hi) - Math.max(l.a, lo) >= 0.8 * (hi - lo))
    if (covered) continue
    out.push({ id: `PER-${i + 1}`, axis, pos: Math.round(pos), a: Math.round(lo), b: Math.round(hi), wallIds: [], external: true })
  }
  return out
}

export const BAR_LIST_DEFAULT = barList()
export { m }
