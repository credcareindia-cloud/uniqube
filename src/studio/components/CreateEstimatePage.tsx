import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAppStore } from '../store'
import { closeSettings, SETTINGS_STEPS, stepForField, useSettingsDialog } from '../lib/settingsDialog'
import type { JobInputs } from '../types'
import clsx from 'clsx'
import { Building2, Calendar, Check, FileText, Layers, MapPin, Upload } from 'lucide-react'
import { LGS_SPEC, PART_SPEC, ROLL_SPEC, chosenLabels } from '../data/buildSpec'
import { SpecTree } from './SpecTree'
import { ELEMENT_RATE_SEEDS, floorName } from '../lib/elements'
import {
  RULES,
  RULE_CATEGORIES,
  pricePreview,
  type FinishingScope,
  type MepScope,
  type PreviewInput,
  type StructuralSystem,
  FOUNDATIONS,
  type BuildingPart,
  type FoundationType,
} from '../lib/rulesPreview'
import type { Commercials } from '../types'

const aed = (value: number) =>
  new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(Math.round(value))

export interface CreatedEstimate {
  name: string
  client: string
  location: string
  buildingType: string
  levels: number
  gfaM2: number
  files: File[]
  commercials: Partial<Commercials>
  specSummary: string
  jobInputs: JobInputs
}

