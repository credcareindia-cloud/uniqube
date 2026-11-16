import { pageScaleKey, useAppStore } from '../store'
import type {
  BuildUp,
  ClientDocument,
  Commercials,
  Measurement,
  MeasurementKind,
  PagePoint,
  PageScale,
  ProjectContext,
  TakeoffLine,
} from '../types'
import {
  ELEMENTS,
  computeQuantities,
  elementById,
  floorsFromCount,
  projectContextBlock,
  sellMultiplier,
} from './elements'
import { buildEstimate, estimateSummaryText } from './estimate'
import { mmPerPtForRatio, sheetSummary, snapScale, summarizeGeometry, traceFootprint } from './geometryCore'
import rulesIndex from '../data/rulesIndex.json'

type RuleRow = { id: string; category: string; scope: string; name: string; unit: string; logic: string; inputs: string[]; check: string; status: string; gate: string }
const RULES: RuleRow[] = rulesIndex.rules
const QA_TESTS: Array<{ id: string; check: string }> = (rulesIndex as { quality_tests?: Array<{ id: string; check: string }> }).quality_tests ?? []

type ToolResult = Record<string, unknown>

function parsePoints(value: unknown): PagePoint[] {
  if (!Array.isArray(value)) return []
  const out: PagePoint[] = []
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      const x = Number(item[0])
      const y = Number(item[1])
      if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y })
      continue
    }
    if (item && typeof item === 'object') {
      const row = item as { x?: unknown; y?: unknown }
      const x = Number(row.x)
      const y = Number(row.y)
      if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y })
    }
  }
  return out
}

function optNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function measurementSummary(m: Measurement) {
  const s = useAppStore.getState()
  const scale = s.pageScales[pageScaleKey(m.fileId, m.pageNumber)] ?? null
  const q = computeQuantities(m, s.projectContext, scale)
  const lines = s.lines.filter((line) => line.measurementId === m.id)
  return {
    id: m.id,
    label: m.label,
    elementId: m.elementId,
    element: elementById(m.elementId)?.label ?? m.elementId,
    kind: m.kind,
    fileName: m.fileName,
    pageNumber: m.pageNumber,
    floor: m.floor,
    points: m.points.length,
    dims: m.dims,
    deductM2: m.deductM2,
    quantities: q,
    source: m.source,
    canvasLines: lines.map((line) => ({ tag: line.tag, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, confirmed: line.confirmed })),
    notes: m.notes,
  }
}

function readyDocs(): ClientDocument[] {
  return useAppStore.getState().documents.filter((d) => d.status === 'ready' && d.analysis)
}

function findDoc(fileId?: string, fileName?: string): ClientDocument | null {
  const docs = readyDocs()
  if (fileId) return docs.find((d) => d.id === fileId) ?? null
  if (fileName) {
    const needle = fileName.trim().toLowerCase()
    return (
      docs.find((d) => d.name.toLowerCase() === needle) ??
      docs.find((d) => d.name.toLowerCase().includes(needle)) ??
      null
    )
  }
  return docs[0] ?? null
}

function num(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the PDF'))
    reader.readAsDataURL(file)
  })
}

