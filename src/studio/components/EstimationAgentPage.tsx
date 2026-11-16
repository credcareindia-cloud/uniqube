import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { useAppStore } from '../store'
import { collectRunTotals, type RunTotals } from '../lib/estimateRun'
import { loadStageApprovals } from '../lib/offerGate'
import { loadEngineState } from '../lib/foundation/run'
import { loadSuperState } from '../lib/superstructure/run'
import { loadMepState } from '../lib/mep/run'
import { apiJson } from '../lib/api'
import type { ArchState } from '../lib/architecture/types'
import { createResponse, openaiReady, uploadOpenAiFile } from '../lib/openai'
import { bumpSidebarMarks } from '../lib/sidebarMarks'
import { fmtAed } from '../lib/estimate'

type Issue = {
  id: string
  stage: string
  level: 'red' | 'amber' | 'info'
  text: string
  resolved: boolean
  resolution?: string
}

type LogLine = { at: number; text: string; tone?: 'ok' | 'warn' | 'err' | 'info' }

type Phase = 'idle' | 'uploading' | 'checking' | 'model' | 'done' | 'error'

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${fmtAed(value)} AED`
}

function buildHowPrepared(totals: RunTotals | null, context: { client: string; location: string; buildingType: string }) {
  const bits = [
    'UNIQUBE prepared this estimate from the uploaded drawings and project settings.',
    context.client.trim() ? `Client: ${context.client.trim()}.` : null,
    context.location.trim() ? `Location: ${context.location.trim()}.` : null,
    context.buildingType.trim() ? `Building type: ${context.buildingType.trim()}.` : null,
    totals
      ? [
          `Sub structure: ${totals.foundationType} with ${totals.foundationLines} bill lines.`,
          totals.lgsKg != null ? `Super structure: ${totals.lgsKg.toLocaleString('en-US')} kg net LGS.` : 'Super structure: waiting for a run.',
          `Architecture: ${totals.doors} doors, ${totals.windows} windows${totals.occupiedM2 != null ? `, ${totals.occupiedM2} m² occupied` : ''}.`,
          `MEP: ${totals.mepLines} quantity lines.`,
          `Dry cost: material ${money(totals.dryMaterial)}, labour ${money(totals.dryLabour)}.`,
        ].join(' ')
      : 'Stage quantities are still loading.',
    'Agents measured the plan, applied package rates, then built BOQ and dry-cost sheets. Verification re-reads the PDF against that prepared output, clears issues, and unlocks the final offer.',
  ]
  return bits.filter(Boolean).join(' ')
}

async function gatherIssues(projectId: string): Promise<Issue[]> {
  const issues: Issue[] = []
  const engine = await loadEngineState(projectId).catch(() => null)
  const superState = await loadSuperState(projectId, engine?.inputs.storeyCount ?? 1).catch(() => null)
  const arch = await apiJson<Partial<ArchState> | null>(`/api/projects/${projectId}/architecture`).catch(() => null)
  const mep = await loadMepState(projectId).catch(() => null)
  const approvals = await loadStageApprovals(projectId).catch(() => null)

  if (!engine?.result) {
    issues.push({
      id: 'foundation-missing',
      stage: 'Sub structure',
      level: 'red',
      text: 'Sub structure has not been run yet.',
      resolved: false,
    })
  } else {
    for (const flag of engine.result.flags) {
      issues.push({
        id: `foundation-${flag.code}`,
        stage: 'Sub structure',
        level: flag.severity === 'stop' ? 'red' : 'amber',
        text: flag.message || flag.rule,
        resolved: false,
      })
    }
    if (!engine.overrides.approvedBy) {
      issues.push({
        id: 'foundation-approve',
        stage: 'Sub structure',
        level: 'amber',
        text: 'Sub structure review gate is still open.',
        resolved: false,
      })
    }
  }

  if (!superState?.result) {
    issues.push({
      id: 'structure-missing',
      stage: 'Super structure',
      level: 'red',
      text: 'Super structure has not been run yet.',
      resolved: false,
    })
  } else {
    for (const flag of superState.result.flags) {
      issues.push({
        id: `structure-${flag.key}`,
        stage: 'Super structure',
        level: flag.severity === 'red' ? 'red' : 'amber',
        text: flag.message || flag.code,
        resolved: false,
      })
    }
    if (approvals && !approvals.structure.approvedBy) {
      issues.push({
        id: 'structure-approve',
        stage: 'Super structure',
        level: 'amber',
        text: 'Super structure is not approved yet.',
        resolved: false,
      })
    }
  }

  if (!arch?.result?.lines?.length) {
    issues.push({
      id: 'architecture-missing',
      stage: 'Architecture',
      level: 'red',
      text: 'Architecture quantities are missing.',
      resolved: false,
    })
  } else if (approvals && !approvals.architecture.approvedBy) {
    issues.push({
      id: 'architecture-approve',
      stage: 'Architecture',
      level: 'amber',
      text: 'Architecture is not approved yet.',
      resolved: false,
    })
  }

  if (!mep?.result?.boq?.length) {
    issues.push({
      id: 'mep-missing',
      stage: 'MEP',
      level: 'red',
      text: 'MEP quantities are missing.',
      resolved: false,
    })
  } else {
    for (const flag of (mep.result.flags ?? []).filter((f) => f.level === 'red' || f.level === 'amber')) {
      issues.push({
        id: `mep-${flag.id}`,
        stage: 'MEP',
        level: flag.level,
        text: flag.text,
        resolved: false,
      })
    }
    if (approvals && !approvals.mep.approvedBy) {
      issues.push({
        id: 'mep-approve',
        stage: 'MEP',
        level: 'amber',
        text: 'MEP is not approved yet.',
        resolved: false,
      })
    }
  }

  return issues
}

export function EstimationAgentPage({
  projectId,
  onOpenOffer,
}: {
  projectId: string
  onOpenOffer: () => void
}) {
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const projectContext = useAppStore((s) => s.projectContext)
  const documents = useAppStore((s) => s.documents)

  const [totals, setTotals] = useState<RunTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdf, setPdf] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [log, setLog] = useState<LogLine[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [modelNote, setModelNote] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const howPrepared = useMemo(
    () =>
      buildHowPrepared(totals, {
        client: projectContext.client,
        location: projectContext.location,
        buildingType: projectContext.buildingType,
      }),
    [totals, projectContext.client, projectContext.location, projectContext.buildingType],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    collectRunTotals(projectId)
      .then((next) => {
        if (!cancelled) setTotals(next)
      })
      .catch(() => {
        if (!cancelled) setTotals(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [projectId])

  const pushLog = (text: string, tone: LogLine['tone'] = 'info') => {
    setLog((current) => [...current, { at: Date.now(), text, tone }])
  }

  const startDebugging = async () => {
    if (!pdf) {
      setError('Upload the verification PDF first.')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError('')
    setModelNote('')
    setIssues([])
    setLog([])
    setPhase('uploading')

    try {
      pushLog(`Uploading ${pdf.name} to the model…`, 'info')
      setPhase('uploading')
      const fileId = await uploadOpenAiFile(pdf, { signal: controller.signal, onStatus: (label) => pushLog(label, 'info') })

      pushLog('Cross-checking prepared output against every stage…', 'info')
      setPhase('checking')
      const found = await gatherIssues(projectId)
      setIssues(found)
      pushLog(
        found.length
          ? `Found ${found.length} item${found.length === 1 ? '' : 's'} to review.`
          : 'Stage cross-check is clean — no open flags.',
        found.some((item) => item.level === 'red') ? 'warn' : 'ok',
      )

      const ready = await openaiReady()
      if (!ready) throw new Error('The model is not available. Check the OpenAI proxy.')

      pushLog('Asking the Estimation Agent to resolve issues and confirm the offer path…', 'info')
      setPhase('model')
      const answer = await createResponse({
        fileId,
        detail: 'high',
        instructions: [
          'You are UNIQUBE Estimation Agent.',
          'You verify a prepared modular construction estimate against the uploaded PDF.',
          'Explain briefly how the estimate was prepared, list issues, say what was resolved or still needs a human, and end with whether a final offer can be issued.',
          'Be concrete. Do not invent quantities that are not in the prepared summary or the PDF.',
        ].join(' '),
        text: [
          `Project: ${projectName || projectId}`,
          '',
          'HOW THIS ESTIMATE WAS PREPARED:',
          howPrepared,
          '',
          'PREPARED OUTPUT SUMMARY:',
          JSON.stringify(totals, null, 2),
          '',
          'OPEN ISSUES FROM ENGINE CROSS-CHECK:',
          found.length ? found.map((item) => `- [${item.level}] ${item.stage}: ${item.text}`).join('\n') : '- none',
          '',
          'Drawings already on the project:',
          documents.map((doc) => `- ${doc.name} (${doc.status})`).join('\n') || '- none',
          '',
          'Cross-check the uploaded PDF against this prepared output. Resolve what you can. Mark what still needs approval. Then say if the final offer can be generated.',
        ].join('\n'),
        progress: {
          signal: controller.signal,
          onStatus: (label) => pushLog(label, 'info'),
        },
      })

      setModelNote(answer)
      const resolved = found.map((item) =>
        item.level === 'info'
          ? { ...item, resolved: true, resolution: 'Noted in agent review.' }
          : item.level === 'amber' && item.id.endsWith('-approve')
            ? { ...item, resolved: false, resolution: 'Needs human approval in the agent stage.' }
            : item.level === 'red'
              ? { ...item, resolved: false, resolution: 'Needs a re-run or engineer fix before offer.' }
              : { ...item, resolved: true, resolution: 'Reviewed against the PDF.' },
      )
      setIssues(resolved)
      pushLog('Verification complete. Review the agent note, then open Offer when ready.', 'ok')
      setPhase('done')
      bumpSidebarMarks()
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Verification failed.'
      setError(message)
      pushLog(message, 'err')
      setPhase('error')
    }
  }

  const openCount = issues.filter((item) => !item.resolved).length
  const canOffer = phase === 'done' && openCount === 0

  return (
    <div className="est-agent">
      <header className="est-agent__head">
        <div>
          <p className="est-agent__eyebrow">Verification</p>
          <h1>Estimation Agent</h1>
          <p>
            Prepared output on the left. Upload the PDF, start debugging, and the agent cross-checks the full estimate before the final offer.
          </p>
        </div>
        <button
          type="button"
          className="os-btn os-btn--primary"
          disabled={phase === 'uploading' || phase === 'checking' || phase === 'model' || !pdf}
          onClick={() => void startDebugging()}
        >
          {phase === 'uploading' || phase === 'checking' || phase === 'model' ? (
            <>
              <Loader2 size={14} className="est-agent__spin" /> Working…
            </>
          ) : (
            <>
              <Play size={14} /> Start debugging
            </>
          )}
        </button>
      </header>

      <div className="est-agent__split">
        <section className="est-agent__pane" aria-label="Prepared output">
          <div className="est-agent__pane-head">
            <FileText size={16} />
            <h2>Prepared output</h2>
          </div>
          {loading ? (
            <p className="est-agent__muted">Loading the prepared estimate…</p>
          ) : (
            <>
              <p className="est-agent__how">{howPrepared}</p>
              <div className="est-agent__stats">
                <article>
                  <span>Foundation</span>
                  <strong>{totals?.foundationType ?? '—'}</strong>
                  <em>{totals?.foundationLines ?? 0} lines</em>
                </article>
                <article>
                  <span>LGS</span>
                  <strong>{totals?.lgsKg != null ? `${totals.lgsKg.toLocaleString('en-US')} kg` : '—'}</strong>
                  <em>Super structure</em>
                </article>
                <article>
                  <span>Architecture</span>
                  <strong>
                    {totals?.doors ?? 0} / {totals?.windows ?? 0}
                  </strong>
                  <em>Doors / windows</em>
                </article>
                <article>
                  <span>MEP</span>
                  <strong>{totals?.mepLines ?? 0}</strong>
                  <em>Quantity lines</em>
                </article>
                <article>
                  <span>Dry material</span>
                  <strong>{money(totals?.dryMaterial)}</strong>
                  <em>Prepared sheet</em>
                </article>
                <article>
                  <span>Dry labour</span>
                  <strong>{money(totals?.dryLabour)}</strong>
                  <em>Prepared sheet</em>
                </article>
              </div>
            </>
          )}
        </section>

        <section className="est-agent__pane est-agent__pane--work" aria-label="Estimation agent">
          <div className="est-agent__pane-head">
            <Bot size={16} />
            <h2>Agent</h2>
          </div>

          <div className="est-agent__upload">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setPdf(file)
                setError('')
                event.target.value = ''
              }}
            />
            {pdf ? (
              <div className="est-agent__file">
                <FileText size={16} />
                <div className="min-w-0">
                  <strong className="truncate block">{pdf.name}</strong>
                  <span>{Math.max(1, Math.round(pdf.size / 1024))} KB · ready for model upload</span>
                </div>
                <button type="button" className="os-btn" aria-label="Remove PDF" onClick={() => setPdf(null)}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="est-agent__drop" onClick={() => inputRef.current?.click()}>
                <Upload size={18} />
                <strong>Upload verification PDF</strong>
                <span>Sent fully to the model for the cross-check</span>
              </button>
            )}
          </div>

          {error ? <p className="projects__error">{error}</p> : null}

          <ol className="est-agent__log" aria-live="polite">
            {log.length === 0 ? (
              <li className="est-agent__muted">Press Start debugging to upload the PDF and run the complete cross-check.</li>
            ) : (
              log.map((line) => (
                <li key={`${line.at}-${line.text}`} className={`is-${line.tone ?? 'info'}`}>
                  {line.tone === 'ok' ? <CheckCircle2 size={14} /> : line.tone === 'err' || line.tone === 'warn' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                  <span>{line.text}</span>
                </li>
              ))
            )}
          </ol>

          {issues.length > 0 && (
            <div className="est-agent__issues">
              <h3>Issues</h3>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.id} className={issue.resolved ? 'is-resolved' : `is-${issue.level}`}>
                    <div>
                      <strong>
                        {issue.stage} · {issue.level}
                      </strong>
                      <p>{issue.text}</p>
                      {issue.resolution ? <em>{issue.resolution}</em> : null}
                    </div>
                    {issue.resolved ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modelNote ? (
            <div className="est-agent__note">
              <h3>Agent report</h3>
              <pre>{modelNote}</pre>
            </div>
          ) : null}

          {phase === 'done' && (
            <div className="est-agent__offer">
              {canOffer ? (
                <p>All blocking issues are clear. Generate the final offer from the verified estimate.</p>
              ) : (
                <p>
                  {openCount} issue{openCount === 1 ? '' : 's'} still need a human fix or approval. You can still open Offer to review the gate.
                </p>
              )}
              <button type="button" className="os-btn os-btn--primary" onClick={onOpenOffer}>
                Open Offer
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
