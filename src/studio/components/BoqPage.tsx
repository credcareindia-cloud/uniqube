import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useAppStore } from '../store'
import { roundedBoq } from '../lib/foundation/engine'
import { foundationTypeName } from '../lib/foundation/rules'
import { loadEngineState, type EngineState } from '../lib/foundation/run'
import type { QuantityLine } from '../lib/foundation/types'
import { loadSuperState, type SuperState } from '../lib/superstructure/run'
import { loadMepState } from '../lib/mep/run'
import type { MepState } from '../lib/mep/types'
import { loadArchState } from '../lib/architecture/run'
import type { ArchState } from '../lib/architecture/types'

function unitLabel(unit: string) {
  if (unit === 'm3') return 'm³'
  if (unit === 'm2') return 'm²'
  return unit
}

function cleanBasis(text?: string | null) {
  if (!text?.trim()) return ''
  if (/\bNaN\b/i.test(text)) return ''
  return text.trim()
}

function qtyText(value: number | null | undefined, unit: string) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '—'
  if (unit === 'kg' || unit === 'nr' || unit === 'no' || unit === 'nos') {
    return Math.round(value).toLocaleString('en-US')
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function wasteText(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct) || pct <= 0 || pct > 40) return null
  return `incl. ${pct}% waste`
}

function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: string }) {
  return <span className={`boq-doc__pill is-${tone}`}>{children}</span>
}

