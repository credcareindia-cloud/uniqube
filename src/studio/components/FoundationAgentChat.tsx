import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowUp, BookOpen, ChevronDown, ChevronRight, Copy, CornerDownLeft, ListChecks, Play, Square, Trash2, X } from 'lucide-react'
import { apiUrl, studioAuthHeaders } from '../lib/api'
import { pageScaleKey, useAppStore } from '../store'
import { runClientTool } from '../lib/clientTools'
import { FOUNDATION_START_PROMPT, foundationContextBlock, foundationRules } from '../lib/agentScopes'
import { computeQuantities, elementById, projectContextBlock } from '../lib/elements'
import { ChatMarkdown } from './ChatMarkdown'
import type { RuleRow } from '../lib/rulesPreview'
import { apiJson } from '../lib/api'

const SUBSTRUCTURE_ELEMENTS = new Set(['iso-footing', 'ground-beam', 'strip-footing', 'grid-footing', 'ground-slab'])
const CHAT_KEY = (projectId: string) => `uniqube-foundation-chat-${projectId}`

async function loadMessages(projectId: string): Promise<UIMessage[]> {
  try {
    const remote = await apiJson<unknown>(`/api/projects/${projectId}/foundation-chat`)
    if (Array.isArray(remote) && remote.length) {
      localStorage.removeItem(CHAT_KEY(projectId))
      return remote as UIMessage[]
    }
  } catch {
    /* database down: fall back to a local copy once */
  }
  try {
    const raw = localStorage.getItem(CHAT_KEY(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    void saveMessages(projectId, parsed as UIMessage[])
    return parsed as UIMessage[]
  } catch {
    return []
  }
}

function saveMessages(projectId: string, messages: UIMessage[]) {
  void apiJson(`/api/projects/${projectId}/foundation-chat`, { method: 'PUT', body: JSON.stringify(messages) }).catch(() => undefined)
}

function formatWorked(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `Worked for ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `Worked for ${minutes}m ${rest}s` : `Worked for ${minutes}m`
}

function messageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function AskCard({
  toolCallId,
  input,
  onAnswer,
}: {
  toolCallId: string
  input: unknown
  onAnswer: (toolCallId: string, answer: string) => void
}) {
  const row = input && typeof input === 'object' ? (input as { question?: string; options?: Array<{ id?: string; label?: string }> }) : {}
  const question = typeof row.question === 'string' ? row.question : 'Need a decision'
  const options = Array.isArray(row.options)
    ? row.options.flatMap((option) => {
        const label = String(option?.label ?? option?.id ?? '').trim()
        if (!label) return []
        return [{ id: String(option?.id ?? label), label }]
      })
    : []
  return (
    <div className="ask-card">
      <p>{question}</p>
      <div className="ask-card__options">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onAnswer(toolCallId, option.label)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RulesPanel({ rules, onClose }: { rules: RuleRow[]; onClose: () => void }) {
  return (
    <div className="agents-rules">
      <header className="agents-rules__head">
        <div>
          <h3>Foundation rules</h3>
          <span>{rules.length} SUBSTRUCTURE rules from the unified registry</span>
        </div>
        <button type="button" className="os-btn" onClick={onClose} aria-label="Close rules">
          <X size={14} />
        </button>
      </header>
      <ul className="os-list agents-rules__list">
        {rules.map((rule) => {
          const status = rule.status.replaceAll('_', ' ').toLowerCase()
          const statusClass = status.includes('draft') ? 'is-draft' : 'is-ready'
          return (
            <li key={rule.id}>
              <div className="os-list__row">
                <div className="os-list__main">
                  <span className="os-list__body">
                    <span className="os-list__title">{rule.name}</span>
                    <span className="os-list__meta">
                      <span className="os-list__chip os-list__chip--id">{rule.id}</span>
                      <span className="os-list__chip">{rule.category}</span>
                      <span className="os-list__mute">unit {rule.unit}</span>
                      <span className={`os-list__status ${statusClass}`}>{status}</span>
                    </span>
                    <span className="os-list__note">{rule.logic}</span>
                    {rule.inputs.length > 0 && <span className="os-list__note">Inputs: {rule.inputs.join(', ')}</span>}
                    {rule.check && <span className="os-list__note">Check: {rule.check}</span>}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ——— tool cards: the source trail ———

type Row = Record<string, unknown>
const asRow = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {})
const n = (value: unknown, digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits).replace(/\.0$/, '') : '—')

/** One-line summary of what a tool was asked and what it returned. */
function toolSummary(name: string, input: unknown, output: unknown): { ask: string; got: string | null } {
  const inp = asRow(input)
  const out = asRow(output)
  const docs = useAppStore.getState().documents
  const byId = inp.fileId ? docs.find((d) => d.id === inp.fileId)?.name : undefined
  const file = String(out.drawingNo ?? byId ?? inp.fileName ?? out.fileName ?? inp.fileId ?? '')
  const page = inp.pageNumber != null ? ` p${inp.pageNumber}` : ''
  const where = `${file}${page}`.trim()
  if (out.error) return { ask: where || 'call', got: `Error: ${String(out.error)}` }
  switch (name) {
    case 'scanSheets': {
      const sheets = Array.isArray(out.sheets) ? (out.sheets as Row[]) : []
      const index = asRow(out.index)
      return {
        ask: 'index every page',
        got: output
          ? `${sheets.length} sheets: ${sheets.map((s) => `${s.drawingNo ?? '?'} ${s.title ?? ''}`.trim()).join(' · ')}${
              index.hasFoundationSheet === false ? ' · no foundation sheet' : ''
            }`
          : null,
      }
    }
    case 'extractGeometry': {
      const counts = asRow(out.counts)
      const scale = asRow(out.scale)
      return {
        ask: where,
        got: output
          ? `${n(counts.dimensions, 0)} dimension strings, ${n(counts.segments, 0)} lines · scale ${String(scale.label ?? 'not set')}${
              scale.confidence != null ? ` (${String(scale.method)}, ${Math.round(Number(scale.confidence) * 100)} %, ${String(scale.samples)} dims)` : ''
            }`
          : null,
      }
    }
    case 'traceFootprint': {
      const check = asRow(out.writtenCheck)
      const bbox = asRow(out.bboxMm)
      return {
        ask: where,
        got: output
          ? out.ok
            ? `${n(out.areaM2)} m² · perimeter ${n(out.perimeterM)} m · ${n(bbox.w, 0)} × ${n(bbox.h, 0)} mm vs written ${n(check.overallWidthMm, 0)} × ${n(
                check.overallDepthMm,
                0,
              )} (${n(check.widthDeltaPct)} % / ${n(check.depthDeltaPct)} %) · ${Array.isArray(out.polygon) ? out.polygon.length : 0} vertices`
            : `No footprint: ${Array.isArray(out.notes) ? (out.notes as string[]).at(-1) : ''}`
          : null,
      }
    }
    case 'setPageScale': {
      const scale = asRow(out.scale)
      return { ask: where, got: output ? `${String(scale.label ?? '')} · ${String(scale.method ?? '')}` : null }
    }
    case 'addMeasurement':
    case 'updateMeasurement': {
      const q = asRow(out.quantities)
      const qty = [
        q.qty != null && `${n(q.qty, 2)} ${String(q.unit ?? '')}`,
        q.lengthMm != null && `${n(Number(q.lengthMm) / 1000)} m run`,
        q.netM2 != null && `${n(q.netM2)} m²`,
        q.volumeM3 != null && `${n(q.volumeM3, 2)} m³`,
        q.count != null && `${n(q.count, 0)} nr`,
        q.needsScale === true && 'needs scale',
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        ask: `${String(inp.label ?? '')} · ${String(inp.elementId ?? '')} · ${String(inp.kind ?? '')}${where ? ` · ${where}` : ''}`,
        got: output ? qty || 'saved' : null,
      }
    }
    case 'getRules': {
      const rules = Array.isArray(out.rules) ? (out.rules as Row[]) : []
      const qa = Array.isArray(out.qualityTests) ? (out.qualityTests as Row[]) : []
      const eng = Array.isArray(out.engineRules) ? (out.engineRules as Row[]) : []
      return {
        ask: [inp.category, inp.query, Array.isArray(inp.ids) ? inp.ids.join(', ') : null].filter(Boolean).join(' · ') || 'all',
        got: output ? [...rules, ...qa, ...eng].map((r) => String(r.id)).join(', ') || 'none' : null,
      }
    }
    case 'foundationEngine': {
      const gate = out.gate as Row | undefined
      const flags = Array.isArray(out.flags) ? (out.flags as Row[]) : []
      const boq = Array.isArray(out.boq) ? out.boq : []
      const summary = (out.summary ?? {}) as Row
      return {
        ask: [inp.foundationType ? `Type ${inp.foundationType}` : null, inp.storeyCount ? `${inp.storeyCount} storeys` : null, inp.plinthAboveNglMm ? `plinth ${inp.plinthAboveNglMm}` : null].filter(Boolean).join(' · ') || 'saved inputs',
        got: output
          ? out.error
            ? String(out.error)
            : `${gate?.blocked ? 'blocked' : gate?.approved ? 'approved' : 'provisional'} · ${n(summary.walls, 0)} walls · ${n(summary.lbLines, 0)} LB lines · ${boq.length} BOQ rows · ${flags.length} flags`
          : null,
      }
    }
    case 'listMeasurements':
      return { ask: 'all', got: output ? `${n(out.count, 0)} measurements` : null }
    case 'removeMeasurement':
      return { ask: String(inp.id ?? ''), got: output ? 'removed' : null }
    case 'readPage':
      return { ask: where, got: output ? 'page attached' : null }
    case 'searchDocuments':
      return { ask: String(inp.query ?? ''), got: output ? `${Array.isArray(out.hits) ? out.hits.length : 0} hits` : null }
    case 'getProjectContext':
      return { ask: 'brief', got: output ? 'read' : null }
    case 'updateProjectContext':
      return { ask: Object.keys(inp).join(', '), got: output ? 'saved' : null }
    default:
      return { ask: where || Object.keys(inp).join(', '), got: output ? 'done' : null }
  }
}

function trimForDisplay(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    const items = value.slice(0, 12).map((v) => trimForDisplay(v, depth + 1))
    return value.length > 12 ? [...items, `… ${value.length - 12} more`] : items
  }
  if (value && typeof value === 'object') {
    const out: Row = {}
    for (const [k, v] of Object.entries(value as Row)) out[k] = depth > 3 ? '…' : trimForDisplay(v, depth + 1)
    return out
  }
  if (typeof value === 'string' && value.length > 400) return `${value.slice(0, 400)}…`
  return value
}

/** The traced outline drawn to scale, with the plan region and the written overall box for comparison. */
function FootprintPreview({ output }: { output: unknown }) {
  const out = asRow(output)
  const polygon = Array.isArray(out.polygon) ? (out.polygon as Array<{ x: number; y: number }>) : []
  const region = asRow(out.region) as { x0?: number; y0?: number; x1?: number; y1?: number }
  if (polygon.length < 3 || region.x0 == null) return null
  const w = (region.x1 ?? 0) - (region.x0 ?? 0)
  const h = (region.y1 ?? 0) - (region.y0 ?? 0)
  if (!(w > 0 && h > 0)) return null
  const bbox = asRow(out.bboxPt) as { x0?: number; y0?: number; x1?: number; y1?: number }
  const points = polygon.map((p) => `${(p.x - region.x0!).toFixed(1)},${(p.y - region.y0!).toFixed(1)}`).join(' ')
  const grid = asRow(out.gridAxes) as { verticalX?: number[]; horizontalY?: number[] }
  return (
    <svg className="tool-card__svg" viewBox={`-4 -4 ${w + 8} ${h + 8}`} role="img" aria-label="Traced footprint">
      <rect x={0} y={0} width={w} height={h} fill="none" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={0.8} />
      {(grid.verticalX ?? []).map((x) => (
        <line key={`v${x}`} x1={x - region.x0!} x2={x - region.x0!} y1={0} y2={h} stroke="#e2e8f0" strokeWidth={0.6} />
      ))}
      {(grid.horizontalY ?? []).map((y) => (
        <line key={`h${y}`} x1={0} x2={w} y1={y - region.y0!} y2={y - region.y0!} stroke="#e2e8f0" strokeWidth={0.6} />
      ))}
      {bbox.x0 != null && (
        <rect x={bbox.x0 - region.x0!} y={bbox.y0! - region.y0!} width={bbox.x1! - bbox.x0} height={bbox.y1! - bbox.y0!} fill="none" stroke="#94a3b8" strokeWidth={0.6} />
      )}
      <polygon points={points} fill="rgba(8,145,178,0.15)" stroke="#0891B2" strokeWidth={1.2} strokeLinejoin="round" />
      {polygon.map((p, i) => (
        <circle key={i} cx={p.x - region.x0!} cy={p.y - region.y0!} r={1.6} fill="#0E7490" />
      ))}
    </svg>
  )
}

function ToolCard({ name, state, input, output, errorText }: { name: string; state: string; input: unknown; output?: unknown; errorText?: string }) {
  const [open, setOpen] = useState(false)
  const done = state === 'output-available'
  const failed = state === 'output-error'
  const { ask, got } = toolSummary(name, input, done ? output : undefined)
  const footprint = done && name === 'traceFootprint' && asRow(output).ok === true
  return (
    <div className={clsx('tool-card', done && 'is-done', failed && 'is-failed')}>
      <button type="button" className="tool-card__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <b>{name}</b>
        <span className="tool-card__ask">{ask}</span>
        <span className="tool-card__got">{failed ? errorText || 'failed' : done ? got : 'running…'}</span>
      </button>
      {footprint && <FootprintPreview output={output} />}
      {open && (
        <div className="tool-card__body">
          <small>Input</small>
          <pre>{JSON.stringify(trimForDisplay(input), null, 1)}</pre>
          {done && (
            <>
              <small>Output</small>
              <pre>{JSON.stringify(trimForDisplay(output), null, 1)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FindingsPanel({ onClose }: { onClose: () => void }) {
  const measurements = useAppStore((s) => s.measurements)
  const pageScales = useAppStore((s) => s.pageScales)
  const projectContext = useAppStore((s) => s.projectContext)
  const removeMeasurement = useAppStore((s) => s.removeMeasurement)
  const rows = measurements.filter((m) => SUBSTRUCTURE_ELEMENTS.has(m.elementId) || m.floor === 0)
  return (
    <div className="agents-rules agents-findings">
      <header className="agents-rules__head">
        <div>
          <h3>Foundation findings</h3>
          <span>{rows.length} substructure measurements written by the agent</span>
        </div>
        <button type="button" className="os-btn" onClick={onClose} aria-label="Close findings">
          <X size={14} />
        </button>
      </header>
      <ul className="agents-rules__list">
        {rows.length === 0 && <li>Nothing written yet. Start the agent or ask it to measure.</li>}
        {rows.map((m) => {
          const scale = pageScales[pageScaleKey(m.fileId, m.pageNumber)] ?? null
          const q = computeQuantities(m, projectContext, scale)
          const qty = [
            `${q.qty.toFixed(q.unit === 'nr' ? 0 : 2)} ${q.unit}`,
            q.lengthMm != null && `${(q.lengthMm / 1000).toFixed(1)} m run`,
            q.netM2 != null && `${q.netM2.toFixed(1)} m²`,
            q.volumeM3 != null && `${q.volumeM3.toFixed(2)} m³`,
            q.count != null && `${q.count} nr`,
            q.needsScale && 'needs scale',
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={m.id}>
              <b>{m.label}</b>
              <strong>{elementById(m.elementId)?.label ?? m.elementId}</strong>
              <small>
                {m.fileName} p{m.pageNumber} · {m.kind} · floor {m.floor ?? '—'} · {m.source}
              </small>
              <span>{qty || 'no scale yet'}</span>
              {m.notes && <em>{m.notes}</em>}
              <button type="button" className="agents-findings__remove" onClick={() => removeMeasurement(m.id)}>
                <Trash2 size={12} /> Remove
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FoundationAgentChat({ projectId }: { projectId: string }) {
  const documents = useAppStore((s) => s.documents)
  const analyzeProgress = useAppStore((s) => s.analyzeProgress)
  const projectContext = useAppStore((s) => s.projectContext)
  const priceSheet = useAppStore((s) => s.priceSheet)
  const [draft, setDraft] = useState('')
  const [side, setSide] = useState<'none' | 'rules' | 'findings'>('none')
  const [worked, setWorked] = useState<Record<string, number>>({})
  const startedRef = useRef<number | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const rules = useMemo(() => foundationRules(), [])
  const fileNames = useMemo(() => documents.map((doc) => doc.name), [documents])
  const initialMessages = useMemo<UIMessage[]>(() => [], [projectId])
  const chatReady = useRef(false)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl('/api/agent'),
        headers: studioAuthHeaders,
        body: () => {
          const s = useAppStore.getState()
          return {
            mode: 'execute' as const,
            model: 'gpt-6.1-sol',
            scope: 'foundation' as const,
            context: foundationContextBlock(fileNames, {
              description: s.projectContext.description,
              scopeNotes: s.projectContext.scopeNotes,
              buildUps: s.projectContext.buildUps as Record<string, unknown>,
              projectContextText: projectContextBlock(s.projectContext, s.priceSheet),
            }),
          }
        },
      }),
    // projectContext and priceSheet are read live in body(); listed so the transport refreshes when they change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileNames, projectContext, priceSheet],
  )

  const { messages, setMessages, sendMessage, addToolOutput, status, stop, error } = useChat({
    id: `foundation-${projectId}`,
    transport,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return
      if (toolCall.toolName === 'askUser' || toolCall.toolName === 'web_search') return
      try {
        const output = await runClientTool(toolCall.toolName, toolCall.input)
        void addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output,
        })
      } catch (e) {
        void addToolOutput({
          state: 'output-error',
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: e instanceof Error ? e.message : 'Tool failed',
        })
      }
    },
  })

  const busy = status === 'submitted' || status === 'streaming'
  const readyCount = documents.filter((doc) => doc.status === 'ready' && doc.analysis).length
  const readingCount = documents.filter((doc) => doc.status === 'reading').length
  const errorDocs = documents.filter((doc) => doc.status === 'error')
  const allReady = documents.length > 0 && readingCount === 0 && readyCount > 0

  useEffect(() => {
    let alive = true
    chatReady.current = false
    loadMessages(projectId).then((loaded) => {
      if (!alive) return
      setMessages(loaded)
      chatReady.current = true
    })
    return () => {
      alive = false
    }
  }, [projectId, setMessages])

  useEffect(() => {
    if (!busy && chatReady.current) saveMessages(projectId, messages)
  }, [busy, messages, projectId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  useEffect(() => {
    if (busy && startedRef.current == null) startedRef.current = Date.now()
    if (!busy && startedRef.current != null) {
      const ms = Date.now() - startedRef.current
      startedRef.current = null
      const lastUser = [...messages].reverse().find((message) => message.role === 'user')
      if (lastUser) setWorked((current) => ({ ...current, [lastUser.id]: ms }))
    }
  }, [busy, messages])

  function answerQuestion(toolCallId: string, answer: string) {
    void addToolOutput({
      tool: 'askUser',
      toolCallId,
      output: { answer },
    })
  }

  function submit(text: string) {
    const value = text.trim()
    if (busy) return
    if (!value) {
      if (!allReady) return
      void sendMessage({ text: FOUNDATION_START_PROMPT })
      return
    }
    setDraft('')
    void sendMessage({ text: value })
  }

  function clearChat() {
    if (busy) return
    setMessages([])
    void apiJson(`/api/projects/${projectId}/foundation-chat`, { method: 'DELETE' }).catch(() => undefined)
  }

  const readiness = !documents.length
    ? 'Upload a PDF before starting.'
    : readingCount
      ? `Reading ${readingCount} PDF${readingCount > 1 ? 's' : ''}… ${Math.round(analyzeProgress * 100)} %`
      : errorDocs.length && !readyCount
        ? `Could not read ${errorDocs.map((d) => d.name).join(', ')}.`
        : `${readyCount} PDF${readyCount > 1 ? 's' : ''} ready`

  return (
    <div className={clsx('agents-chat', side !== 'none' && 'has-rules')}>
      <header className="agents-chat__head">
        <div>
          <h2>Foundation</h2>
          <span>
            Substructure takeoff from the PDFs · {rules.length} rules in scope · {readiness}
          </span>
        </div>
        <div className="agents-chat__actions">
          <button type="button" className={clsx('os-btn', side === 'findings' && 'is-on')} onClick={() => setSide((v) => (v === 'findings' ? 'none' : 'findings'))}>
            <ListChecks size={14} /> Findings
          </button>
          <button type="button" className={clsx('os-btn', side === 'rules' && 'is-on')} onClick={() => setSide((v) => (v === 'rules' ? 'none' : 'rules'))}>
            <BookOpen size={14} /> Rules considered
          </button>
          {messages.length > 0 && (
            <button type="button" className="os-btn" disabled={busy} onClick={clearChat} title="Clear this chat">
              <Trash2 size={14} />
            </button>
          )}
          <button type="button" className="os-btn os-btn--primary" disabled={busy || !allReady} onClick={() => submit('')}>
            <Play size={14} /> {messages.length ? 'Run again' : 'Start'}
          </button>
        </div>
      </header>

      <div className="agents-chat__body">
        <div className="agents-chat__log" ref={logRef}>
          {messages.length === 0 && (
            <p className="agents-chat__empty">
              Start the Foundation agent. It indexes every sheet, calibrates the plan from its dimension strings, traces the footprint, reads the levels,
              writes substructure measurements with a source on every number, and lists what the set does not give.
              {!allReady && documents.length > 0 && <> Waiting for the PDF analysis to finish.</>}
            </p>
          )}
          {messages.map((message, index) => {
            if (message.role === 'user') {
              const text = messageText(message.parts)
              const elapsed = worked[message.id]
              const latestUser = messages.slice(index + 1).every((later) => later.role !== 'user')
              return (
                <div key={message.id} className="turn">
                  <div className="turn-user">
                    <div>
                      <p>{text}</p>
                    </div>
                    <CornerDownLeft size={14} aria-hidden />
                  </div>
                  {(elapsed != null || (busy && latestUser)) && <p className="turn-meta">{elapsed != null ? formatWorked(elapsed) : 'Working…'}</p>}
                </div>
              )
            }
            const text = messageText(message.parts)
            return (
              <article key={message.id} className="turn-assistant">
                {message.parts.map((part, partIndex) => {
                  if (part.type === 'text') return null
                  if (!isToolUIPart(part)) return null
                  const name = getToolName(part)
                  if (name === 'askUser' && part.state === 'input-available') {
                    return <AskCard key={part.toolCallId} toolCallId={part.toolCallId} input={part.input} onAnswer={answerQuestion} />
                  }
                  if (name === 'askUser' && part.state === 'output-available') return null
                  return (
                    <ToolCard
                      key={part.toolCallId || partIndex}
                      name={name}
                      state={part.state}
                      input={part.input}
                      output={part.state === 'output-available' ? part.output : undefined}
                      errorText={part.state === 'output-error' ? part.errorText : undefined}
                    />
                  )
                })}
                {text ? <ChatMarkdown text={text} /> : null}
                {text && !busy ? (
                  <button type="button" className="turn-copy" aria-label="Copy reply" onClick={() => void navigator.clipboard.writeText(text)}>
                    <Copy size={14} />
                  </button>
                ) : null}
              </article>
            )
          })}
          {error && <p className="agent-pane__error">{error.message}</p>}
        </div>
        {side === 'rules' && <RulesPanel rules={rules} onClose={() => setSide('none')} />}
        {side === 'findings' && <FindingsPanel onClose={() => setSide('none')} />}
      </div>

      <form
        className="composer agents-chat__composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <textarea
          ref={composerRef}
          rows={2}
          value={draft}
          placeholder={allReady ? 'Message the Foundation agent' : readiness}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="composer__bar">
          <span className="agents-chat__mode">Execute · Sol · foundation scope</span>
          {busy ? (
            <button type="button" className="composer__send" aria-label="Stop" onClick={() => void stop()}>
              <Square size={12} />
            </button>
          ) : (
            <button type="submit" className="composer__send" aria-label={draft.trim() ? 'Send' : 'Start Foundation agent'} disabled={!draft.trim() && !allReady}>
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
