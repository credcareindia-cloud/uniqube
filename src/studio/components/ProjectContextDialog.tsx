import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useAppStore } from '../store'
import type { BuildUp, BuildUpLayer, Commercials } from '../types'
import {
  ELEMENTS,
  ELEMENT_GROUPS,
  SQFT_PER_M2,
  buildUpFor,
  defaultBuildUp,
  defaultCommercials,
  rateForLayer,
  sellMultiplier,
  type ElementDef,
  type ElementSize as ElementSizeKey,
} from '../lib/elements'

type Section = 'project' | 'floors' | 'elements' | 'commercials' | 'scope'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'project', label: 'Project' },
  { id: 'floors', label: 'Floors' },
  { id: 'elements', label: 'Elements and build-ups' },
  { id: 'commercials', label: 'Commercials' },
  { id: 'scope', label: 'Scope notes' },
]

type NumField = { key: keyof Commercials; label: string; step?: number; suffix?: string; help?: string }

const MARKUP_FIELDS: NumField[] = [
  { key: 'overheadPct', label: 'Head office overhead', suffix: '% on cost', help: 'UNIQUBE: 15% on direct cost' },
  { key: 'financePct', label: 'Finance', suffix: '%', help: '2% on subtotal' },
  { key: 'contingencyPct', label: 'Contingency', suffix: '%', help: '2% on subtotal' },
  { key: 'designPct', label: 'Design and engineering', suffix: '%', help: '2%' },
  { key: 'customsPct', label: 'Customs and duties', suffix: '%', help: '0 when ex-works UAE' },
  { key: 'corporateTaxPct', label: 'Corporate tax', suffix: '%', help: 'Leave 0 unless the offer must carry it' },
  { key: 'commissionPct', label: 'Commission', suffix: '%', help: '7% = 3.5% + 3.5% agents' },
  { key: 'usdRate', label: 'AED per USD', step: 0.01, help: '3.67 fixed peg' },
]

const STEEL_FIELDS: NumField[] = [
  { key: 'lgsKgPerM2', label: 'LGS steel', suffix: 'kg/m² GFA', help: 'Zuha: 48–68 kg/m² (4.4–6.3 kg/sqft)' },
  { key: 'lgsRatePerKg', label: 'LGS direct rate', step: 0.1, suffix: 'AED/kg', help: 'Material 3.5 + fabrication 2.4' },
  { key: 'hrsKgPerM2', label: 'Hot-rolled steel', suffix: 'kg/m² GFA', help: 'Zuha: 7–14 kg/m²' },
  { key: 'hrsRatePerKg', label: 'HRS rate incl. install', step: 0.1, suffix: 'AED/kg' },
  { key: 'screwsPerM2', label: 'Self-drilling screws', suffix: 'nr/m² GFA', help: '150–400 nr/m²' },
  { key: 'screwRate', label: 'Screw rate', step: 0.01, suffix: 'AED/nr' },
  { key: 'connectorsPerKgLgs', label: 'Connectors and accessories', step: 0.01, suffix: 'AED per kg LGS', help: '≈ 0.2 AED/kg' },
  { key: 'anchorsCount', label: 'Anchor bolts', suffix: 'nr' },
  { key: 'anchorRate', label: 'Anchor rate', step: 0.5, suffix: 'AED/nr' },
]

const SITE_FIELDS: NumField[] = [
  { key: 'installPerM2', label: 'Site installation', suffix: 'AED/m² GFA', help: 'Zuha: 55–111 AED/m²' },
  { key: 'm2PerContainer', label: 'GFA per 40 ft container', suffix: 'm²', help: '≈ 60 m² per container' },
  { key: 'trailerPerContainer', label: 'Trailer per container', suffix: 'AED' },
  { key: 'palletPerContainer', label: 'Pallets per container', suffix: 'AED' },
  { key: 'prelimsPct', label: 'Preliminaries', suffix: '% of direct', help: 'Used when the lump sum below is 0' },
  { key: 'prelimsLumpSum', label: 'Preliminaries lump sum', suffix: 'AED', help: 'Site staff months, security, plant (Overhead sheet)' },
  { key: 'mepPanelsPerM2', label: 'MEP first-fix panels', step: 0.01, suffix: 'panels/m² GFA' },
  { key: 'mepRatePerPanel', label: 'MEP rate per panel', suffix: 'AED' },
]

const INCLUDE_FIELDS: Array<{ key: keyof Commercials; label: string }> = [
  { key: 'includeSteelAllowance', label: 'Steel allowance (LGS, HRS, screws, anchors, connectors)' },
  { key: 'includeInstallation', label: 'Site installation labour' },
  { key: 'includeLogistics', label: 'Logistics (containers, trailer, pallets)' },
  { key: 'includePrelims', label: 'Preliminaries' },
  { key: 'includeMep', label: 'MEP first-fix on panels' },
]

