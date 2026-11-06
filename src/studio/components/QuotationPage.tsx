import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useAppStore } from '../store'
import { buildEstimate } from '../lib/estimate'
import { loadEngineState, type EngineState } from '../lib/foundation/run'
import { buildShareQuotation, downloadText, quotationInnerHtml, quotationWordHtml, quotationWorkbookXml } from '../lib/quotation'

export function QuotationPage({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const lines = useAppStore((s) => s.lines)
  const measurements = useAppStore((s) => s.measurements)
  const pageScales = useAppStore((s) => s.pageScales)
  const projectContext = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const [engine, setEngine] = useState<EngineState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    setReady(false)
    loadEngineState(projectId).then((loaded) => {
      if (!alive) return
      setEngine(loaded)
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

  const approved = Boolean(engine?.overrides.approvedBy && engine.result && !engine.result.blocked)
  const quote = useMemo(() => {
    if (!approved || !engine?.result) return null
    return buildShareQuotation({
      projectName,
      client: projectContext.client,
      location: projectContext.location,
      buildingType: projectContext.buildingType,
      currency: projectContext.commercials.currency || 'AED',
      approvedAt: engine.overrides.approvedAt,
      approver: engine.overrides.approvedBy,
      priced: estimate.boq,
      foundation: engine.result,
    })
  }, [approved, engine, estimate.boq, projectContext, projectName])

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
        <p className="uq-wait">The share document opens after the foundation review is approved and the bill has quantities.</p>
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
      <article className="uq-letter" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
