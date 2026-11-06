import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Check, Download, X, Sheet, ArrowLeft, Settings, Ruler, ClipboardList, Calculator } from 'lucide-react'
import { EstimateSummary } from './EstimateSummary'
import clsx from 'clsx'
import { useAppStore } from '../store'
import type { PreviewTab, TakeoffLine } from '../types'
import { AgentSettings } from './AgentSettings'
import { PricingSheet } from './PricingSheet'
import { MeasureWorkspace } from './MeasureWorkspace'
import { ProjectContextDialog } from './ProjectContextDialog'
import { ELEMENTS, elementLabel, floorName } from '../lib/elements'

function lineTotal(l: TakeoffLine) {
  return l.quantity * l.unitPrice
}

function csvCell(value: string | number | undefined | null) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function FieldInput({ tip, ...props }: InputHTMLAttributes<HTMLInputElement> & { tip?: string }) {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const text = tip?.trim()
  return (
    <>
      <input
        {...props}
        onMouseEnter={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          setAnchor({ left: box.left, top: box.bottom + 6 })
        }}
        onMouseLeave={() => setAnchor(null)}
      />
      {anchor && text
        ? createPortal(
            <div className="field-tip" style={{ left: anchor.left, top: anchor.top }}>
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function EstimationStage({ settingsNonce = 0 }: { settingsNonce?: number }) {
  const lines = useAppStore((s) => s.lines)
  const analysis = useAppStore((s) => s.analysis)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const addLine = useAppStore((s) => s.addLine)
  const updateLine = useAppStore((s) => s.updateLine)
  const removeLine = useAppStore((s) => s.removeLine)
  const chatLineIds = useAppStore((s) => s.chatLineIds)
  const toggleChatLine = useAppStore((s) => s.toggleChatLine)
  const reset = useAppStore((s) => s.reset)
  const file = useAppStore((s) => s.file)
  const status = useAppStore((s) => s.status)
  const stageView = useAppStore((s) => s.stageView)
  const setStageView = useAppStore((s) => s.setStageView)
  const documents = useAppStore((s) => s.documents)
  const measureTarget = useAppStore((s) => s.measureTarget)
  const setMeasureTarget = useAppStore((s) => s.setMeasureTarget)
  const contextOpen = useAppStore((s) => s.contextOpen)
  const setContextOpen = useAppStore((s) => s.setContextOpen)
  const projectId = useAppStore((s) => s.projectId)
  const seenSettings = useRef(settingsNonce)
  const [settingsOpen, setSettingsOpen] = useState(settingsNonce > 0)
  useEffect(() => {
    if (settingsNonce > seenSettings.current) {
      seenSettings.current = settingsNonce
      setSettingsOpen(true)
    }
  }, [settingsNonce])
  const onPricing = stageView === 'pricing' && !settingsOpen
  const onMeasure = stageView === 'measure' && !settingsOpen
  const onSummary = stageView === 'summary' && !settingsOpen
  const awayFromTakeoff = onPricing || onMeasure || onSummary || settingsOpen
  const readyDoc = documents.find((d) => d.status === 'ready' && d.analysis && d.analysis === analysis) ?? documents.find((d) => d.status === 'ready' && d.analysis)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const previewPage =
    activeTab?.kind === 'preview'
      ? analysis?.pages.find((p) => p.pageNumber === (activeTab as PreviewTab).pageNumber)
      : null

  function openMeasure() {
    setSettingsOpen(false)
    const target = measureTarget && documents.some((d) => d.id === measureTarget.fileId && d.status === 'ready')
      ? measureTarget
      : readyDoc
        ? { fileId: readyDoc.id, pageNumber: 1 }
        : null
    if (target) setMeasureTarget(target)
    else setStageView('measure')
  }

  function exportCsv() {
    const header = [
      'Tag',
      'Element',
      'Floor',
      'System',
      'Type',
      'Width_mm',
      'Height_mm',
      'Length_m',
      'Area_m2',
      'Qty',
      'Unit',
      'UnitPrice',
      'Total',
      'Source',
      'Page',
      'Confirmed',
      'Notes',
    ]
    const rows = lines.map((l) =>
      [
        l.tag,
        elementLabel(l.element),
        l.floor == null ? '' : floorName(l.floor),
        l.system,
        l.type,
        l.widthMm,
        l.heightMm,
        l.lengthMm != null ? Math.round(l.lengthMm) / 1000 : '',
        l.areaM2 ?? '',
        l.quantity,
        l.unit,
        l.unitPrice,
        lineTotal(l),
        l.source,
        l.pageRef ?? '',
        l.confirmed ? 'Y' : 'N',
        l.notes,
      ]
        .map(csvCell)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${analysis?.fileName?.replace(/\.pdf$/i, '') || 'takeoff'}-BOQ.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="stage">
      <header className="editor-chrome">
        <nav className="tab-bar" role="tablist" aria-label="Stage tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={clsx('tab', !awayFromTakeoff && activeTabId === tab.id && 'is-active')}
              role="presentation"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!awayFromTakeoff && activeTabId === tab.id}
                className="tab__label"
                onClick={() => {
                  setSettingsOpen(false)
                  setStageView('takeoff')
                  setActiveTab(tab.id)
                }}
              >
                {tab.kind === 'canvas' ? 'Canvas' : `P${(tab as PreviewTab).pageNumber}`}
              </button>
              {tab.kind === 'preview' && (
                <button
                  type="button"
                  className="tab__close"
                  title="Close tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {onPricing && <span className="tab tab--view is-active">Price sheet</span>}
          {onMeasure && <span className="tab tab--view is-active">Measure</span>}
          {onSummary && <span className="tab tab--view is-active">Summary</span>}
          {settingsOpen && <span className="tab tab--view is-active">Settings</span>}
        </nav>
        <div className="stage__actions">
          {awayFromTakeoff ? (
            <>
              {(onMeasure || onSummary) && (
                <button type="button" className="btn btn--ghost" onClick={() => setContextOpen(true)} disabled={!projectId}>
                  <ClipboardList size={16} /> Project context
                </button>
              )}
              {onMeasure && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setStageView('summary')}
                  title="Systems, BOQ, cost breakdown, benchmarks, offer"
                >
                  <Calculator size={16} /> Summary
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSettingsOpen(false)
                  setStageView('takeoff')
                }}
              >
                <ArrowLeft size={16} /> Back to canvas
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={openMeasure}
                disabled={!readyDoc}
                title="Measure lengths, areas, and counts on a sheet"
              >
                <Ruler size={16} /> Measure
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setContextOpen(true)}
                disabled={!projectId}
                title="Floors, elements, build-ups, and scope the estimator works from"
              >
                <ClipboardList size={16} /> Project context
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setSettingsOpen(false)
                  setStageView('summary')
                }}
                disabled={!projectId}
                title="Systems, client BOQ, cost breakdown, benchmarks, revisions, offer"
              >
                <Calculator size={16} /> Summary
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={addLine}
                disabled={status === 'idle'}
              >
                <Plus size={16} /> Manual line
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={exportCsv}
                disabled={!lines.length}
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setSettingsOpen(false)
                  setStageView('pricing')
                }}
              >
                <Sheet size={16} /> Price sheet
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={reset}
                disabled={!file}
              >
                Clear
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          className={clsx('chrome-settings', settingsOpen && 'is-on')}
          title="Estimator settings"
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings size={16} />
        </button>
      </header>

      {contextOpen && <ProjectContextDialog onClose={() => setContextOpen(false)} />}

      {settingsOpen ? (
        <div className="stage-slot">
          <AgentSettings />
        </div>
      ) : onPricing ? (
        <div className="stage-slot stage-slot--pricing">
          <PricingSheet />
        </div>
      ) : onMeasure ? (
        <div className="stage-slot stage-slot--measure">
          <MeasureWorkspace />
        </div>
      ) : onSummary ? (
        <div className="stage-slot stage-slot--summary">
          <EstimateSummary />
        </div>
      ) : (
        <div className="stage-slot">
        {activeTab?.kind === 'canvas' && (
          <div className="canvas-viewer">
            {!lines.length ? (
              <div className="stage-empty" />
            ) : (
              <div className="table-wrap table-wrap--fill">
                <table className="boq">
                  <thead>
                    <tr>
                      <th />
                      <th>Tag</th>
                      <th>Element</th>
                      <th>Fl</th>
                      <th>System</th>
                      <th>Type</th>
                      <th>W (mm)</th>
                      <th>H (mm)</th>
                      <th>L (m)</th>
                      <th>Area (m²)</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th title="Direct rate: material + fabrication + installation, before markups">Direct rate</th>
                      <th title="Direct total before overheads, margin, finance, contingency, design and commission">Direct total</th>
                      <th>Src</th>
                      <th>Pg</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const picked = chatLineIds.includes(l.id)
                      return (
                      <tr
                        key={l.id}
                        className={clsx(l.confirmed && 'is-confirmed', picked && 'is-picked')}
                      >
                        <td>
                          <button
                            type="button"
                            className={clsx('icon-btn', picked && 'icon-btn--on')}
                            title={picked ? 'Remove from chat' : 'Add to chat'}
                            aria-pressed={picked}
                            onClick={() => toggleChatLine(l.id)}
                          >
                            <Check size={14} />
                          </button>
                        </td>
                        <td>
                          <FieldInput
                            value={l.tag}
                            tip={l.tag}
                            onChange={(e) => updateLine(l.id, { tag: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="boq__select"
                            value={l.element ?? ''}
                            title={elementLabel(l.element) || 'Element'}
                            onChange={(e) => updateLine(l.id, { element: e.target.value || undefined })}
                          >
                            <option value="">—</option>
                            {ELEMENTS.map((element) => (
                              <option key={element.id} value={element.id}>
                                {element.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            className="boq__short"
                            value={l.floor ?? ''}
                            tip={l.floor == null ? undefined : floorName(l.floor)}
                            onChange={(e) =>
                              updateLine(l.id, { floor: e.target.value === '' ? null : Number(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            value={l.system}
                            tip={l.system}
                            onChange={(e) => updateLine(l.id, { system: e.target.value })}
                          />
                        </td>
                        <td>
                          <FieldInput
                            value={l.type}
                            tip={l.type}
                            onChange={(e) => updateLine(l.id, { type: e.target.value })}
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            value={l.widthMm || ''}
                            tip={l.widthMm ? String(l.widthMm) : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { widthMm: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            value={l.heightMm || ''}
                            tip={l.heightMm ? String(l.heightMm) : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { heightMm: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            step={0.01}
                            value={l.lengthMm != null ? Math.round(l.lengthMm) / 1000 : ''}
                            tip={l.lengthMm != null ? `${Math.round(l.lengthMm)} mm` : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { lengthMm: e.target.value === '' ? undefined : (Number(e.target.value) || 0) * 1000 })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            step={0.01}
                            value={l.areaM2 ?? ''}
                            tip={l.areaM2 != null ? `${l.areaM2} m²` : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { areaM2: e.target.value === '' ? undefined : Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            step={0.01}
                            value={l.quantity}
                            tip={l.quantity ? String(l.quantity) : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { quantity: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <FieldInput
                            className="boq__short"
                            value={l.unit}
                            tip={l.unit}
                            onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                          />
                        </td>
                        <td>
                          <FieldInput
                            type="number"
                            value={l.unitPrice || ''}
                            tip={l.unitPrice ? String(l.unitPrice) : undefined}
                            onChange={(e) =>
                              updateLine(l.id, { unitPrice: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="num">
                          {lineTotal(l).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td>
                          <span className={`src src--${l.source}`}>{l.source}</span>
                        </td>
                        <td className="num">{l.pageRef ?? '—'}</td>
                        <td>
                          <FieldInput
                            value={l.notes}
                            tip={l.notes}
                            onChange={(e) => updateLine(l.id, { notes: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => removeLine(l.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab?.kind === 'preview' && (
          <div className="drawing-viewer">
            <div className="drawing-viewer__toolbar">
              <div className="drawing-viewer__title">
                <span>Page {(activeTab as PreviewTab).pageNumber}</span>
                {previewPage && (
                  <span className={clsx('q-badge', `q-badge--${previewPage.quality}`)}>
                    {previewPage.quality}
                  </span>
                )}
              </div>
            </div>
            <div className="drawing-viewer__body">
              {previewPage?.imageDataUrl || previewPage?.thumbnail ? (
                <img
                  key={(activeTab as PreviewTab).pageNumber}
                  src={previewPage.imageDataUrl || previewPage.thumbnail}
                  alt={`Page ${(activeTab as PreviewTab).pageNumber}`}
                />
              ) : (
                <div className="stage-empty stage-empty--inset">
                  <h2>No preview</h2>
                  <p>This page has no renderable image.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </main>
  )
}
