export interface PricedLine {
  id: string
  slNo: string | null
  bill: string
  description: string
  unit: string | null
  qty: number
  mode: 'FULL' | 'PASS_THROUGH'
  directTotal: number
  sellRate: number
  amount: number
}

export interface PricedBill {
  bill: string
  lines: PricedLine[]
  amount: number
}

export interface Margins {
  overheadPct: number
  marginPct: number
  financingPct: number
  contingencyPct: number
  customsPct: number
  corporateTaxPct: number
  designPct: number
  commissionPct: number
}

/** One revision, fully priced by the server. */
export interface EstimateDetail {
  id: string
  jobNumber: string
  revision: string
  name: string
  client: string | null
  status: string
  currency: string
  fxRate: number
  totalArea: number | null
  notes: string | null
  margins: Margins
  bills: PricedBill[]
  directCost: number
  total: number
  totalUsd: number | null
  perSqft: number | null
  perSqftUsd: number | null
}

/** A revision as it appears in the selector, without its lines. */
export interface EstimateSummary {
  id: string
  jobNumber: string
  revision: string
  status: string
  totalAmount: number | null
  lineCount: number
  updatedAt: string
}
