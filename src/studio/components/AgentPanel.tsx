import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import { useChat } from '@ai-sdk/react'
import { ArrowUp, Copy, CornerDownLeft, Square, X } from 'lucide-react'
import type { UIMessage } from 'ai'
import { apiUrl, studioAuthHeaders } from '../lib/api'
import { useAppStore } from '../store'
import { buildAiRulesBlock, buildRulesReference } from '../lib/rulesContext'
import { runClientTool } from '../lib/clientTools'
import { getChatBuffer, schedulePersist, updateChatBuffer } from '../lib/projectLibrary'
import { emptyChat } from '../lib/projectRecord'
import type { AgentMode } from '../types'
import { ChatMarkdown } from './ChatMarkdown'
import { decodeChatPin, encodeChatPin } from '../lib/chatPage'
import { projectContextBlock, sellMultiplier } from '../lib/elements'
import { buildEstimate, fmtAed } from '../lib/estimate'

const MODELS = [
  { id: 'gpt-6.1-sol', label: 'Sol' },
  { id: 'gpt-6-astra', label: 'Astra' },
  { id: 'gpt-6-luna', label: 'Luna' },
] as const

const START_PROMPT = 'Start the estimation.'

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

function estimateLine() {
  const s = useAppStore.getState()
  if (!s.lines.length && !s.projectContext.floors.some((floor) => floor.areaM2)) {
    return `Estimate: nothing priced yet. Multiplier ${sellMultiplier(s.projectContext.commercials).toFixed(4)} on direct cost.`
  }
  const estimate = buildEstimate({
    lines: s.lines,
    measurements: s.measurements,
    pageScales: s.pageScales,
    projectContext: s.projectContext,
    priceSheet: s.priceSheet,
  })
  const flags = estimate.benchmarks.filter((b) => b.status === 'low' || b.status === 'high').map((b) => `${b.label} ${b.status}`)
  return [
    `Estimate (live): GFA ${fmtAed(estimate.gfaM2)} m², direct ${fmtAed(estimate.direct.total)} AED, selling ${fmtAed(estimate.sellRounded)} AED (${fmtAed(estimate.aedPerSqft, 1)} AED/sqft), multiplier ${estimate.multiplier.toFixed(4)}.`,
    flags.length ? ` Benchmark flags: ${flags.join(', ')}.` : '',
    s.revisions.length ? ` Revisions saved: ${s.revisions.map((rev) => rev.label).join(', ')}.` : '',
    ' Call getEstimateSummary for the full picture.',
  ].join('')
}

function projectContext() {
  const s = useAppStore.getState()
  const files = s.documents
    .map((d) => `${d.name} (${d.status}${d.analysis ? `, ${d.analysis.pageCount} pages` : ''})`)
    .join('; ')
  const scales = Object.entries(s.pageScales)
    .map(([key, scale]) => {
      const [fileId, page] = key.split(':')
      const doc = s.documents.find((d) => d.id === fileId)
      return `${doc?.name ?? fileId} p${page}: ${scale.label} (${scale.method})`
    })
    .join('; ')
  return [
    buildRulesReference(s.projectSetup),
    buildAiRulesBlock('leadEstimation'),
    `Project: ${s.projectSetup.projectName || '(unnamed)'}`,
    `Scale statement: ${s.drawingScale || '(not set)'}`,
    `Page scales: ${scales || '(none yet; extractGeometry calibrates)'}`,
    `Files: ${files || '(none)'}`,
    `Canvas lines: ${s.lines.length}. Measurements: ${s.measurements.length}.`,
    `Price sheet: ${s.priceSheet.length} direct rates. Call searchRates before using a unit price.`,
    estimateLine(),
    '',
    'JOB BRIEF (from Project context):',
    projectContextBlock(s.projectContext, s.priceSheet),
  ].join('\n')
}

