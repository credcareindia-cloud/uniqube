import { useState } from 'react'
import clsx from 'clsx'
import { ScanLine, Sparkles, ChevronDown, Bot, RotateCcw, Maximize2 } from 'lucide-react'
import { DropZone } from './DropZone'
import { JobViewerDialog } from './JobViewerDialog'
import { useAppStore } from '../store'
import type { PageQuality, SubagentJob } from '../types'

function QualityBadge({ q }: { q: PageQuality }) {
  return <span className={clsx('q-badge', `q-badge--${q}`)}>{q}</span>
}

function statusDot(status: SubagentJob['status'] | 'synth-running' | 'synth-done') {
  if (status === 'running' || status === 'synth-running') return 'dot dot--run'
  if (status === 'done' || status === 'synth-done') return 'dot dot--ok'
  if (status === 'error') return 'dot dot--err'
  return 'dot'
}

function JobRow({
  title,
  label,
  status,
  expanded,
  answer,
  thinking,
  thinkingExpanded,
  live,
  canRetry,
  retryLabel = 'Retry',
  retryDisabled,
  openInDialog,
  onToggle,
  onToggleThinking,
  onRetry,
}: {
  title: string
  label: string
  status: SubagentJob['status'] | 'synth-running' | 'synth-done'
  expanded: boolean
  answer: string
  thinking: string
  thinkingExpanded: boolean
  live?: boolean
  canRetry?: boolean
  retryLabel?: string
  retryDisabled?: boolean
  /** Page readers open a full viewer instead of inline expand */
  openInDialog?: boolean
  onToggle: () => void
  onToggleThinking: () => void
  onRetry?: () => void
}) {
  return (
    <li
      className={clsx(
        'job',
        !openInDialog && expanded && 'job--open',
        status === 'error' && 'job--error',
      )}
    >
      <div className="job__head-row">
        <button type="button" className="job__head" onClick={onToggle}>
          <span className={statusDot(status)} aria-hidden />
          <span className="job__title">{title}</span>
          <span className="job__label">{label}</span>
          {openInDialog ? (
            <Maximize2 size={14} className="job__open-icon" aria-hidden />
          ) : (
            <ChevronDown size={16} className={clsx('job__chev', expanded && 'is-open')} />
          )}
        </button>
        {canRetry && onRetry ? (
          <button
            type="button"
            className="btn btn--ghost job__retry"
            disabled={retryDisabled}
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
          >
            <RotateCcw size={14} />
            {retryLabel}
          </button>
        ) : null}
      </div>
      {!openInDialog && expanded && (
        <div className="job__body">
          {thinking ? (
            <div className="job__think">
              <button type="button" className="job__think-toggle" onClick={onToggleThinking}>
                {thinkingExpanded ? 'Hide thinking' : 'Show thinking'}
              </button>
              {thinkingExpanded && (
                <pre className="job__pre job__pre--muted">
                  {thinking}
                  {live && !answer ? <span className="ai-live__caret">▍</span> : null}
                </pre>
              )}
            </div>
          ) : null}
          {answer ? (
            <pre className="job__pre">
              {answer}
              {live && answer ? <span className="ai-live__caret">▍</span> : null}
            </pre>
          ) : (
            <p className="job__hint">{live ? 'Working…' : 'No output yet'}</p>
          )}
        </div>
      )}
    </li>
  )
}

