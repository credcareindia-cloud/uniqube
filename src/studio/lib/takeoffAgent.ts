import { createResponse, DEFAULT_MODEL, uploadOpenAiFile } from './openai'
import type { TextProgress } from './openai'
import type { PageQuality, TakeoffLine } from '../types'

export type TextCallbacks = TextProgress

export type EstimationCtx = {
  estimationContext?: string
  /** Short model instruction for this call */
  rulesPrompt?: string
  /** Brief pointer to UNIQUBE practice — not a full rules dump */
  rulesReference?: string
}

type RawLine = {
  tag?: string
  system?: string
  widthMm?: number
  heightMm?: number
  type?: string
  quantity?: number
  unit?: string
  unitPrice?: number
  notes?: string
  pageRef?: number
}

function coerceLines(raw: unknown, newId: () => string): TakeoffLine[] | null {
  if (!Array.isArray(raw)) return null
  const out: TakeoffLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as RawLine
    out.push({
      id: newId(),
      tag: String(r.tag ?? '').trim() || 'OPEN',
      system: String(r.system ?? 'CW 50'),
      widthMm: Number(r.widthMm) || 0,
      heightMm: Number(r.heightMm) || 0,
      type: String(r.type ?? 'Opening'),
      quantity: Number(r.quantity) || 1,
      unit: String(r.unit ?? 'Pieces'),
      unitPrice: Number(r.unitPrice) || 0,
      notes: String(r.notes ?? ''),
      source: 'ai',
      pageRef: r.pageRef != null ? Number(r.pageRef) : undefined,
      confirmed: false,
    })
  }
  return out.length ? out : null
}

/** Pull first JSON array/object from model text */
export function extractJsonBlock(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || text.trim()
  const arrayStart = candidate.indexOf('[')
  const objStart = candidate.indexOf('{')
  let start = -1
  let endChar = ']'
  if (arrayStart >= 0 && (objStart < 0 || arrayStart <= objStart)) {
    start = arrayStart
    endChar = ']'
  } else if (objStart >= 0) {
    start = objStart
    endChar = '}'
  }
  if (start < 0) return null
  const end = candidate.lastIndexOf(endChar)
  if (end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'))
  } catch {
    return null
  }
}

export function linesFromAgentText(
  text: string,
  newId: () => string,
  _fallbackPages?: Array<{ notes: string; pageNumber: number; quality: PageQuality }>,
): TakeoffLine[] {
  const parsed = extractJsonBlock(text)
  if (parsed) {
    if (Array.isArray(parsed)) {
      const lines = coerceLines(parsed, newId)
      if (lines) return lines
    } else if (typeof parsed === 'object' && parsed && 'lines' in parsed) {
      const lines = coerceLines((parsed as { lines: unknown }).lines, newId)
      if (lines) return lines
    }
  }
  return []
}

export function stripJsonFromReply(text: string): string {
  return text
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, '')
    .replace(/^\s*\[[\s\S]*\]\s*$/m, '')
    .trim()
}

function buildTakeoffUserPrompt(ctx?: EstimationCtx): string {
  const setup = ctx?.estimationContext?.trim() || '(no project setup yet)'
  const ref =
    ctx?.rulesReference?.trim() ||
    'Apply UNIQUBE / Mulk aluminium estimation and offer conventions you already know (thermal-break systems, DGU, supply-only, W01… assembly positions). Do not invent a different commercial process.'

  return `${ref}

PROJECT / PRICE CONTEXT:
${setup}

From the attached architectural PDF:
1) Read cover, door/window schedules, and elevations.
2) Produce a UNIQUBE-style ROUGH ESTIMATE (brief markdown offer letter + specs + exclusions).
3) Group openings into assembly positions the way a UNIQUBE estimator would (W01…).
4) Convert imperial sizes to mm (1'-0" = 304.8 mm).
5) Prefer schedule truth over elevation guesses when they conflict.

After the markdown offer, append a fenced JSON block:
\`\`\`json
{
  "lines": [
    {
      "tag": "W01",
      "system": "CW 50",
      "widthMm": 2743.2,
      "heightMm": 3048,
      "type": "fixed cw",
      "quantity": 1,
      "unit": "Pieces",
      "unitPrice": 0,
      "notes": "short",
      "pageRef": 1
    }
  ],
  "offerTotalUsd": null
}
\`\`\`
unitPrice 0 unless a matching UNIT RATE is clearly applicable.`
}

