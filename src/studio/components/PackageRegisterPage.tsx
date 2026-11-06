import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtAed } from '../lib/estimate'
import {
  PACKAGE_SEED,
  SQFT_PER_M2,
  assemblyTotal,
  loadPackageRegister,
  savePackageRegister,
  type Assembly,
  type LabourRate,
  type LibraryItem,
  type PackageRegister,
  type SubcontractRate,
  type WorkPackage,
} from '../lib/packageRegister'

type Tab = 'packages' | 'library' | 'labour' | 'subcontract' | 'assemblies'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'packages', label: 'Packages' },
  { id: 'library', label: 'Cost library' },
  { id: 'labour', label: 'Labour rates' },
  { id: 'subcontract', label: 'Subcontractors' },
  { id: 'assemblies', label: 'Assemblies' },
]

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function showNum(value: number | null) {
  return value == null ? '' : String(value)
}

function matches(query: string, parts: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return parts.some((part) => (part ?? '').toLowerCase().includes(needle))
}

export function PackageRegisterPage() {
  const [register, setRegister] = useState<PackageRegister | null>(null)
  const [tab, setTab] = useState<Tab>('packages')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const readyRef = useRef(false)

  useEffect(() => {
    let alive = true
    readyRef.current = false
    loadPackageRegister()
      .then((loaded) => {
        if (!alive) return
        readyRef.current = true
        setRegister(loaded)
      })
      .catch((error: unknown) => {
        if (!alive) return
        readyRef.current = true
        setNotice(error instanceof Error ? error.message : 'Could not open the package register.')
        setRegister(PACKAGE_SEED)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!register || !readyRef.current) return
    const timer = window.setTimeout(() => {
      void savePackageRegister(register).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Could not save the package register.')
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [register])

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

  function textField(value: string, onCommit: (next: string) => void, wide = false) {
    return (
      <input
        className={wide ? 'dry-cost__input dry-cost__input--desc' : 'dry-cost__input'}
        value={value}
        onChange={(e) => onCommit(e.target.value)}
      />
    )
  }

  const packages = register?.packages.filter((row) => matches(query, [row.code, row.name, row.description])) ?? []
  const library = register?.library.filter((row) => matches(query, [row.group, row.description, row.notes, row.unit])) ?? []
  const labour = register?.labour.filter((row) => matches(query, [row.description, row.basis, row.unit])) ?? []
  const subcontract = register?.subcontract.filter((row) => matches(query, [row.trade, row.description, row.basis])) ?? []
  const assemblies = register?.assemblies.filter((row) => matches(query, [row.code, row.description, row.system])) ?? []

  return (
    <div className="doc-page dry-cost pkg">
      <header>
        <h1>Package register</h1>
        <p>
          Company rates shared by every estimate. Seeded from the 5340 Zuha Admin Building budget R4 of 7 September 2026: the Data Sheet, the costing build-up, the BOQ packages, and the aluminium unit sheet.
        </p>
      </header>
      <div className="pkg__bar">
        <input
          className="dry-cost__input pkg__search"
          placeholder="Search the register"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="os-btn"
          onClick={() => {
            if (!window.confirm('Replace this register with the 5340 R4 seed?')) return
            readyRef.current = true
            setRegister(structuredClone(PACKAGE_SEED))
          }}
        >
          Restore seed
        </button>
      </div>
      {notice && <p className="doc-page__note">{notice}</p>}
      <div className="dry-cost__tabs" role="tablist">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-on' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {!register ? (
        <div className="dry-cost__skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : tab === 'packages' ? (
        <PackageTable
          rows={packages}
          numberField={numberField}
          textField={textField}
          onChange={(id, patch) =>
            setRegister((current) =>
              current ? { ...current, packages: current.packages.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
            )
          }
          onAdd={() =>
            setRegister((current) =>
              current
                ? {
                    ...current,
                    packages: [
                      ...current.packages,
                      { id: crypto.randomUUID(), code: '', name: '', unit: 'LS', costAed: null, offerAed: null, description: '' },
                    ],
                  }
                : current,
            )
          }
          onRemove={(id) => setRegister((current) => (current ? { ...current, packages: current.packages.filter((row) => row.id !== id) } : current))}
        />
      ) : tab === 'library' ? (
        <LibraryTable
          rows={library}
          numberField={numberField}
          textField={textField}
          onChange={(id, patch) =>
            setRegister((current) =>
              current
                ? {
                    ...current,
                    library: current.library.map((row) => {
                      if (row.id !== id) return row
                      const next = { ...row, ...patch }
                      if ('labourPerSqft' in patch) next.labourPerM2 = next.labourPerSqft == null ? null : Math.round(next.labourPerSqft * SQFT_PER_M2 * 10000) / 10000
                      return next
                    }),
                  }
                : current,
            )
          }
          onAdd={() =>
            setRegister((current) =>
              current
                ? {
                    ...current,
                    library: [
                      ...current.library,
                      { id: crypto.randomUUID(), group: 'Added', description: '', unit: '', rateAed: null, labourPerSqft: null, labourPerM2: null, notes: '' },
                    ],
                  }
                : current,
            )
          }
          onRemove={(id) => setRegister((current) => (current ? { ...current, library: current.library.filter((row) => row.id !== id) } : current))}
        />
      ) : tab === 'labour' ? (
        <LabourTable
          rows={labour}
          numberField={numberField}
          textField={textField}
          onChange={(id, patch) =>
            setRegister((current) =>
              current ? { ...current, labour: current.labour.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
            )
          }
          onAdd={() =>
            setRegister((current) =>
              current
                ? { ...current, labour: [...current.labour, { id: crypto.randomUUID(), description: '', unit: '', rateAed: null, perM2: null, basis: '' }] }
                : current,
            )
          }
          onRemove={(id) => setRegister((current) => (current ? { ...current, labour: current.labour.filter((row) => row.id !== id) } : current))}
        />
      ) : tab === 'subcontract' ? (
        <SubcontractTable
          rows={subcontract}
          numberField={numberField}
          textField={textField}
          onChange={(id, patch) =>
            setRegister((current) =>
              current ? { ...current, subcontract: current.subcontract.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
            )
          }
          onAdd={() =>
            setRegister((current) =>
              current
                ? {
                    ...current,
                    subcontract: [...current.subcontract, { id: crypto.randomUUID(), trade: '', description: '', unit: '', rateAed: null, qty: null, basis: '' }],
                  }
                : current,
            )
          }
          onRemove={(id) => setRegister((current) => (current ? { ...current, subcontract: current.subcontract.filter((row) => row.id !== id) } : current))}
        />
      ) : (
        <AssemblyTable
          rows={assemblies}
          numberField={numberField}
          textField={textField}
          onChange={(id, patch) =>
            setRegister((current) =>
              current ? { ...current, assemblies: current.assemblies.map((row) => (row.id === id ? { ...row, ...patch } : row)) } : current,
            )
          }
          onPart={(id, index, amountAed) =>
            setRegister((current) => {
              if (!current) return current
              return {
                ...current,
                assemblies: current.assemblies.map((row) => {
                  if (row.id !== id) return row
                  const parts = row.parts.map((part, partIndex) => (partIndex === index ? { ...part, amountAed } : part))
                  return { ...row, parts, totalAed: assemblyTotal(parts) }
                }),
              }
            })
          }
          onAdd={() =>
            setRegister((current) =>
              current
                ? {
                    ...current,
                    assemblies: [
                      ...current.assemblies,
                      {
                        id: crypto.randomUUID(),
                        code: '',
                        description: '',
                        system: '',
                        widthMm: null,
                        heightMm: null,
                        areaM2: null,
                        unit: 'nr',
                        qty: null,
                        parts: ['Profiles', 'Paint', 'Accessories', 'Hardware', 'Glass', 'Panel', 'Fabrication', 'Installation'].map((name) => ({ name, amountAed: null })),
                        totalAed: 0,
                      },
                    ],
                  }
                : current,
            )
          }
          onRemove={(id) => setRegister((current) => (current ? { ...current, assemblies: current.assemblies.filter((row) => row.id !== id) } : current))}
        />
      )}
    </div>
  )
}

function PackageTable({
  rows,
  numberField,
  textField,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: WorkPackage[]
  numberField: (key: string, value: number | null, onCommit: (next: number | null) => void) => ReactNode
  textField: (value: string, onCommit: (next: string) => void, wide?: boolean) => ReactNode
  onChange: (id: string, patch: Partial<WorkPackage>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <>
      <div className="dry-cost__scroll">
        <table className="summary__table dry-cost__table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Package</th>
              <th>Description</th>
              <th>Unit</th>
              <th className="num">Cost</th>
              <th className="num">Offer</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{textField(row.code, (code) => onChange(row.id, { code }))}</td>
                <td>{textField(row.name, (name) => onChange(row.id, { name }), true)}</td>
                <td>{textField(row.description, (description) => onChange(row.id, { description }), true)}</td>
                <td>{textField(row.unit, (unit) => onChange(row.id, { unit }))}</td>
                <td>{numberField(`${row.id}:cost`, row.costAed, (costAed) => onChange(row.id, { costAed }))}</td>
                <td>{numberField(`${row.id}:offer`, row.offerAed, (offerAed) => onChange(row.id, { offerAed }))}</td>
                <td><button type="button" className="dry-cost__remove" onClick={() => onRemove(row.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-page__note">Cost is the build-up from the costing sheet. Offer is the lump sum on the BOQ.</p>
      <button type="button" className="os-btn" onClick={onAdd}>Add package</button>
    </>
  )
}

function LibraryTable({
  rows,
  numberField,
  textField,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: LibraryItem[]
  numberField: (key: string, value: number | null, onCommit: (next: number | null) => void) => ReactNode
  textField: (value: string, onCommit: (next: string) => void, wide?: boolean) => ReactNode
  onChange: (id: string, patch: Partial<LibraryItem>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  let group = ''
  return (
    <>
      <div className="dry-cost__scroll">
        <table className="summary__table dry-cost__table pkg__library">
          <thead>
            <tr>
              <th>Group</th>
              <th>Description</th>
              <th>Unit</th>
              <th className="num">Material rate</th>
              <th className="num">Labour / sqft</th>
              <th className="num">Labour / m²</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const heading = row.group !== group
              group = row.group
              return (
                <tr key={row.id} className={heading ? 'is-group-start' : undefined}>
                  <td>{textField(row.group, (groupName) => onChange(row.id, { group: groupName }))}</td>
                  <td>{textField(row.description, (description) => onChange(row.id, { description }), true)}</td>
                  <td>{textField(row.unit, (unit) => onChange(row.id, { unit }))}</td>
                  <td>{numberField(`${row.id}:rate`, row.rateAed, (rateAed) => onChange(row.id, { rateAed }))}</td>
                  <td>{numberField(`${row.id}:lab`, row.labourPerSqft, (labourPerSqft) => onChange(row.id, { labourPerSqft }))}</td>
                  <td className="num">{row.labourPerM2 == null ? '' : fmtAed(row.labourPerM2, 2)}</td>
                  <td>{textField(row.notes, (notes) => onChange(row.id, { notes }), true)}</td>
                  <td><button type="button" className="dry-cost__remove" onClick={() => onRemove(row.id)}>Remove</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="doc-page__note">Material rates are AED per unit from the Data Sheet. Labour per square metre is the sheet’s labour per sqft times 10.7639.</p>
      <button type="button" className="os-btn" onClick={onAdd}>Add library item</button>
    </>
  )
}

function LabourTable({
  rows,
  numberField,
  textField,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: LabourRate[]
  numberField: (key: string, value: number | null, onCommit: (next: number | null) => void) => ReactNode
  textField: (value: string, onCommit: (next: string) => void, wide?: boolean) => ReactNode
  onChange: (id: string, patch: Partial<LabourRate>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <>
      <div className="dry-cost__scroll">
        <table className="summary__table dry-cost__table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Unit</th>
              <th className="num">Rate</th>
              <th className="num">AED / m²</th>
              <th>Basis</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{textField(row.description, (description) => onChange(row.id, { description }), true)}</td>
                <td>{textField(row.unit, (unit) => onChange(row.id, { unit }))}</td>
                <td>{numberField(`${row.id}:rate`, row.rateAed, (rateAed) => onChange(row.id, { rateAed }))}</td>
                <td className="num">{row.perM2 == null ? '' : fmtAed(row.perM2, 2)}</td>
                <td>{textField(row.basis, (basis) => onChange(row.id, { basis }), true)}</td>
                <td><button type="button" className="dry-cost__remove" onClick={() => onRemove(row.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="os-btn" onClick={onAdd}>Add labour rate</button>
    </>
  )
}

function SubcontractTable({
  rows,
  numberField,
  textField,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: SubcontractRate[]
  numberField: (key: string, value: number | null, onCommit: (next: number | null) => void) => ReactNode
  textField: (value: string, onCommit: (next: string) => void, wide?: boolean) => ReactNode
  onChange: (id: string, patch: Partial<SubcontractRate>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <>
      <div className="dry-cost__scroll">
        <table className="summary__table dry-cost__table">
          <thead>
            <tr>
              <th>Trade</th>
              <th>Description</th>
              <th>Unit</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
              <th>Basis</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const amount = row.qty != null && row.rateAed != null ? Math.round(row.qty * row.rateAed * 100) / 100 : null
              return (
                <tr key={row.id}>
                  <td>{textField(row.trade, (trade) => onChange(row.id, { trade }))}</td>
                  <td>{textField(row.description, (description) => onChange(row.id, { description }), true)}</td>
                  <td>{textField(row.unit, (unit) => onChange(row.id, { unit }))}</td>
                  <td>{numberField(`${row.id}:qty`, row.qty, (qty) => onChange(row.id, { qty }))}</td>
                  <td>{numberField(`${row.id}:rate`, row.rateAed, (rateAed) => onChange(row.id, { rateAed }))}</td>
                  <td className="num">{amount == null ? '' : fmtAed(amount, 2)}</td>
                  <td>{textField(row.basis, (basis) => onChange(row.id, { basis }), true)}</td>
                  <td><button type="button" className="dry-cost__remove" onClick={() => onRemove(row.id)}>Remove</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="doc-page__note">Installation-only prices and the aluminium installation column from the unit sheet. Supply-and-install lump sums stay on Packages.</p>
      <button type="button" className="os-btn" onClick={onAdd}>Add subcontract rate</button>
    </>
  )
}

function AssemblyTable({
  rows,
  numberField,
  textField,
  onChange,
  onPart,
  onAdd,
  onRemove,
}: {
  rows: Assembly[]
  numberField: (key: string, value: number | null, onCommit: (next: number | null) => void) => ReactNode
  textField: (value: string, onCommit: (next: string) => void, wide?: boolean) => ReactNode
  onChange: (id: string, patch: Partial<Assembly>) => void
  onPart: (id: string, index: number, amountAed: number | null) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const partNames = rows[0]?.parts.map((part) => part.name) ?? []
  return (
    <>
      <div className="dry-cost__scroll">
        <table className="summary__table dry-cost__table pkg__assemblies">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>System</th>
              <th className="num">W</th>
              <th className="num">H</th>
              <th className="num">m²</th>
              <th className="num">Qty</th>
              {partNames.map((name) => (
                <th key={name} className="num">{name}</th>
              ))}
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{textField(row.code, (code) => onChange(row.id, { code }))}</td>
                <td>{textField(row.description, (description) => onChange(row.id, { description }), true)}</td>
                <td>{textField(row.system, (system) => onChange(row.id, { system }))}</td>
                <td>{numberField(`${row.id}:w`, row.widthMm, (widthMm) => onChange(row.id, { widthMm }))}</td>
                <td>{numberField(`${row.id}:h`, row.heightMm, (heightMm) => onChange(row.id, { heightMm }))}</td>
                <td>{numberField(`${row.id}:a`, row.areaM2, (areaM2) => onChange(row.id, { areaM2 }))}</td>
                <td>{numberField(`${row.id}:q`, row.qty, (qty) => onChange(row.id, { qty }))}</td>
                {row.parts.map((part, index) => (
                  <td key={part.name}>{numberField(`${row.id}:p${index}`, part.amountAed, (amountAed) => onPart(row.id, index, amountAed))}</td>
                ))}
                <td className="num">{row.totalAed == null ? '' : fmtAed(row.totalAed, 2)}</td>
                <td><button type="button" className="dry-cost__remove" onClick={() => onRemove(row.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-page__note">Door and window build-ups from the Unit Costing sheet. Width and height are millimetres. The total is the sum of the part columns, in AED per piece.</p>
      <button type="button" className="os-btn" onClick={onAdd}>Add assembly</button>
    </>
  )
}
