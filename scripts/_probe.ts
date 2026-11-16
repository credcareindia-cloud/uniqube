import { defaultCommercials, emptyProjectContext } from '../src/studio/lib/elements.ts'
import { buildEstimate } from '../src/studio/lib/estimate.ts'
const ctx = { ...emptyProjectContext(), client: 'X', floors: [{ level: 1, name: 'GF', heightMm: 3200, areaM2: 500 }], commercials: { ...defaultCommercials(), ratesReviewedAt: '2026-11-10' },
  measured: { lgsGrossKg: 26250, lgsNetKg: 25000, hrsKg: 6000, screws: 100000, connectorsAed: 5250, anchors: 800, superRanAt: 'x', superApprovedBy: 'A' } }
const e = buildEstimate({ lines: [], measurements: [], pageScales: {}, projectContext: ctx as any, priceSheet: [] })
console.log({ direct: Math.round(e.direct.total), cost: Math.round(e.costTotal), sell: Math.round(e.sellTotal), mult: e.multiplier, aedSqft: e.aedPerSqft.toFixed(1), marginPct: (e.stack.margin/e.sellTotal*100).toFixed(2) })
for (const r of e.cbd) console.log(r.code.padEnd(3), r.label.padEnd(45), Math.round(r.amount))
console.log(e.warnings)
