import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { DefaultChatTransport, getToolName, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { apiJson, apiUrl, studioAuthHeaders } from '../lib/api'
import { ChatMarkdown } from './ChatMarkdown'

function AskCard({ toolCallId, input, onAnswer }: { toolCallId: string; input: unknown; onAnswer: (toolCallId: string, answer: string) => void }) {
  const row = input && typeof input === 'object' ? (input as { question?: string; options?: Array<{ id?: string; label?: string }> }) : {}
  const question = typeof row.question === 'string' ? row.question : 'Need a decision'
  const options = Array.isArray(row.options)
    ? row.options.flatMap((option) => {
        const label = String(option?.label ?? option?.id ?? '').trim()
        return label ? [{ id: String(option?.id ?? label), label }] : []
      })
    : []
  return (
    <div className="fe__ask">
      <p>{question}</p>
      <div>
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onAnswer(toolCallId, option.label)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function messageText(message: UIMessage) {
  return message.parts
    .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n')
    .trim()
}

async function loadMessages(projectId: string): Promise<UIMessage[]> {
  try {
    const remote = await apiJson<unknown>(`/api/projects/${projectId}/plan-chat`)
    return Array.isArray(remote) ? (remote as UIMessage[]) : []
  } catch {
    return []
  }
}

function saveMessages(projectId: string, messages: UIMessage[]) {
  void apiJson(`/api/projects/${projectId}/plan-chat`, { method: 'PUT', body: JSON.stringify(messages) }).catch(() => undefined)
}

export function PlanRevisionChat({
  projectId,
  context,
  onRevise,
}: {
  projectId: string
  context: () => string
  onRevise: (patch: unknown) => Promise<unknown>
}) {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const ready = useRef(false)
  const contextRef = useRef(context)
  const reviseRef = useRef(onRevise)
  contextRef.current = context
  reviseRef.current = onRevise

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl('/api/agent'),
        headers: studioAuthHeaders,
        body: () => ({
          mode: 'execute' as const,
          model: 'gpt-6.1-sol',
          scope: 'plan' as const,
          context: contextRef.current(),
        }),
      }),
    [],
  )

  const { messages, setMessages, sendMessage, addToolOutput, status, stop, error } = useChat({
    id: `plan-revise-${projectId}`,
    transport,
    messages: [],
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return
      if (toolCall.toolName === 'askUser') return
      if (toolCall.toolName !== 'revisePlan') {
        void addToolOutput({
          state: 'output-error',
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: 'This chat only revises the plan drawing.',
        })
        return
      }
      try {
        const output = await reviseRef.current(toolCall.input)
        void addToolOutput({ tool: 'revisePlan', toolCallId: toolCall.toolCallId, output })
      } catch (e) {
        void addToolOutput({
          state: 'output-error',
          tool: 'revisePlan',
          toolCallId: toolCall.toolCallId,
          errorText: e instanceof Error ? e.message : 'The plan could not be revised.',
        })
      }
    },
  })

  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    let alive = true
    ready.current = false
    loadMessages(projectId).then((loaded) => {
      if (!alive) return
      setMessages(loaded)
      ready.current = true
    })
    return () => {
      alive = false
    }
  }, [projectId, setMessages])

  useEffect(() => {
    if (!busy && ready.current) saveMessages(projectId, messages)
  }, [busy, messages, projectId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  function answerQuestion(toolCallId: string, answer: string) {
    void addToolOutput({ tool: 'askUser', toolCallId, output: { answer } })
  }

  function submit() {
    const value = draft.trim()
    if (!value || busy) return
    setDraft('')
    void sendMessage({ text: value })
  }

  return (
    <div className="fe__revise">
      <div className="fe__revise-log" ref={logRef}>
        {messages.length === 0 && <p className="fe__muted">Describe a change. The engine redraws the plan when it can apply it.</p>}
        {messages.map((message) => {
          const text = messageText(message)
          if (message.role === 'user') {
            return (
              <p key={message.id} className="is-user">
                {text}
              </p>
            )
          }
          const question = message.parts.find((part) => isToolUIPart(part) && getToolName(part) === 'askUser' && part.state === 'input-available')
          return (
            <div key={message.id}>
              {text ? <ChatMarkdown text={text} /> : null}
              {question && isToolUIPart(question) ? <AskCard toolCallId={question.toolCallId} input={question.input} onAnswer={answerQuestion} /> : null}
            </div>
          )
        })}
        {busy && <p className="fe__muted">Updating the drawing…</p>}
        {error && <p className="fe__error">{error.message}</p>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <textarea
          rows={2}
          value={draft}
          placeholder="Say what to change on this plan"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        {busy ? (
          <button type="button" className="os-btn" aria-label="Stop" onClick={() => void stop()}>
            <Square size={14} />
          </button>
        ) : (
          <button type="submit" className="os-btn os-btn--primary" aria-label="Revise the plan" disabled={!draft.trim()}>
            <ArrowUp size={14} />
          </button>
        )}
      </form>
    </div>
  )
}
