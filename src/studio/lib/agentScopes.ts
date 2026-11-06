import { RULES, type RuleRow } from './rulesPreview'

export type ScopeAgentId = 'foundation' | 'structure' | 'mep' | 'architecture'

export interface ScopeAgent {
  id: ScopeAgentId
  label: string
  ready: boolean
  blurb: string
  categories: string[]
}

export const SCOPE_AGENTS: ScopeAgent[] = [
  {
    id: 'foundation',
    label: 'Sub structure',
    ready: true,
    blurb: 'Substructure, footings, excavation, and below-grade work.',
    categories: ['SUBSTRUCTURE'],
  },
  {
    id: 'structure',
    label: 'Super structure',
    ready: true,
    blurb: 'LGS superstructure: walls, floors, roof, parapets, anchors, rods and HRS.',
    categories: ['SUPERSTRUCTURE'],
  },
  {
    id: 'mep',
    label: 'MEP',
    ready: true,
    blurb: 'Electrical, mechanical and plumbing quantities from the measured building.',
    categories: ['INSTALLATION'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    ready: true,
    blurb: 'Walls, openings, floors and facade measured from the approved plan.',
    categories: ['FINISHING'],
  },
]

export function rulesForAgent(id: ScopeAgentId): RuleRow[] {
  const agent = SCOPE_AGENTS.find((item) => item.id === id)
  if (!agent) return []
  const cats = new Set(agent.categories)
  return RULES.filter((rule) => cats.has(rule.category))
}

export function foundationRules(): RuleRow[] {
  return rulesForAgent('foundation')
}

const FOUNDATION_TYPE_WORDS: Array<[RegExp, string]> = [
  [/strip\s*footing|strip\s*foundation/i, 'strip footing'],
  [/isolated|pad\s*footing|iso[- ]footing/i, 'isolated footings'],
  [/ground\s*beam|tie\s*beam|plinth\s*beam/i, 'ground beams'],
  [/\braft\b/i, 'raft'],
  [/\bpiles?\b|piling/i, 'piles'],
  [/ground\s*slab|slab\s*on\s*grade|floor\s*slab/i, 'ground slab'],
  [/grid\s*footing/i, 'grid footing'],
]

/** Foundation types the human named in the project context, if any. */
export function foundationTypesFromContext(context: { description?: string; scopeNotes?: string; buildUps?: Record<string, unknown> }): string[] {
  const text = `${context.description ?? ''}\n${context.scopeNotes ?? ''}`
  const found = FOUNDATION_TYPE_WORDS.filter(([re]) => re.test(text)).map(([, label]) => label)
  for (const key of Object.keys(context.buildUps ?? {})) {
    if (key === 'strip-footing' && !found.includes('strip footing')) found.push('strip footing')
    if (key === 'iso-footing' && !found.includes('isolated footings')) found.push('isolated footings')
    if (key === 'ground-beam' && !found.includes('ground beams')) found.push('ground beams')
    if (key === 'grid-footing' && !found.includes('grid footing')) found.push('grid footing')
    if (key === 'ground-slab' && !found.includes('ground slab')) found.push('ground slab')
  }
  return found
}

export function foundationContextBlock(
  fileNames: string[],
  context: { description?: string; scopeNotes?: string; buildUps?: Record<string, unknown>; projectContextText?: string } = {},
): string {
  const rules = foundationRules()
  const types = foundationTypesFromContext(context)
  const lines = rules.map((rule) => `- ${rule.id} · ${rule.name} · ${rule.unit}`)
  return [
    `Uploaded PDFs: ${fileNames.length ? fileNames.join('; ') : '(none)'}`,
    types.length
      ? `Foundation types chosen by the human in the project context: ${types.join(', ')}. Measure these; ask before adding another type.`
      : 'The project context names no foundation type. If the set has no foundation sheet, ask the human which type to assume before measuring footings.',
    '',
    context.projectContextText ?? '',
    '',
    `SUBSTRUCTURE rules in scope (${rules.length}; call getRules for logic, inputs and checks):`,
    ...lines,
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n')
}

export const FOUNDATION_START_PROMPT =
  'Start the Foundation agent. Use only the uploaded PDFs. Scan the sheets, run geometry takeoff on the plan, trace the footprint, read the levels, write the substructure measurements the set supports, and give the final report with a source for every number and the SUBSTRUCTURE rule ids you applied.'
