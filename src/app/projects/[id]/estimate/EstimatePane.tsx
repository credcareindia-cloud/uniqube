import { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Plus, SlidersHorizontal } from 'lucide-react'
import type { EstimateDetail, Margins, PricedLine } from './types'

export interface NewEstimateLine {
  bill: string
  description: string
  unit: string
  qty: number
  unitCost: number
}

interface EstimatePaneProps {
  estimate: EstimateDetail
  canManage: boolean
  onPatchEstimate: (body: Partial<Record<keyof Margins, number>>) => void
  onPatchLine: (lineId: string, qty: number) => void
  onAddLine?: (line: NewEstimateLine) => Promise<void> | void
}

const MARGIN_LABELS: { key: keyof Margins; label: string }[] = [
  { key: 'overheadPct', label: 'Overhead' },
  { key: 'marginPct', label: 'Margin' },
  { key: 'financingPct', label: 'Financing' },
  { key: 'contingencyPct', label: 'Contingency' },
  { key: 'customsPct', label: 'Customs' },
  { key: 'corporateTaxPct', label: 'Corp tax' },
  { key: 'designPct', label: 'Design' },
  { key: 'commissionPct', label: 'Commission' },
]

export const money = (n: number | null | undefined, currency = '', dp = 0) => {
  if (n == null) return '—'
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
  return currency ? `${currency} ${formatted}` : formatted
}

const emptyForm = (): NewEstimateLine => ({
  bill: 'General',
  description: '',
  unit: 'nos',
  qty: 1,
  unitCost: 0,
})

