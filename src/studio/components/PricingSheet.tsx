import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useAppStore } from '../store'
import { DISCIPLINES, type DisciplineId } from '../lib/projectCatalog'
import { checkRate } from '../lib/rateStatus'

const UNITS = ['m²', 'lm', 'm³', 'nos', 'kg', 'set', 'ls'] as const

export function PricingSheet() {
  const priceSheet = useAppStore((s) => s.priceSheet)
  const updatePriceRow = useAppStore((s) => s.updatePriceRow)
  const addPriceRow = useAppStore((s) => s.addPriceRow)
  const removePriceRow = useAppStore((s) => s.removePriceRow)
  const resetPriceSheet = useAppStore((s) => s.resetPriceSheet)
  const verifyPriceRows = useAppStore((s) => s.verifyPriceRows)
  const [onlyToCheck, setOnlyToCheck] = useState(false)

  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineId | 'all'>('all')
  const [search, setSearch] = useState('')
  const [dirtyFlash, setDirtyFlash] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return priceSheet.filter((r) => {
      if (disciplineFilter !== 'all' && r.discipline !== disciplineFilter) return false
      if (onlyToCheck && checkRate(r).ok) return false
      if (!q) return true
      return (
        r.componentLabel.toLowerCase().includes(q) ||
        r.materialLabel.toLowerCase().includes(q) ||
        r.variantLabel.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      )
    })
  }, [priceSheet, disciplineFilter, search, onlyToCheck])
  const toCheck = useMemo(() => priceSheet.filter((r) => !checkRate(r).ok).length, [priceSheet])

  function markSaved() {
    setDirtyFlash(true)
    window.setTimeout(() => setDirtyFlash(false), 900)
  }

  return (
    <div className="pricing">
      <div className="pricing__toolbar">
        <div className="pricing__title-block">
          <h2>Price sheet</h2>
          <p>
            {priceSheet.length} rates · {toCheck} to check before quoting · typing a rate stamps it as checked today
            · edits save automatically
            {dirtyFlash ? <span className="pricing__saved"> Saved</span> : null}
          </p>
        </div>
        <div className="pricing__filters">
          <input
            type="search"
            className="pricing__search"
            placeholder="Search material, component…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={disciplineFilter}
            onChange={(e) =>
              setDisciplineFilter(e.target.value as DisciplineId | 'all')
            }
            aria-label="Filter by discipline"
          >
            <option value="all">All disciplines</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="pricing__toggle">
            <input type="checkbox" checked={onlyToCheck} onChange={(e) => setOnlyToCheck(e.target.checked)} /> Only rates to check ({toCheck})
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            title="Stamp the rows shown as checked today against the source you name"
            onClick={() => {
              const ids = filtered.filter((r) => r.unitPrice > 0).map((r) => r.id)
              if (!ids.length) return
              const source = window.prompt(`Mark ${ids.length} rate${ids.length === 1 ? '' : 's'} as checked today. Source (supplier quote no., price list, invoice):`)
              if (!source?.trim()) return
              verifyPriceRows(ids, source)
              markSaved()
            }}
          >
            Mark shown as checked
          </button>
          <button type="button" className="btn" onClick={addPriceRow}>
            <Plus size={16} /> Add rate
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (
                window.confirm(
                  'Reset price sheet to catalog seed defaults? Your edits will be lost.',
                )
              ) {
                resetPriceSheet()
                markSaved()
              }
            }}
          >
            <RotateCcw size={16} /> Reset seed
          </button>
        </div>
      </div>

      <div className="table-wrap table-wrap--fill pricing__table-wrap">
        <table className="boq pricing-table">
          <thead>
            <tr>
              <th>Discipline</th>
              <th>Component</th>
              <th>Material</th>
              <th>Variant</th>
              <th>Unit</th>
              <th>Unit price</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <select
                    value={r.discipline}
                    onChange={(e) => {
                      updatePriceRow(r.id, {
                        discipline: e.target.value as DisciplineId,
                      })
                      markSaved()
                    }}
                  >
                    {DISCIPLINES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={r.componentLabel}
                    onChange={(e) => {
                      updatePriceRow(r.id, { componentLabel: e.target.value })
                      markSaved()
                    }}
                  />
                </td>
                <td>
                  <input
                    value={r.materialLabel}
                    onChange={(e) => {
                      updatePriceRow(r.id, { materialLabel: e.target.value })
                      markSaved()
                    }}
                  />
                </td>
                <td>
                  <input
                    value={r.variantLabel}
                    onChange={(e) => {
                      updatePriceRow(r.id, { variantLabel: e.target.value })
                      markSaved()
                    }}
                  />
                </td>
                <td>
                  <select
                    value={r.unit}
                    onChange={(e) => {
                      updatePriceRow(r.id, { unit: e.target.value })
                      markSaved()
                    }}
                  >
                    {!UNITS.includes(r.unit as (typeof UNITS)[number]) && (
                      <option value={r.unit}>{r.unit}</option>
                    )}
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={r.unitPrice || ''}
                    onChange={(e) => {
                      updatePriceRow(r.id, {
                        unitPrice: Number(e.target.value) || 0,
                      })
                      markSaved()
                    }}
                  />
                </td>
                <td>
                  {(() => {
                    const check = checkRate(r)
                    const text = check.label === 'current' ? `Checked ${r.rateDate}` : check.label === 'seed' ? 'Placeholder' : check.label === 'stale' ? `Old: ${r.rateDate}` : 'No review date'
                    return (
                      <span className={`pricing__status pricing__status--${check.label}`} title={check.reason ?? r.rateSource ?? ''}>
                        {text}
                      </span>
                    )
                  })()}
                </td>
                <td>
                  <input
                    value={r.currency}
                    onChange={(e) => {
                      updatePriceRow(r.id, { currency: e.target.value })
                      markSaved()
                    }}
                  />
                </td>
                <td>
                  <input
                    value={r.notes}
                    onChange={(e) => {
                      updatePriceRow(r.id, { notes: e.target.value })
                      markSaved()
                    }}
                    placeholder="Optional"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    title="Remove rate"
                    onClick={() => {
                      removePriceRow(r.id)
                      markSaved()
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="pricing__empty">
                  No rates match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
