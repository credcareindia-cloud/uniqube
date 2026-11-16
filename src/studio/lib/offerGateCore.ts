/**
 * Offer checks with no I/O, so they can be tested. offerGate.ts loads the engine states and calls this.
 */
import type { PriceSheetRow, ProjectContext, TakeoffLine } from '../types'
import type { Estimate } from './estimate'
import { scopeConflicts } from './quotation'
import { VOLATILE_MAX_AGE_DAYS, checkRate, daysSince } from './rateStatus'

export interface StageApproval {
  /** Result exists and has no red flag. */
  ran: boolean
  blocked: boolean
  approvedBy: string | null
}

export interface GateInput {
  estimate: Estimate
  lines: TakeoffLine[]
  priceSheet: PriceSheetRow[]
  context: ProjectContext
  structure: StageApproval
  architecture: StageApproval
  mep: StageApproval
  today?: Date
}

export interface OfferGate {
  ready: boolean
  /** Each one stops the offer. */
  blockers: string[]
  /** Shown on the page; the offer can still go. */
  warnings: string[]
}

const ARCH_SYSTEMS = new Set(['wall', 'roof', 'ceiling', 'floor', 'openings'])

function stageBlocker(name: string, stage: StageApproval): string | null {
  if (!stage.ran) return `${name} has not been run.`
  if (stage.blocked) return `${name} has red flags to clear.`
  if (!stage.approvedBy) return `${name} is not approved.`
  return null
}

function listed(items: string[], max = 4): string {
  return items.length <= max ? items.join('; ') : `${items.slice(0, max).join('; ')} and ${items.length - max} more`
}

export function evaluateOfferGate(input: GateInput): OfferGate {
  const { estimate, lines, priceSheet, context: ctx } = input
  const today = input.today ?? new Date()
  const c = ctx.commercials
  const blockers: string[] = []
  const warnings: string[] = []
  const priced = new Set(estimate.boq.filter((row) => row.amount > 0).map((row) => row.system))

  if (!(estimate.sellTotal > 0)) blockers.push('Nothing is priced yet.')
  if (!ctx.client.trim()) blockers.push('Client is missing.')

  // Every engine whose work is on the offer must be approved.
  const structure = stageBlocker('Super structure', input.structure)
  if (structure) blockers.push(structure)
  if ([...priced].some((id) => ARCH_SYSTEMS.has(id))) {
    const arch = stageBlocker('Architecture', input.architecture)
    if (arch) blockers.push(arch)
  }
  if (priced.has('mep')) {
    const mep = stageBlocker('MEP', input.mep)
    if (mep) blockers.push(mep)
  }

  // Steel must come from the measurement, not the ratio.
  const lgs = estimate.allowances.find((row) => row.id === 'lgs')
  if (c.includeSteelAllowance && lgs && !lgs.basis.startsWith('measured')) blockers.push('Steel is priced from the kg/m² ratio. Approve the super structure so the measured weight is used.')

  // Canvas lines: confirmed by a person and priced from a current rate.
  const live = lines.filter((line) => line.quantity > 0)
  const unconfirmed = live.filter((line) => !line.confirmed)
  if (unconfirmed.length) blockers.push(`${unconfirmed.length} bill line${unconfirmed.length === 1 ? ' is' : 's are'} not confirmed.`)
  const unpriced = live.filter((line) => !(line.unitPrice > 0))
  if (unpriced.length) blockers.push(`${unpriced.length} bill line${unpriced.length === 1 ? ' has' : 's have'} a quantity but no rate.`)
  const rows = new Map(priceSheet.map((row) => [row.id, row]))
  const badRates = new Set<string>()
  for (const line of live) {
    const row = line.rateRowId ? rows.get(line.rateRowId) : undefined
    if (!row) continue
    const check = checkRate(row, today)
    if (!check.ok && check.reason) badRates.add(check.reason)
  }
  if (badRates.size) blockers.push(`Rates to confirm before quoting: ${listed([...badRates])}.`)

  // Steel, site and logistics rates on the commercials sheet.
  if (c.includeSteelAllowance || c.includeInstallation || c.includeLogistics) {
    const age = daysSince(c.ratesReviewedAt, today)
    if (age == null) blockers.push('Steel, site and logistics rates have never been reviewed. Check them in Project context → Commercials.')
    else if (age > VOLATILE_MAX_AGE_DAYS) blockers.push(`Steel, site and logistics rates were reviewed ${age} days ago (limit ${VOLATILE_MAX_AGE_DAYS}).`)
  }

  // The offer's exclusion list must not contradict what the bill prices.
  blockers.push(...scopeConflicts(ctx))

  // Not blocking, but the estimator should see them.
  const install = estimate.allowances.find((row) => row.id === 'installation')
  if (install && !install.basis.startsWith('labour model')) warnings.push('Installation is a per-m² allowance, not built from productivity norms.')
  if (!ctx.jobInputs?.quoteValidUntil) warnings.push('No validity date set: the offer states 30 days.')
  for (const check of estimate.benchmarks) {
    if (check.status === 'low' || check.status === 'high') warnings.push(`${check.label} is ${check.status}: ${check.value} ${check.unit} against ${check.low}–${check.high}.`)
  }
  return { ready: blockers.length === 0, blockers, warnings }
}

