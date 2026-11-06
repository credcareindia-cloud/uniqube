import type { ProjectSetup } from '../types'

export type ModelRuleTarget = 'pageReader' | 'leadEstimation' | 'chat' | 'setupPrefill'

const MODEL_INSTRUCTIONS: Record<ModelRuleTarget, { title: string; body: string }> = {
  pageReader: {
    title: 'Document takeoff (Sol) — instructions',
    body: `Read the whole document set. Nothing in it is out of scope.
Answer from the sheets. If a fact is not stated, say so. Do not invent it.
Prefer a schedule when it conflicts with another view.`,
  },
  leadEstimation: {
    title: 'Estimation model (gpt-6.1-sol) — instructions',
    body: `Answer any question from the uploaded documents.
Write for a narrow chat column: short paragraphs, bold only a label or the key figure, a bullet list for several items, and a markdown table only for two or three columns. Leave JSON out of the chat.
No trade or item is out of scope. If the documents do not state the fact, say what is missing. Do not invent it.
When you write a canvas line, use the tag, unit, and quantity the document uses.
When a rate is needed, call searchRates and use that unit price. If none matches, or the human gives a link, call web_search and name the source URL. Leave the canvas unit price at 0 unless they ask you to record the web rate. Do not invent a rate.`,
  },
  chat: {
    title: 'Chat model — instructions',
    body: `Answer from the documents and the canvas. Any subject is in scope. Write short paragraphs, bullet lists, or a small markdown table. Leave JSON out of the chat. Do not invent a figure the documents do not support.`,
  },
  setupPrefill: {
    title: 'Setup prefill — instructions',
    body: `Extract project setup JSON from the whole drawing set. Use only catalog ids. Do not prefer one trade over another.`,
  },
}

try {
  localStorage.removeItem('estimation-rules-bundle-v2')
} catch {
  /* storage unavailable */
}

/** No trade fence. The model answers from the documents. */
export function buildRulesReference(setup: ProjectSetup): string {
  const discs = setup.disciplines.length ? ` Selected disciplines: ${setup.disciplines.join(', ')}.` : ''
  return `Answer from the uploaded documents. No trade, package, or item is out of scope.${discs} If a fact is not in the documents, say so. Do not invent it.`
}

/** One of the four short model instructions, by call site. */
export function buildAiRulesBlock(target: ModelRuleTarget): string {
  const rule = MODEL_INSTRUCTIONS[target]
  return `### ${rule.title}\n${rule.body.trim()}`
}
