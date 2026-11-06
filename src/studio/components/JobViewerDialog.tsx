import { useEffect, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../store'
import type { SubagentJob } from '../types'

type Props = {
  jobId: string
  onClose: () => void
}

export function JobViewerDialog({ jobId, onClose }: Props) {
  const job = useAppStore((s) => s.takeoffAgent.jobs.find((j) => j.id === jobId))
  const page = useAppStore((s) =>
    s.analysis?.pages.find((p) => p.pageNumber === job?.pageNumber),
  )
  const retryPageJob = useAppStore((s) => s.retryPageJob)
  const agentBusy = useAppStore((s) => s.agentBusy)

  const [thinkingOpen, setThinkingOpen] = useState(false)

  // Auto-collapse thinking once the main answer arrives / job finishes
  useEffect(() => {
    if (!job) return
    const hasAnswer = !!(job.answerText || job.rawNotes)
    if (job.status === 'running' && !hasAnswer && job.thinkingText) {
      setThinkingOpen(true)
    } else if (hasAnswer || job.status === 'done' || job.status === 'error') {
      setThinkingOpen(false)
    }
  }, [job?.status, job?.answerText, job?.rawNotes, job?.thinkingText, job])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!job) return null

  const answer = job.answerText || job.rawNotes || job.error || ''
  const live = job.status === 'running'
  const imgSrc = page?.imageDataUrl || page?.thumbnail

  return (
    <div className="job-viewer-overlay" role="dialog" aria-modal="true" aria-labelledby="job-viewer-title">
      <div className="job-viewer">
        <header className="job-viewer__head">
          <div>
            <p className="job-viewer__eyebrow">Page reader</p>
            <h2 id="job-viewer-title">Page {job.pageNumber}</h2>
            <p className="job-viewer__meta">
              {job.quality} · {job.label}
              {live ? ' · live' : ''}
            </p>
          </div>
          <div className="job-viewer__head-actions">
            {job.status === 'error' && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={agentBusy}
                onClick={() => void retryPageJob(job.pageNumber)}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className="setup-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="job-viewer__body">
          <aside className="job-viewer__image-pane">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={`Drawing page ${job.pageNumber}`}
                className="job-viewer__image"
              />
            ) : (
              <div className="job-viewer__empty">No page image</div>
            )}
          </aside>

          <section className="job-viewer__output">
            {job.thinkingText ? (
              <div className="job-viewer__think">
                <button
                  type="button"
                  className="job-viewer__think-toggle"
                  onClick={() => setThinkingOpen((v) => !v)}
                  aria-expanded={thinkingOpen}
                >
                  <span>{thinkingOpen ? 'Hide thinking' : 'Show thinking'}</span>
                  <ChevronDown
                    size={16}
                    className={clsx('job__chev', thinkingOpen && 'is-open')}
                  />
                </button>
                {thinkingOpen && (
                  <pre className="job-viewer__pre job-viewer__pre--muted">
                    {job.thinkingText}
                    {live && !answer ? <span className="ai-live__caret">▍</span> : null}
                  </pre>
                )}
              </div>
            ) : null}

            <div className="job-viewer__answer-block">
              <h3>Response</h3>
              {answer ? (
                <pre className="job-viewer__pre">
                  {answer}
                  {live && answer ? <span className="ai-live__caret">▍</span> : null}
                </pre>
              ) : (
                <p className="job-viewer__hint">
                  {live ? 'Reading page…' : 'No output yet'}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Narrow helper so callers can type against SubagentJob without importing dialog guts */
export type JobViewerTarget = Pick<SubagentJob, 'id' | 'pageNumber'>
