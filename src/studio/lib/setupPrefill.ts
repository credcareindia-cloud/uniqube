import type {
  DisciplineId,
  DocumentAnalysis,
  MaterialSelection,
  ProjectSetup,
} from '../types'
import {
  COMPONENTS,
  DISCIPLINES,
  MATERIALS_BY_COMPONENT,
} from './projectCatalog'
import { extractJsonBlock, suggestSetupWithPdf } from './takeoffAgent'
import { openaiReady } from './openai'

export type SetupPrefillSuggestion = {
  projectName: string
  floors: number
  disciplines: DisciplineId[]
  floorComponents: Record<number, string[]>
  floorMaterials: Record<number, Record<string, MaterialSelection[]>>
  rationale: string
}

type RawPrefill = {
  projectName?: string
  floors?: number
  disciplines?: string[]
  componentsByFloor?: Record<string, string[]>
  componentsAllFloors?: string[]
  materialsByFloor?: Record<
    string,
    Record<string, Array<{ materialId?: string; variantId?: string }>>
  >
  materialsAllFloors?: Record<
    string,
    Array<{ materialId?: string; variantId?: string }>
  >
  rationale?: string
}

const VALID_DISCIPLINES = new Set(DISCIPLINES.map((d) => d.id))
const VALID_COMPONENTS = new Set(COMPONENTS.map((c) => c.id))

function catalogDigest(): string {
  return COMPONENTS.map((c) => {
    const mats = (MATERIALS_BY_COMPONENT[c.id] ?? [])
      .map((m) => `${m.id}:{${m.variants.map((v) => v.id).join('|')}}`)
      .join(', ')
    return `${c.id}|${c.discipline}|${c.label} → ${mats}`
  }).join('\n')
}

function buildDrawingDigest(analysis: DocumentAnalysis, fileName: string): string {
  const parts = [`File: ${fileName}`, `Pages: ${analysis.pageCount}`]
  for (const p of analysis.pages.slice(0, 4)) {
    const text = (p.ocrText ?? '').trim()
    if (text) parts.push(`--- PAGE ${p.pageNumber} ---\n${text.slice(0, 3500)}`)
  }
  return parts.join('\n\n').slice(0, 10000)
}

