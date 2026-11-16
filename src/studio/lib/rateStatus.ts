import type { PriceSheetRow } from '../types'

/** A rate older than this needs a fresh supplier check before it goes on an offer. */
export const RATE_MAX_AGE_DAYS = 90
/** Steel, aluminium and copper move monthly: they get a shorter window. */
export const VOLATILE_MAX_AGE_DAYS = 30

const VOLATILE = /\b(steel|lgs|hrs|aluminium|aluminum|rebar|copper|cable|sandwich)\b/i

export function isVolatile(row: Pick<PriceSheetRow, 'componentLabel' | 'materialLabel' | 'variantLabel'>): boolean {
  return VOLATILE.test(`${row.componentLabel} ${row.materialLabel} ${row.variantLabel}`)
}

export function daysSince(iso: string | undefined | null, today: Date = new Date()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor((today.getTime() - t) / 86_400_000)
}

export interface RateCheck {
  ok: boolean
  /** Why the rate cannot go on an offer yet. */
  reason: string | null
  label: 'seed' | 'unreviewed' | 'stale' | 'current'
}

/** Can this price-sheet rate be quoted today? */
export function checkRate(row: PriceSheetRow, today: Date = new Date()): RateCheck {
  const name = row.variantLabel || row.materialLabel || row.id
  const status = row.status ?? 'listed'
  if (status === 'seed') return { ok: false, label: 'seed', reason: `${name}: placeholder rate from the catalog, not a real price` }
  if (!(row.unitPrice > 0)) return { ok: false, label: 'unreviewed', reason: `${name}: no rate` }
  const age = daysSince(row.rateDate, today)
  if (status !== 'verified' || age == null) return { ok: false, label: 'unreviewed', reason: `${name}: rate has no review date` }
  const limit = isVolatile(row) ? VOLATILE_MAX_AGE_DAYS : RATE_MAX_AGE_DAYS
  if (age > limit) return { ok: false, label: 'stale', reason: `${name}: checked ${age} days ago (limit ${limit})` }
  return { ok: true, label: 'current', reason: null }
}

/** Stamp a row as checked by a person today. */
export function markVerified(row: PriceSheetRow, source?: string, today: Date = new Date()): PriceSheetRow {
  return { ...row, status: 'verified', rateDate: today.toISOString().slice(0, 10), rateSource: source?.trim() || row.rateSource || 'Reviewed in price sheet' }
}
