import { useAppStore } from '../store'
import { fmtAed } from '../lib/estimate'
import { useEffect, useRef, useState } from 'react'
import {
  blankLabour,
  blankMaterial,
  collectSources,
  lineAmount,
  loadDryCost,
  mergeDryCost,
  saveDryCost,
  sheetTotal,
  takeoffSources,
  type DryCostSheet,
  type LabourRow,
  type MaterialRow,
  type SourceLine,
} from '../lib/dryCost'
import { DEFAULT_LABOUR_DAY_RATE } from '../lib/labourNorms'

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function showNum(value: number | null) {
  return value == null ? '' : String(value)
}

function dayRate() {
  return useAppStore.getState().projectContext.commercials.labourDayRate ?? DEFAULT_LABOUR_DAY_RATE
}

export function DryCostPage({ projectId }: { projectId: string }) {
  const currency = useAppStore((s) => s.projectContext.commercials.currency || 'AED')
  const lines = useAppStore((s) => s.lines)
  const [sheet, setSheet] = useState<DryCostSheet | null>(null)
  const [tab, setTab] = useState<'material' | 'labour'>('material')
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const sourcesRef = useRef<SourceLine[]>([])
  const readyRef = useRef(false)

  useEffect(() => {
    let alive = true
    readyRef.current = false
    setSheet(null)
    setNotice(null)
    setDraft({})
    Promise.all([loadDryCost(projectId), collectSources(projectId)])
      .then(([saved, sources]) => {
        if (!alive) return
        sourcesRef.current = sources
        readyRef.current = true
        setSheet(mergeDryCost(saved, [...sources, ...takeoffSources(useAppStore.getState().lines)], dayRate()))
      })
      .catch((error: unknown) => {
        if (!alive) return
        readyRef.current = true
        setNotice(error instanceof Error ? error.message : 'Could not open the dry cost sheet.')
        setSheet(mergeDryCost(null, takeoffSources(useAppStore.getState().lines), dayRate()))
      })
    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!readyRef.current) return
    setSheet((current) => (current ? mergeDryCost(current, [...sourcesRef.current, ...takeoffSources(lines)], dayRate()) : current))
  }, [lines])

  const sheetRef = useRef(sheet)
  sheetRef.current = sheet

  useEffect(() => {
    if (!sheet || !projectId) return
    const timer = window.setTimeout(() => {
      void saveDryCost(projectId, sheet).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Could not save the dry cost sheet.')
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [projectId, sheet])

  useEffect(() => {
    return () => {
      const latest = sheetRef.current
      if (latest && projectId) void saveDryCost(projectId, latest)
    }
  }, [projectId])

  const materialTotal = sheet ? sheetTotal(sheet.material) : 0
  const labourTotal = sheet ? sheetTotal(sheet.labour) : 0

  function numberField(key: string, value: number | null, onCommit: (next: number | null) => void) {
    return (
      <input
        className="dry-cost__input dry-cost__input--num"
        inputMode="decimal"
        value={draft[key] ?? showNum(value)}
        onChange={(e) => {
          const text = e.target.value
          setDraft((current) => ({ ...current, [key]: text }))
          if (text.trim() === '' || /^-?\d*\.?\d*$/.test(text.trim())) onCommit(parseNum(text))
        }}
        onBlur={() =>
          setDraft((current) => {
            const next = { ...current }
            delete next[key]
            return next
          })
        }
      />
    )
  }

  function patchMaterial(id: string, patch: Partial<MaterialRow>) {
    setSheet((current) =>
      current ? { ...current, material: current.material.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
    )
  }

  function patchLabour(id: string, patch: Partial<LabourRow>) {
    setSheet((current) =>
      current ? { ...current, labour: current.labour.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
    )
  }

  function removeMaterial(row: MaterialRow) {
    setSheet((current) => {
      if (!current) return current
      return {
        ...current,
        material: current.material.filter((item) => item.id !== row.id),
        dismissedMaterial: row.sourceKey ? [...current.dismissedMaterial, row.sourceKey] : current.dismissedMaterial,
      }
    })
  }

  function removeLabour(row: LabourRow) {
    setSheet((current) => {
      if (!current) return current
      return {
        ...current,
        labour: current.labour.filter((item) => item.id !== row.id),
        dismissedLabour: row.sourceKey ? [...current.dismissedLabour, row.sourceKey] : current.dismissedLabour,
      }
    })
  }

  return (
    <div className="doc-page dry-cost">
      <header>
        <h1>Dry cost</h1>
        <p>
          The quantities from Sub structure, Super structure, MEP, Architecture and takeoff land here. Type the material rate and the labour rate on each line. The amount is quantity times rate.
        </p>
      </header>
      <div className="dry-cost__totals">
        <span>Material {fmtAed(materialTotal, 2)} {currency}</span>
        <span>Labour {fmtAed(labourTotal, 2)} {currency}</span>
        <strong>Dry cost {fmtAed(materialTotal + labourTotal, 2)} {currency}</strong>
      </div>
      {notice && <p className="doc-page__note">{notice}</p>}
      <div className="dry-cost__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'material'} className={tab === 'material' ? 'is-on' : ''} onClick={() => setTab('material')}>
          Material costs
        </button>
        <button type="button" role="tab" aria-selected={tab === 'labour'} className={tab === 'labour' ? 'is-on' : ''} onClick={() => setTab('labour')}>
          Labour costs
        </button>
      </div>
      {!sheet ? (
        <div className="dry-cost__skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : tab === 'material' ? (
        <>
          <div className="dry-cost__scroll">
            <table className="summary__table dry-cost__table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Item code</th>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th>Unit</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th>Source</th>
                  <th>Remarks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sheet.material.length === 0 && (
                  <tr>
                    <td colSpan={10}>No material lines yet. They appear when an agent writes a quantity, or add a row.</td>
                  </tr>
                )}
                {sheet.material.map((row, index) => {
                  const amount = lineAmount(row.qty, row.rate)
                  return (
                    <tr key={row.id}>
                      <td className="num">{index + 1}</td>
                      <td><input className="dry-cost__input dry-cost__input--code" value={row.code} onChange={(e) => patchMaterial(row.id, { code: e.target.value })} /></td>
                      <td><input className="dry-cost__input dry-cost__input--desc" value={row.description} onChange={(e) => patchMaterial(row.id, { description: e.target.value })} /></td>
                      <td>{numberField(`${row.id}:qty`, row.qty, (qty) => patchMaterial(row.id, { qty }))}</td>
                      <td><input className="dry-cost__input dry-cost__input--unit" value={row.unit} onChange={(e) => patchMaterial(row.id, { unit: e.target.value })} /></td>
                      <td>{numberField(`${row.id}:rate`, row.rate, (rate) => patchMaterial(row.id, { rate }))}</td>
                      <td className="num">{amount == null ? '' : fmtAed(amount, 2)}</td>
                      <td>{row.source}</td>
                      <td><input className="dry-cost__input dry-cost__input--note" value={row.remarks} onChange={(e) => patchMaterial(row.id, { remarks: e.target.value })} /></td>
                      <td><button type="button" className="dry-cost__remove" onClick={() => removeMaterial(row)} aria-label={`Remove material row ${index + 1}`}>Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="is-total">
                  <td colSpan={6}>Material total</td>
                  <td className="num">{fmtAed(materialTotal, 2)}</td>
                  <td colSpan={3}>{currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" className="os-btn" onClick={() => setSheet((current) => (current ? { ...current, material: [...current.material, blankMaterial()] } : current))}>
            Add material row
          </button>
        </>
      ) : (
        <>
          <div className="dry-cost__scroll">
            <table className="summary__table dry-cost__table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Code</th>
                  <th>Trade</th>
                  <th>Description</th>
                  <th className="num">Gang</th>
                  <th className="num">Qty</th>
                  <th>Unit</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th>Source</th>
                  <th>Remarks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sheet.labour.length === 0 && (
                  <tr>
                    <td colSpan={12}>No labour lines yet. They follow the quantities, or add a row for a crew.</td>
                  </tr>
                )}
                {sheet.labour.map((row, index) => {
                  const amount = lineAmount(row.qty, row.rate)
                  return (
                    <tr key={row.id}>
                      <td className="num">{index + 1}</td>
                      <td><input className="dry-cost__input dry-cost__input--code" value={row.code} onChange={(e) => patchLabour(row.id, { code: e.target.value })} /></td>
                      <td><input className="dry-cost__input dry-cost__input--trade" value={row.trade} onChange={(e) => patchLabour(row.id, { trade: e.target.value })} /></td>
                      <td><input className="dry-cost__input dry-cost__input--desc" value={row.description} onChange={(e) => patchLabour(row.id, { description: e.target.value })} /></td>
                      <td>{numberField(`${row.id}:gang`, row.gang, (gang) => patchLabour(row.id, { gang }))}</td>
                      <td>{numberField(`${row.id}:qty`, row.qty, (qty) => patchLabour(row.id, { qty, qtyTyped: true }))}</td>
                      <td><input className="dry-cost__input dry-cost__input--unit" value={row.unit} onChange={(e) => patchLabour(row.id, { unit: e.target.value })} /></td>
                      <td>{numberField(`${row.id}:rate`, row.rate, (rate) => patchLabour(row.id, { rate, rateTyped: true }))}</td>
                      <td className="num">{amount == null ? '' : fmtAed(amount, 2)}</td>
                      <td>{row.source}</td>
                      <td><input className="dry-cost__input dry-cost__input--note" value={row.remarks} onChange={(e) => patchLabour(row.id, { remarks: e.target.value })} /></td>
                      <td><button type="button" className="dry-cost__remove" onClick={() => removeLabour(row)} aria-label={`Remove labour row ${index + 1}`}>Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="is-total">
                  <td colSpan={8}>Labour total</td>
                  <td className="num">{fmtAed(labourTotal, 2)}</td>
                  <td colSpan={3}>{currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="doc-page__note">Gang is the crew size. The amount is quantity times rate, so enter man-days or man-hours in the quantity when the rate is per person.</p>
          <button type="button" className="os-btn" onClick={() => setSheet((current) => (current ? { ...current, labour: [...current.labour, blankLabour()] } : current))}>
            Add labour row
          </button>
        </>
      )}
    </div>
  )
}