function parseSetupJson(text: string): RawPrefill | null {
  const parsed = extractJsonBlock(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as RawPrefill
}

function sanitizeMaterials(
  componentId: string,
  list: Array<{ materialId?: string; variantId?: string }> | undefined,
): MaterialSelection[] {
  const catalog = MATERIALS_BY_COMPONENT[componentId] ?? []
  const out: MaterialSelection[] = []
  const seen = new Set<string>()
  for (const item of list ?? []) {
    const mid = String(item.materialId ?? '')
    const vid = String(item.variantId ?? '')
    const mat = catalog.find((m) => m.id === mid)
    if (!mat?.variants.some((v) => v.id === vid)) continue
    const key = `${mid}|${vid}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ materialId: mid, variantId: vid })
  }
  return out
}

function coerceSuggestion(
  raw: RawPrefill,
  fallbackName: string,
): SetupPrefillSuggestion {
  const floors = Math.min(5, Math.max(1, Math.round(Number(raw.floors) || 1)))
  const disciplines = (raw.disciplines ?? [])
    .map((d) => String(d).toLowerCase().trim() as DisciplineId)
    .filter((d) => VALID_DISCIPLINES.has(d))

  const floorComponents: Record<number, string[]> = {}
  const floorMaterials: Record<number, Record<string, MaterialSelection[]>> = {}
  const sharedComps = (raw.componentsAllFloors ?? []).filter((id) =>
    VALID_COMPONENTS.has(id),
  )

  for (let f = 1; f <= floors; f++) {
    const fromFloor = (raw.componentsByFloor?.[String(f)] ?? []).filter((id) =>
      VALID_COMPONENTS.has(id),
    )
    let comps = fromFloor.length ? fromFloor : [...sharedComps]
    if (disciplines.length) {
      const allowed = new Set(
        COMPONENTS.filter((c) => disciplines.includes(c.discipline)).map((c) => c.id),
      )
      comps = comps.filter((id) => allowed.has(id))
    }
    floorComponents[f] = comps
    const matsForFloor: Record<string, MaterialSelection[]> = {}
    const rawFloorMats = raw.materialsByFloor?.[String(f)]
    const rawShared = raw.materialsAllFloors
    for (const cid of comps) {
      const cleaned = sanitizeMaterials(cid, rawFloorMats?.[cid] ?? rawShared?.[cid])
      if (cleaned.length) matsForFloor[cid] = cleaned
    }
    floorMaterials[f] = matsForFloor
  }

  let discs = disciplines
  if (!discs.length) {
    discs = ['arch']
    for (let f = 1; f <= floors; f++) {
      if (!floorComponents[f]?.length) floorComponents[f] = ['arch-doors', 'arch-windows']
    }
  }

  return {
    projectName: String(raw.projectName ?? '').trim() || fallbackName,
    floors,
    disciplines: discs,
    floorComponents,
    floorMaterials,
    rationale: String(raw.rationale ?? '').trim() || 'Suggested from drawing',
  }
}

function heuristicFromDrawing(
  analysis: DocumentAnalysis,
  fallbackName: string,
): SetupPrefillSuggestion {
  const blob = [analysis.fileName, ...analysis.pages.map((p) => p.ocrText ?? '')]
    .join('\n')
    .toLowerCase()

  let floors = 1
  if (/\b(upper level|2nd floor|second floor|main level[\s\S]{0,40}upper)\b/.test(blob)) {
    floors = 2
  }

  const nameMatch =
    analysis.pages
      .map((p) => p.ocrText ?? '')
      .join('\n')
      .match(/\b([A-Z][A-Za-z0-9 .'/-]{2,40}\s+RESIDENCE[S]?)\b/) ||
    analysis.pages
      .map((p) => p.ocrText ?? '')
      .join('\n')
      .match(/\b(VEERAVELLI\s+RESIDENCE[S]?)\b/i)

  const comps = ['arch-doors', 'arch-windows']
  if (/\bcurtain wall\b|\bfixed cw\b|\bunitized\b/.test(blob)) {
    comps.push('arch-curtain-wall')
  }

  const materialsAll: Record<string, MaterialSelection[]> = {
    'arch-doors': [
      { materialId: 'door-aluminium', variantId: 'sliding' },
      { materialId: 'door-aluminium', variantId: 'swing' },
    ],
    'arch-windows': [
      { materialId: 'win-aluminium', variantId: 'fixed' },
      { materialId: 'win-aluminium', variantId: 'casement' },
      { materialId: 'win-glazing', variantId: 'dg' },
    ],
  }
  if (comps.includes('arch-curtain-wall')) {
    materialsAll['arch-curtain-wall'] = [
      { materialId: 'cw-system', variantId: 'unitized' },
      { materialId: 'cw-finish', variantId: 'powder' },
    ]
  }

  const floorComponents: Record<number, string[]> = {}
  const floorMaterials: Record<number, Record<string, MaterialSelection[]>> = {}
  for (let f = 1; f <= floors; f++) {
    floorComponents[f] = [...comps]
    floorMaterials[f] = { ...materialsAll }
  }

  return {
    projectName: nameMatch?.[1]?.trim() || fallbackName.replace(/[_-]+/g, ' '),
    floors,
    disciplines: ['arch'],
    floorComponents,
    floorMaterials,
    rationale: 'Heuristic from drawing text — review before Next',
  }
}

export async function suggestSetupFromAnalysis(
  analysis: DocumentAnalysis,
  opts?: {
    signal?: AbortSignal
    onStatus?: (msg: string) => void
    rulesPrompt?: string
    file?: File | null
    fileId?: string | null
  },
): Promise<SetupPrefillSuggestion> {
  const fallbackName = analysis.fileName.replace(/\.pdf$/i, '')
  const digest = buildDrawingDigest(analysis, analysis.fileName)
  const catalog = catalogDigest()

  const ready = await openaiReady()
  if (!ready) {
    return heuristicFromDrawing(analysis, fallbackName)
  }

  opts?.onStatus?.('Sol suggesting project setup…')
  try {
    const text = await suggestSetupWithPdf({
      file: opts?.file,
      fileId: opts?.fileId,
      drawingDigest: digest,
      catalogDigest: catalog,
      rulesPrompt: opts?.rulesPrompt,
      callbacks: { onStatus: opts?.onStatus, signal: opts?.signal },
    })
    const parsed = parseSetupJson(text)
    if (parsed) {
      const suggestion = coerceSuggestion(parsed, fallbackName)
      if (
        !suggestion.disciplines.length ||
        Object.values(suggestion.floorComponents).every((c) => !c.length)
      ) {
        const h = heuristicFromDrawing(analysis, fallbackName)
        return {
          ...h,
          projectName: suggestion.projectName || h.projectName,
          floors: suggestion.floors || h.floors,
          rationale: `${suggestion.rationale} + heuristic fill`,
        }
      }
      return suggestion
    }
  } catch {
    /* fall through */
  }

  opts?.onStatus?.('Using drawing-text heuristics…')
  return heuristicFromDrawing(analysis, fallbackName)
}

export function applySuggestionToSetup(
  suggestion: SetupPrefillSuggestion,
): ProjectSetup {
  return {
    projectName: suggestion.projectName,
    floors: suggestion.floors,
    disciplines: suggestion.disciplines,
    floorComponents: suggestion.floorComponents,
    floorMaterials: suggestion.floorMaterials,
    completed: false,
  }
}