function askInput(input: unknown): { question: string; options: { id: string; label: string }[] } {
  if (!input || typeof input !== 'object') return { question: 'Need a decision', options: [] }
  const row = input as { question?: unknown; options?: unknown }
  const options = Array.isArray(row.options)
    ? row.options.flatMap((option) => {
        if (!option || typeof option !== 'object') return []
        const item = option as { id?: unknown; label?: unknown }
        const label = String(item.label ?? item.id ?? '').trim()
        if (!label) return []
        return [{ id: String(item.id ?? label), label }]
      })
    : []
  return {
    question: typeof row.question === 'string' && row.question.trim() ? row.question : 'Need a decision',
    options,
  }
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
  const ask = askInput(input)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  function submit(answer: string) {
    const value = answer.trim()
    if (!value || sent) return
    setSent(true)
    onAnswer(toolCallId, value)
  }

  return (
    <form
      className="ask-card"
      onSubmit={(e) => {
        e.preventDefault()
        submit(text)
      }}
    >
      <p>{ask.question}</p>
      {ask.options.length > 0 && (
        <div className="ask-card__options">
          {ask.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn btn--ghost"
              disabled={sent}
              onClick={() => submit(option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div className="ask-card__row">
        <input
          value={text}
          disabled={sent}
          placeholder="Or type the scale, unit, or correction"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn" disabled={sent || !text.trim()}>
          Send
        </button>
      </div>
    </form>
  )
}

function restoreMessages(value: unknown[]): UIMessage[] {
  return value.filter((item): item is UIMessage => {
    if (!item || typeof item !== 'object') return false
    const row = item as { id?: unknown; role?: unknown; parts?: unknown }
    return typeof row.id === 'string' && (row.role === 'user' || row.role === 'assistant' || row.role === 'system') && Array.isArray(row.parts)
  })
}

export function AgentPanel({ projectId }: { projectId: string | null }) {
  const documents = useAppStore((s) => s.documents)
  const lineCount = useAppStore((s) => s.lines.length)
  const chatPage = useAppStore((s) => s.chatPage)
  const clearChatPage = useAppStore((s) => s.clearChatPage)
  const chatLineIds = useAppStore((s) => s.chatLineIds)
  const lines = useAppStore((s) => s.lines)
  const toggleChatLine = useAppStore((s) => s.toggleChatLine)
  const clearChatLines = useAppStore((s) => s.clearChatLines)
  const chatLines = lines.filter((line) => chatLineIds.includes(line.id))
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [seed] = useState(() => (projectId ? getChatBuffer() : emptyChat()))
  const [initialMessages] = useState(() => restoreMessages(seed.messages))
  const [mode, setMode] = useState<AgentMode>(seed.mode)
  const [model, setModel] = useState<(typeof MODELS)[number]['id']>(
    MODELS.some((item) => item.id === seed.model) ? (seed.model as (typeof MODELS)[number]['id']) : 'gpt-6.1-sol',
  )
  const [draft, setDraft] = useState('')
  const [worked, setWorked] = useState<Record<string, number>>(seed.worked)
  const modeRef = useRef(mode)
  const modelRef = useRef(model)
  const startedRef = useRef<number | null>(null)
  modeRef.current = mode
  modelRef.current = model

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl('/api/agent'),
        headers: studioAuthHeaders,
        body: () => ({
          mode: modeRef.current,
          model: modelRef.current,
          context: projectContext(),
        }),
      }),
    [],
  )

  const { messages, sendMessage, addToolOutput, status, stop, error } = useChat({
    id: projectId ?? 'no-project',
    messages: initialMessages,
    transport,
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
  const readyFiles = documents.some((d) => d.status === 'ready')

  useEffect(() => {
    if (chatPage || chatLineIds.length) composerRef.current?.focus()
  }, [chatPage, chatLineIds])

  const skipChatSave = useRef(true)
  useEffect(() => {
    if (!projectId) return
    updateChatBuffer({ messages, worked, mode, model })
    if (skipChatSave.current) {
      skipChatSave.current = false
      return
    }
    schedulePersist()
  }, [messages, worked, mode, model, projectId])

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
    const state = useAppStore.getState()
    const page = state.chatPage
    const picked = state.lines.filter((line) => state.chatLineIds.includes(line.id))
    if (busy) return
    if (!value) {
      if (page || picked.length) return
      if (!readyFiles) return
      void sendMessage({ text: START_PROMPT })
      return
    }
    setDraft('')
    const outgoing =
      page || picked.length
        ? encodeChatPin(
            {
              page,
              lines: picked.map((line) => ({
                tag: line.tag,
                system: line.system,
                widthMm: line.widthMm,
                heightMm: line.heightMm,
                type: line.type,
                quantity: line.quantity,
                unit: line.unit,
                unitPrice: line.unitPrice,
                notes: line.notes,
                pageRef: line.pageRef,
              })),
            },
            value,
          )
        : value
    if (page) clearChatPage()
    if (picked.length) clearChatLines()
    void sendMessage({ text: outgoing })
  }

  return (
    <aside className="agent-pane">
      <div className="agent-pane__log">
        {messages.map((message, index) => {
          if (message.role === 'user') {
            const text = messageText(message.parts)
            const elapsed = worked[message.id]
            const latestUser = messages.slice(index + 1).every((later) => later.role !== 'user')
            const pinned = decodeChatPin(text)
            return (
              <div key={message.id} className="turn">
                <div className="turn-user">
                  <div>
                    {pinned?.page && (
                      <p className="turn-user__page">
                        Page {pinned.page.pageNumber} · {pinned.page.fileName}
                      </p>
                    )}
                    {pinned && pinned.lines.length > 0 && (
                      <p className="turn-user__page">{pinned.lines.map((line) => line.tag).join(', ')}</p>
                    )}
                    <p>{pinned ? pinned.question : text}</p>
                  </div>
                  <CornerDownLeft size={14} aria-hidden />
                </div>
                {(elapsed != null || (busy && latestUser)) && (
                  <p className="turn-meta">{elapsed != null ? formatWorked(elapsed) : 'Working…'}</p>
                )}
              </div>
            )
          }

          const text = messageText(message.parts)
          return (
            <article key={message.id} className="turn-assistant">
              {message.parts.map((part, index) => {
                if (part.type === 'text') return null
                if (!isToolUIPart(part)) return null
                const name = getToolName(part)
                if (name === 'askUser' && part.state === 'input-available') {
                  return (
                    <AskCard
                      key={part.toolCallId}
                      toolCallId={part.toolCallId}
                      input={part.input}
                      onAnswer={answerQuestion}
                    />
                  )
                }
                if (name === 'askUser' && part.state === 'output-available') return null
                const label =
                  part.state === 'output-error'
                    ? `${name} failed`
                    : part.state === 'output-available'
                      ? name
                      : `${name}…`
                return (
                  <p key={part.toolCallId || index} className="tool-line">
                    {label}
                  </p>
                )
              })}
              {text ? <ChatMarkdown text={text} /> : null}
              {text && !busy ? (
                <button
                  type="button"
                  className="turn-copy"
                  aria-label="Copy reply"
                  onClick={() => void navigator.clipboard.writeText(text)}
                >
                  <Copy size={14} />
                </button>
              ) : null}
            </article>
          )
        })}
        {error && <p className="agent-pane__error">{error.message}</p>}
      </div>

      {lineCount > 0 && (
        <div className="composer-changes">
          <span>&gt; {lineCount === 1 ? '1 line' : `${lineCount} lines`}</span>
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        {(chatPage || chatLines.length > 0) && (
          <div className="composer__pins">
            {chatPage && (
              <div className="composer__page">
                <span>
                  Page {chatPage.pageNumber} · {chatPage.fileName}
                </span>
                <button type="button" aria-label="Remove page from chat" onClick={() => clearChatPage()}>
                  <X size={12} />
                </button>
              </div>
            )}
            {chatLines.map((line) => (
              <div key={line.id} className="composer__page">
                <span>
                  {line.tag}
                  {line.type ? ` · ${line.type}` : ''}
                </span>
                <button type="button" aria-label={`Remove ${line.tag} from chat`} onClick={() => toggleChatLine(line.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={composerRef}
          rows={2}
          value={draft}
          placeholder={
            chatLines.length > 1
              ? 'Ask about the selected lines'
              : chatLines.length === 1
                ? `Ask about ${chatLines[0].tag}`
                : chatPage
                  ? `Ask about page ${chatPage.pageNumber}`
                  : 'Message the estimator'
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="composer__bar">
          <select
            className={clsx('composer__mode', mode === 'ask' && 'composer__mode--ask')}
            value={mode}
            aria-label="Mode"
            onChange={(e) => setMode(e.target.value as AgentMode)}
          >
            <option value="ask">Ask</option>
            <option value="execute">Execute</option>
          </select>
          <select
            className="composer__model"
            value={model}
            aria-label="Model"
            onChange={(e) => setModel(e.target.value as (typeof MODELS)[number]['id'])}
          >
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {busy ? (
            <button type="button" className="composer__send" aria-label="Stop" onClick={() => void stop()}>
              <Square size={12} />
            </button>
          ) : (
            <button
              type="submit"
              className="composer__send"
              aria-label={draft.trim() ? 'Send' : 'Start estimation'}
              disabled={!draft.trim() && (!readyFiles || !!chatPage || chatLines.length > 0)}
            >
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}
