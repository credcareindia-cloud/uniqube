import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useAppStore } from '../store'
import { buildEstimate } from '../lib/estimate'
import { loadEngineState, type EngineState } from '../lib/foundation/run'
import { refreshMeasured } from '../lib/measured'
import { evaluateOfferGate, loadStageApprovals } from '../lib/offerGate'
import { loadSuperState } from '../lib/superstructure/run'
import { buildShareQuotation, scheduleOfRates, downloadText, quotationInnerHtml, quotationWordHtml, quotationWorkbookXml } from '../lib/quotation'

export function QuotationPage({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const lines = useAppStore((s) => s.lines)
  const measurements = useAppStore((s) => s.measurements)
  const pageScales = useAppStore((s) => s.pageScales)
  const projectContext = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const [engine, setEngine] = useState<EngineState | null>(null)
  const [stages, setStages] = useState<Awaited<ReturnType<typeof loadStageApprovals>> | null>(null)
  const [approvedAt, setApprovedAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    setReady(false)
    Promise.all([
      loadEngineState(projectId).catch(() => null),
      loadStageApprovals(projectId),
      refreshMeasured(projectId).catch(() => null),
      loadEngineState(projectId)
        .then((foundation) => loadSuperState(projectId, foundation.inputs.storeyCount))
        .then((state) => state.overrides.approvedAt)
        .catch(() => null),
    ]).then(([loaded, approvals, , superApprovedAt]) => {
      if (!alive) return
      setEngine(loaded)
      setStages(approvals)
      setApprovedAt(superApprovedAt ?? null)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [projectId])
  const estimate = useMemo(
    () => buildEstimate({ lines, measurements, pageScales, projectContext, priceSheet }),
    [lines, measurements, pageScales, projectContext, priceSheet],
  )
  const gate = useMemo(
    () => (stages ? evaluateOfferGate({ estimate, lines, priceSheet, context: projectContext, ...stages }) : null),
    [estimate, lines, priceSheet, projectContext, stages],
  )
  const quote = useMemo(() => {
    if (!gate?.ready) return null
    return buildShareQuotation({
      projectName,
      client: projectContext.client,
      location: projectContext.location,
      buildingType: projectContext.buildingType,
      currency: projectContext.commercials.currency || 'AED',
      approvedAt,
      approver: stages?.structure.approvedBy ?? null,
      priced: estimate.boq,
      foundation: engine?.result ?? null,
      context: projectContext,
      schedule: scheduleOfRates(estimate, lines),
    })
  }, [gate, engine, estimate, lines, projectContext, projectName, stages, approvedAt])
  if (!ready) return <p className="uq-wait">Opening the quotation…</p>
  if (!quote) {
    return (
      <div className="uq-page">
        <div className="uq-page__bar">
          <span>Offer</span>
          <button type="button" className="os-btn" onClick={onBack}>
            Back to engine
          </button>
        </div>
        <div className="uq-gate">
          <p className="uq-wait">The offer opens when every check below is cleared.</p>
          <ul className="uq-gate__list uq-gate__list--stop">
            {(gate?.blockers ?? ['Could not read the engine approvals.']).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          {gate && gate.warnings.length > 0 && (
            <ul className="uq-gate__list uq-gate__list--warn">
              {gate.warnings.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }
  const html = quotationInnerHtml(quote)
  return (
    <div className="uq-page">
      <div className="uq-page__bar">
        <span>Offer · ready to share</span>
        <button type="button" className="os-btn" onClick={onBack}>
          Back to engine
        </button>
        <button type="button" className="os-btn" onClick={() => window.print()}>
          <Printer size={14} /> PDF
        </button>
        <button
          type="button"
          className="os-btn"
          onClick={() => downloadText(`UNIQUBE_QUOTATION-${quote.fileSlug}.xls`, quotationWorkbookXml(quote), 'application/vnd.ms-excel')}
        >
          <Download size={14} /> Excel
        </button>
        <button
          type="button"
          className="os-btn os-btn--primary"
          onClick={() => void quotationWordHtml(quote).then((html) => downloadText(`UNIQUBE_QUOTATION-${quote.fileSlug}.doc`, html, 'application/msword'))}
        >
          <Download size={14} /> Word
        </button>
      </div>
      {gate && gate.warnings.length > 0 && (
        <ul className="uq-gate__list uq-gate__list--warn uq-gate__list--print-hide">
          {gate.warnings.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      <article className="uq-letter" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
