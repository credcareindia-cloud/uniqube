import { useMemo } from 'react'
import { useAppStore } from '../store'
import { buildEstimate, fmtAed } from '../lib/estimate'

const n0 = (value: number) => fmtAed(value, 0)

export function CostingPage() {
  const lines = useAppStore((s) => s.lines)
  const measurements = useAppStore((s) => s.measurements)
  const pageScales = useAppStore((s) => s.pageScales)
  const projectContext = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const estimate = useMemo(
    () => buildEstimate({ lines, measurements, pageScales, projectContext, priceSheet }),
    [lines, measurements, pageScales, projectContext, priceSheet],
  )
  const currency = projectContext.commercials.currency || 'AED'
  const allowances = estimate.allowances.filter((row) => row.direct > 0)
  const costs = estimate.cbd.filter((row) => row.amount !== 0)
  const empty = estimate.direct.total === 0 && costs.length === 0

  return (
    <div className="doc-page">
      <header>
        <h1>Costing</h1>
        <p>Direct cost, allowances, and the cost breakdown for this estimate. Amounts stay off the page when they are zero.</p>
      </header>
      {empty ? (
        <p className="doc-page__note">No cost yet. It appears when floor areas or measured lines carry a rate.</p>
      ) : (
        <>
          <section>
            <h2>Direct cost</h2>
            <table className="summary__table summary__table--cbd">
              <tbody>
                <tr>
                  <td>Materials and supply</td>
                  <td className="num">{n0(estimate.direct.material)} {currency}</td>
                </tr>
                <tr>
                  <td>Fabrication</td>
                  <td className="num">{n0(estimate.direct.fab)} {currency}</td>
                </tr>
                <tr>
                  <td>Installation</td>
                  <td className="num">{n0(estimate.direct.install)} {currency}</td>
                </tr>
                <tr>
                  <td>Indirect on direct cost</td>
                  <td className="num">{n0(estimate.direct.indirect)} {currency}</td>
                </tr>
                <tr className="is-total">
                  <td>Direct total</td>
                  <td className="num">{n0(estimate.direct.total)} {currency}</td>
                </tr>
              </tbody>
            </table>
          </section>
          {allowances.length > 0 && (
            <section>
              <h2>Allowances</h2>
              <table className="summary__table summary__table--cbd">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th>Unit</th>
                    <th className="num">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {allowances.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.label}
                        <div className="muted">{row.basis}</div>
                      </td>
                      <td className="num">{fmtAed(row.qty, 1)}</td>
                      <td>{row.unit}</td>
                      <td className="num">{n0(row.direct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {costs.length > 0 && (
            <section>
              <h2>Cost breakdown</h2>
              <table className="summary__table summary__table--cbd">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th className="num">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((row) => (
                    <tr key={`${row.code}-${row.label}`} className={row.total ? 'is-total' : row.subtotal ? 'is-subtotal' : undefined}>
                      <td>{row.code}</td>
                      <td>{row.label}</td>
                      <td className="num">{n0(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  )
}