function SectionBlock({
  title,
  meta,
  status,
  children,
  empty,
}: {
  title: string
  meta?: string
  status?: { tone: 'ok' | 'warn' | 'muted'; label: string }
  children?: ReactNode
  empty?: string
}) {
  return (
    <section className="boq-doc__section">
      <div className="boq-doc__section-head">
        <div>
          <h2>{title}</h2>
          {meta ? <p>{meta}</p> : null}
        </div>
        {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
      </div>
      {children ?? (empty ? <p className="boq-doc__empty">{empty}</p> : null)}
    </section>
  )
}

function BoqTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: Array<{ key: string; label: string; align?: 'left' | 'right'; width?: string }>
  rows: Array<{ key: string; cells: Record<string, ReactNode>; title?: string }>
}) {
  return (
    <div className="boq-doc__table-wrap">
      <table className="boq-doc__table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th className="boq-doc__item">Item</th>
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'num' : undefined} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} title={row.title}>
              <td className="boq-doc__item">{String(index + 1).padStart(2, '0')}</td>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'num' : undefined}>
                  {row.cells[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BoqPage({ projectId }: { projectId: string }) {
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const client = useAppStore((s) => s.projectContext.client)
  const location = useAppStore((s) => s.projectContext.location)
  const buildingType = useAppStore((s) => s.projectContext.buildingType)

  const [engine, setEngine] = useState<EngineState | null>(null)
  const [superState, setSuperState] = useState<SuperState | null>(null)
  const [mep, setMep] = useState<MepState | null>(null)
  const [arch, setArch] = useState<ArchState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    setReady(false)
    loadEngineState(projectId).then(async (loaded) => {
      if (!alive) return
      setEngine(loaded)
      const sup = await loadSuperState(projectId, loaded.inputs.storeyCount)
      const electrical = await loadMepState(projectId)
      const architecture = await loadArchState(projectId, {
        foundationReady: Boolean(loaded.result),
        foundationApproved: Boolean(loaded.overrides.approvedBy),
        footprintM2: loaded.result?.footprint.areaM2 ?? 0,
        footprint: loaded.result?.footprint.polygon ?? [],
        walls: (loaded.result?.walls ?? []).map((wall) => ({
          id: wall.id,
          external: wall.isExternal,
          lengthMm: wall.length,
          axis: wall.axis,
          pos: wall.pos,
          a: wall.a,
          b: wall.b,
          thickness: wall.thickness,
          openings: wall.openings.map((opening) => ({
            id: opening.id,
            type: opening.type,
            widthMm: opening.width,
            position: opening.position,
          })),
        })),
        rooms: (loaded.result?.rooms ?? []).map((room) => ({
          id: room.id,
          label: room.label,
          category: room.category,
          areaM2: room.areaM2,
          bbox: room.bbox,
        })),
        levels: (sup.result?.levels ?? []).length
          ? sup.result!.levels.map((level) => ({
              id: level.levelId,
              name: level.name,
              heightMm: level.heightMm,
              isRoof: Boolean(level.roof),
            }))
          : (sup.inputs.levels ?? []).map((level) => ({
              id: level.id,
              name: level.name,
              heightMm: level.ffhMm,
              isRoof: level.framingType === 'pitched_roof' || level.framingType === 'flat_roof_truss' || level.framingType === 'flat_roof_c_joist',
            })),
        parapet: null,
      })
      if (!alive) return
      setSuperState(sup)
      setMep(electrical)
      setArch(architecture)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [projectId])

  const result = engine?.result ?? null
  const rows = useMemo(() => (result ? roundedBoq(result) : []), [result])
  const sections = useMemo(() => [...new Set(rows.map((row) => row.section))], [rows])
  const superResult = superState?.result ?? null
  const superGroups = useMemo(() => (superResult ? [...new Set(superResult.boq.map((row) => row.group))] : []), [superResult])
  const issued = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

  const foundationStatus = !ready
    ? null
    : !result
      ? { tone: 'muted' as const, label: 'Not run' }
      : !rows.length
        ? { tone: 'warn' as const, label: 'Blocked' }
        : result.gateOpen
          ? { tone: 'ok' as const, label: 'Approved' }
          : { tone: 'warn' as const, label: 'Provisional' }

  return (
    <div className="boq-doc">
      <header className="boq-doc__cover">
        <div className="boq-doc__brand">
          <span className="boq-doc__mark">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <p className="boq-doc__eyebrow">UNIQUBE · Bill of quantities</p>
            <h1>{projectName.trim() || 'Project estimate'}</h1>
          </div>
        </div>
        <dl className="boq-doc__meta">
          <div>
            <dt>Client</dt>
            <dd>{client.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{location.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Building</dt>
            <dd>{buildingType.trim() || '—'}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{issued}</dd>
          </div>
        </dl>
        <p className="boq-doc__lede">
          Quantities only. Missing inputs stay blank. Calculation notes sit behind each line as a hover tip — they are not part of the issued sheet.
        </p>
      </header>

      <SectionBlock
        title="1. Sub structure"
        meta={
          result
            ? `Type ${result.foundationType} — ${foundationTypeName(result.foundationType)} · Band ${result.band} · ${result.level.drawingNo ?? 'Plan'} p${result.level.sourcePage}${
                engine?.overrides.approvedBy ? ` · ${engine.overrides.approvedBy}` : ''
              }`
            : undefined
        }
        status={foundationStatus ?? undefined}
        empty={
          !ready
            ? 'Loading foundation quantities…'
            : !result
              ? 'Run Sub structure to populate this section.'
              : !rows.length
                ? 'No foundation quantities yet. Resolve stop flags or missing inputs, then run again.'
                : undefined
        }
      >
        {result && rows.length
          ? sections.map((section) => {
              const sectionRows = rows.filter((row) => row.section === section)
              return (
                <BoqTable
                  key={section}
                  caption={section}
                  columns={[
                    { key: 'code', label: 'Code', width: '88px' },
                    { key: 'description', label: 'Description' },
                    { key: 'net', label: 'Net', align: 'right', width: '96px' },
                    { key: 'gross', label: 'Gross', align: 'right', width: '110px' },
                    { key: 'unit', label: 'Unit', width: '64px' },
                  ]}
                  rows={sectionRows.map((row: QuantityLine) => {
                    const waste = wasteText(row.wastePct)
                    const basis = cleanBasis(row.basis)
                    return {
                      key: row.id,
                      title: basis || undefined,
                      cells: {
                        code: <span className="boq-doc__code">{row.boqCode}</span>,
                        description: (
                          <div className="boq-doc__desc">
                            <strong>{row.description}</strong>
                            {waste ? <span>{waste}</span> : null}
                          </div>
                        ),
                        net: qtyText(row.netQty, row.unit),
                        gross: qtyText(row.grossQty, row.unit),
                        unit: unitLabel(row.unit),
                      },
                    }
                  })}
                />
              )
            })
          : null}
      </SectionBlock>

      <SectionBlock
        title="2. Super structure"
        meta={
          superResult
            ? `LGS studs at ${superResult.settings.studSpacingMm} mm · ${superResult.levels.length} level${superResult.levels.length === 1 ? '' : 's'} · net ${Math.round(
                superResult.totals.netLgsKg,
              ).toLocaleString('en-US')} kg`
            : undefined
        }
        status={
          !ready
            ? undefined
            : !superResult
              ? { tone: 'muted', label: 'Not run' }
              : superResult.blocked
                ? { tone: 'warn', label: 'Blocked' }
                : superState?.overrides.approvedBy
                  ? { tone: 'ok', label: 'Approved' }
                  : { tone: 'warn', label: 'Provisional' }
        }
        empty={!ready ? 'Loading superstructure quantities…' : !superResult ? 'Run Super structure to populate this section.' : undefined}
      >
        {superResult
          ? superGroups.map((group) => {
              const groupRows = superResult.boq.filter((row) => row.group === group)
              return (
                <BoqTable
                  key={group}
                  caption={group}
                  columns={[
                    { key: 'code', label: 'Code', width: '88px' },
                    { key: 'description', label: 'Description' },
                    { key: 'qty', label: 'Qty', align: 'right', width: '96px' },
                    { key: 'unit', label: 'Unit', width: '64px' },
                  ]}
                  rows={groupRows.map((row) => {
                    const basis = cleanBasis([row.lgsSection, row.basis].filter(Boolean).join(' · '))
                    return {
                      key: row.id,
                      title: basis || undefined,
                      cells: {
                        code: <span className="boq-doc__code">{row.code}</span>,
                        description: (
                          <div className="boq-doc__desc">
                            <strong>{row.description}</strong>
                            {row.lgsSection ? <span>{row.lgsSection}</span> : null}
                          </div>
                        ),
                        qty: qtyText(row.qty, row.unit),
                        unit: unitLabel(row.unit),
                      },
                    }
                  })}
                />
              )
            })
          : null}
      </SectionBlock>

      <SectionBlock
        title="3. Architecture"
        meta={
          arch?.result?.lines.length
            ? `${arch.result.summary.storeys} measured floor${arch.result.summary.storeys === 1 ? '' : 's'}${
                arch.result.summary.occupiedM2 != null ? ` · ${arch.result.summary.occupiedM2} m² occupied` : ''
              }`
            : undefined
        }
        status={
          !ready
            ? undefined
            : !arch?.result?.lines.length
              ? { tone: 'muted', label: 'Not run' }
              : arch.overrides.approvedBy
                ? { tone: 'ok', label: 'Approved' }
                : { tone: 'warn', label: 'Provisional' }
        }
        empty={!ready ? 'Loading architectural quantities…' : !arch?.result?.lines.length ? 'Run Architecture to populate this section.' : undefined}
      >
        {arch?.result?.lines.length
          ? (['measured', 'openings', 'finishes'] as const).map((group) => {
              const lines = arch.result!.lines.filter((line) => line.group === group)
              if (!lines.length) return null
              return (
                <BoqTable
                  key={group}
                  caption={group === 'measured' ? 'Measured' : group === 'openings' ? 'Openings' : 'Finishes'}
                  columns={[
                    { key: 'code', label: 'Code', width: '88px' },
                    { key: 'description', label: 'Description' },
                    { key: 'qty', label: 'Qty', align: 'right', width: '96px' },
                    { key: 'unit', label: 'Unit', width: '64px' },
                  ]}
                  rows={lines.map((line) => ({
                    key: line.code,
                    title: cleanBasis(line.basis) || undefined,
                    cells: {
                      code: <span className="boq-doc__code">{line.code}</span>,
                      description: (
                        <div className="boq-doc__desc">
                          <strong>{line.description}</strong>
                        </div>
                      ),
                      qty: qtyText(line.qty, line.unit),
                      unit: unitLabel(line.unit),
                    },
                  }))}
                />
              )
            })
          : null}
      </SectionBlock>

      <SectionBlock
        title="4. MEP"
        meta={mep?.result?.boq.length ? `Material extra ${mep.inputs.settings.allowancePct}% on base · fixtures unchanged` : undefined}
        status={
          !ready
            ? undefined
            : !mep?.result?.boq.length
              ? { tone: 'muted', label: 'Not run' }
              : mep.overrides.approvedBy
                ? { tone: 'ok', label: 'Approved' }
                : { tone: 'warn', label: 'Provisional' }
        }
        empty={!ready ? 'Loading MEP quantities…' : !mep?.result?.boq.length ? 'Run MEP to populate this section.' : undefined}
      >
        {mep?.result?.boq.length
          ? [...new Set(mep.result.boq.map((line) => line.module))].map((module) => {
              const moduleRows = mep.result!.boq.filter((line) => line.module === module)
              return (
                <BoqTable
                  key={module}
                  caption={module}
                  columns={[
                    { key: 'code', label: 'Code', width: '88px' },
                    { key: 'description', label: 'Description' },
                    { key: 'base', label: 'Base', align: 'right', width: '84px' },
                    { key: 'extra', label: 'Extra', align: 'right', width: '84px' },
                    { key: 'final', label: 'Final', align: 'right', width: '84px' },
                    { key: 'unit', label: 'Unit', width: '64px' },
                  ]}
                  rows={moduleRows.map((line) => ({
                    key: line.code,
                    title: cleanBasis(line.basis) || undefined,
                    cells: {
                      code: <span className="boq-doc__code">{line.code}</span>,
                      description: (
                        <div className="boq-doc__desc">
                          <strong>{line.description}</strong>
                        </div>
                      ),
                      base: qtyText(line.base, line.unit),
                      extra: qtyText(line.extra, line.unit),
                      final: qtyText(line.final, line.unit),
                      unit: unitLabel(line.unit),
                    },
                  }))}
                />
              )
            })
          : null}
      </SectionBlock>
    </div>
  )
}