export function CreateEstimatePage({
  busy,
  notice,
  defaultName = 'Estimation v1',
  initial,
  existingDrawings = 0,
  showUpload = true,
  submitLabel = 'Start estimation',
  step = null,
  focusField = null,
  onBack,
  onPrev,
  onNext,
  onCreate,
}: {
  busy: boolean
  notice: string | null
  defaultName?: string
  initial?: {
    client?: string
    location?: string
    buildingType?: string
    levels?: number
    gfaM2?: number
    currency?: string
    marginPct?: number
    commissionPct?: number
    jobInputs?: JobInputs
  }
  existingDrawings?: number
  showUpload?: boolean
  submitLabel?: string
  step?: number | null
  focusField?: string | null
  onBack?: () => void
  onPrev?: () => void
  onNext?: (draft: CreatedEstimate) => void
  onCreate: (draft: CreatedEstimate) => void
}) {
  const [name, setName] = useState(defaultName)
  const [projectType, setProjectType] = useState(initial?.buildingType ?? '')
  const [client, setClient] = useState(initial?.client ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [currency, setCurrency] = useState(initial?.currency || 'AED')
  const [unit, setUnit] = useState<'m2' | 'sqft'>(initial?.jobInputs?.measurementUnit ?? 'm2')
  const [start, setStart] = useState(initial?.jobInputs?.quoteValidUntil ?? '')
  const [doorHeight, setDoorHeight] = useState<number | ''>(initial?.jobInputs?.doorHeightMm ?? '')
  const [windowHeight, setWindowHeight] = useState<number | ''>(initial?.jobInputs?.windowHeightMm ?? '')
  const [plinth, setPlinth] = useState<number | ''>(initial?.jobInputs?.plinthAboveNglMm ?? '')
  const [soil, setSoil] = useState<number | ''>(initial?.jobInputs?.soilBearingKpa ?? '')
  const [lineLoad, setLineLoad] = useState<number | ''>(initial?.jobInputs?.lineLoadKnM ?? '')
  const [cooling, setCooling] = useState<number | ''>(initial?.jobInputs?.coolingWm2 ?? '')
  const [levels, setLevels] = useState<number | ''>(initial?.levels ?? '')
  const [gfa, setGfa] = useState<number | ''>(initial?.gfaM2 && initial.gfaM2 > 0 ? initial.gfaM2 : '')
  const [page, setPage] = useState<'select' | 'details'>('select')
  const [systems, setSystems] = useState<StructuralSystem[]>([])
  const [openings, setOpenings] = useState<Array<'doors' | 'facade'>>([])
  const [picked, setPicked] = useState<string[]>([])
  const pickedSet = useMemo(() => new Set(picked), [picked])
  const [finishOn, setFinishOn] = useState(false)
  const [finishMode, setFinishMode] = useState<'shell-core' | 'custom'>('shell-core')
  const [mepOn, setMepOn] = useState(false)
  const [mepMode, setMepMode] = useState<'first-fix' | 'custom'>('first-fix')
  const parts = useMemo<BuildingPart[]>(
    () => ['walls', 'floors', 'roof', 'finishes', ...(openings.includes('doors') ? (['doors'] as const) : []), ...(openings.includes('facade') ? (['facade'] as const) : [])],
    [openings],
  )
  const finishing: FinishingScope = !finishOn ? 'none' : finishMode === 'shell-core' ? 'shell' : 'full'
  const mep: MepScope = !mepOn ? 'none' : mepMode === 'custom' ? 'full' : 'basic'
  const [includeSub, setIncludeSub] = useState(false)
  const [foundation, setFoundation] = useState<FoundationType[]>([])
  const specLabels = useMemo(() => {
    const steel = [
      ...(systems.includes('lgs') ? chosenLabels(LGS_SPEC, pickedSet) : []),
      ...(systems.includes('roll-formed') ? chosenLabels(ROLL_SPEC, pickedSet) : []),
    ]
    const build = parts.flatMap((id) => chosenLabels(PART_SPEC[id] ?? [], pickedSet))
    const found = includeSub ? FOUNDATIONS.filter(([id]) => foundation.includes(id)).map(([, label]) => label) : []
    return [...steel, ...build, ...found]
  }, [pickedSet, systems, parts, includeSub, foundation])
  const [wastage, setWastage] = useState(true)
  const [logistics, setLogistics] = useState(true)
  const [installation, setInstallation] = useState(true)
  const [margin, setMargin] = useState(initial?.marginPct ?? 15)
  const [external, setExternal] = useState(initial?.commissionPct != null ? initial.commissionPct / 2 : 3.5)
  const [internal, setInternal] = useState(initial?.commissionPct != null ? initial.commissionPct / 2 : 3.5)
  const [files, setFiles] = useState<File[]>([])
  const [ruleQuery, setRuleQuery] = useState('')
  const [ruleCategory, setRuleCategory] = useState('ALL')
  const [error, setError] = useState<string | null>(null)

  const input: PreviewInput = {
    gfaM2: 0,
    structuralSystem: systems,
    parts,
    finishing,
    mep,
    includeSubstructure: includeSub,
    foundation: includeSub ? foundation : [],
    includeWastage: wastage,
    includeLogistics: logistics,
    includeInstallation: installation,
    marginPct: margin,
    externalCommissionPct: external,
    internalCommissionPct: internal,
  }
  const preview = pricePreview(input)

  const shownRules = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase()
    return RULES.filter((rule) => {
      if (ruleCategory !== 'ALL' && rule.category !== ruleCategory) return false
      if (!q) return false
      return rule.name.toLowerCase().includes(q) || rule.id.toLowerCase().includes(q) || rule.unit.toLowerCase().includes(q)
    }).slice(0, 12)
  }, [ruleQuery, ruleCategory])

  const drawingCount = files.length + existingDrawings
  const readiness = Math.round(
    (name.trim() ? 15 : 0) +
      (client.trim() ? 10 : 0) +
      (Number(gfa) > 0 ? 15 : 0) +
      (drawingCount ? 20 : 0) +
      30,
  )
  const commercials: Partial<Commercials> = {
    currency,
    marginPct: margin,
    commissionPct: external + internal,
    includeInstallation: installation,
    includeLogistics: logistics,
    includePrelims: true,
    includeMep: mepOn,
    includeSteelAllowance: systems.includes('lgs'),
    mepPanelsPerM2: mep === 'full' ? 0.6 : mep === 'basic' ? 0.2 : 0,
    installPerM2: installation ? 75 : 0,
  }

  const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'))

  function submit() {
    if (!name.trim()) {
      setError('Estimate name is required.')
      return
    }
    const levelCount = Number(levels)
    const area = Number(gfa) || 0
    if (levels === '' || !Number.isInteger(levelCount) || levelCount < 0 || levelCount > 5) {
      setError('Choose the number of levels.')
      return
    }
    if (pdfFiles.length === 0 && existingDrawings === 0) {
      setError('Upload at least one PDF drawing before starting estimation.')
      return
    }
    setError(null)
    onCreate(buildDraft(levelCount, area))
  }

  function buildDraft(levelCount = Number(levels) || 0, area = Number(gfa) || 0): CreatedEstimate {
    return {
      name: name.trim(),
      client: client.trim(),
      location: location.trim(),
      buildingType: projectType,
      levels: levelCount,
      gfaM2: area,
      files: pdfFiles,
      commercials,
      specSummary: specLabels.join('; '),
      jobInputs: {
        doorHeightMm: doorHeight === '' ? null : Number(doorHeight),
        windowHeightMm: windowHeight === '' ? null : Number(windowHeight),
        plinthAboveNglMm: plinth === '' ? null : Number(plinth),
        soilBearingKpa: soil === '' ? null : Number(soil),
        lineLoadKnM: lineLoad === '' ? null : Number(lineLoad),
        coolingWm2: cooling === '' ? null : Number(cooling),
        measurementUnit: unit,
        quoteValidUntil: start,
      },
    }
  }

  useEffect(() => {
    if (!focusField) return
    document.querySelector(`[data-field="${focusField}"]`)?.scrollIntoView({ block: 'center' })
  }, [focusField, step])

  const mark = (id: string) => (focusField === id ? 'is-needed' : undefined)

  const maxBar = Math.max(1, ...preview.lines.map((line) => line.amount))

  const stepped = step != null

  return (
    <div className={stepped ? 'settings-wizard' : 'os-body'}>
        <main className={stepped ? undefined : 'os-main'}>
          {stepped && <p className="settings-wizard__count">{SETTINGS_STEPS[step]} · {step + 1} of {SETTINGS_STEPS.length}</p>}
          {stepped && step === 2 ? (
            <DetailsPage
              systems={systems}
              openings={openings}
              includeSub={includeSub}
              foundation={foundation}
              setFoundation={setFoundation}
              finishOn={finishOn}
              finishMode={finishMode}
              setFinishMode={setFinishMode}
              mepOn={mepOn}
              mepMode={mepMode}
              setMepMode={setMepMode}
              pickedSet={pickedSet}
              onToggle={(id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
              onBack={() => onPrev?.()}
              onNext={() => onNext?.(buildDraft())}
            />
          ) : page === 'details' ? (
            <DetailsPage
              systems={systems}
              openings={openings}
              includeSub={includeSub}
              foundation={foundation}
              setFoundation={setFoundation}
              finishOn={finishOn}
              finishMode={finishMode}
              setFinishMode={setFinishMode}
              mepOn={mepOn}
              mepMode={mepMode}
              setMepMode={setMepMode}
              pickedSet={pickedSet}
              onToggle={(id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
              onBack={() => setPage('select')}
            />
          ) : (
          <>
          {onBack && (
            <div className="os-nextbar os-backbar">
              <button type="button" className="os-btn os-back" onClick={onBack}>Back to estimations</button>
            </div>
          )}
          {(!stepped || step === 0) && (
          <section className="os-card" id="os-1">
            <h2><Building2 size={16} /> Project information</h2>
            <div className="os-grid">
              <label className={mark('name')} data-field="name">Estimate name<input value={name} placeholder="Estimate name" onChange={(e) => setName(e.target.value)} /></label>
              <label className={mark('type')} data-field="type">Project type
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                  <option value="">Select</option>
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Industrial</option>
                </select>
              </label>
              <label className={mark('client')} data-field="client">Client name<input value={client} placeholder="Client company" onChange={(e) => setClient(e.target.value)} /></label>
              <label className={mark('location')} data-field="location">Location
                <span className="os-affix"><MapPin size={14} /><input value={location} placeholder="City, plot" onChange={(e) => setLocation(e.target.value)} /></span>
              </label>
              <label className={mark('currency')} data-field="currency">Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label className={mark('unit')} data-field="unit">Measurement unit
                <select value={unit} onChange={(e) => setUnit(e.target.value === 'sqft' ? 'sqft' : 'm2')}>
                  <option value="m2">m² (square metres)</option>
                  <option value="sqft">sqft</option>
                </select>
              </label>
              <label className={mark('validity')} data-field="validity">Validity of quotation
                <span className="os-affix"><Calendar size={14} /><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></span>
              </label>
            </div>
          </section>
          )}

          {(!stepped || step === 1) && (
          <section className="os-card" id="os-3">
            <h2><Layers size={16} /> Building parameters</h2>
            <div className="os-grid">
              <label className={mark('levels')} data-field="levels">Number of levels
                <select value={levels} onChange={(e) => setLevels(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">Select</option>
                  {[0, 1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label className={mark('gfa')} data-field="gfa">Gross floor area (m²)<input type="number" min={0} placeholder="m²" value={gfa} onChange={(e) => setGfa(e.target.value === '' ? '' : Number(e.target.value))} /></label>
            </div>
            <h3 className="os-scope">Scope of work</h3>
            <div className="os-seg">
              <span>Substructure</span>
              <Toggle label={includeSub ? 'In scope' : 'Out of scope'} on={includeSub} set={setIncludeSub} />
            </div>
            <h3 className="os-scope">Superstructure</h3>
            <div className="os-seg">
              <div>
                {(
                  [
                    ['lgs', 'LGS'],
                    ['roll-formed', 'Roll formed steel'],
                    ['doors', 'Doors & Windows'],
                    ['facade', 'Facade'],
                    ['precast', 'Precast'],
                  ] as const
                ).map(([id, text]) => {
                  const soon = id === 'precast'
                  const on = id === 'doors' || id === 'facade' ? openings.includes(id) : id !== 'precast' && systems.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className={clsx(on && 'is-on', soon && 'is-soon')}
                      aria-pressed={soon ? false : on}
                      aria-disabled={soon}
                      onClick={() => {
                        if (soon) return
                        if (id === 'doors' || id === 'facade') {
                          setOpenings((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
                          return
                        }
                        setSystems((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
                      }}
                    >
                      {text}
                      {soon && <span className="os-soon">Coming soon</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="os-seg">
              <span>Finishes</span>
              <Toggle label={finishOn ? 'In scope' : 'Out of scope'} on={finishOn} set={setFinishOn} />
            </div>
            <div className="os-seg">
              <span>MEP</span>
              <Toggle label={mepOn ? 'In scope' : 'Out of scope'} on={mepOn} set={setMepOn} />
            </div>
          </section>
          )}

          {stepped && step === 3 && (
          <section className="os-card">
            <h2>Required inputs</h2>
            <p className="os-note">These values are shared. The agents read them from here, so they are not asked for again on each page.</p>
            <div className="os-grid">
              <label className={mark('doorHeight')} data-field="doorHeight">Door height (mm)<input type="number" min={0} placeholder="2100" value={doorHeight} onChange={(e) => setDoorHeight(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className={mark('windowHeight')} data-field="windowHeight">Window height (mm)<input type="number" min={0} placeholder="1200" value={windowHeight} onChange={(e) => setWindowHeight(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className={mark('plinth')} data-field="plinth">Plinth above NGL (mm)<input type="number" min={0} step={50} placeholder="450" value={plinth} onChange={(e) => setPlinth(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className={mark('soil')} data-field="soil">Soil bearing (kPa)<input type="number" min={0} step={10} placeholder="150" value={soil} onChange={(e) => setSoil(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className={mark('lineLoad')} data-field="lineLoad">Line load / storey (kN/m)<input type="number" min={0} step={5} placeholder="40" value={lineLoad} onChange={(e) => setLineLoad(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className={mark('cooling')} data-field="cooling">Cooling (W/m²)<input type="number" min={0} placeholder="e.g. 180" value={cooling} onChange={(e) => setCooling(e.target.value === '' ? '' : Number(e.target.value))} /></label>
            </div>
          </section>
          )}

          {showUpload && !stepped && (
          <section className="os-card" id="os-2">
            <h2><Upload size={16} /> Upload drawings</h2>
            <label className="os-drop">
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => setFiles([...(e.target.files ?? [])])}
              />
              <b>Drag and drop PDF drawings, or browse</b>
              <span>PDF only. DWG and IFC are not read by the geometry engine yet. Vector PDFs measure; scans are flagged.</span>
            </label>
            <ul className="os-files">
              {files.map((file) => (
                <li key={file.name}>
                  <FileText size={14} />
                  <span>{file.name}</span>
                  <small>{(file.size / 1e6).toFixed(1)} MB</small>
                  {file.name.toLowerCase().endsWith('.pdf') ? <Check size={14} /> : <em>skipped</em>}
                </li>
              ))}
            </ul>
          </section>
          )}

          {(!stepped || step === 4) && (
          <section className="os-card" id="os-4">
            <h2>Rules and pricing setup</h2>
            <div className="os-toggles">
              <Toggle label="Supply of material" on={wastage} set={setWastage} />
              <Toggle label="Include logistics" on={logistics} set={setLogistics} />
              <Toggle label="Include installation" on={installation} set={setInstallation} />
            </div>
            <div className="os-grid">
              <label className={mark('margin')} data-field="margin">Target profit margin (%)<input type="number" min={0} max={40} step={0.5} value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} /></label>
              <label className={mark('external')} data-field="external">External commission (%)<input type="number" min={0} max={20} step={0.5} value={external} onChange={(e) => setExternal(Number(e.target.value) || 0)} /></label>
              <label className={mark('internal')} data-field="internal">Internal commission (%)<input type="number" min={0} max={20} step={0.5} value={internal} onChange={(e) => setInternal(Number(e.target.value) || 0)} /></label>
            </div>
            <div className="os-rulebar">
              <select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)}>
                <option value="ALL">All 11 categories</option>
                {RULE_CATEGORIES.map((cat) => (
                  <option key={cat.code} value={cat.name}>{cat.name} ({cat.rule_count})</option>
                ))}
              </select>
              <input value={ruleQuery} placeholder="Find a rule by name, id, or unit — try wall, kg, or nr" onChange={(e) => setRuleQuery(e.target.value)} />
            </div>
            {ruleQuery.trim() ? (
              <ul className="os-rules">
                {shownRules.map((rule) => (
                  <li key={rule.id}>
                    <b>{rule.id}</b> {rule.name}
                    <small>{rule.category} · unit {rule.unit} · {rule.status.replaceAll('_', ' ').toLowerCase()}</small>
                    <span>{rule.logic}</span>
                  </li>
                ))}
                {shownRules.length === 0 && <li>No rule matches.</li>}
              </ul>
            ) : null}
          </section>
          )}

          {stepped && step !== 2 && (
            <div className="settings-wizard__nav">
              <button type="button" className="os-btn" disabled={step === 0} onClick={onPrev}>Previous</button>
              {error && <p className="os-error">{error}</p>}
              <button
                type="button"
                className="os-btn os-btn--primary"
                disabled={busy}
                onClick={() => (step === SETTINGS_STEPS.length - 1 ? submit() : onNext?.(buildDraft()))}
              >
                {step === SETTINGS_STEPS.length - 1 ? submitLabel : 'Next'}
              </button>
            </div>
          )}

          {!stepped && (
          <div className="os-nextbar">
            {error && <p className="os-error">{error}</p>}
            {!error && notice === 'Settings saved.' && <p className="os-note">{notice}</p>}
            {!error && notice && notice !== 'Settings saved.' && <p className="os-error">{notice}</p>}
            <button type="button" className="os-btn os-btn--primary os-next" onClick={() => setPage('details')}>
              Next
            </button>
          </div>
          )}
          </>
          )}
        </main>

        {!stepped && (
        <aside className="os-side">
          <div className="os-card">
            <div className="os-side__head">
              <h2>Estimate summary</h2>
              <span className={clsx('os-badge', preview.blocked ? 'is-block' : 'is-prov')}>
                {preview.blocked ? 'Blocked' : 'Provisional'}
              </span>
            </div>
            <dl className="os-facts">
              <div><dt>Name</dt><dd>{name || '—'}</dd></div>
              <div><dt>Type</dt><dd>{projectType || '—'}</dd></div>
              <div><dt>Location</dt><dd>{location || '—'}</dd></div>
              <div><dt>GFA</dt><dd>{Number(gfa) > 0 ? `${aed(Number(gfa))} m²` : '—'}</dd></div>
              <div><dt>Levels</dt><dd>{levels === '' ? '—' : levels}{Number(gfa) > 0 && Number(levels) > 0 ? ` · ${aed(Number(gfa) / Number(levels))} m² each, ${floorName(1)} up` : ''}</dd></div>
              <div><dt>System</dt><dd>{systems.length ? systems.map((item) => (item === 'roll-formed' ? 'Roll formed steel' : item.toUpperCase())).join(', ') : '—'}</dd></div>
              <div><dt>Build-up</dt><dd>{specLabels.length ? `${specLabels.length} selected` : '—'}</dd></div>
            </dl>
            <div className="os-meters">
              <Meter label="Rules loaded" value={`${RULES.length}`} />
              <Meter label="Rate cards linked" value={`${ELEMENT_RATE_SEEDS.length}`} />
              <Meter label="Uploaded drawings" value={`${drawingCount}`} />
              <Meter label="Readiness" value={`${readiness}%`} />
            </div>
          </div>

          <div className="os-card">
            <h2>Preliminary cost preview</h2>
            <p className="os-note">Template rates. Not a measured takeoff. Status PROVISIONAL.</p>
            {preview.blocked ? (
              <p className="os-error">{preview.blocked}</p>
            ) : (
              <>
                <ul className="os-bars">
                  {preview.lines.filter((line) => line.amount > 0).map((line) => (
                    <li key={line.category}>
                      <div><span>{line.category}</span><b>{aed(line.amount)}</b></div>
                      <i style={{ width: `${(line.amount / maxBar) * 100}%` }} />
                      <small>{line.basis}</small>
                    </li>
                  ))}
                </ul>
                <div className="os-total">
                  <span>Estimated total ({currency})</span>
                  <strong>{aed(preview.netSale)}</strong>
                  <small>{aed(preview.perM2)} {currency}/m² · margin {(preview.achievedMargin * 100).toFixed(1)}% of selling price</small>
                </div>
                <p className="os-note">
                  Base cost {aed(preview.baseCost)} · profit {aed(preview.profit)} · external commission {aed(preview.externalCommission)} · internal {aed(preview.internalCommission)}.
                </p>
              </>
            )}
            <div className="os-actions">
              <button
                type="button"
                className="os-btn os-btn--primary"
                disabled={busy || (pdfFiles.length === 0 && existingDrawings === 0)}
                onClick={() => submit()}
              >
                <Check size={14} /> {submitLabel}
              </button>
              {pdfFiles.length === 0 && existingDrawings === 0 && (
                <p className="os-note">Upload at least one PDF in Upload drawings to enable {submitLabel}.</p>
              )}
              {!error && notice === 'Settings saved.' && <p className="os-note">{notice}</p>}
              {!error && notice && notice !== 'Settings saved.' && <p className="os-error">{notice}</p>}
            </div>
          </div>
        </aside>
        )}
      </div>
  )
}

function ChoiceRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<[T, string]>
}) {
  return (
    <div className="os-seg">
      <div>
        {options.map(([id, text]) => (
          <button key={id} type="button" className={clsx(value === id && 'is-on')} aria-pressed={value === id} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function DetailsPage({
  systems,
  openings,
  includeSub,
  foundation,
  setFoundation,
  finishOn,
  finishMode,
  setFinishMode,
  mepOn,
  mepMode,
  setMepMode,
  pickedSet,
  onToggle,
  onBack,
  onNext,
}: {
  systems: StructuralSystem[]
  openings: Array<'doors' | 'facade'>
  includeSub: boolean
  foundation: FoundationType[]
  setFoundation: (value: FoundationType[] | ((current: FoundationType[]) => FoundationType[])) => void
  finishOn: boolean
  finishMode: 'shell-core' | 'custom'
  setFinishMode: (value: 'shell-core' | 'custom') => void
  mepOn: boolean
  mepMode: 'first-fix' | 'custom'
  setMepMode: (value: 'first-fix' | 'custom') => void
  pickedSet: ReadonlySet<string>
  onToggle: (id: string) => void
  onBack: () => void
  onNext?: () => void
}) {
  return (
    <>
      <section className="os-card">
        <h2>Structure</h2>
        {systems.includes('lgs') && (
          <div className="spec-panel">
            <b>LGS</b>
            <SpecTree nodes={LGS_SPEC} selected={pickedSet} onToggle={onToggle} />
          </div>
        )}
        {systems.includes('roll-formed') && (
          <div className="spec-panel">
            <b>Roll formed steel</b>
            <SpecTree nodes={ROLL_SPEC} selected={pickedSet} onToggle={onToggle} />
          </div>
        )}
        {includeSub && (
          <div className="os-seg">
            <span>Foundation</span>
            <div>
              {FOUNDATIONS.map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  className={clsx(foundation.includes(id) && 'is-on')}
                  aria-pressed={foundation.includes(id)}
                  onClick={() => setFoundation((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {(['walls', 'floors', 'roof'] as const).map((id) => (
          <div className="spec-panel" key={id}>
            <b>{id === 'walls' ? 'Walls' : id === 'floors' ? 'Floors' : 'Roof'}</b>
            <SpecTree nodes={PART_SPEC[id]} selected={pickedSet} onToggle={onToggle} />
          </div>
        ))}
      </section>
      <section className="os-card">
        <h2>Architecture</h2>
        {openings.includes('doors') && (
          <div className="spec-panel">
            <b>Doors & Windows</b>
            <SpecTree nodes={PART_SPEC.doors} selected={pickedSet} onToggle={onToggle} />
          </div>
        )}
        {openings.includes('facade') && (
          <div className="spec-panel">
            <b>Facade</b>
            <SpecTree nodes={PART_SPEC.facade} selected={pickedSet} onToggle={onToggle} />
          </div>
        )}
        {finishOn && (
          <>
            <ChoiceRow
              value={finishMode}
              onChange={setFinishMode}
              options={[['shell-core', 'Shell & core'], ['custom', 'Customised finishes']]}
            />
            {finishMode === 'custom' && (
              <div className="spec-panel">
                <b>Finishes</b>
                <SpecTree nodes={PART_SPEC.finishes} selected={pickedSet} onToggle={onToggle} />
              </div>
            )}
          </>
        )}
      </section>
      {mepOn && (
        <section className="os-card">
          <h2>MEP</h2>
          <ChoiceRow
            value={mepMode}
            onChange={setMepMode}
            options={[['first-fix', 'First fix'], ['custom', 'Customised MEP']]}
          />
        </section>
      )}
      <div className="os-nextbar os-backbar">
        <button type="button" className="os-btn os-back" onClick={onBack}>Previous</button>
        {onNext && (
          <button type="button" className="os-btn os-btn--primary" onClick={onNext}>Next</button>
        )}
      </div>
    </>
  )
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) {
  return (
    <button type="button" className={clsx('os-toggle', on && 'is-on')} onClick={() => set(!on)} aria-pressed={on}>
      <i />
      {label}
    </button>
  )
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="os-meter">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function applySettings(draft: CreatedEstimate) {
  const store = useAppStore.getState()
  if (draft.name) store.setSetupDetails({ projectName: draft.name, floors: Math.max(0, draft.levels) })
  if (Number.isInteger(draft.levels) && draft.levels >= 0) store.setFloorCount(draft.levels)
  const each = draft.levels > 0 && draft.gfaM2 > 0 ? Math.round((draft.gfaM2 / draft.levels) * 100) / 100 : undefined
  const floors = useAppStore.getState().projectContext.floors.map((floor) => ({
    ...floor,
    ...(each ? { areaM2: each } : {}),
  }))
  store.setProjectContext({
    client: draft.client,
    location: draft.location,
    buildingType: draft.buildingType,
    floors,
    jobInputs: draft.jobInputs,
    ...(draft.specSummary ? { scopeNotes: draft.specSummary } : {}),
  })
  store.setCommercials(draft.commercials)
}

/** Settings opens over the page. Next and Previous walk the shared project values. */
export function SettingsDialogHost() {
  const dialog = useSettingsDialog()
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const ctx = useAppStore((s) => s.projectContext)
  const drawings = useAppStore((s) => s.documents.length)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const levels = ctx.floors.filter((floor) => floor.level >= 0).length
  const gfa = ctx.floors.reduce((sum, floor) => sum + (floor.areaM2 ?? 0), 0)

  useEffect(() => {
    if (dialog.open) setStep(stepForField(dialog.field))
  }, [dialog.open, dialog.field])

  useEffect(() => {
    if (!dialog.open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog.open])

  if (!dialog.open) return null

  async function save(draft: CreatedEstimate, done: boolean) {
    setBusy(true)
    setNotice(null)
    try {
      applySettings(draft)
      if (draft.files.length) await useAppStore.getState().addClientFiles(draft.files)
      if (done) closeSettings()
      else setNotice(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save settings')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="pages-backdrop" style={{ zIndex: 4000 }} onMouseDown={() => closeSettings()}>
      <div className="pages-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="pages-dialog__head">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p>One place for the project. Every page reads these values.</p>
          </div>
          <button type="button" className="pages-dialog__close" aria-label="Close settings" onClick={() => closeSettings()}>
            <X size={16} />
          </button>
        </header>
        <CreateEstimatePage
          busy={busy}
          notice={notice}
          defaultName={projectName || 'Estimation'}
          initial={{
            client: ctx.client,
            location: ctx.location,
            buildingType: ctx.buildingType,
            levels: levels > 0 ? levels : undefined,
            gfaM2: gfa,
            currency: ctx.commercials.currency,
            marginPct: ctx.commercials.marginPct,
            commissionPct: ctx.commercials.commissionPct,
            jobInputs: ctx.jobInputs,
          }}
          existingDrawings={drawings}
          showUpload={false}
          submitLabel="Save"
          step={step}
          focusField={dialog.field}
          onPrev={() => setStep((current) => Math.max(0, current - 1))}
          onNext={(draft) => {
            void save(draft, false)
            setStep((current) => Math.min(SETTINGS_STEPS.length - 1, current + 1))
          }}
          onCreate={(draft) => void save(draft, true)}
        />
      </div>
    </div>,
    document.body,
  )
}