const SIZE_LABEL: Record<ElementSizeKey, string> = {
  height: 'Height (mm)',
  width: 'Width (mm)',
  depth: 'Depth (mm)',
  thickness: 'Thickness (mm)',
}

const SIZE_FIELD: Record<ElementSizeKey, keyof Pick<BuildUp, 'heightMm' | 'widthMm' | 'depthMm' | 'thicknessMm'>> = {
  height: 'heightMm',
  width: 'widthMm',
  depth: 'depthMm',
  thickness: 'thicknessMm',
}

function CommercialNumber({
  field,
  value,
  onChange,
}: {
  field: NumField
  value: number
  onChange: (patch: Partial<Commercials>) => void
}) {
  return (
    <label className="context-field">
      <span>
        {field.label}
        {field.suffix ? <em className="context-field__suffix"> {field.suffix}</em> : null}
      </span>
      <input
        type="number"
        step={field.step ?? 1}
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange({ [field.key]: Number.isFinite(next) && next >= 0 ? next : 0 } as Partial<Commercials>)
        }}
      />
      {field.help ? <small className="context-field__help">{field.help}</small> : null}
    </label>
  )
}

function newLayerId() {
  return `layer-${Math.random().toString(36).slice(2, 8)}`
}

function BuildUpEditor({ element }: { element: ElementDef }) {
  const ctx = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const setBuildUp = useAppStore((s) => s.setBuildUp)
  const buildUp = buildUpFor(ctx, element)
  const custom = Boolean(ctx.buildUps[element.id])

  const rateGroups = useMemo(() => {
    const groups = new Map<string, typeof priceSheet>()
    for (const row of priceSheet) {
      const list = groups.get(row.componentLabel)
      if (list) list.push(row)
      else groups.set(row.componentLabel, [row])
    }
    return [...groups.entries()]
  }, [priceSheet])

  function save(next: BuildUp) {
    setBuildUp(element.id, next)
  }

  function patchLayer(index: number, patch: Partial<BuildUpLayer>) {
    const layers = buildUp.layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer))
    save({ ...buildUp, layers })
  }

  return (
    <div className="buildup">
      <p className="buildup__hint">{element.hint}</p>
      {element.sizes.length > 0 && (
        <div className="buildup__sizes">
          {element.sizes.map((size) => (
            <label key={size} className="buildup__size">
              <span>{SIZE_LABEL[size]}</span>
              <input
                type="number"
                min={0}
                placeholder={size === 'height' ? 'floor height' : 'from section'}
                value={buildUp[SIZE_FIELD[size]] ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  save({ ...buildUp, [SIZE_FIELD[size]]: value > 0 ? value : undefined })
                }}
              />
            </label>
          ))}
        </div>
      )}
      <div className="buildup__layers">
        <div className="buildup__layers-head">
          <span>Layers · each becomes a priced line</span>
          <div>
            {custom && (
              <button type="button" className="icon-btn" title="Reset to the default build-up" onClick={() => setBuildUp(element.id, null)}>
                <RotateCcw size={13} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              title="Add a layer"
              onClick={() =>
                save({
                  ...buildUp,
                  layers: [...buildUp.layers, { id: newLayerId(), name: 'New layer', thicknessMm: 0 }],
                })
              }
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
        {buildUp.layers.length === 0 && (
          <p className="buildup__empty">
            One line per measurement, billed in {element.unit}. Add layers when the element is built from boards, insulation, or decking.
          </p>
        )}
        {buildUp.layers.map((layer, index) => {
          const seed = element.layers.find((item) => item.id === layer.id)
          const row = rateForLayer(priceSheet, layer, seed)
          return (
            <div key={layer.id} className="buildup__layer">
              <input
                value={layer.name}
                placeholder="Layer"
                onChange={(e) => patchLayer(index, { name: e.target.value })}
              />
              <input
                type="number"
                min={0}
                value={layer.thicknessMm || ''}
                placeholder="mm"
                title="Thickness (mm)"
                onChange={(e) => patchLayer(index, { thicknessMm: Number(e.target.value) || 0 })}
              />
              <select
                value={layer.priceRowId ?? ''}
                title={row ? `${row.materialLabel} / ${row.variantLabel} · ${row.unitPrice} ${row.currency}/${row.unit}` : 'No rate matched'}
                onChange={(e) => patchLayer(index, { priceRowId: e.target.value || undefined })}
              >
                <option value="">{row ? `Auto: ${row.materialLabel} / ${row.variantLabel}` : 'Auto: no rate matched'}</option>
                {rateGroups.map(([group, rows]) => (
                  <optgroup key={group} label={group}>
                    {rows.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.materialLabel} / {item.variantLabel} · {item.unitPrice} {item.currency}/{item.unit}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="buildup__rate">{row ? `${row.unitPrice} ${row.currency}/${row.unit}` : '—'}</span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                title="Remove layer"
                onClick={() => save({ ...buildUp, layers: buildUp.layers.filter((_, i) => i !== index) })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>
      <input
        className="buildup__notes"
        value={buildUp.notes}
        placeholder="Notes for the estimator, for example: deduct openings over 1 m²"
        onChange={(e) => save({ ...buildUp, notes: e.target.value })}
      />
    </div>
  )
}

export function ProjectContextDialog({ onClose }: { onClose: () => void }) {
  const ctx = useAppStore((s) => s.projectContext)
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const setFloorCount = useAppStore((s) => s.setFloorCount)
  const setFloor = useAppStore((s) => s.setFloor)
  const setBuildUp = useAppStore((s) => s.setBuildUp)
  const setCommercials = useAppStore((s) => s.setCommercials)
  const [section, setSection] = useState<Section>('project')
  const commercials = ctx.commercials
  const multiplier = sellMultiplier(commercials)
  const totalAreaM2 = ctx.floors.reduce((sum, floor) => sum + (floor.areaM2 ?? 0), 0)
  const [openElement, setOpenElement] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleElement(id: string) {
    const has = ctx.elements.includes(id)
    setProjectContext({ elements: has ? ctx.elements.filter((item) => item !== id) : [...ctx.elements, id] })
    if (has && openElement === id) setOpenElement(null)
  }

  return createPortal(
    <div className="pages-backdrop" onMouseDown={onClose}>
      <div
        className="pages-dialog context-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pages-dialog__head">
          <div>
            <h2 id="context-dialog-title">Project context</h2>
            <p>{projectName || 'This project'} · what the estimator knows before it reads a sheet</p>
          </div>
          <div className="pages-dialog__actions">
            <button type="button" className="modal__save" onClick={onClose}>
              Done
            </button>
            <button type="button" className="pages-dialog__close" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="context-dialog__body">
          <nav className="context-dialog__nav" aria-label="Context sections">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx('agent-settings__nav-item', section === item.id && 'is-on')}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="context-dialog__pane">
            {section === 'project' && (
              <>
                <p className="context-help">Building type, location and client are set in Settings.</p>
                <label className="context-field">
                  <span>Project number</span>
                  <input value={ctx.projectNumber} placeholder="5335" onChange={(e) => setProjectContext({ projectNumber: e.target.value })} />
                </label>
                <label className="context-field">
                  <span>Consultant</span>
                  <input value={ctx.consultant} placeholder="Consultant / PMC" onChange={(e) => setProjectContext({ consultant: e.target.value })} />
                </label>
                <label className="context-field">
                  <span>Drawing units</span>
                  <select value={ctx.units} onChange={(e) => setProjectContext({ units: e.target.value as typeof ctx.units })}>
                    <option value="mm">Millimetres (3500)</option>
                    <option value="m">Metres (3.50)</option>
                    <option value="ft">Feet and inches (11'-6")</option>
                  </select>
                </label>
                <label className="context-field context-field--wide">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={ctx.description}
                    placeholder="What the job is, what UNIQUBE supplies, what is by others"
                    onChange={(e) => setProjectContext({ description: e.target.value })}
                  />
                </label>
              </>
            )}

            {section === 'floors' && (
              <>
                <p className="context-help">Number of levels is set in Settings. Names and heights for those levels stay here.</p>
                <p className="context-help">
                  Wall measurements use the floor height when no height is given. Substructure is floor 0. Built-up area drives
                  the steel, installation, logistics allowances and the AED/sqft rate; leave it blank to use measured floor areas.
                  {totalAreaM2 > 0 && ` Total ${Math.round(totalAreaM2).toLocaleString()} m² (${Math.round(totalAreaM2 * SQFT_PER_M2).toLocaleString()} sqft).`}
                </p>
                <table className="context-table">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Name</th>
                      <th>Floor height (mm)</th>
                      <th>Built-up area (m²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.floors.map((floor) => (
                      <tr key={floor.level}>
                        <td className="num">{floor.level}</td>
                        <td>
                          <input
                            value={floor.name}
                            onChange={(e) =>
                              setProjectContext({
                                floors: ctx.floors.map((item) => (item.level === floor.level ? { ...item, name: e.target.value } : item)),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={floor.heightMm}
                            onChange={(e) =>
                              setProjectContext({
                                floors: ctx.floors.map((item) =>
                                  item.level === floor.level ? { ...item, heightMm: Number(e.target.value) || 0 } : item,
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={floor.areaM2 ?? ''}
                            placeholder="measured"
                            onChange={(e) => {
                              const value = Number(e.target.value)
                              setFloor(floor.level, { areaM2: e.target.value === '' || !Number.isFinite(value) || value <= 0 ? undefined : value })
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {section === 'commercials' && (
              <section className="context-commercials">
                <div className="context-multiplier">
                  <div>
                    <span className="context-multiplier__label">Selling multiplier on direct cost</span>
                    <strong className="context-multiplier__value">× {multiplier.toFixed(4)}</strong>
                  </div>
                  <p className="context-help">
                    direct × (1 + OH) ÷ (1 − margin) × (1 + finance + contingency) × (1 + design) × (1 + customs) × (1 + tax) × (1 +
                    commission). UNIQUBE Zuha jobs: 1.5357.
                  </p>
                  <button type="button" className="btn btn--ghost" onClick={() => setCommercials(defaultCommercials())}>
                    <RotateCcw size={14} /> Reset to UNIQUBE defaults
                  </button>
                </div>

                <h4 className="context-subhead">Markups</h4>
                <div className="context-form">
                  {MARKUP_FIELDS.map((field) => (
                    <CommercialNumber key={field.key} field={field} value={commercials[field.key] as number} onChange={setCommercials} />
                  ))}
                </div>

                <h4 className="context-subhead">Steel allowance (per m² of built-up area)</h4>
                <div className="context-form">
                  {STEEL_FIELDS.map((field) => (
                    <CommercialNumber key={field.key} field={field} value={commercials[field.key] as number} onChange={setCommercials} />
                  ))}
                </div>

                <h4 className="context-subhead">Installation, logistics, preliminaries, MEP</h4>
                <div className="context-form">
                  {SITE_FIELDS.map((field) => (
                    <CommercialNumber key={field.key} field={field} value={commercials[field.key] as number} onChange={setCommercials} />
                  ))}
                </div>

                <h4 className="context-subhead">Included in this offer</h4>
                <div className="context-includes">
                  {INCLUDE_FIELDS.map((field) => (
                    <label key={field.key} className="context-element__check">
                      <input
                        type="checkbox"
                        checked={Boolean(commercials[field.key])}
                        onChange={(e) => setCommercials({ [field.key]: e.target.checked } as Partial<Commercials>)}
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {section === 'elements' && (
              <section className="context-elements">
                <p className="context-help">
                  Tick what this job includes. Open an element to set its layers, default sizes, and rates. The
                  estimator measures only ticked elements.
                </p>
                {ELEMENT_GROUPS.map((group) => (
                  <div key={group.id} className="context-group">
                    <h3>{group.label}</h3>
                    {ELEMENTS.filter((element) => element.group === group.id).map((element) => {
                      const on = ctx.elements.includes(element.id)
                      const open = openElement === element.id
                      const custom = Boolean(ctx.buildUps[element.id])
                      return (
                        <div key={element.id} className={clsx('context-element', on && 'is-on', open && 'is-open')}>
                          <div className="context-element__row">
                            <label className="context-element__check">
                              <input type="checkbox" checked={on} onChange={() => toggleElement(element.id)} />
                              <span>{element.label}</span>
                            </label>
                            <span className="context-element__meta">
                              {element.measure} → {element.unit}
                              {custom ? ' · custom build-up' : ''}
                            </span>
                            <button
                              type="button"
                              className="btn btn--ghost context-element__open"
                              disabled={!on}
                              onClick={() => setOpenElement(open ? null : element.id)}
                            >
                              {open ? 'Close' : 'Build-up'}
                            </button>
                          </div>
                          {open && on && <BuildUpEditor element={element} />}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    for (const element of ELEMENTS) {
                      if (ctx.buildUps[element.id]) setBuildUp(element.id, null)
                    }
                  }}
                >
                  Reset all build-ups to defaults
                </button>
                <p className="context-help">
                  Defaults: {ELEMENTS.filter((e) => e.layers.length).map((e) => `${e.label}: ${defaultBuildUp(e).layers.map((l) => l.name).join(' + ')}`).join('; ')}.
                </p>
              </section>
            )}

            {section === 'scope' && (
              <section className="context-form">
                <label className="context-field context-field--wide">
                  <span>Scope notes</span>
                  <textarea
                    rows={10}
                    value={ctx.scopeNotes}
                    placeholder="Measurement rules for this job: deduct openings over 1 m², gross external area for the roof, exclude garage, take wall heights from section A-A…"
                    onChange={(e) => setProjectContext({ scopeNotes: e.target.value })}
                  />
                </label>
                <p className="context-help">These notes go to the model with every message.</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
