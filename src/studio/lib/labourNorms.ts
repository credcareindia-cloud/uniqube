/**
 * Site labour productivity: how much one gang finishes in one working day.
 * Labour cost = quantity ÷ output per gang-day × gang size × day rate.
 *
 * Every figure here is PROPOSED until the site manager confirms it against UNIQUBE job records
 * (Zuha timesheets). Change a norm here, never in a row: rows recompute from these.
 *
 * Openings and railings are left out on purpose: their price-sheet rates already carry installation.
 */
export interface LabourNorm {
  id: string
  trade: string
  /** Matched against the line's source, code and description. */
  match: RegExp
  /** Unit the output is measured in; the line must use the same unit. */
  unit: 'kg' | 'm²' | 'm³' | 'nr' | 'm'
  outputPerGangDay: number
  gang: number
  source: 'PROPOSED' | 'UNIQUBE'
}

/** All-in cost of one labourer per day (wage, visa, housing, transport, food). PROPOSED. */
export const DEFAULT_LABOUR_DAY_RATE = 160

export const LABOUR_NORMS: LabourNorm[] = [
  { id: 'lgs-erect', trade: 'LGS erection', match: /\b(lgs|stud|track|truss|joist|nogging|lintel|frame)\b/i, unit: 'kg', outputPerGangDay: 1200, gang: 4, source: 'PROPOSED' },
  { id: 'hrs-erect', trade: 'HRS erection', match: /\b(hrs|ub|uc|shs|rhs|hot.?rolled)\b/i, unit: 'kg', outputPerGangDay: 2500, gang: 5, source: 'PROPOSED' },
  { id: 'cement-board', trade: 'Cement board fixing', match: /cement\s*board|\bcb\b/i, unit: 'm²', outputPerGangDay: 30, gang: 3, source: 'PROPOSED' },
  { id: 'gypsum', trade: 'Gypsum board fixing and jointing', match: /gypsum|plasterboard|\bgyp/i, unit: 'm²', outputPerGangDay: 35, gang: 2, source: 'PROPOSED' },
  { id: 'insulation', trade: 'Insulation', match: /rockwool|insulation|mineral wool/i, unit: 'm²', outputPerGangDay: 80, gang: 2, source: 'PROPOSED' },
  { id: 'membrane', trade: 'Membranes and barriers', match: /membrane|vapou?r|breather|weather barrier/i, unit: 'm²', outputPerGangDay: 150, gang: 2, source: 'PROPOSED' },
  { id: 'roof-panel', trade: 'Roof sandwich panels', match: /sandwich|roof panel/i, unit: 'm²', outputPerGangDay: 70, gang: 4, source: 'PROPOSED' },
  { id: 'ceiling', trade: 'Ceiling', match: /ceiling/i, unit: 'm²', outputPerGangDay: 30, gang: 2, source: 'PROPOSED' },
  { id: 'mep-first-fix', trade: 'MEP first fix', match: /\b(socket|switch|point|conduit|box|outlet|fixture|first.?fix)\b/i, unit: 'nr', outputPerGangDay: 25, gang: 2, source: 'PROPOSED' },
  { id: 'excavation', trade: 'Excavation', match: /excavat/i, unit: 'm³', outputPerGangDay: 40, gang: 3, source: 'PROPOSED' },
  { id: 'concrete', trade: 'Concrete placing', match: /concrete|blinding|pcc|rcc/i, unit: 'm³', outputPerGangDay: 15, gang: 6, source: 'PROPOSED' },
  { id: 'rebar', trade: 'Reinforcement', match: /rebar|reinforce|\bbar\b/i, unit: 'kg', outputPerGangDay: 900, gang: 4, source: 'PROPOSED' },
  { id: 'formwork', trade: 'Formwork', match: /formwork|shutter/i, unit: 'm²', outputPerGangDay: 25, gang: 3, source: 'PROPOSED' },
]

function normUnit(unit: string): string {
  const u = unit.trim().toLowerCase()
  if (u === 'm2' || u === 'm²' || u === 'sqm') return 'm²'
  if (u === 'm3' || u === 'm³' || u === 'cum') return 'm³'
  if (u === 'nos' || u === 'no' || u === 'nr' || u === 'each' || u === 'ea') return 'nr'
  if (u === 'lm' || u === 'm' || u === 'rm') return 'm'
  return u
}

/** The first norm whose unit matches and whose pattern hits the line text. */
export function findNorm(line: { source: string; code: string; description: string; unit: string }): LabourNorm | null {
  const unit = normUnit(line.unit)
  const text = `${line.source} ${line.code} ${line.description}`
  return LABOUR_NORMS.find((norm) => norm.unit === unit && norm.match.test(text)) ?? null
}

export interface LabourEstimate {
  gangDays: number
  gang: number
  /** Cost of one gang-day. */
  gangDayRate: number
  amount: number
  basis: string
}

export function labourFor(qty: number, norm: LabourNorm, dayRate: number): LabourEstimate {
  const gangDays = Math.ceil((qty / norm.outputPerGangDay) * 10) / 10
  const gangDayRate = norm.gang * dayRate
  return {
    gangDays,
    gang: norm.gang,
    gangDayRate,
    amount: Math.round(gangDays * gangDayRate * 100) / 100,
    basis: `${norm.trade}: ${norm.outputPerGangDay} ${norm.unit}/gang-day, gang of ${norm.gang} × ${dayRate} AED/day (${norm.source})`,
  }
}
