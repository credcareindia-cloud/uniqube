/**
 * Pricing and offer-gate tests. Run: npm run test:estimation
 * Every number here is a decision: if a change moves one, the test should fail until someone agrees.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultCommercials, emptyProjectContext, sellMultiplier } from '../src/studio/lib/elements.ts'
import { buildEstimate } from '../src/studio/lib/estimate.ts'
import { findNorm, labourFor, LABOUR_NORMS } from '../src/studio/lib/labourNorms.ts'
import { evaluateOfferGate, type StageApproval } from '../src/studio/lib/offerGateCore.ts'
import { offerInclusions, scopeConflicts } from '../src/studio/lib/quotation.ts'
import { checkRate } from '../src/studio/lib/rateStatus.ts'
import type { MeasuredQuantities, PriceSheetRow, ProjectContext, TakeoffLine } from '../src/studio/types.ts'

const TODAY = new Date('2026-11-16T09:00:00Z')

function context(patch: Partial<ProjectContext> = {}): ProjectContext {
  const base = emptyProjectContext()
  return {
    ...base,
    client: 'Zuha Admin',
    location: 'Hamriyah, Sharjah',
    floors: [{ level: 1, name: 'Ground floor', heightMm: 3200, areaM2: 500 }],
    commercials: { ...defaultCommercials(), ratesReviewedAt: '2026-11-10' },
    ...patch,
  }
}

const MEASURED: MeasuredQuantities = {
  lgsGrossKg: 26_250,
  lgsNetKg: 25_000,
  hrsKg: 5_000,
  screws: 180_000,
  connectorsAed: 5_000,
  anchors: 600,
  superRanAt: '2026-11-15T10:00:00Z',
  superApprovedBy: 'Akhilesh',
}

function estimate(ctx: ProjectContext, lines: TakeoffLine[] = []) {
  return buildEstimate({ lines, measurements: [], pageScales: {}, projectContext: ctx, priceSheet: [] })
}

const approved: StageApproval = { ran: true, blocked: false, approvedBy: 'Akhilesh' }

test('margin and commission are exact shares of the selling price', () => {
  const e = estimate(context({ measured: MEASURED }))
  assert.ok(e.sellTotal > 0)
  assert.ok(Math.abs(e.stack.margin / e.sellTotal - 0.15) < 1e-9)
  assert.ok(Math.abs(e.stack.commission / e.sellTotal - 0.07) < 1e-9)
})

test('contingency and design sit on direct cost, not on profit', () => {
  const e = estimate(context({ measured: MEASURED }))
  assert.ok(Math.abs(e.stack.contingency - e.direct.total * 0.02) < 1e-6)
  assert.ok(Math.abs(e.stack.design - e.direct.total * 0.02) < 1e-6)
})

test('with no customs the effective multiplier equals sellMultiplier', () => {
  const ctx = context({ measured: MEASURED })
  const e = estimate(ctx)
  assert.ok(Math.abs(e.multiplier - sellMultiplier(ctx.commercials)) < 1e-3)
})

test('customs applies to imported material only', () => {
  const c = { ...defaultCommercials(), ratesReviewedAt: '2026-11-10', customsPct: 5, importedMaterialPct: 40 }
  const e = estimate(context({ measured: MEASURED, commercials: c }))
  assert.ok(Math.abs(e.stack.customs - e.direct.material * 0.4 * 0.05) < 1e-6)
})

test('corporate tax is never added to the price', () => {
  const c = { ...defaultCommercials(), ratesReviewedAt: '2026-11-10', corporateTaxPct: 9 }
  const withTax = estimate(context({ measured: MEASURED, commercials: c }))
  const without = estimate(context({ measured: MEASURED }))
  assert.equal(withTax.sellTotal, without.sellTotal)
  assert.ok(withTax.warnings.some((w) => w.includes('Corporate tax')))
})

test('steel is priced from the measured super structure when there is one', () => {
  const e = estimate(context({ measured: MEASURED }))
  const lgs = e.allowances.find((a) => a.id === 'lgs')!
  assert.equal(lgs.qty, 26_250)
  assert.ok(lgs.basis.startsWith('measured'))
  assert.equal(e.allowances.find((a) => a.id === 'hrs')!.qty, 5_000)
})

test('without a measurement the ratio is used and flagged', () => {
  const e = estimate(context())
  const lgs = e.allowances.find((a) => a.id === 'lgs')!
  assert.equal(lgs.qty, 25_000) // 50 kg/m² × 500 m²
  assert.ok(lgs.basis.startsWith('RATIO'))
  assert.ok(e.warnings.some((w) => w.includes('not measured')))
})

test('measured steel far from the ratio is called out', () => {
  const e = estimate(context({ measured: { ...MEASURED, lgsGrossKg: 40_000 } }))
  assert.ok(e.warnings.some((w) => w.includes('Measured LGS is 80 kg/m²')))
})

test('installation comes from the labour model only when every row is covered', () => {
  const model = estimate(context({ measured: { ...MEASURED, labourAed: 40_000, labourGangDays: 62.5, labourUnmatched: 0 } }))
  const install = model.allowances.find((a) => a.id === 'installation')!
  assert.equal(install.direct, 40_000)
  assert.ok(install.basis.startsWith('labour model'))
  const partial = estimate(context({ measured: { ...MEASURED, labourAed: 40_000, labourGangDays: 62.5, labourUnmatched: 3 } }))
  assert.equal(partial.allowances.find((a) => a.id === 'installation')!.direct, 500 * 75)
})

test('labour norms turn quantity into gang-days and cost', () => {
  const norm = findNorm({ source: 'Super structure', code: 'SS-W1', description: 'LGS studs 89S41', unit: 'kg' })!
  assert.equal(norm.id, 'lgs-erect')
  const labour = labourFor(2_400, norm, 160)
  assert.equal(labour.gangDays, 2)
  assert.equal(labour.amount, 2 * 4 * 160)
  assert.equal(findNorm({ source: 'Architecture', code: 'D1', description: 'Door 900x2100', unit: 'nr' }), null)
  assert.ok(LABOUR_NORMS.every((n) => n.outputPerGangDay > 0 && n.gang > 0))
})

function row(patch: Partial<PriceSheetRow>): PriceSheetRow {
  return { id: 'r1', discipline: 'arch', componentId: 'c', componentLabel: 'Boards', materialId: 'm', materialLabel: 'Gypsum board', variantId: 'v', variantLabel: 'Gypsum 12.5 mm FR', unit: 'm²', unitPrice: 8.68, currency: 'AED', notes: '', ...patch } as PriceSheetRow
}

test('rate status: placeholders, undated and old rates are not quotable', () => {
  assert.equal(checkRate(row({ status: 'seed' }), TODAY).ok, false)
  assert.equal(checkRate(row({ status: 'listed' }), TODAY).ok, false)
  assert.equal(checkRate(row({ status: 'verified', rateDate: '2026-11-01' }), TODAY).ok, true)
  assert.equal(checkRate(row({ status: 'verified', rateDate: '2026-10-01' }), TODAY).ok, true) // gypsum: 90 days
  assert.equal(checkRate(row({ status: 'verified', rateDate: '2026-10-01', materialLabel: 'Steel section' }), TODAY).label, 'stale') // steel: 30 days
})

function line(patch: Partial<TakeoffLine>): TakeoffLine {
  return { id: 'l1', tag: 'IW1', system: 'Walls', widthMm: 0, heightMm: 3000, type: 'Internal wall', quantity: 100, unit: 'm²', unitPrice: 120, notes: '', source: 'manual', confirmed: true, element: 'int-wall', ...patch } as TakeoffLine
}

function cleanContext() {
  // Default external wall carries a render layer the offer excludes; a clean job drops it.
  const ctx = context({ measured: { ...MEASURED, labourAed: 40_000, labourGangDays: 62.5, labourUnmatched: 0 } })
  ctx.elements = ctx.elements.filter((id) => id !== 'ext-wall')
  return ctx
}

test('gate: a clean, approved, measured estimate is ready', () => {
  const ctx = cleanContext()
  const lines = [line({})]
  const e = estimate(ctx, lines)
  const gate = evaluateOfferGate({ estimate: e, lines, priceSheet: [], context: ctx, structure: approved, architecture: approved, mep: approved, today: TODAY })
  assert.deepEqual(gate.blockers, [])
  assert.equal(gate.ready, true)
})

test('gate: each missing check stops the offer', () => {
  const ctx = cleanContext()
  const seed = row({ id: 'seed-row', status: 'seed' })
  const lines = [line({ confirmed: false, rateRowId: 'seed-row' })]
  const e = estimate(ctx, lines)
  const gate = evaluateOfferGate({
    estimate: e,
    lines,
    priceSheet: [seed],
    context: { ...ctx, commercials: { ...ctx.commercials, ratesReviewedAt: '' } },
    structure: { ran: true, blocked: false, approvedBy: null },
    architecture: approved,
    mep: approved,
    today: TODAY,
  })
  assert.equal(gate.ready, false)
  const text = gate.blockers.join('\n')
  assert.match(text, /Super structure is not approved/)
  assert.match(text, /not confirmed/)
  assert.match(text, /placeholder rate/)
  assert.match(text, /never been reviewed/)
})

test('gate: steel on the ratio cannot be quoted', () => {
  const ctx = cleanContext()
  ctx.measured = null
  const lines = [line({})]
  const gate = evaluateOfferGate({ estimate: estimate(ctx, lines), lines, priceSheet: [], context: ctx, structure: approved, architecture: approved, mep: approved, today: TODAY })
  assert.ok(gate.blockers.some((b) => b.includes('kg/m² ratio')))
})

test('offer scope cannot contradict the bill', () => {
  const ctx = context()
  const conflicts = scopeConflicts(ctx)
  assert.ok(conflicts.some((c) => c.includes('external envelope finish')), 'default external wall prices a render the offer excludes')
  const wallLine = offerInclusions(ctx).find((r) => r.description.includes('External wall'))
  assert.ok(wallLine && wallLine.description.includes('cement board'))
})
