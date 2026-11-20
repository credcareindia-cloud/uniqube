import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'
import { QubeCharacter, type QubeMood } from '@/components/ui/QubeCharacter'
import { useAppStore } from '../store'
import { readSession } from './OsChrome'
import {
  RUN_LABELS,
  RUN_STAGES,
  approveStage,
  collectRunTotals,
  QUOTE_WINDOW_MS,
  formatClock,
  formatDuration,
  formatPreciseClock,
  inspectStage,
  persistFloorHeight,
  resolveStructureChoice,
  runStage,
  applyRunFields,
  type MissingField,
  type RunChoice,
  type RunStage,
  type RunTotals,
  type StageSnapshot,
} from '../lib/estimateRun'

const WORK: RunStage[] = ['documents', 'settings', 'foundation', 'structure', 'architecture', 'mep']

function nextStage(stage: RunStage): RunStage {
  const index = RUN_STAGES.indexOf(stage)
  return RUN_STAGES[Math.min(RUN_STAGES.length - 1, index + 1)]
}

function prevStage(stage: RunStage): RunStage {
  const index = RUN_STAGES.indexOf(stage)
  return RUN_STAGES[Math.max(0, index - 1)]
}

function askField(snap: StageSnapshot | null): MissingField | null {
  return snap?.missing[0] ?? null
}

function headline(stage: RunStage, field: MissingField | null, waitDraw: boolean, readyLine: string | undefined): string {
  if (stage === 'done') return 'Quoted'
  if (field) return field.label
  if (waitDraw) return 'The plan'
  if (stage === 'documents') return 'Plan is in'
  return readyLine || RUN_LABELS[stage]
}

function qubeMood(busy: boolean, stage: RunStage, blocked: boolean, done: boolean): QubeMood {
  if (done) return 'happy'
  if (blocked) return 'sad'
  if (busy) return 'walk'
  if (stage === 'documents') return 'cute'
  return 'cute'
}

function qubeLine(args: {
  busy: boolean
  stage: RunStage
  field: MissingField | null
  waitDraw: boolean
  red: string | null
  error: string | null
  nudge: string | null
  remaining: number
  choice: RunChoice | null
}): string {
  if (args.busy) return 'Running — stay with me.'
  if (args.stage === 'done') return 'Quoted. That was minutes.'
  if (args.error) return args.error
  if (args.nudge) return args.nudge
  if (args.choice) return args.choice.title
  if (args.red) return args.red
  if (args.waitDraw) return 'Drop the plan. Then we fly.'
  if (args.field) return args.field.hint
  if (args.remaining > 1) return `${args.remaining} left. One at a time.`
  if (args.stage === 'settings') return 'Settings are in. We run next.'
  return 'Check it. Approve. Next.'
}