export async function runClientTool(name: string, input: unknown): Promise<ToolResult> {
  const args = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

  if (name === 'listFiles') {
    const documents = useAppStore.getState().documents
    return {
      scale: useAppStore.getState().drawingScale || null,
      files: documents.map((d) => ({
        fileId: d.id,
        fileName: d.name,
        status: d.status,
        pageCount: d.analysis?.pageCount ?? 0,
        pages: (d.analysis?.pages ?? []).map((p) => ({
          pageNumber: p.pageNumber,
          quality: p.quality,
          textChars: p.textChars,
        })),
        error: d.error,
      })),
    }
  }

  if (name === 'searchDocuments') {
    const query = str(args.query).trim()
    if (!query) return { error: 'query is required' }
    const needle = query.toLowerCase()
    const hits: Array<{ fileId: string; fileName: string; pageNumber: number; snippet: string }> = []
    for (const doc of readyDocs()) {
      for (const page of doc.analysis?.pages ?? []) {
        const text = page.ocrText ?? ''
        const at = text.toLowerCase().indexOf(needle)
        if (at < 0) continue
        const start = Math.max(0, at - 80)
        hits.push({
          fileId: doc.id,
          fileName: doc.name,
          pageNumber: page.pageNumber,
          snippet: text.slice(start, start + 800),
        })
      }
    }
    return { query, hits }
  }

  if (name === 'searchRates') {
    const query = str(args.query).trim().toLowerCase()
    if (!query) return { error: 'query is required' }
    const words = query.split(/\s+/).filter(Boolean)
    const rates = useAppStore
      .getState()
      .priceSheet.filter((row) => {
        const text = [
          row.discipline,
          row.componentLabel,
          row.materialLabel,
          row.variantLabel,
          row.unit,
          row.currency,
          row.notes,
        ]
          .join(' ')
          .toLowerCase()
        return words.every((word) => text.includes(word))
      })
      .map((row) => ({
        discipline: row.discipline,
        component: row.componentLabel,
        material: row.materialLabel,
        variant: row.variantLabel,
        unit: row.unit,
        unitPrice: row.unitPrice,
        currency: row.currency,
        notes: row.notes,
      }))
    return {
      query,
      count: rates.length,
      rates,
      note: rates.length
        ? 'Use one of these unit prices. Do not invent a rate.'
        : 'No price-sheet rate matches. Leave the unit price at 0.',
    }
  }

  if (name === 'readPage') {
    const doc = findDoc(str(args.fileId) || undefined, str(args.fileName) || undefined)
    if (!doc?.analysis) return { error: 'No matching file. Call listFiles first.' }
    const pageNumber = Math.floor(num(args.pageNumber))
    const page = doc.analysis.pages.find((p) => p.pageNumber === pageNumber)
    if (!page) return { error: `Page ${pageNumber} is not in ${doc.name}` }

    let text = page.ocrText ?? ''
    let via: 'selectable' | 'ocr' = 'selectable'
    if (text.replace(/\s+/g, '').length < 40 && page.imageDataUrl) {
      const { runOcr } = await import('./ocr')
      text = (await runOcr(page.imageDataUrl)).replace(/\s+/g, ' ').trim()
      via = 'ocr'
      const nextPages = doc.analysis.pages.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, ocrText: text, textChars: text.replace(/\s+/g, '').length }
          : p,
      )
      const nextAnalysis = { ...doc.analysis, pages: nextPages }
      useAppStore.setState((s) => ({
        documents: s.documents.map((d) =>
          d.id === doc.id ? { ...d, analysis: nextAnalysis } : d,
        ),
        analysis: s.analysis?.fileName === doc.analysis?.fileName ? nextAnalysis : s.analysis,
      }))
    }

    if (!doc.file || doc.file.size === 0) return { error: `The PDF for ${doc.name} is not stored.` }
    const pdf = await fileToDataUrl(doc.file)
    return {
      fileId: doc.id,
      fileName: doc.name,
      pageNumber,
      quality: page.quality,
      textSource: via,
      textChars: text.replace(/\s+/g, '').length,
      text,
      pdf,
      note: `The full PDF is attached. Use page ${pageNumber} only.`,
    }
  }

  if (name === 'setScale') {
    const statement = str(args.statement).trim()
    if (!statement) return { error: 'statement is required' }
    useAppStore.getState().setDrawingScale(statement)
    return { ok: true, scale: statement }
  }

  if (name === 'upsertLine') {
    const tag = str(args.tag).trim()
    if (!tag) return { error: 'tag is required' }
    const line: Omit<TakeoffLine, 'id' | 'confirmed'> = {
      tag,
      system: str(args.system),
      widthMm: num(args.widthMm),
      heightMm: num(args.heightMm),
      type: str(args.type, 'Item') || 'Item',
      quantity: Math.max(1, num(args.quantity, 1)),
      unit: str(args.unit, 'Pieces') || 'Pieces',
      unitPrice: num(args.unitPrice),
      notes: str(args.notes),
      source: 'ai',
      pageRef: args.pageRef != null ? num(args.pageRef) : undefined,
    }
    const saved = useAppStore.getState().upsertTakeoffLine(line)
    useAppStore.setState({ activeTabId: 'canvas', stageView: 'takeoff' })
    return { ok: true, ...saved, tag, widthMm: line.widthMm, heightMm: line.heightMm }
  }

  if (name === 'updateLine') {
    const tag = str(args.tag).trim()
    const existing = useAppStore.getState().lines.find((l) => l.tag.toLowerCase() === tag.toLowerCase())
    if (!existing) return { error: `No line tagged ${tag}` }
    const patch: Partial<TakeoffLine> = {}
    if (args.system != null) patch.system = str(args.system)
    if (args.widthMm != null) patch.widthMm = num(args.widthMm)
    if (args.heightMm != null) patch.heightMm = num(args.heightMm)
    if (args.type != null) patch.type = str(args.type)
    if (args.quantity != null) patch.quantity = Math.max(1, num(args.quantity, 1))
    if (args.unit != null) patch.unit = str(args.unit)
    if (args.unitPrice != null) patch.unitPrice = num(args.unitPrice)
    if (args.notes != null) patch.notes = str(args.notes)
    if (args.pageRef != null) patch.pageRef = num(args.pageRef)
    useAppStore.getState().updateLine(existing.id, patch)
    return { ok: true, tag, updated: Object.keys(patch) }
  }

  if (name === 'removeLine') {
    const tag = str(args.tag).trim()
    const existing = useAppStore.getState().lines.find((l) => l.tag.toLowerCase() === tag.toLowerCase())
    if (!existing) return { error: `No line tagged ${tag}` }
    useAppStore.getState().removeLine(existing.id)
    return { ok: true, removed: tag }
  }

  if (name === 'getProjectContext') {
    const s = useAppStore.getState()
    return {
      text: projectContextBlock(s.projectContext, s.priceSheet),
      context: s.projectContext,
      elements: ELEMENTS.map((element) => ({
        id: element.id,
        label: element.label,
        group: element.group,
        measure: element.measure,
        unit: element.unit,
        sizes: element.sizes,
        hint: element.hint,
      })),
      pageScales: Object.entries(s.pageScales).map(([key, scale]) => {
        const [fileId, page] = key.split(':')
        const doc = s.documents.find((d) => d.id === fileId)
        return { fileId, fileName: doc?.name, pageNumber: Number(page), ...scale }
      }),
    }
  }

  if (name === 'updateProjectContext') {
    const s = useAppStore.getState()
    const patch: Partial<ProjectContext> = {}
    if (typeof args.buildingType === 'string') patch.buildingType = args.buildingType
    if (typeof args.location === 'string') patch.location = args.location
    if (typeof args.description === 'string') patch.description = args.description
    if (typeof args.scopeNotes === 'string') patch.scopeNotes = args.scopeNotes
    if (typeof args.client === 'string') patch.client = args.client
    if (typeof args.consultant === 'string') patch.consultant = args.consultant
    if (typeof args.projectNumber === 'string') patch.projectNumber = args.projectNumber
    if (args.units === 'mm' || args.units === 'm' || args.units === 'ft') patch.units = args.units
    let floors = s.projectContext.floors
    if (args.floorCount != null) floors = floorsFromCount(num(args.floorCount, floors.length), floors)
    if (Array.isArray(args.floors)) {
      const given = args.floors
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          level: num(item.level, 0),
          name: str(item.name),
          heightMm: num(item.heightMm, 0),
          areaM2: optNum(item.areaM2),
        }))
        .filter((item) => item.level > 0)
      if (given.length) {
        floors = given
          .sort((a, b) => a.level - b.level)
          .map((item) => {
            const existing = floors.find((floor) => floor.level === item.level)
            const areaM2 = item.areaM2 ?? existing?.areaM2
            return {
              level: item.level,
              name: item.name || existing?.name || `Level ${item.level}`,
              heightMm: item.heightMm || existing?.heightMm || 3000,
              ...(areaM2 ? { areaM2 } : {}),
            }
          })
      }
    }
    patch.floors = floors
    if (Array.isArray(args.elements)) {
      const known = new Set(ELEMENTS.map((element) => element.id))
      patch.elements = args.elements.filter((id): id is string => typeof id === 'string' && known.has(id))
    }
    if (args.buildUps && typeof args.buildUps === 'object') {
      const next: Record<string, BuildUp> = { ...s.projectContext.buildUps }
      for (const [elementId, raw] of Object.entries(args.buildUps as Record<string, unknown>)) {
        const element = elementById(elementId)
        if (!element || !raw || typeof raw !== 'object') continue
        const row = raw as Record<string, unknown>
        const current: BuildUp = next[elementId] ?? {
          layers: element.layers.map((layer) => ({ id: layer.id, name: layer.name, thicknessMm: layer.thicknessMm })),
          notes: '',
        }
        const layers = Array.isArray(row.layers)
          ? row.layers
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
              .map((item, index) => ({
                id: str(item.id) || `layer-${index + 1}`,
                name: str(item.name) || `Layer ${index + 1}`,
                thicknessMm: num(item.thicknessMm, 0),
                priceRowId: str(item.priceRowId) || undefined,
              }))
          : current.layers
        next[elementId] = {
          layers,
          heightMm: optNum(row.heightMm) ?? current.heightMm,
          widthMm: optNum(row.widthMm) ?? current.widthMm,
          depthMm: optNum(row.depthMm) ?? current.depthMm,
          thicknessMm: optNum(row.thicknessMm) ?? current.thicknessMm,
          notes: typeof row.notes === 'string' ? row.notes : current.notes,
        }
      }
      patch.buildUps = next
    }
    s.setProjectContext(patch)
    const after = useAppStore.getState()
    return { ok: true, text: projectContextBlock(after.projectContext, after.priceSheet) }
  }

  if (name === 'getEstimateSummary') {
    const s = useAppStore.getState()
    const estimate = buildEstimate({
      lines: s.lines,
      measurements: s.measurements,
      pageScales: s.pageScales,
      projectContext: s.projectContext,
      priceSheet: s.priceSheet,
    })
    const currency = s.projectContext.commercials.currency || 'AED'
    return {
      text: estimateSummaryText(estimate, currency),
      gfaM2: estimate.gfaM2,
      gfaSqft: estimate.gfaSqft,
      multiplier: estimate.multiplier,
      direct: estimate.direct,
      sellTotal: estimate.sellRounded,
      usdTotal: Math.round(estimate.usdTotal),
      aedPerSqft: Math.round(estimate.aedPerSqft * 10) / 10,
      systems: estimate.systems
        .filter((sys) => sys.direct > 0 || sys.lineCount > 0)
        .map((sys) => ({ id: sys.id, label: sys.label, direct: Math.round(sys.direct), sell: Math.round(sys.sell), aedPerSqft: Math.round(sys.aedPerSqft * 10) / 10, lines: sys.lineCount })),
      allowances: estimate.allowances.map((a) => ({ id: a.id, label: a.label, qty: a.qty, unit: a.unit, rate: a.rate, direct: Math.round(a.direct), basis: a.basis })),
      boq: estimate.boq.filter((b) => b.amount > 0).map((b) => ({ system: b.system, label: b.label, amount: b.amount })),
      cbd: estimate.cbd.map((row) => ({ code: row.code, label: row.label, amount: Math.round(row.amount), pct: Math.round(row.pct * 1000) / 10 })),
      qtoByFloor: estimate.qto.rows.map((row) => ({
        elementId: row.elementId,
        label: row.label,
        unit: row.unit,
        perFloor: Object.fromEntries(estimate.qto.floors.map((floor) => [floor.name, Math.round((row.perFloor[floor.level] ?? 0) * 100) / 100])),
        total: Math.round(row.total * 100) / 100,
        totalSqft: row.totalSqft == null ? null : Math.round(row.totalSqft),
      })),
      benchmarks: estimate.benchmarks.map((b) => ({ id: b.id, label: b.label, value: Math.round(b.value * 100) / 100, unit: b.unit, low: b.low, high: b.high, status: b.status })),
      warnings: estimate.warnings,
      revisions: s.revisions.map((rev) => ({ id: rev.id, label: rev.label, savedAt: rev.savedAt, sellAed: rev.sellAed, gfaM2: rev.gfaM2, note: rev.note })),
      commercials: s.projectContext.commercials,
    }
  }

  if (name === 'updateCommercials') {
    const s = useAppStore.getState()
    const current = s.projectContext.commercials
    const patch: Partial<Commercials> = {}
    for (const key of Object.keys(current) as Array<keyof Commercials>) {
      // Only a person can say the rates were reviewed; the offer gate relies on it.
      if (key === 'ratesReviewedAt') continue
      if (!(key in args)) continue
      const value = args[key]
      if (typeof current[key] === 'number') {
        const n = Number(value)
        if (Number.isFinite(n) && n >= 0) (patch as Record<string, number>)[key] = n
      } else if (typeof current[key] === 'boolean') {
        if (typeof value === 'boolean') (patch as Record<string, boolean>)[key] = value
      } else if (typeof value === 'string') {
        ;(patch as Record<string, string>)[key] = value
      }
    }
    if (!Object.keys(patch).length) return { error: 'No recognised commercial fields in the input.' }
    s.setCommercials(patch)
    const after = useAppStore.getState().projectContext.commercials
    return { ok: true, applied: patch, multiplier: Math.round(sellMultiplier(after) * 10000) / 10000, commercials: after }
  }

  if (name === 'saveRevision') {
    const s = useAppStore.getState()
    const revision = s.saveRevision(str(args.label) || undefined, str(args.note))
    return { ok: true, revision, revisions: useAppStore.getState().revisions.map((rev) => ({ label: rev.label, sellAed: rev.sellAed, savedAt: rev.savedAt })) }
  }

  if (name === 'extractGeometry') {
    const doc = findDoc(str(args.fileId) || undefined, str(args.fileName) || undefined)
    if (!doc?.analysis) return { error: 'No matching file. Call listFiles first.' }
    const pageNumber = Math.floor(num(args.pageNumber, 1))
    if (pageNumber < 1 || pageNumber > doc.analysis.pageCount) return { error: `Page ${pageNumber} is not in ${doc.name}` }
    const s = useAppStore.getState()
    const { getPageGeometry } = await import('./geometry')
    const geo = await getPageGeometry(doc, pageNumber, s.projectContext.units)
    let scale: PageScale | null = s.pageScales[pageScaleKey(doc.id, pageNumber)] ?? null
    let scaleApplied: string | null = null
    if (!scale) {
      const best = geo.scaleCandidates.find((c) => c.method === 'auto' && c.confidence >= 0.6)
      if (best) {
        scale = { mmPerPt: best.mmPerPt, label: best.label, method: 'auto', confidence: best.confidence, samples: best.samples }
        s.setPageScale(doc.id, pageNumber, scale)
        scaleApplied = `Auto-calibrated ${best.label} from ${best.samples} dimension strings and applied to this page.`
      }
    }
    const detail = str(args.detail, 'standard')
    const limits = detail === 'full' ? { segments: 200, rects: 150, texts: 250, dimensions: 250 } : detail === 'brief' ? { segments: 30, rects: 25, texts: 50, dimensions: 50 } : {}
    return {
      fileId: doc.id,
      fileName: doc.name,
      scale: scale
        ? { ...scale, note: 'Lengths below are already in mm using this scale.' }
        : { note: 'No scale on this page yet. Call setPageScale (ratio, two points and a known length, or useCandidate) before measuring.' },
      scaleApplied,
      ...summarizeGeometry(geo, scale?.mmPerPt ?? null, limits),
    }
  }

  if (name === 'scanSheets') {
    const s = useAppStore.getState()
    const pending = s.documents.filter((d) => d.status !== 'ready' && d.status !== 'error')
    const docs = readyDocs()
    if (!docs.length) {
      return {
        error: pending.length
          ? `No PDF is ready yet (${pending.map((d) => `${d.name}: ${d.status}`).join(', ')}). Wait and call scanSheets again.`
          : 'No PDF has been uploaded.',
      }
    }
    const { getPageGeometry } = await import('./geometry')
    const sheets: Array<Record<string, unknown>> = []
    for (const doc of docs) {
      const pageCount = doc.analysis?.pageCount ?? 0
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        const geo = await getPageGeometry(doc, pageNumber, s.projectContext.units)
        const summary = sheetSummary(geo)
        const auto = geo.scaleCandidates.find((c) => c.method === 'auto')
        const stated = geo.scaleCandidates.filter((c) => c.method === 'stated').map((c) => c.label)
        sheets.push({
          fileId: doc.id,
          fileName: doc.name,
          ...summary,
          pageSizePt: { w: Math.round(geo.widthPt), h: Math.round(geo.heightPt) },
          autoScale: auto ? { label: auto.label, mmPerPt: Math.round(auto.mmPerPt * 1000) / 1000, confidence: auto.confidence, samples: auto.samples } : null,
          statedScales: stated,
          pageScaleSet: s.pageScales[pageScaleKey(doc.id, pageNumber)]?.label ?? null,
        })
      }
    }
    const kinds = (kind: string) => sheets.filter((sh) => sh.kind === kind).map((sh) => `${sh.drawingNo ?? '?'} p${sh.pageNumber}`)
    const foundationSheets = sheets.filter((sh) => {
      const title = String(sh.title ?? '').toUpperCase()
      const hits = (sh.keywordHits as Record<string, string[]>).foundation ?? []
      return /FOUNDATION|FOOTING|PILE|RAFT|SUBSTRUCTURE/.test(title) || hits.length >= 3
    })
    return {
      files: docs.map((d) => ({ fileId: d.id, fileName: d.name, pages: d.analysis?.pageCount ?? 0 })),
      pendingFiles: pending.map((d) => ({ fileName: d.name, status: d.status })),
      sheets,
      index: {
        planSheets: kinds('plan'),
        sectionSheets: kinds('section'),
        elevationSheets: kinds('elevation'),
        scheduleSheets: kinds('schedule'),
        coverSheets: kinds('cover'),
        foundationSheets: foundationSheets.map((sh) => `${sh.drawingNo ?? '?'} p${sh.pageNumber}`),
        hasFoundationSheet: foundationSheets.length > 0,
        statedAreas: sheets.flatMap((sh) => (sh.statedAreas as Array<{ text: string; m2: number }>).map((a) => ({ ...a, sheet: `${sh.drawingNo ?? '?'} p${sh.pageNumber}` }))),
        levels: sheets.flatMap((sh) => (sh.levels as Array<{ label: string; mm: number }>).map((l) => ({ ...l, sheet: `${sh.drawingNo ?? '?'} p${sh.pageNumber}` }))),
      },
      note: foundationSheets.length
        ? 'Foundation sheets found. Read them before deriving anything from the architectural plan.'
        : 'No foundation or structural sheet in this set. Footprint, levels and wall lines can be read from the architectural plan; foundation type, sizes and depths cannot. Report that as a gap.',
    }
  }

  if (name === 'traceFootprint') {
    const doc = findDoc(str(args.fileId) || undefined, str(args.fileName) || undefined)
    if (!doc?.analysis) return { error: 'No matching file. Call scanSheets first.' }
    const pageNumber = Math.floor(num(args.pageNumber, 1))
    if (pageNumber < 1 || pageNumber > doc.analysis.pageCount) return { error: `Page ${pageNumber} is not in ${doc.name}` }
    const s = useAppStore.getState()
    const { getPageGeometry } = await import('./geometry')
    const geo = await getPageGeometry(doc, pageNumber, s.projectContext.units)
    let scale: PageScale | null = s.pageScales[pageScaleKey(doc.id, pageNumber)] ?? null
    let scaleApplied: string | null = null
    if (!scale) {
      const best = geo.scaleCandidates.find((c) => c.method === 'auto' && c.confidence >= 0.6)
      if (best) {
        scale = { mmPerPt: best.mmPerPt, label: best.label, method: 'auto', confidence: best.confidence, samples: best.samples }
        s.setPageScale(doc.id, pageNumber, scale)
        scaleApplied = `Auto-calibrated ${best.label} from ${best.samples} dimension strings and applied to this page.`
      }
    }
    if (!scale) return { error: 'No page scale. Call extractGeometry and setPageScale first.' }
    const regionIn = args.region && typeof args.region === 'object' ? (args.region as Record<string, unknown>) : null
    const region =
      regionIn && [regionIn.x0, regionIn.y0, regionIn.x1, regionIn.y1].every((v) => Number.isFinite(Number(v)))
        ? { x0: num(regionIn.x0), y0: num(regionIn.y0), x1: num(regionIn.x1), y1: num(regionIn.y1) }
        : undefined
    const result = traceFootprint(geo, scale.mmPerPt, {
      region,
      closingRadiusPt: optNum(args.closingRadiusPt),
      openingRadiusPt: optNum(args.openingRadiusPt),
    })
    const sheet = sheetSummary(geo)
    return {
      fileId: doc.id,
      fileName: doc.name,
      pageNumber,
      drawingNo: sheet.drawingNo,
      title: sheet.title,
      scale: { label: scale.label, mmPerPt: Math.round(scale.mmPerPt * 1000) / 1000, method: scale.method, confidence: scale.confidence },
      scaleApplied,
      ...result,
      polygon: result.polygon.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      source: result.ok
        ? `${sheet.drawingNo ?? doc.name} p${pageNumber}: wall lines inside the plan region bounded by the written ${result.writtenCheck.overallWidthMm ?? '?'} × ${result.writtenCheck.overallDepthMm ?? '?'} mm dimensions, scale ${scale.label}`
        : null,
      usage: result.ok
        ? 'Pass polygon to addMeasurement as points with kind area (ground-slab) or kind length (strip-footing / ground-beam along the perimeter). Cite the source string in notes.'
        : undefined,
    }
  }

  if (name === 'foundationEngine') {
    const { loadEngineState, runEngineForProject, saveEngineState } = await import('./foundation/run')
    const { roundedBoq } = await import('./foundation/engine')
    const projectId = useAppStore.getState().projectId ?? 'draft'
    const state = await loadEngineState(projectId)
    const inputs = { ...state.inputs }
    if (args.storeyCount != null) inputs.storeyCount = Math.max(1, Math.floor(num(args.storeyCount, 1)))
    if (args.foundationType != null && [1, 2, 3].includes(num(args.foundationType))) inputs.foundationType = num(args.foundationType) as 1 | 2 | 3
    if (args.plinthAboveNglMm != null) inputs.plinthAboveNglMm = num(args.plinthAboveNglMm)
    if (args.soilBearingKpa != null) inputs.soilBearingKpa = num(args.soilBearingKpa)
    if (args.lineLoadPerStoreyKnM != null) inputs.lineLoadPerStoreyKnM = num(args.lineLoadPerStoreyKnM)
    try {
      const outcome = await runEngineForProject({ ...state, inputs })
      const r = outcome.result
      await saveEngineState(projectId, { ...state, inputs, result: r })
      const full = str(args.detail) === 'full'
      return {
        plan: { fileId: outcome.plan.fileId, fileName: outcome.plan.fileName, pageNumber: outcome.plan.pageNumber, drawingNo: r.level.drawingNo, title: r.level.name, scale: r.scale.label, scaleMethod: r.scale.method, scaleSamples: r.scale.samples },
        engine: { version: r.version, parameterSet: r.parameterSetVersion, ranAt: r.ranAt },
        inputs,
        band: r.band,
        foundationType: r.foundationType,
        gate: { approved: r.gateOpen, blocked: r.blocked, approvedBy: state.overrides.approvedBy },
        footprint: { areaM2: r.footprint.areaM2, perimeterM: r.footprint.perimeterM, vertices: r.footprint.polygon.length },
        summary: r.summary,
        flags: r.flags.map((f) => ({ code: f.code, severity: f.severity, rule: f.rule, message: f.message, action: f.action })),
        checks: r.checks,
        wallClasses: {
          LB: r.wallClasses.filter((c) => c.class === 'LB').length,
          SHEAR: r.wallClasses.filter((c) => c.class === 'SHEAR').length,
          NLB: r.wallClasses.filter((c) => c.class === 'NLB').length,
          REVIEW: r.wallClasses.filter((c) => c.class === 'REVIEW').length,
        },
        lbLines: r.lbLines.map((l) => ({ id: l.id, axis: l.axis, posMm: l.pos, fromMm: l.a, toMm: l.b, lengthM: Math.round((l.b - l.a) / 10) / 100, external: l.external })),
        decisions: r.decisions.map((d) => ({ zoneId: d.zoneId, case: d.case, direction: d.direction, spanMm: d.spanMm, status: d.status, rules: d.ruleIds, note: d.note })),
        boq: roundedBoq(r).map((row) => ({ code: row.boqCode, section: row.section, description: row.description, unit: row.unit, netQty: row.netQty, wastePct: row.wastePct, grossQty: row.grossQty, rules: row.ruleIds, basis: row.basis, flags: row.flags })),
        rebar: r.rebar.map((x) => ({ element: x.elementType, arrangement: x.role, barDia: x.barDia, kg: Math.round(x.totalKg), kgPerUnit: x.kgPerUnit, perUnit: x.perUnit, rules: x.ruleIds })),
        ...(full
          ? {
              walls: r.walls.map((w) => ({ id: w.id, axis: w.axis, posMm: w.pos, fromMm: w.a, toMm: w.b, thicknessMm: w.thickness, lengthM: Math.round(w.length / 10) / 100, external: w.isExternal, openings: w.openings.map((o) => `${o.type} ${o.width}`), class: r.wallClasses.find((c) => c.wallId === w.id)?.class, classRule: r.wallClasses.find((c) => c.wallId === w.id)?.reasonRuleIds, readAtPagePt: w.source.pagePt })),
              rooms: r.rooms.map((x) => ({ id: x.id, label: x.label, category: x.category, areaM2: x.areaM2 })),
              zones: r.zones.map((z) => ({ id: z.id, LxMm: z.Lx, LyMm: z.Ly, rooms: z.roomIds.length })),
              elements: r.elements.length,
              nodes: r.nodes.length,
            }
          : {}),
        note: r.blocked
          ? 'Stop flags block the BOQ (RG-03 / QA-05). Report the flags and what the human must supply or decide. Do not estimate the blocked quantities yourself.'
          : r.gateOpen
            ? 'Review gate approved: these quantities can go to the estimate. Cite each with its boq_code and rule ids.'
            : 'Quantities are provisional until an engineer approves the review gate in the Engine view. Report them as provisional.',
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'The foundation engine could not run.' }
    }
  }

  if (name === 'getRules') {
    const ids = Array.isArray(args.ids) ? args.ids.map((v) => String(v).toUpperCase()) : []
    const category = str(args.category).trim().toUpperCase()
    const query = str(args.query).trim().toLowerCase()
    let rows = RULES
    if (ids.length) rows = rows.filter((r) => ids.includes(r.id.toUpperCase()))
    if (category) rows = rows.filter((r) => r.category.toUpperCase() === category)
    if (query) {
      const words = query.split(/\s+/).filter(Boolean)
      rows = rows.filter((r) => {
        const hay = `${r.id} ${r.name} ${r.logic} ${r.inputs.join(' ')} ${r.check} ${r.scope}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
    }
    const limit = Math.min(60, Math.max(1, Math.floor(num(args.limit, 25))))
    const qaWanted = ids.filter((id) => /^QA-\d+$/.test(id)).concat(query.split(/\s+/).filter((w) => /^qa-\d+$/.test(w)).map((w) => w.toUpperCase()))
    const qualityTests = QA_TESTS.filter((t) => qaWanted.includes(t.id.toUpperCase()) || (query && !ids.length && !category && t.check.toLowerCase().includes(query)))
    const { ENGINE_RULES, engineRulesFor } = await import('./foundation/ruleText')
    const engineIds = ids.filter((id) => /^(PI|SL|FZ|FD|SA|RG|WC|FT|T1|T2|T3|RB|BQ|VC)(-|$)/.test(id))
    const engineRules = engineIds.length
      ? engineRulesFor(engineIds)
      : category === 'FOUNDATION-ENGINE' || (query && !ids.length && !category)
        ? ENGINE_RULES.filter((r) => !query || `${r.id} ${r.module} ${r.name} ${r.logic}`.toLowerCase().includes(query)).slice(0, limit)
        : []
    return {
      count: rows.length,
      rules: rows.slice(0, limit).map((r) => ({ id: r.id, name: r.name, unit: r.unit, logic: r.logic, inputs: r.inputs, check: r.check, status: r.status, gate: r.gate, category: r.category })),
      truncated: rows.length > limit,
      qualityTests,
      engineRules,
      note: engineRules.length ? 'engineRules are the load-bearing wall & foundation spec v0.1 (category FOUNDATION-ENGINE).' : undefined,
    }
  }

  if (name === 'setPageScale') {
    const doc = findDoc(str(args.fileId) || undefined, str(args.fileName) || undefined)
    if (!doc?.analysis) return { error: 'No matching file. Call listFiles first.' }
    const pageNumber = Math.floor(num(args.pageNumber, 1))
    const s = useAppStore.getState()
    let scale: PageScale | null = null
    const points = parsePoints(args.points)
    const known = optNum(args.knownLengthMm)
    if (args.ratio != null && num(args.ratio) > 0) {
      const mmPerPt = mmPerPtForRatio(num(args.ratio))
      scale = { mmPerPt, label: snapScale(mmPerPt).label, method: 'stated', confidence: 0.8, samples: 1 }
    } else if (args.mmPerPt != null && num(args.mmPerPt) > 0) {
      const mmPerPt = num(args.mmPerPt)
      scale = { mmPerPt, label: snapScale(mmPerPt).label, method: 'manual', confidence: 0.9, samples: 1 }
    } else if (points.length >= 2 && known) {
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
      if (distance < 0.5) return { error: 'The two points are on top of each other.' }
      const mmPerPt = known / distance
      scale = { mmPerPt, label: snapScale(mmPerPt).label, method: 'manual', confidence: 0.9, samples: 1 }
    } else if (args.useCandidate !== false) {
      const { getPageGeometry } = await import('./geometry')
      const geo = await getPageGeometry(doc, pageNumber, s.projectContext.units)
      const index = args.candidateIndex != null ? Math.floor(num(args.candidateIndex)) : 0
      const best = geo.scaleCandidates[index] ?? geo.scaleCandidates[0]
      if (!best) return { error: 'No scale candidate on this page. Give a ratio or two points with a known length.' }
      scale = { mmPerPt: best.mmPerPt, label: best.label, method: best.method, confidence: best.confidence, samples: best.samples }
    }
    if (!scale) return { error: 'Give ratio, mmPerPt, or points plus knownLengthMm.' }
    s.setPageScale(doc.id, pageNumber, scale)
    return { ok: true, fileId: doc.id, fileName: doc.name, pageNumber, scale }
  }

  if (name === 'addMeasurement' || name === 'updateMeasurement') {
    const s = useAppStore.getState()
    const existing = name === 'updateMeasurement' ? s.measurements.find((m) => m.id === str(args.id)) : null
    if (name === 'updateMeasurement' && !existing) return { error: `No measurement ${str(args.id)}` }
    const doc = existing
      ? s.documents.find((d) => d.id === existing.fileId) ?? null
      : findDoc(str(args.fileId) || undefined, str(args.fileName) || undefined)
    if (!doc) return { error: 'No matching file. Call listFiles first.' }
    const elementId = str(args.elementId) || existing?.elementId || ''
    const element = elementById(elementId)
    if (!element) return { error: `Unknown elementId ${elementId}. Use one of: ${ELEMENTS.map((e) => e.id).join(', ')}` }
    const kindRaw = str(args.kind) || existing?.kind || ''
    const kinds: MeasurementKind[] = ['length', 'area', 'rect', 'count', 'dims']
    const points = args.points != null ? parsePoints(args.points) : existing?.points ?? []
    const kind: MeasurementKind = kinds.includes(kindRaw as MeasurementKind)
      ? (kindRaw as MeasurementKind)
      : points.length
        ? element.measure === 'area'
          ? 'area'
          : element.measure === 'count'
            ? 'count'
            : 'length'
        : 'dims'
    if (kind === 'length' && points.length < 2) return { error: 'A length needs at least two points.' }
    if (kind === 'area' && points.length < 3) return { error: 'An area needs at least three points.' }
    if (kind === 'rect' && points.length !== 2) return { error: 'A rect needs two opposite corners.' }
    if (kind === 'count' && points.length < 1 && !optNum(args.count) && !existing?.dims.count) return { error: 'A count needs points or a count.' }
    const dims = { ...(existing?.dims ?? {}) }
    for (const key of ['lengthMm', 'widthMm', 'heightMm', 'depthMm', 'thicknessMm', 'count'] as const) {
      if (args[key] != null) dims[key] = optNum(args[key])
    }
    if (kind === 'dims' && !dims.lengthMm && !dims.count && !dims.widthMm) {
      return { error: 'Stated dims need lengthMm, widthMm, or count.' }
    }
    const floorRaw = args.floor
    const floor = floorRaw == null ? existing?.floor ?? null : Number.isFinite(Number(floorRaw)) ? Number(floorRaw) : null
    const input: Omit<Measurement, 'id' | 'createdAt'> = {
      fileId: doc.id,
      fileName: doc.name,
      pageNumber: existing?.pageNumber ?? Math.floor(num(args.pageNumber, 1)),
      kind,
      points,
      elementId,
      label: str(args.label) || existing?.label || element.label,
      floor,
      dims,
      deductM2: args.deductM2 != null ? Math.max(0, num(args.deductM2)) : existing?.deductM2 ?? 0,
      notes: typeof args.notes === 'string' ? args.notes : existing?.notes ?? '',
      source: 'ai',
    }
    if (existing) {
      s.updateMeasurement(existing.id, input)
      const after = useAppStore.getState().measurements.find((m) => m.id === existing.id)
      return after ? { ok: true, ...measurementSummary(after) } : { error: 'Update failed' }
    }
    const toCanvas = args.toCanvas !== false
    const { measurement, quantities, lines } = s.addMeasurement(input, { toCanvas })
    useAppStore.setState((state) => (state.stageView === 'pricing' ? { stageView: 'takeoff' } : {}))
    return {
      ok: true,
      id: measurement.id,
      quantities,
      lines: lines.map((line) => ({ tag: line.tag, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, notes: line.notes })),
      note: quantities.needsScale
        ? 'This page has no scale, so the drawn length is not in mm yet. Call setPageScale, then the lines update on their own.'
        : toCanvas
          ? 'Lines are on the canvas, unconfirmed.'
          : 'Measurement saved. Nothing was written to the canvas.',
    }
  }

  if (name === 'listMeasurements') {
    const s = useAppStore.getState()
    const fileId = str(args.fileId) || null
    const pageNumber = args.pageNumber != null ? Math.floor(num(args.pageNumber)) : null
    const rows = s.measurements
      .filter((m) => (!fileId || m.fileId === fileId) && (!pageNumber || m.pageNumber === pageNumber))
      .map(measurementSummary)
    return { count: rows.length, measurements: rows }
  }

  if (name === 'removeMeasurement') {
    const id = str(args.id)
    const s = useAppStore.getState()
    if (!s.measurements.some((m) => m.id === id)) return { error: `No measurement ${id}` }
    s.removeMeasurement(id)
    return { ok: true, removed: id }
  }

  return { error: `Unknown tool ${name}` }
}