export function EstimatePane({
  estimate,
  canManage,
  onPatchEstimate,
  onPatchLine,
  onAddLine,
}: EstimatePaneProps) {
  const [openBills, setOpenBills] = useState<Set<string>>(new Set())
  const [showMargins, setShowMargins] = useState(false)
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<NewEstimateLine>(emptyForm)
  const [savingLine, setSavingLine] = useState(false)

  const c = estimate.currency
  const hasLines = estimate.bills.some((b) => b.lines.length > 0)

  const toggleBill = (bill: string) =>
    setOpenBills((open) => {
      const next = new Set(open)
      if (next.has(bill)) next.delete(bill)
      else next.add(bill)
      return next
    })

  const commitQty = (line: PricedLine) => {
    const raw = draftQty[line.id]
    setDraftQty((d) => {
      const next = { ...d }
      delete next[line.id]
      return next
    })
    const qty = Number(raw)
    if (raw == null || !Number.isFinite(qty) || qty < 0 || qty === line.qty) return
    onPatchLine(line.id, qty)
  }

  const submitLine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onAddLine || !form.description.trim()) return
    setSavingLine(true)
    try {
      await onAddLine({
        ...form,
        description: form.description.trim(),
        bill: form.bill.trim() || 'General',
      })
      setForm(emptyForm())
      setAdding(false)
    } finally {
      setSavingLine(false)
    }
  }

  return (
    <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Direct cost', value: money(estimate.directCost, c) },
              { label: `Total (${c})`, value: money(estimate.total) },
              { label: 'Total (USD)', value: money(estimate.totalUsd) },
              {
                label: 'Per sqft (USD)',
                value: estimate.perSqftUsd ? estimate.perSqftUsd.toFixed(2) : '—',
              },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
                  {stat.label}
                </div>
                <div className="text-base font-bold text-slate-900 truncate">{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canManage && onAddLine && (
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className={`p-2 rounded-lg ${
                  adding ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Add item"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMargins((v) => !v)}
              className={`p-2 rounded-lg ${
                showMargins ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Commercial uplifts"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showMargins && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MARGIN_LABELS.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="95"
                      disabled={!canManage}
                      key={`${key}-${estimate.margins[key]}`}
                      defaultValue={(estimate.margins[key] * 100).toFixed(2).replace(/\.?0+$/, '')}
                      onBlur={(e) => {
                        const pct = Number(e.target.value)
                        if (!Number.isFinite(pct) || pct < 0) return
                        const next = pct / 100
                        if (Math.abs(next - estimate.margins[key]) < 1e-9) return
                        onPatchEstimate({ [key]: next })
                      }}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-900 disabled:bg-slate-50"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {adding && (
          <form
            onSubmit={submitLine}
            className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-6 gap-2"
          >
            <input
              value={form.bill}
              onChange={(e) => setForm((f) => ({ ...f, bill: e.target.value }))}
              placeholder="Bill"
              className="col-span-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description *"
              required
              className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="Unit"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) || 0 }))}
              placeholder="Qty"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                step="any"
                value={form.unitCost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitCost: Number(e.target.value) || 0 }))
                }
                placeholder="Unit cost"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={savingLine || !form.description.trim()}
                className="uq-btn px-3 rounded-md text-sm font-semibold disabled:opacity-50 shrink-0"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>

      {estimate.notes && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
          <Info className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900">{estimate.notes}</p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {!hasLines ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-semibold text-slate-900">No items in this revision yet</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Auto generate reads PDF drawing text and prices from past jobs, then drafts a BOQ.
              Or add items manually — totals stay at zero until there is something to price.
            </p>
            {canManage && onAddLine && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            )}
          </div>
        ) : (
          estimate.bills.map((bill) => {
            const open = openBills.has(bill.bill)
            const priced = bill.lines.filter((l) => l.qty > 0).length
            return (
              <div key={bill.bill} className="border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleBill(bill.bill)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-left"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-slate-900 flex-1 truncate">
                    {bill.bill}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {priced}/{bill.lines.length}
                  </span>
                  <span className="text-sm font-bold text-slate-900 w-32 text-right shrink-0 tabular-nums">
                    {money(bill.amount, '', 2)}
                  </span>
                </button>

                {open && (
                  <table className="w-full text-sm border-t border-slate-100">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50">
                        <th className="text-left font-medium px-4 py-1.5 w-14">Item</th>
                        <th className="text-left font-medium px-2 py-1.5">Description</th>
                        <th className="text-left font-medium px-2 py-1.5 w-12">Unit</th>
                        <th className="text-right font-medium px-2 py-1.5 w-24">Qty</th>
                        <th className="text-right font-medium px-2 py-1.5 w-20">Rate</th>
                        <th className="text-right font-medium px-4 py-1.5 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.lines.map((line) => (
                        <tr
                          key={line.id}
                          className={`border-t border-slate-50 ${line.qty > 0 ? '' : 'text-slate-400'}`}
                        >
                          <td className="px-4 py-1 text-[11px]">{line.slNo || ''}</td>
                          <td className="px-2 py-1 text-xs">
                            {line.description}
                            {line.mode === 'PASS_THROUGH' && (
                              <span className="ml-1.5 text-[10px] text-slate-400">(at cost)</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-[11px]">{line.unit || ''}</td>
                          <td className="px-2 py-1 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!canManage}
                              value={draftQty[line.id] ?? String(line.qty)}
                              onChange={(e) =>
                                setDraftQty((d) => ({ ...d, [line.id]: e.target.value }))
                              }
                              onBlur={() => commitQty(line)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                              className="w-20 rounded border border-transparent hover:border-slate-300 focus:border-slate-400 px-1 py-0.5 text-right text-xs bg-transparent focus:bg-white disabled:hover:border-transparent tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1 text-right text-[11px] tabular-nums">
                            {line.sellRate.toFixed(2)}
                          </td>
                          <td className="px-4 py-1 text-right text-xs tabular-nums font-medium">
                            {line.amount > 0 ? money(line.amount, '', 2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
        <span className="text-sm font-bold text-slate-900">Total excluding VAT</span>
        <span className="text-base font-bold text-slate-900 tabular-nums">
          {money(estimate.total, c, 2)}
        </span>
      </div>
    </div>
  )
}