export function EstimateRunDialog({
  projectId,
  onClose,
  onOpenBoq,
}: {
  projectId: string
  onClose: () => void
  onOpenBoq: () => void
}) {
  const user = readSession()?.name ?? 'engineer'
  const documents = useAppStore((s) => s.documents)
  const addFiles = useAppStore((s) => s.addClientFiles)
  const [stage, setStage] = useState<RunStage>('documents')
  const [snap, setSnap] = useState<StageSnapshot | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [startedAt] = useState(() => Date.now())
  const startedPerf = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [marks, setMarks] = useState<Partial<Record<RunStage, number>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nudge, setNudge] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [totals, setTotals] = useState<RunTotals | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (finishedAt) return
    let frame = 0
    const tick = () => {
      setElapsedMs(performance.now() - startedPerf.current)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [finishedAt, startedAt])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let alive = true
    setError(null)
    setNudge(null)
    inspectStage(projectId, stage)
      .then((next) => {
        if (!alive) return
        setSnap(next)
        setValues(Object.fromEntries(next.missing.map((field) => [field.id, field.value])))
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'This stage could not be opened.')
      })
    return () => {
      alive = false
    }
  }, [projectId, stage, documents.map((doc) => `${doc.id}:${doc.status}`).join('|')])

  const elapsed = formatDuration(elapsedMs)
  const clock = formatPreciseClock(elapsedMs)
  const timeProgress = Math.min(1, elapsedMs / QUOTE_WINDOW_MS)
  const field = askField(snap)
  const filled = field ? Boolean((values[field.id] ?? field.value).trim()) : true
  const reds = snap?.flags.filter((flag) => flag.level === 'red') ?? []
  const waitDraw = stage === 'documents' && !snap?.ready
  const remaining = snap?.missing.length ?? 0
  const done = stage === 'done'

  const action = useMemo(() => {
    if (stage === 'done') return { label: 'Open the BOQ', kind: 'done' as const }
    if (waitDraw) return { label: 'Add the drawing', kind: 'upload' as const }
    if (field && !filled) return { label: `Need ${field.label.toLowerCase()}`, kind: 'need' as const }
    if (field) return { label: remaining > 1 ? `Next · ${remaining - 1} left` : 'Save — then we run', kind: 'save' as const }
    if (snap?.choice) return { label: snap.choice.acceptLabel, kind: 'choice' as const }
    if (stage === 'documents' || (snap?.ready && snap.approved) || stage === 'settings') {
      return { label: 'Next', kind: 'next' as const }
    }
    if (!snap?.ready) return { label: busy ? 'Running…' : `Run ${RUN_LABELS[stage].toLowerCase()}`, kind: 'run' as const }
    if (reds[0]) return { label: 'This is blocking', kind: 'blocked' as const }
    if (!snap.approved) return { label: 'Approve — keep going', kind: 'approve' as const }
    return { label: 'Next', kind: 'next' as const }
  }, [stage, snap, busy, waitDraw, field, filled, remaining, reds])

  const blocked = action.kind === 'need' || action.kind === 'blocked' || Boolean(error)
  const line = qubeLine({
    busy,
    stage,
    field,
    waitDraw,
    choice: snap?.choice ?? null,
    red: reds[0]?.text ?? null,
    error,
    nudge,
    remaining,
  })

  const flash = (why: string) => {
    setNudge(why)
    setShake((n) => n + 1)
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }

  const go = async () => {
    if (action.kind === 'need' && field) {
      flash(field.hint)
      return
    }
    if (action.kind === 'upload') {
      fileRef.current?.click()
      return
    }
    if (action.kind === 'blocked') {
      flash(reds[0]?.text ?? 'Clear the stop flag, then we go.')
      return
    }
    setBusy(true)
    setError(null)
    setNudge(null)
    try {
      if (action.kind === 'done') {
        onOpenBoq()
        onClose()
        return
      }
      if (action.kind === 'save' && field) {
        const answered = field.id
        const nextValues = { [answered]: values[answered] ?? '' }
        applyRunFields(nextValues)
        const ffh = Number(nextValues.ffh)
        if (answered === 'ffh' && ffh > 0) await persistFloorHeight(projectId, ffh)
        const next = await inspectStage(projectId, stage)
        const leftover = next.missing.filter((item) => item.id !== answered)
        setSnap({ ...next, missing: leftover, ready: leftover.length === 0 ? true : next.ready })
        setValues(Object.fromEntries(leftover.map((item) => [item.id, values[item.id] ?? item.value])))
        if (leftover.length === 0 && (stage === 'settings' || stage === 'documents')) {
          setMarks((current) => ({ ...current, [stage]: Date.now() }))
          setStage(nextStage(stage))
        }
        return
      }
      if (action.kind === 'choice') {
        const next = await resolveStructureChoice(projectId)
        setSnap(next)
        setValues(Object.fromEntries(next.missing.map((item) => [item.id, values[item.id] ?? item.value])))
        return
      }
      if (action.kind === 'run') {
        const next = await runStage(projectId, stage, user, values)
        setSnap(next)
        setValues(Object.fromEntries(next.missing.map((item) => [item.id, values[item.id] ?? item.value])))
        return
      }
      if (action.kind === 'approve') {
        const next = await approveStage(projectId, stage, user)
        setSnap(next)
        setMarks((current) => ({ ...current, [stage]: Date.now() }))
        setStage(nextStage(stage))
        return
      }
      setMarks((current) => ({ ...current, [stage]: current[stage] ?? Date.now() }))
      setStage(nextStage(stage))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This step could not finish.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (stage !== 'done') return
    let alive = true
    collectRunTotals(projectId).then((next) => {
      if (!alive) return
      setTotals(next)
      setFinishedAt((current) => current ?? Date.now())
    })
    return () => {
      alive = false
    }
  }, [stage, projectId])

  useEffect(() => {
    if (!field) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(id)
  }, [field?.id, stage])

  const doneCount = WORK.filter((item) => marks[item] || (item === stage && item !== 'documents')).length
  const progress = done ? 1 : Math.min(0.95, (doneCount + (field ? 0.35 : snap?.ready ? 0.7 : 0.15)) / WORK.length)

  return createPortal(
    <div className="pages-backdrop" style={{ zIndex: 4000 }} onMouseDown={onClose}>
      <div
        className={nudge ? 'est-run is-nudge' : 'est-run'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="est-run-title"
        data-shake={shake}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="est-run__side">
          <p className="est-run__offer">Quotation in 5 min</p>
          <div className="est-run__clock">
            <b>{clock}</b>
            <span
              className={timeProgress >= 1 ? 'est-run__timebar is-over' : 'est-run__timebar'}
              role="progressbar"
              aria-label="Time used of five minutes"
              aria-valuemin={0}
              aria-valuemax={300}
              aria-valuenow={Math.min(300, Math.round(elapsedMs / 1000))}
            >
              <i style={{ width: `${Math.round(timeProgress * 100)}%` }} />
            </span>
          </div>
          <QubeCharacter mood={qubeMood(busy, stage, blocked, done)} size={132} />
          <p className="est-run__say">{line}</p>
        </aside>
        <header className="est-run__head">
          <div>
            <p className="est-run__kicker">
              {done ? 'Done' : field ? `${RUN_LABELS[stage]} · ${remaining} left` : RUN_LABELS[stage]}
            </p>
            <h2 id="est-run-title">{headline(stage, field, waitDraw, snap?.summary)}</h2>
          </div>
          <button type="button" className="pages-dialog__close" aria-label="Close start estimation" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="est-run__track" aria-hidden>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="est-run__body">
          <input
            ref={fileRef}
            className="est-run__file"
            type="file"
            accept="application/pdf"
            multiple
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              if (files.length) addFiles(files)
              event.target.value = ''
            }}
          />
          {done && totals ? (
            <ResultPane totals={totals} elapsed={elapsed} marks={marks} startedAt={startedAt} finishedAt={finishedAt ?? startedAt + elapsedMs} />
          ) : (
            <AskPane
              key={`${stage}-${field?.id ?? 'ready'}`}
              snap={snap}
              field={field}
              values={values}
              waitDraw={waitDraw}
              inputRef={inputRef}
              onChange={(id, value) => {
                setNudge(null)
                setValues((current) => ({ ...current, [id]: value }))
              }}
              onEnter={() => void go()}
              onPick={() => fileRef.current?.click()}
            />
          )}
        </div>
        <footer className="est-run__foot">
          <button type="button" className="os-btn" disabled={stage === 'documents' || busy} onClick={() => setStage(prevStage(stage))}>
            Back
          </button>
          <button type="button" className={blocked ? 'os-btn os-btn--warn' : 'os-btn os-btn--primary'} disabled={busy} onClick={() => void go()}>
            {busy ? 'On it…' : action.label}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function AskPane({
  snap,
  field,
  values,
  waitDraw,
  inputRef,
  onChange,
  onEnter,
  onPick,
}: {
  snap: StageSnapshot | null
  field: MissingField | null
  values: Record<string, string>
  waitDraw: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (id: string, value: string) => void
  onEnter: () => void
  onPick: () => void
}) {
  if (!snap) return <p className="est-run__wait">Opening this beat…</p>
  if (waitDraw) {
    return (
      <button type="button" className="est-run__drop" onClick={onPick}>
        <strong>PDF in. Quote out.</strong>
        <span>One building. Architecture first. We keep moving.</span>
      </button>
    )
  }
  if (field) {
    const typed = (values[field.id] ?? '').trim()
    return (
      <div className="est-run__ask" data-field={field.id}>
        <p>{field.hint}</p>
        <label className="est-run__box">
          <input
            ref={inputRef}
            type="text"
            inputMode={field.kind === 'number' ? 'decimal' : 'text'}
            autoComplete="off"
            spellCheck={false}
            value={values[field.id] ?? ''}
            placeholder={field.example ?? field.label}
            aria-label={field.label}
            onChange={(event) => {
              const next = event.target.value
              if (field.kind === 'number' && next && !/^\d*\.?\d*$/.test(next)) return
              onChange(field.id, next)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onEnter()
              }
            }}
          />
          {field.suffix ? <span className="est-run__unit">{field.suffix}</span> : null}
        </label>
        {field.example && !typed ? (
          <button type="button" className="est-run__typical" onClick={() => onChange(field.id, field.example!)}>
            Use {field.example}
            {field.suffix ? ` ${field.suffix}` : ''}
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="est-run__ready">
      <p>{snap.summary}</p>
      {snap.choice ? (
        <div className="est-run__choice">
          <strong>{snap.choice.title}</strong>
          <span>{snap.choice.detail}</span>
        </div>
      ) : null}
      {snap.flags.map((flag) => (
        <p key={flag.id} className={`fe__flag is-${flag.level}`}>
          {flag.text}
        </p>
      ))}
      {snap.lines.length ? (
        <ul>
          {snap.lines.slice(0, 4).map((row) => (
            <li key={`${row.code}-${row.text}`}>
              <b>{row.code}</b> {row.text} <em>{row.qty}</em>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ResultPane({
  totals,
  elapsed,
  marks,
  startedAt,
  finishedAt,
}: {
  totals: RunTotals
  elapsed: string
  marks: Partial<Record<RunStage, number>>
  startedAt: number
  finishedAt: number
}) {
  return (
    <div className="est-run__result">
      <p className="est-run__win">
        Quoted in <b>{elapsed}</b>
      </p>
      <dl>
        <div>
          <dt>Sub structure</dt>
          <dd>
            {totals.foundationType} · {totals.foundationLines} lines
          </dd>
        </div>
        <div>
          <dt>Super structure</dt>
          <dd>{totals.lgsKg != null ? `${totals.lgsKg.toLocaleString('en-US')} kg LGS` : '—'}</dd>
        </div>
        <div>
          <dt>Architecture</dt>
          <dd>
            {totals.occupiedM2 != null ? `${totals.occupiedM2} m²` : '—'} · {totals.doors} doors · {totals.windows} windows
          </dd>
        </div>
        <div>
          <dt>MEP</dt>
          <dd>{totals.mepLines} bill lines</dd>
        </div>
        <div>
          <dt>Dry cost</dt>
          <dd>
            Material {totals.dryMaterial.toLocaleString('en-US')} · Labour {totals.dryLabour.toLocaleString('en-US')}
          </dd>
        </div>
      </dl>
      <ol>
        {WORK.map((item) => (
          <li key={item}>
            <span>{RUN_LABELS[item]}</span>
            <b>{marks[item] ? formatClock(marks[item]! - startedAt) : '—'}</b>
          </li>
        ))}
        <li>
          <span>Total</span>
          <b>{formatClock(finishedAt - startedAt)}</b>
        </li>
      </ol>
    </div>
  )
}

export function StartEstimateButton({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button type="button" className="est-primary est-start" disabled={disabled} title={title} onClick={onClick}>
      <Play size={14} />
      <span>Quote now</span>
    </button>
  )
}
