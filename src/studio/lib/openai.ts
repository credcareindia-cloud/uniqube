/** OpenAI via the server proxy (key stays on the server). */

import { apiFetch } from './api'

export const DEFAULT_MODEL = 'gpt-6.1-sol'
export const REVIEW_MODEL = 'gpt-6-astra'

export type StreamParts = { thinking: string; answer: string }

export type TextProgress = {
  onStatus?: (label: string) => void
  onToken?: (chunk: string, full: string, parts: StreamParts) => void
  signal?: AbortSignal
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } | string }
    if (typeof data.error === 'string') return data.error
    if (data.error && typeof data.error === 'object' && data.error.message) {
      return data.error.message
    }
  } catch {
    /* ignore */
  }
  return `OpenAI error ${res.status}`
}

export async function openaiReady(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/openai/ready')
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return !!data.ok
  } catch {
    return false
  }
}

/** Upload a PDF (or other file) to OpenAI Files API via proxy. */
export async function uploadOpenAiFile(
  file: File,
  progress?: TextProgress,
): Promise<string> {
  progress?.onStatus?.(`Uploading ${file.name} to the model…`)
  const form = new FormData()
  form.append('purpose', 'user_data')
  form.append('file', file, file.name)

  const res = await apiFetch('/api/openai/files', {
    method: 'POST',
    body: form,
    signal: progress?.signal,
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { id?: string }
  if (!data.id) throw new Error('OpenAI file upload returned no id')
  progress?.onStatus?.(`Uploaded · ${data.id}`)
  return data.id
}

type ResponseContentPart = { type?: string; text?: string }
type ResponseOutputItem = { type?: string; content?: ResponseContentPart[] }
type ResponsesPayload = {
  output_text?: string
  output?: ResponseOutputItem[]
  error?: { message?: string }
}

function extractResponseText(data: ResponsesPayload): string {
  if (data.output_text?.trim()) return data.output_text.trim()
  const parts: string[] = []
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.text) parts.push(part.text)
    }
  }
  return parts.join('\n').trim()
}

/**
 * Non-streaming Responses API call (PDF file_id and/or text).
 * Uses gpt-6.1-sol by default (bakeoff winner for UNIQUBE takeoff).
 */
export async function createResponse(opts: {
  model?: string
  instructions?: string
  text: string
  fileId?: string
  detail?: 'low' | 'high' | 'auto'
  progress?: TextProgress
}): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL
  opts.progress?.onStatus?.(`Calling ${model}…`)

  const content: Array<Record<string, unknown>> = []
  if (opts.fileId) {
    content.push({
      type: 'input_file',
      file_id: opts.fileId,
      detail: opts.detail ?? 'high',
    })
  }
  content.push({ type: 'input_text', text: opts.text })

  const body: Record<string, unknown> = {
    model,
    input: [{ role: 'user', content }],
  }
  if (opts.instructions?.trim()) {
    body.instructions = opts.instructions.trim()
  }

  const res = await apiFetch('/api/openai/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.progress?.signal,
  })

  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as ResponsesPayload
  if (data.error?.message) throw new Error(data.error.message)

  const text = extractResponseText(data)
  if (!text) throw new Error('OpenAI returned empty output')

  opts.progress?.onToken?.(text, text, { thinking: '', answer: text })
  return text
}

export async function generateText(
  prompt: string,
  model = DEFAULT_MODEL,
  progress?: TextProgress,
): Promise<string> {
  return createResponse({ model, text: prompt, progress })
}
