import { useEffect, useState } from 'react'
import { roundedBoq } from '../lib/foundation/engine'
import { foundationTypeName } from '../lib/foundation/rules'
import { loadEngineState, type EngineState } from '../lib/foundation/run'
import type { QuantityLine } from '../lib/foundation/types'
import { loadSuperState, type SuperState } from '../lib/superstructure/run'
import { loadMepState } from '../lib/mep/run'
import type { MepState } from '../lib/mep/types'
import { loadArchState } from '../lib/architecture/run'
import type { ArchState } from '../lib/architecture/types'

function unitLabel(unit: QuantityLine['unit']) {
  if (unit === 'm3') return 'm³'
  if (unit === 'm2') return 'm²'
  return unit
}

function qty(value: number, unit: QuantityLine['unit']) {
  if (unit === 'kg') return Math.round(value).toLocaleString('en-US')
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BoqPage({ projectId }: { projectId: string }) {
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
  const rows = result ? roundedBoq(result) : []
  const sections = [...new Set(rows.map((row) => row.section))]
  const superResult = superState?.result ?? null
  const superGroups = superResult ? [...new Set(superResult.boq.map((row) => row.group))] : []

  return (
    <div className="doc-page">
      <header>
        <h1>BOQ</h1>
        <p>Quantities only. A missing input stays blank, and nothing is written as zero.</p>
      </header>
      <section>
        <h2>Sub structure</h2>
        {!ready && <p className="doc-page__note">Loading the foundation quantities…</p>}
        {ready && !result && <p className="doc-page__note">Run the foundation engine on Agents. The quantities appear here after that run.</p>}
        {ready && result && !rows.length && <p className="doc-page__note">No foundation quantities. A stop flag or a missing input is blocking the bill.</p>}
        {result && rows.length > 0 && (
          <>
            <p className="doc-page__note">
              Type {result.foundationType} — {foundationTypeName(result.foundationType)} · band {result.band} · {result.level.drawingNo ?? 'plan'} p{result.level.sourcePage}
              {result.gateOpen ? ` · approved by ${engine?.overrides.approvedBy ?? '—'}` : ' · provisional until the review gate is approved'}
            </p>
            {sections.map((section) => (
              <table key={section} className="summary__table">
                <thead>
                  <tr>
                    <th colSpan={5}>{section}</th>
                  </tr>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th className="num">Net</th>
                    <th className="num">Gross</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((row) => row.section === section)
                    .map((row) => (
                      <tr key={row.id} title={row.basis}>
                        <td>{row.boqCode}</td>
                        <td>
                          {row.description}
                          <div className="muted">{row.basis}</div>
                        </td>
                        <td className="num">{qty(row.netQty, row.unit)}</td>
                        <td className="num">
                          {qty(row.grossQty, row.unit)}
                          {row.wastePct ? <div className="muted">+{row.wastePct}%</div> : null}
                        </td>
                        <td>{unitLabel(row.unit)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ))}
          </>
        )}
      </section>
      <section>
        <h2>Super structure</h2>
        {!ready && <p className="doc-page__note">Loading the superstructure quantities…</p>}
        {ready && !superResult && <p className="doc-page__note">Run the Structure agent on Agents. The LGS quantities appear here after that run.</p>}
        {superResult && (
          <>
            <p className="doc-page__note">
              LGS at s = {superResult.settings.studSpacingMm} mm · {superResult.levels.length} level{superResult.levels.length === 1 ? '' : 's'} · net {Math.round(superResult.totals.netLgsKg).toLocaleString('en-US')} kg · gross {Math.round(superResult.totals.grossLgsKg).toLocaleString('en-US')} kg
              {superResult.blocked ? ' · blocked by red flags or missing inputs' : superState?.overrides.approvedBy ? ` · approved by ${superState.overrides.approvedBy}` : ' · provisional until the review gate is approved'}
            </p>
            {superGroups.map((group) => (
              <table key={group} className="summary__table">
                <thead>
                  <tr>
                    <th colSpan={4}>{group}</th>
                  </tr>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {superResult.boq
                    .filter((row) => row.group === group)
                    .map((row) => (
                      <tr key={row.id} title={row.ruleIds.join(' ')}>
                        <td>{row.code}</td>
                        <td>
                          {row.description}
                          <div className="muted">
                            {row.lgsSection ? `${row.lgsSection} · ` : ''}
                            {row.basis}
                          </div>
                        </td>
                        <td className="num">{row.qty == null ? '' : row.unit === 'kg' || row.unit === 'nr' ? Math.round(row.qty).toLocaleString('en-US') : row.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        <td>{row.unit}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ))}
          </>
        )}
      </section>
      <section>
        <h2>Architecture</h2>
        {!ready && <p className="doc-page__note">Loading the architectural quantities…</p>}
        {ready && !arch?.result?.lines.length && <p className="doc-page__note">Run Architecture after the sub structure plan. Wall, opening and finish lines appear here.</p>}
        {arch?.result?.lines.length ? (
          <>
            <p className="doc-page__note">
              {arch.result.summary.storeys} measured floor{arch.result.summary.storeys === 1 ? '' : 's'}
              {arch.result.summary.occupiedM2 != null ? ` · ${arch.result.summary.occupiedM2} m² occupied` : ''}
              {arch.overrides.approvedBy ? ` · approved by ${arch.overrides.approvedBy}` : ' · provisional until architecture is approved'}
            </p>
            {(['measured', 'openings', 'finishes'] as const).map((group) => {
              const lines = arch.result!.lines.filter((line) => line.group === group)
              if (!lines.length) return null
              return (
                <table key={group} className="summary__table">
                  <thead>
                    <tr>
                      <th colSpan={4}>{group === 'measured' ? 'Measured' : group === 'openings' ? 'Openings' : 'Finishes'}</th>
                    </tr>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.code}>
                        <td>{line.code}</td>
                        <td>
                          {line.description}
                          <div className="muted">{line.basis}</div>
                        </td>
                        <td className="num">{line.qty}</td>
                        <td>{line.unit === 'm2' ? 'm²' : line.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })}
          </>
        ) : null}
      </section>
      <section>
        <h2>MEP</h2>
        {!ready && <p className="doc-page__note">Loading the MEP quantities…</p>}
        {ready && !mep?.result?.boq.length && <p className="doc-page__note">Run MEP. Electrical, mechanical, plumbing and fire appear here after the rooms are counted.</p>}
        {mep?.result?.boq.length ? (
          <>
            <p className="doc-page__note">
              Material extra is {mep.inputs.settings.allowancePct}% of the base, applied once. Fixture counts are unchanged.
              {mep.overrides.approvedBy ? ` Approved by ${mep.overrides.approvedBy}.` : ' Provisional until MEP is approved.'}
              {' '}Rates stay in Costing.
            </p>
            {[...new Set(mep.result.boq.map((line) => line.module))].map((module) => (
              <table key={module} className="summary__table">
                <thead>
                  <tr>
                    <th colSpan={7}>{module}</th>
                  </tr>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Basis</th>
                    <th className="num">Base</th>
                    <th className="num">Extra</th>
                    <th className="num">Final</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {mep.result!.boq
                    .filter((line) => line.module === module)
                    .map((line) => (
                      <tr key={line.code}>
                        <td>{line.code}</td>
                        <td>{line.description}</td>
                        <td>{line.basis}</td>
                        <td className="num">{line.base}</td>
                        <td className="num">{line.extra}</td>
                        <td className="num">{line.final}</td>
                        <td>{line.unit}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ))}
          </>
        ) : null}
      </section>
    </div>
  )
}