export function AnalysisPanel() {
  const analysis = useAppStore((s) => s.analysis)
  const file = useAppStore((s) => s.file)
  const status = useAppStore((s) => s.status)
  const statusMessage = useAppStore((s) => s.statusMessage)
  const analyzeProgress = useAppStore((s) => s.analyzeProgress)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const openPreviewTab = useAppStore((s) => s.openPreviewTab)
  const activePreview = tabs.find((t) => t.id === activeTabId && t.kind === 'preview')
  const selectedPage = activePreview?.kind === 'preview' ? activePreview.pageNumber : null
  const openPreviewPages = new Set(
    tabs.filter((t) => t.kind === 'preview').map((t) => t.pageNumber),
  )
  const runTakeoffAgent = useAppStore((s) => s.runTakeoffAgent)
  const retryPageJob = useAppStore((s) => s.retryPageJob)
  const resumeSynthesis = useAppStore((s) => s.resumeSynthesis)
  const toggleSynthesisExpand = useAppStore((s) => s.toggleSynthesisExpand)
  const toggleSynthesisThinking = useAppStore((s) => s.toggleSynthesisThinking)
  const sendAgentChat = useAppStore((s) => s.sendAgentChat)
  const agentBusy = useAppStore((s) => s.agentBusy)
  const takeoffAgent = useAppStore((s) => s.takeoffAgent)
  const lines = useAppStore((s) => s.lines)
  const projectSetup = useAppStore((s) => s.projectSetup)
  const openSetupWizard = useAppStore((s) => s.openSetupWizard)
  const [chatDraft, setChatDraft] = useState('')
  const [pagesOpen, setPagesOpen] = useState(false)
  const [viewerJobId, setViewerJobId] = useState<string | null>(null)

  const selected = analysis?.pages.find((p) => p.pageNumber === selectedPage)
  const showAgent = takeoffAgent.jobs.length > 0 || takeoffAgent.phase !== 'idle'

  const phaseLabel =
    takeoffAgent.phase === 'reading'
      ? 'Uploading PDF…'
      : takeoffAgent.phase === 'synthesizing'
        ? 'Sol estimating…'
        : takeoffAgent.phase === 'ready'
          ? 'Done'
          : takeoffAgent.phase === 'error'
            ? 'Error'
            : ''

  const showSynthRow =
    takeoffAgent.phase === 'synthesizing' ||
    takeoffAgent.phase === 'ready' ||
    takeoffAgent.phase === 'error' ||
    !!takeoffAgent.synthesisAnswer

  const runFinished =
    takeoffAgent.phase === 'ready' || takeoffAgent.phase === 'error'
  const failedJobs = takeoffAgent.jobs.filter((j) => j.status === 'error')
  const hasSuccessfulReads = takeoffAgent.jobs.some((j) => j.rawNotes)
  const chatMessages = takeoffAgent.messages.filter((m) => m.kind === 'chat')

  return (
    <aside className="panel">
      {!file && <DropZone />}

      {status === 'analyzing' && (
        <section className="upload-progress" aria-live="polite">
          <div className="upload-progress__head">
            <strong>Reading PDF</strong>
            <span>{Math.round(analyzeProgress * 100)}%</span>
          </div>
          <div className="upload-progress__bar">
            <div
              className="upload-progress__fill"
              style={{ width: `${Math.max(4, analyzeProgress * 100)}%` }}
            />
          </div>
          <p className="upload-progress__label">{statusMessage}</p>
        </section>
      )}

      {analysis && (
        <>
          {(projectSetup.completed || projectSetup.projectName || file) && (
            <section className="summary-card setup-summary">
              <div className="summary-card__title">
                <strong title={projectSetup.projectName || 'Project setup'}>
                  {projectSetup.projectName || 'Project setup'}
                </strong>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => openSetupWizard()}
                >
                  {projectSetup.completed ? 'Edit setup' : 'Open setup'}
                </button>
              </div>
              {projectSetup.completed || projectSetup.disciplines.length > 0 ? (
                <p className="setup-summary__meta">
                  {projectSetup.floors} floor{projectSetup.floors === 1 ? '' : 's'}
                  {projectSetup.disciplines.length
                    ? ` · ${projectSetup.disciplines.join(', ')}`
                    : ''}
                  {!projectSetup.completed ? ' · incomplete' : ''}
                </p>
              ) : (
                <p className="setup-summary__meta">Setup not finished yet</p>
              )}
            </section>
          )}
          <section className="summary-card">
            <div className="summary-card__title">
              <strong title={analysis.fileName}>{analysis.fileName}</strong>
              <QualityBadge q={analysis.overall} />
            </div>
            <div className="summary-grid">
              <div>
                <span>Pages</span>
                <b>{analysis.pageCount}</b>
              </div>
              <div>
                <span>Normal</span>
                <b>{analysis.normalCount}</b>
              </div>
              <div>
                <span>Scanned</span>
                <b>{analysis.scannedCount}</b>
              </div>
              <div>
                <span>Poor</span>
                <b className={analysis.poorCount ? 'warn' : ''}>{analysis.poorCount}</b>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="btn btn--accent"
            disabled={agentBusy}
            onClick={() => void runTakeoffAgent()}
          >
            <Sparkles size={16} />
            Run Sol takeoff
          </button>

          {showAgent && (
            <section className="agent-panel">
              <div className="agent-panel__head">
                <Bot size={15} />
                <strong>Takeoff</strong>
                {phaseLabel ? <span className="agent-panel__phase">{phaseLabel}</span> : null}
              </div>

              {(takeoffAgent.phase === 'reading' || takeoffAgent.phase === 'synthesizing') &&
                takeoffAgent.totalCount > 0 && (
                  <div className="ai-live__bar">
                    <div
                      className="ai-live__bar-fill"
                      style={{
                        width: `${Math.max(
                          8,
                          takeoffAgent.phase === 'synthesizing'
                            ? 92
                            : (takeoffAgent.doneCount / takeoffAgent.totalCount) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                )}

              {runFinished && failedJobs.length > 0 && (
                <p className="job__hint job__hint--banner">
                  {failedJobs.length} page(s) failed. Retry those rows — you won’t restart from
                  page 1.
                </p>
              )}

              <ul className="job-list">
                {takeoffAgent.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    title={job.title || `Document · P${job.pageNumber}`}
                    label={
                      job.status === 'queued'
                        ? 'Waiting'
                        : job.status === 'running'
                          ? 'Sol…'
                          : job.status === 'done'
                            ? 'Done'
                            : 'Failed'
                    }
                    status={job.status}
                    expanded={false}
                    openInDialog
                    answer={job.answerText || job.rawNotes || job.error || ''}
                    thinking={job.thinkingText}
                    thinkingExpanded={false}
                    live={job.status === 'running'}
                    canRetry={runFinished && job.status === 'error'}
                    retryDisabled={agentBusy}
                    onToggle={() => setViewerJobId(job.id)}
                    onToggleThinking={() => {}}
                    onRetry={() => void retryPageJob(job.pageNumber)}
                  />
                ))}

                {showSynthRow && (
                  <JobRow
                    title="Offer / canvas"
                    label={
                      takeoffAgent.phase === 'synthesizing'
                        ? 'Building…'
                        : takeoffAgent.phase === 'error'
                          ? 'Failed'
                          : takeoffAgent.synthesisAnswer
                            ? 'Done'
                            : 'Pending'
                    }
                    status={
                      takeoffAgent.phase === 'synthesizing'
                        ? 'synth-running'
                        : takeoffAgent.phase === 'error'
                          ? 'error'
                          : 'synth-done'
                    }
                    expanded={takeoffAgent.synthesisExpanded}
                    answer={
                      takeoffAgent.phase === 'ready'
                        ? `${lines.length} line(s) written to canvas.\n\n${takeoffAgent.synthesisAnswer || takeoffAgent.synthesisStream}`
                        : takeoffAgent.synthesisAnswer || takeoffAgent.synthesisStream
                    }
                    thinking={takeoffAgent.synthesisThinking}
                    thinkingExpanded={takeoffAgent.synthesisThinkingExpanded}
                    live={takeoffAgent.phase === 'synthesizing'}
                    canRetry={runFinished && hasSuccessfulReads}
                    retryLabel="Rebuild"
                    retryDisabled={agentBusy}
                    onToggle={() => toggleSynthesisExpand()}
                    onToggleThinking={() => toggleSynthesisThinking()}
                    onRetry={() => void resumeSynthesis()}
                  />
                )}
              </ul>

              {takeoffAgent.chatEnabled && (
                <div className="agent-chat-simple">
                  {chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={clsx('bubble', m.role === 'user' ? 'bubble--you' : 'bubble--agent')}
                    >
                      <span>{m.role === 'user' ? 'You' : 'Agent'}</span>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  <form
                    className="agent-chat__compose"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const q = chatDraft
                      setChatDraft('')
                      void sendAgentChat(q)
                    }}
                  >
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="Ask to change or clarify…"
                      disabled={agentBusy}
                    />
                    <button
                      type="submit"
                      className="btn btn--ghost"
                      disabled={!chatDraft.trim() || agentBusy}
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </section>
          )}

          <section className={clsx('page-list', pagesOpen && 'page-list--open')}>
            <button
              type="button"
              className="page-list__toggle"
              onClick={() => setPagesOpen((o) => !o)}
              aria-expanded={pagesOpen}
            >
              <span className="page-list__toggle-label">
                <ScanLine size={14} /> Pages
                <em>{analysis.pageCount}</em>
              </span>
              <ChevronDown
                size={16}
                className={clsx('job__chev', pagesOpen && 'is-open')}
              />
            </button>
            {pagesOpen && (
              <ul>
                {analysis.pages.map((p) => (
                  <li key={p.pageNumber}>
                    <button
                      type="button"
                      className={clsx(
                        'page-item',
                        selectedPage === p.pageNumber && 'is-active',
                        openPreviewPages.has(p.pageNumber) && 'is-open',
                      )}
                      onClick={() => openPreviewTab(p.pageNumber)}
                    >
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt={`Page ${p.pageNumber}`} />
                      ) : (
                        <div className="page-item__ph" />
                      )}
                      <div className="page-item__meta">
                        <span>Page {p.pageNumber}</span>
                        <QualityBadge q={p.quality} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pagesOpen && selected && (
            <section className="page-detail">
              <h3>Page {selected.pageNumber}</h3>
              <dl className="metrics">
                <div>
                  <dt>Text</dt>
                  <dd>{selected.textChars}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{Math.round(selected.imageCoverage * 100)}%</dd>
                </div>
                <div>
                  <dt>Sharpness</dt>
                  <dd>{selected.sharpness}</dd>
                </div>
                <div>
                  <dt>Contrast</dt>
                  <dd>{selected.contrast}</dd>
                </div>
              </dl>
            </section>
          )}
        </>
      )}

      {viewerJobId && (
        <JobViewerDialog jobId={viewerJobId} onClose={() => setViewerJobId(null)} />
      )}
    </aside>
  )
}