/** Upload PDF once and run Sol takeoff (direct file input). */
export async function runPdfTakeoff(opts: {
  file: File
  fileId?: string | null
  ctx?: EstimationCtx
  model?: string
  callbacks?: TextCallbacks
}): Promise<{ text: string; fileId: string }> {
  const progress = opts.callbacks
  let fileId = opts.fileId ?? null
  if (!fileId) {
    fileId = await uploadOpenAiFile(opts.file, progress)
  }

  const instructions = [
    opts.ctx?.rulesPrompt?.trim(),
    'You are UNIQUBE aluminium estimation lead. Be precise on sizes and quantities.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const text = await createResponse({
    model: opts.model ?? DEFAULT_MODEL,
    instructions,
    text: buildTakeoffUserPrompt(opts.ctx),
    fileId,
    detail: 'high',
    progress,
  })

  return { text, fileId }
}

export async function chatTakeoffAgent(
  userText: string,
  lines: TakeoffLine[],
  offerNotes: string,
  history: Array<{ role: string; text: string }>,
  callbacks?: TextCallbacks,
  ctx?: EstimationCtx,
  fileId?: string | null,
): Promise<string> {
  const canvas = lines
    .map(
      (l) =>
        `${l.tag}|${l.system}|${l.widthMm}x${l.heightMm}|${l.type}|qty ${l.quantity}|${l.unit}|@${l.unitPrice}|pg ${l.pageRef ?? '-'}|${l.notes.slice(0, 80)}`,
    )
    .join('\n')

  const recent = history
    .slice(-8)
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n')

  const setup = ctx?.estimationContext?.trim() || ''
  const rules = ctx?.rulesPrompt?.trim() || ''
  const ref =
    ctx?.rulesReference?.trim() ||
    'Apply UNIQUBE aluminium estimation practice you already know.'

  const prompt = `${rules}

${ref}

${setup ? `PROJECT CONTEXT:\n${setup}\n` : ''}
Current canvas lines:
${canvas || '(empty)'}

Prior offer / takeoff notes (excerpt):
${offerNotes.slice(0, 4000) || '(none)'}

Recent chat:
${recent || '(none)'}

User: ${userText}

Reply in plain text first.
If the canvas should change, append:
\`\`\`json
{ "action": "replace", "lines": [ /* full takeoff array */ ] }
\`\`\``

  return createResponse({
    model: DEFAULT_MODEL,
    text: prompt,
    fileId: fileId || undefined,
    detail: 'low',
    progress: callbacks,
  })
}

export async function suggestSetupWithPdf(opts: {
  file?: File | null
  fileId?: string | null
  drawingDigest: string
  catalogDigest: string
  rulesPrompt?: string
  callbacks?: TextCallbacks
}): Promise<string> {
  let fileId = opts.fileId ?? null
  if (!fileId && opts.file) {
    fileId = await uploadOpenAiFile(opts.file, opts.callbacks)
  }

  const prompt = `${opts.rulesPrompt?.trim() || 'Extract project setup from the architectural drawing.'}

Reply with a single JSON object only:
{
  "projectName": "string",
  "floors": 1,
  "disciplines": ["arch"],
  "componentsAllFloors": ["arch-doors","arch-windows"],
  "materialsAllFloors": {
    "arch-doors": [{"materialId":"door-aluminium","variantId":"sliding"}],
    "arch-windows": [{"materialId":"win-aluminium","variantId":"fixed"}]
  },
  "rationale": "short"
}

Use ONLY catalog ids:
${opts.catalogDigest}

Drawing text extract:
${opts.drawingDigest}`

  return createResponse({
    model: DEFAULT_MODEL,
    text: prompt,
    fileId: fileId || undefined,
    detail: 'low',
    progress: opts.callbacks,
    instructions: 'Return JSON only. Prefer arch + doors/windows for aluminium D&W packs.',
  })
}
