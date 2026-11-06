import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Download, Printer, Save, Trash2 } from 'lucide-react'
import { useAppStore } from '../store'
import type { EstimateRevision } from '../types'
import { ELEMENTS, SQFT_PER_M2, SYSTEMS, buildUpFor, floorName, rateForLayer } from '../lib/elements'
import { buildEstimate, fmtAed, type Estimate } from '../lib/estimate'

type Tab = 'overview' | 'qto' | 'boq' | 'cbd' | 'benchmarks' | 'revisions' | 'offer'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'qto', label: 'QTO by floor' },
  { id: 'boq', label: 'Client BOQ' },
  { id: 'cbd', label: 'Cost breakdown' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'revisions', label: 'Revisions' },
  { id: 'offer', label: 'Offer' },
]

const n0 = (value: number) => fmtAed(value, 0)
const n1 = (value: number) => fmtAed(value, 1)
const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const csvCell = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function EstimateSummary() {
  const lines = useAppStore((s) => s.lines)
  const measurements = useAppStore((s) => s.measurements)
  const pageScales = useAppStore((s) => s.pageScales)
  const projectContext = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const projectSetup = useAppStore((s) => s.projectSetup)
  const revisions = useAppStore((s) => s.revisions)
  const saveRevision = useAppStore((s) => s.saveRevision)
  const removeRevision = useAppStore((s) => s.removeRevision)
  const setContextOpen = useAppStore((s) => s.setContextOpen)
  const [tab, setTab] = useState<Tab>('overview')

  const estimate = useMemo(
    () => buildEstimate({ lines, measurements, pageScales, projectContext, priceSheet }),
    [lines, measurements, pageScales, projectContext, priceSheet],
  )
  const currency = projectContext.commercials.currency || 'AED'

  const exportCsv = () => {
    const rows: string[][] = [['Section', 'Code', 'Item', 'Qty', 'Unit', 'Rate', 'Amount', 'Share']]
    for (const s of estimate.systems) rows.push(['System', s.id, s.label, '', '', '', String(Math.round(s.sell)), pct(estimate.sellTotal ? s.sell / estimate.sellTotal : 0)])
    for (const a of estimate.allowances) rows.push(['Allowance', a.id, a.label, String(a.qty), a.unit, a.rate.toFixed(2), String(Math.round(a.direct)), a.basis])
    for (const r of estimate.cbd) rows.push(['CBD', r.code, r.label, '', '', '', String(Math.round(r.amount)), pct(r.pct)])
    for (const b of estimate.boq) rows.push(['BOQ', b.system, b.label, '1', 'LS', '', String(b.amount), ''])
    for (const q of estimate.qto.rows) {
      rows.push([
        'QTO',
        q.elementId,
        q.label,
        String(Math.round(q.total * 100) / 100),
        q.unit,
        '',
        q.totalSqft != null ? String(Math.round(q.totalSqft)) : '',
        estimate.qto.floors.map((f) => `${f.name}: ${Math.round((q.perFloor[f.level] ?? 0) * 100) / 100}`).join('; '),
      ])
    }
    download(`${(projectSetup.projectName || 'estimate').replace(/[^\w-]+/g, '_')}-summary.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'))
  }

  return (
    <div className="summary">
      <div className="summary__bar">
        <nav className="summary__tabs" aria-label="Summary sections">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={clsx('summary__tab', tab === item.id && 'is-on')} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="summary__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setContextOpen(true)}>
            Commercials
          </button>
          <button type="button" className="btn btn--ghost" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
          {tab === 'offer' && (
            <button type="button" className="btn btn--accent" onClick={() => window.print()}>
              <Printer size={14} /> Print / PDF
            </button>
          )}
        </div>
      </div>

      {estimate.warnings.length > 0 && tab !== 'offer' && (
        <ul className="summary__warnings">
          {estimate.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="summary__pane">
        {tab === 'overview' && <Overview estimate={estimate} currency={currency} />}
        {tab === 'qto' && <QtoTable estimate={estimate} />}
        {tab === 'boq' && <ClientBoq estimate={estimate} currency={currency} />}
        {tab === 'cbd' && <Cbd estimate={estimate} currency={currency} />}
        {tab === 'benchmarks' && <Benchmarks estimate={estimate} />}
        {tab === 'revisions' && (
          <Revisions estimate={estimate} revisions={revisions} onSave={saveRevision} onRemove={removeRevision} currency={currency} />
        )}
        {tab === 'offer' && <Offer estimate={estimate} currency={currency} />}
      </div>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  )
}

function Overview({ estimate, currency }: { estimate: Estimate; currency: string }) {
  const c = useAppStore((s) => s.projectContext.commercials)
  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Built-up area" value={`${n0(estimate.gfaM2)} m²`} hint={`${n0(estimate.gfaSqft)} sqft`} />
        <Kpi label="Direct cost" value={`${n0(estimate.direct.total)} ${currency}`} hint={`incl. indirects ${n0(estimate.direct.indirect)}`} />
        <Kpi label="Selling price" value={`${n0(estimate.sellRounded)} ${currency}`} hint={`${n0(estimate.usdTotal)} USD @ ${c.usdRate}`} />
        <Kpi label="Rate" value={`${n1(estimate.aedPerSqft)} ${currency}/sqft`} hint={`${n1(estimate.usdPerSqft)} USD/sqft`} />
        <Kpi label="Multiplier" value={`× ${estimate.multiplier.toFixed(4)}`} hint={`OH ${c.overheadPct}% · margin ${c.marginPct}% · comm. ${c.commissionPct}%`} />
        <Kpi label="Lines" value={String(estimate.lineCount)} hint={estimate.unconfirmedCount ? `${estimate.unconfirmedCount} unconfirmed` : 'all confirmed'} />
      </div>

      <h3 className="summary__h">Systems</h3>
      <table className="summary__table">
        <thead>
          <tr>
            <th>System</th>
            <th className="num">Lines</th>
            <th className="num">Material</th>
            <th className="num">Fabrication</th>
            <th className="num">Installation</th>
            <th className="num">Direct</th>
            <th className="num">+ indirects</th>
            <th className="num">Selling</th>
            <th className="num">{currency}/sqft</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {estimate.systems
            .filter((s) => s.direct > 0 || s.lineCount > 0)
            .map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td className="num">{s.lineCount}</td>
                <td className="num">{n0(s.material)}</td>
                <td className="num">{n0(s.fab)}</td>
                <td className="num">{n0(s.install)}</td>
                <td className="num">{n0(s.direct)}</td>
                <td className="num">{n0(s.directWithIndirects)}</td>
                <td className="num strong">{n0(s.sell)}</td>
                <td className="num">{n1(s.aedPerSqft)}</td>
                <td className="num">{pct(estimate.sellTotal ? s.sell / estimate.sellTotal : 0)}</td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{estimate.lineCount}</td>
            <td className="num">{n0(estimate.direct.material)}</td>
            <td className="num">{n0(estimate.direct.fab)}</td>
            <td className="num">{n0(estimate.direct.install)}</td>
            <td className="num">{n0(estimate.direct.total - estimate.direct.indirect)}</td>
            <td className="num">{n0(estimate.direct.total)}</td>
            <td className="num strong">{n0(estimate.sellTotal)}</td>
            <td className="num">{n1(estimate.aedPerSqft)}</td>
            <td className="num">100%</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="summary__h">Allowances (from commercials)</h3>
      <table className="summary__table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th>Unit</th>
            <th className="num">Rate</th>
            <th className="num">Direct</th>
            <th>Basis</th>
          </tr>
        </thead>
        <tbody>
          {estimate.allowances.map((a) => (
            <tr key={a.id}>
              <td>{a.label}</td>
              <td className="num">{n0(a.qty)}</td>
              <td>{a.unit}</td>
              <td className="num">{a.rate.toFixed(2)}</td>
              <td className="num">{n0(a.direct)}</td>
              <td className="muted">{a.basis}</td>
            </tr>
          ))}
          {estimate.allowances.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                All allowances are switched off in Commercials.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 className="summary__h">Floor areas</h3>
      <table className="summary__table summary__table--narrow">
        <thead>
          <tr>
            <th>Floor</th>
            <th className="num">m²</th>
            <th className="num">sqft</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {estimate.floorAreas.map((f) => (
            <tr key={f.level}>
              <td>{f.name}</td>
              <td className="num">{n0(f.areaM2)}</td>
              <td className="num">{n0(f.areaM2 * SQFT_PER_M2)}</td>
              <td className="muted">{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function QtoTable({ estimate }: { estimate: Estimate }) {
  const floors = estimate.qto.floors
  return (
    <>
      <p className="summary__help">
        Quantities per floor in the element unit, then total and sqft (× {SQFT_PER_M2}). This is the QTO sheet the costing is based on.
      </p>
      <table className="summary__table">
        <thead>
          <tr>
            <th>Element</th>
            <th>Unit</th>
            {floors.map((f) => (
              <th key={f.level} className="num">
                {f.name}
              </th>
            ))}
            <th className="num">Total</th>
            <th className="num">sqft</th>
          </tr>
        </thead>
        <tbody>
          {estimate.qto.rows.map((row) => (
            <tr key={row.elementId}>
              <td>{row.label}</td>
              <td>{row.unit}</td>
              {floors.map((f) => (
                <td key={f.level} className="num">
                  {row.perFloor[f.level] ? n1(row.perFloor[f.level]) : '—'}
                </td>
              ))}
              <td className="num strong">{n1(row.total)}</td>
              <td className="num">{row.totalSqft != null ? n0(row.totalSqft) : '—'}</td>
            </tr>
          ))}
          {estimate.qto.rows.length === 0 && (
            <tr>
              <td colSpan={4 + floors.length} className="muted">
                Measure or add lines to populate the QTO.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

function ClientBoq({ estimate, currency }: { estimate: Estimate; currency: string }) {
  const boq = estimate.boq.filter((b) => b.amount > 0)
  const total = boq.reduce((sum, b) => sum + b.amount, 0)
  return (
    <>
      <p className="summary__help">Lump sums per system (selling price incl. pro-rata indirects, rounded to 10). This is the client-facing BOQ.</p>
      <table className="summary__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th className="num">Qty</th>
            <th>Unit</th>
            <th className="num">Amount ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {boq.map((b, i) => (
            <tr key={b.system}>
              <td>{i + 1}</td>
              <td>
                <strong>{b.label}</strong>
                <div className="muted">{b.text}</div>
              </td>
              <td className="num">1</td>
              <td>LS</td>
              <td className="num strong">{n0(b.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total (excl. VAT)</td>
            <td className="num strong">{n0(total)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}

function Cbd({ estimate, currency }: { estimate: Estimate; currency: string }) {
  return (
    <>
      <p className="summary__help">Cost breakdown in the UNIQUBE CBD format. Percentages are shares of the final selling price.</p>
      <table className="summary__table summary__table--cbd">
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th className="num">Amount ({currency})</th>
            <th className="num">%</th>
          </tr>
        </thead>
        <tbody>
          {estimate.cbd.map((row) => (
            <tr key={`${row.code}-${row.label}`} className={clsx(row.subtotal && 'is-subtotal', row.total && 'is-total')}>
              <td>{row.code}</td>
              <td>{row.label}</td>
              <td className="num">{n0(row.amount)}</td>
              <td className="num">{pct(row.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Benchmarks({ estimate }: { estimate: Estimate }) {
  return (
    <>
      <p className="summary__help">Each figure is compared with the range seen on recent UNIQUBE projects (Zuha Island 5335, 5340, 5345, 5391).</p>
      <table className="summary__table">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="num">This estimate</th>
            <th className="num">Typical range</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {estimate.benchmarks.map((b) => (
            <tr key={b.id}>
              <td>{b.label}</td>
              <td className="num strong">
                {b.status === 'na' ? '—' : `${n1(b.value)} ${b.unit}`}
              </td>
              <td className="num">
                {n1(b.low)} – {n1(b.high)} {b.unit}
              </td>
              <td>
                <span className={clsx('bench', `bench--${b.status}`)}>
                  {b.status === 'in' ? 'In range' : b.status === 'low' ? 'Below' : b.status === 'high' ? 'Above' : 'No data'}
                </span>
              </td>
              <td className="muted">{b.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Revisions({
  estimate,
  revisions,
  onSave,
  onRemove,
  currency,
}: {
  estimate: Estimate
  revisions: EstimateRevision[]
  onSave: (label?: string, note?: string) => EstimateRevision
  onRemove: (id: string) => void
  currency: string
}) {
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const systems = SYSTEMS.filter((s) => revisions.some((r) => (r.systems[s.id] ?? 0) > 0) || estimate.systems.some((x) => x.id === s.id && x.sell > 0))
  const save = () => {
    onSave(label, note)
    setLabel('')
    setNote('')
  }
  const delta = (current: number, previous: number | undefined) => {
    if (previous == null || previous === 0) return ''
    const d = ((current - previous) / previous) * 100
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`
  }
  return (
    <>
      <div className="summary__save">
        <input className="summary__input" placeholder="Label (R0, R1 …)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="summary__input summary__input--wide" placeholder="What changed in this revision" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn btn--accent" onClick={save}>
          <Save size={14} /> Save revision
        </button>
      </div>
      <table className="summary__table">
        <thead>
          <tr>
            <th>Revision</th>
            <th>Saved</th>
            <th className="num">GFA m²</th>
            <th className="num">Direct</th>
            <th className="num">Selling</th>
            <th className="num">{currency}/sqft</th>
            <th className="num">Δ vs prev.</th>
            {systems.map((s) => (
              <th key={s.id} className="num">
                {s.label.replace(' System', '')}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {revisions.map((rev, i) => {
            const prev = revisions[i - 1]
            const sqft = rev.gfaM2 > 0 ? rev.sellAed / (rev.gfaM2 * SQFT_PER_M2) : 0
            return (
              <tr key={rev.id}>
                <td>
                  <strong>{rev.label}</strong>
                  {rev.note && <div className="muted">{rev.note}</div>}
                </td>
                <td className="muted">{new Date(rev.savedAt).toLocaleString()}</td>
                <td className="num">{n0(rev.gfaM2)}</td>
                <td className="num">{n0(rev.directAed)}</td>
                <td className="num strong">{n0(rev.sellAed)}</td>
                <td className="num">{n1(sqft)}</td>
                <td className="num">{delta(rev.sellAed, prev?.sellAed)}</td>
                {systems.map((s) => (
                  <td key={s.id} className="num">
                    {n0(rev.systems[s.id] ?? 0)}
                  </td>
                ))}
                <td>
                  <button type="button" className="icon-btn" title="Remove revision" onClick={() => onRemove(rev.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            )
          })}
          <tr className="is-current">
            <td>
              <strong>Current</strong>
              <div className="muted">live, not saved</div>
            </td>
            <td className="muted">now</td>
            <td className="num">{n0(estimate.gfaM2)}</td>
            <td className="num">{n0(estimate.direct.total)}</td>
            <td className="num strong">{n0(estimate.sellRounded)}</td>
            <td className="num">{n1(estimate.aedPerSqft)}</td>
            <td className="num">{delta(estimate.sellRounded, revisions[revisions.length - 1]?.sellAed)}</td>
            {systems.map((s) => (
              <td key={s.id} className="num">
                {n0(estimate.systems.find((x) => x.id === s.id)?.sell ?? 0)}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </>
  )
}

function Offer({ estimate, currency }: { estimate: Estimate; currency: string }) {
  const ctx = useAppStore((s) => s.projectContext)
  const projectSetup = useAppStore((s) => s.projectSetup)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const revisions = useAppStore((s) => s.revisions)
  const boq = estimate.boq.filter((b) => b.amount > 0)
  const total = boq.reduce((sum, b) => sum + b.amount, 0)
  const revisionLabel = revisions.length ? revisions[revisions.length - 1].label : 'R0'
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const inScope = ELEMENTS.filter((el) => ctx.elements.includes(el.id) && estimate.qto.rows.some((r) => r.elementId === el.id && r.total > 0))
  const payment = [
    ['10%', 'Advance payment on signing of the agreement'],
    ['20%', 'On approval of shop drawings and start of fabrication'],
    ['30%', 'On completion of fabrication, before shipping'],
    ['40%', 'Progress payments against installation, monthly'],
  ]
  const exclusions = [
    'Civil works, foundations, ground slab and site preparation',
    'MEP material and second fix (only first-fix installation on panels is included where listed)',
    'Lightweight concrete floor screed, floor finishes and tiling except where stated',
    'Painting of internal and external surfaces unless stated',
    'Shipping, customs duties and port charges unless stated',
    'Government approvals, NOCs and permits',
    'VAT and other statutory taxes',
  ]
  return (
    <div className="offer-doc">
      <header className="offer-doc__head">
        <div>
          <h1>Commercial offer</h1>
          <p className="muted">
            {projectSetup.projectName || 'Project'} · {ctx.projectNumber || 'Ref —'} · Revision {revisionLabel} · {today}
          </p>
        </div>
        <img className="offer-doc__logo" src="/UniQube_Logo.png" alt="UNIQUBE" />
      </header>

      <section>
        <p>
          To: <strong>{ctx.client || 'Client'}</strong>
          {ctx.consultant ? ` · Consultant: ${ctx.consultant}` : ''}
        </p>
        <p>
          Subject: Supply and installation of light gauge steel modular building system for{' '}
          <strong>{ctx.buildingType || projectSetup.projectName || 'the project'}</strong>
          {ctx.location ? ` at ${ctx.location}` : ''}.
        </p>
        <p>
          We thank you for the opportunity and are pleased to submit our offer for the above works. The scope covers the design,
          fabrication, supply and installation of the systems listed below for a built-up area of {n0(estimate.gfaM2)} m² ({n0(estimate.gfaSqft)} sqft)
          across {ctx.floors.length} floor{ctx.floors.length === 1 ? '' : 's'}.
        </p>
      </section>

      <section>
        <h2>1. Bill of quantities</h2>
        <table className="offer-doc__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th className="num">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {boq.map((b, i) => (
              <tr key={b.system}>
                <td>{i + 1}</td>
                <td>
                  <strong>{b.label}</strong>
                  <div>{b.text}</div>
                </td>
                <td>1</td>
                <td>LS</td>
                <td className="num">{n0(b.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total offer (excluding VAT)</td>
              <td className="num">
                {n0(total)} {currency}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="muted">
                Equivalent in USD @ {ctx.commercials.usdRate}
              </td>
              <td className="num muted">{n0(total / (ctx.commercials.usdRate || 3.67))} USD</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section>
        <h2>2. System specification</h2>
        <table className="offer-doc__table">
          <thead>
            <tr>
              <th>Element</th>
              <th>Build-up (outside to inside)</th>
              <th className="num">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {inScope.map((el) => {
              const bu = buildUpFor(ctx, el)
              const q = estimate.qto.rows.find((r) => r.elementId === el.id)
              return (
                <tr key={el.id}>
                  <td>
                    <strong>{el.label}</strong>
                  </td>
                  <td>
                    {bu.layers.length
                      ? bu.layers
                          .map((layer, index) => {
                            const row = rateForLayer(priceSheet, layer, el.layers[index])
                            const name = row ? `${row.materialLabel}${row.variantLabel ? ` ${row.variantLabel}` : ''}` : layer.name
                            return layer.thicknessMm ? `${name} (${layer.thicknessMm} mm)` : name
                          })
                          .join(' + ')
                      : el.hint}
                    {bu.notes ? <div className="muted">{bu.notes}</div> : null}
                  </td>
                  <td className="num">{q ? `${n1(q.total)} ${q.unit}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {ctx.scopeNotes && <p className="muted">{ctx.scopeNotes}</p>}
      </section>

      <section>
        <h2>3. Inclusions and exclusions</h2>
        <table className="offer-doc__table">
          <thead>
            <tr>
              <th>Included</th>
              <th>Excluded</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <ul>
                  <li>Structural design, shop drawings and engineering of the LGS system</li>
                  <li>Fabrication of LGS panels and hot-rolled steel members</li>
                  {ctx.commercials.includeLogistics && <li>Packing, containers and transport to site</li>}
                  {ctx.commercials.includeInstallation && <li>Site installation by our crews including supervision</li>}
                  {ctx.commercials.includePrelims && <li>Site preliminaries: site staff, security and plant for the installation period</li>}
                  <li>Materials as per the system specification above</li>
                </ul>
              </td>
              <td>
                <ul>
                  {exclusions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>4. Payment terms</h2>
        <table className="offer-doc__table offer-doc__table--narrow">
          <tbody>
            {payment.map(([share, text]) => (
              <tr key={share}>
                <td className="num">
                  <strong>{share}</strong>
                </td>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>5. Terms and conditions</h2>
        <ol>
          <li>Validity of this offer: 30 days from the date above.</li>
          <li>Prices are in {currency}, exclusive of VAT, based on the drawings and information received to date; changes in scope will be priced as variations.</li>
          <li>Programme and installation sequence to be agreed on award; site access, power and water to be provided by the client.</li>
          <li>Design is to the applicable UAE codes; third-party approvals are by the client unless otherwise agreed.</li>
          <li>Warranty on the LGS structure and supplied materials per manufacturer terms; workmanship warranty 12 months from handover.</li>
        </ol>
      </section>

      <footer className="offer-doc__foot">
        <p>For UNIQUBE / Mulk International</p>
        <p className="muted">
          Floors: {ctx.floors.map((f) => `${f.name || floorName(f.level)} ${f.areaM2 ? `${n0(f.areaM2)} m²` : ''}`.trim()).join(' · ')}
        </p>
      </footer>
    </div>
  )
}
