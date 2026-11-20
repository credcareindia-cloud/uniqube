import { CANVAS_TAB } from '../types'
import type { Commercials, DocumentAnalysis, EstimateRevision, Measurement, PageAnalysis, PageScale, ProjectContext } from '../types'
import { buildSeedPriceSheet } from './priceSheet'
import { ELEMENTS, defaultCommercials, emptyProjectContext, withElementRates } from './elements'
import { useAppStore } from '../store'
import { apiFetch, apiJson } from './api'
import {
  emptyChat,
  type ProjectIndexItem,
  type ProjectRecord,
  type SnapshotDocument,
  type StoredChat,
  type WorkspaceSnapshot,
} from './projectRecord'

const DB_NAME = 'estimation-projects'
const DB_VERSION = 1
const PROJECTS = 'projects'
const FILES = 'files'

type StoredProject = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  body: string
}

let dbPromise: Promise<IDBDatabase> | null = null
let activeId: string | null = null
let activeCreatedAt = ''
let activeName = ''
let chatBuffer: StoredChat = emptyChat()
let writeDepth = 0
let timer: number | null = null
let chain: Promise<void> = Promise.resolve()
const savedFileSizes = new Map<string, number>()
const persistListeners = new Set<(error: string | null) => void>()
let lastError: string | null = null

function notify(error: string | null) {
  lastError = error
  persistListeners.forEach((fn) => fn(error))
}

export function onPersistError(fn: (error: string | null) => void) {
  persistListeners.add(fn)
  return () => persistListeners.delete(fn)
}

export function persistError() {
  return lastError
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'key' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close()
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('Could not open project storage'))
    }
  })
  return dbPromise
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Project storage request failed'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Project storage transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Project storage transaction aborted'))
  })
}

let indexCache: ProjectIndexItem[] = []

export function readIndex(): ProjectIndexItem[] {
  return indexCache
}

function writeIndex(items: ProjectIndexItem[]) {
  indexCache = [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return indexCache
}

function indexItem(record: ProjectRecord): ProjectIndexItem {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lineCount: record.lines.length,
    fileCount: record.documents.length,
  }
}

function upsertIndex(record: ProjectRecord) {
  const items = readIndex().filter((item) => item.id !== record.id)
  items.push(indexItem(record))
  writeIndex(items)
}

function fileKey(projectId: string, docId: string) {
  return `${projectId}:${docId}`
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function stripPageImages(page: PageAnalysis): PageAnalysis {
  const next = { ...page }
  delete next.imageDataUrl
  delete next.thumbnail
  return next
}

function stripAnalysisImages(analysis: DocumentAnalysis): DocumentAnalysis {
  return { ...analysis, pages: analysis.pages.map(stripPageImages) }
}

function bodyOf(record: ProjectRecord, documents: SnapshotDocument[]) {
  const { file: _file, ...restDoc } = { file: null as Blob | null, id: '', name: '', status: 'ready' as const }
  void _file
  void restDoc
  return cloneJson({
    projectSetup: record.projectSetup,
    drawingScale: record.drawingScale,
    lines: record.lines,
    tabs: record.tabs,
    activeTabId: record.activeTabId,
    stageView: record.stageView,
    priceSheet: record.priceSheet,
    status: record.status,
    statusMessage: record.statusMessage,
    activeDocumentId: record.activeDocumentId,
    projectContext: record.projectContext,
    measurements: record.measurements,
    pageScales: record.pageScales,
    measureTarget: record.measureTarget,
    revisions: record.revisions,
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      sourceName: doc.sourceName || doc.name,
      category: doc.category ?? 'drawing',
      status: doc.status,
      error: doc.error,
      analysis: doc.analysis,
      hasFile: Boolean(doc.file && doc.file.size > 0),
    })),
    chat: normalizeChat(record.chat),
  })
}

function normalizeContext(value: unknown): ProjectContext {
  const base = emptyProjectContext()
  if (!value || typeof value !== 'object') return base
  const row = value as Partial<ProjectContext>
  const known = new Set(ELEMENTS.map((element) => element.id))
  const floors = Array.isArray(row.floors)
    ? row.floors
        .filter((floor) => floor && typeof floor === 'object' && Number.isFinite(Number(floor.level)))
        .map((floor) => ({
          level: Number(floor.level),
          name: typeof floor.name === 'string' ? floor.name : `Level ${floor.level}`,
          heightMm: Number.isFinite(Number(floor.heightMm)) && Number(floor.heightMm) > 0 ? Number(floor.heightMm) : 3000,
          ...(Number.isFinite(Number(floor.areaM2)) && Number(floor.areaM2) > 0 ? { areaM2: Number(floor.areaM2) } : {}),
        }))
    : []
  const defaults = defaultCommercials()
  const commercials: Commercials = { ...defaults }
  if (row.commercials && typeof row.commercials === 'object') {
    for (const key of Object.keys(defaults) as Array<keyof Commercials>) {
      const value = (row.commercials as unknown as Record<string, unknown>)[key]
      if (typeof defaults[key] === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        ;(commercials as unknown as Record<string, number>)[key] = value
      } else if (typeof defaults[key] === 'boolean' && typeof value === 'boolean') {
        ;(commercials as unknown as Record<string, boolean>)[key] = value
      } else if (typeof defaults[key] === 'string' && typeof value === 'string') {
        ;(commercials as unknown as Record<string, string>)[key] = value
      }
    }
  }
  return {
    buildingType: typeof row.buildingType === 'string' ? row.buildingType : '',
    location: typeof row.location === 'string' ? row.location : '',
    description: typeof row.description === 'string' ? row.description : '',
    units: row.units === 'm' || row.units === 'ft' ? row.units : 'mm',
    floors: floors.length ? floors : base.floors,
    elements: Array.isArray(row.elements) ? row.elements.filter((id): id is string => typeof id === 'string' && known.has(id)) : base.elements,
    buildUps: row.buildUps && typeof row.buildUps === 'object' ? row.buildUps : {},
    scopeNotes: typeof row.scopeNotes === 'string' ? row.scopeNotes : '',
    client: typeof row.client === 'string' ? row.client : '',
    consultant: typeof row.consultant === 'string' ? row.consultant : '',
    projectNumber: typeof row.projectNumber === 'string' ? row.projectNumber : '',
    commercials,
  }
}

function normalizeMeasurements(value: unknown): Measurement[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Measurement => {
    if (!item || typeof item !== 'object') return false
    const row = item as Partial<Measurement>
    return typeof row.id === 'string' && typeof row.fileId === 'string' && typeof row.elementId === 'string' && Array.isArray(row.points)
  }).map((row) => ({
    ...row,
    dims: row.dims && typeof row.dims === 'object' ? row.dims : {},
    deductM2: Number.isFinite(row.deductM2) ? row.deductM2 : 0,
    notes: typeof row.notes === 'string' ? row.notes : '',
    label: typeof row.label === 'string' ? row.label : '',
    floor: row.floor == null ? null : Number(row.floor),
  }))
}

function normalizeScales(value: unknown): Record<string, PageScale> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, PageScale> = {}
  for (const [key, scale] of Object.entries(value as Record<string, Partial<PageScale>>)) {
    if (!scale || !Number.isFinite(scale.mmPerPt) || !(scale.mmPerPt! > 0)) continue
    out[key] = {
      mmPerPt: scale.mmPerPt!,
      label: typeof scale.label === 'string' ? scale.label : '',
      method: scale.method === 'auto' || scale.method === 'stated' ? scale.method : 'manual',
      confidence: Number.isFinite(scale.confidence) ? scale.confidence! : 1,
      samples: Number.isFinite(scale.samples) ? scale.samples! : 0,
    }
  }
  return out
}

async function putStored(record: ProjectRecord, documents: SnapshotDocument[]) {
  const fileIds = documents.filter((doc) => doc.file && doc.file.size > 0).map((doc) => doc.id)
  const saved = await apiJson<{ ok: boolean; missingFileIds?: string[] }>(`/api/projects/${record.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      body: JSON.parse(JSON.stringify(bodyOf(record, documents))),
      fileIds,
    }),
  })
  for (const id of saved.missingFileIds ?? []) savedFileSizes.delete(fileKey(record.id, id))
}

async function writeFiles(projectId: string, documents: SnapshotDocument[]) {
  for (const doc of documents) {
    if (!doc.file || doc.file.size === 0) continue
    const key = fileKey(projectId, doc.id)
    if (savedFileSizes.get(key) === doc.file.size) continue
    const res = await apiFetch(`/api/projects/${projectId}/files/${doc.id}`, {
      method: 'PUT',
      headers: { 'content-type': doc.file.type || 'application/pdf' },
      body: doc.file,
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error || 'Could not store the drawing')
    }
    savedFileSizes.set(key, doc.file.size)
  }
}

async function persistRecord(record: ProjectRecord) {
  try {
    await putStored(record, record.documents)
    await writeFiles(record.id, record.documents)
  } catch {
    const slimDocs = record.documents.map((doc) => ({
      ...doc,
      analysis: doc.analysis ? stripAnalysisImages(doc.analysis) : null,
    }))
    await putStored(record, slimDocs)
    await writeFiles(record.id, slimDocs)
  }
  upsertIndex(record)
}

async function migrateIndexedDb() {
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  const tx = db.transaction(PROJECTS, 'readonly')
  const rows = await requestToPromise(tx.objectStore(PROJECTS).getAll() as IDBRequest<StoredProject[]>)
  await txDone(tx)
  for (const row of rows) {
    const record = await loadFromIndexedDb(row.id)
    if (record) await persistRecord(record)
  }
  db.close()
  dbPromise = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

export async function refreshIndex(): Promise<ProjectIndexItem[]> {
  let items = await apiJson<ProjectIndexItem[]>('/api/projects')
  if (!items.length) {
    await migrateIndexedDb()
    items = await apiJson<ProjectIndexItem[]>('/api/projects')
  }
  return writeIndex(items)
}

function withoutDrawingImages(messages: unknown[]): unknown[] {
  try {
    return JSON.parse(
      JSON.stringify(messages, (key, value) => {
        if ((key === 'image' || key === 'pdf') && typeof value === 'string' && value.startsWith('data:')) return undefined
        return value
      }),
    ) as unknown[]
  } catch {
    return messages
  }
}

function normalizeChat(chat: StoredChat | undefined): StoredChat {
  const base = emptyChat()
  if (!chat) return base
  const worked: Record<string, number> = {}
  if (chat.worked && typeof chat.worked === 'object') {
    for (const [id, ms] of Object.entries(chat.worked)) {
      if (typeof ms === 'number' && Number.isFinite(ms)) worked[id] = ms
    }
  }
  return {
    messages: Array.isArray(chat.messages) ? withoutDrawingImages(chat.messages) : [],
    worked,
    mode: chat.mode === 'ask' ? 'ask' : 'execute',
    model: typeof chat.model === 'string' && chat.model ? chat.model : base.model,
  }
}

function asBlob(value: unknown): Blob | null {
  if (value instanceof Blob && value.size > 0) return value
  return null
}

async function loadFromIndexedDb(id: string): Promise<ProjectRecord | null> {
  const db = await openDb()
  const tx = db.transaction([PROJECTS, FILES], 'readonly')
  const row = await requestToPromise(tx.objectStore(PROJECTS).get(id) as IDBRequest<StoredProject | undefined>)
  if (!row) {
    await txDone(tx)
    return null
  }
  const body = JSON.parse(row.body) as WorkspaceSnapshot & {
    chat?: StoredChat
    documents: Array<SnapshotDocument & { hasFile?: boolean }>
  }
  const documents: SnapshotDocument[] = []
  for (const doc of body.documents ?? []) {
    let file: Blob | null = null
    if (doc.hasFile) {
      const stored = await requestToPromise(
        tx.objectStore(FILES).get(fileKey(id, doc.id)) as IDBRequest<{ key: string; blob: Blob } | undefined>,
      )
      file = asBlob(stored?.blob)
    }
    documents.push({
      id: doc.id,
      name: doc.name,
      sourceName: doc.sourceName || doc.name,
      category: doc.category,
      status: doc.status,
      error: doc.error,
      analysis: doc.analysis ?? null,
      file,
    })
  }
  await txDone(tx)
  return recordFrom(row.id, row.name, row.createdAt, row.updatedAt, body, documents)
}

type StoredBody = WorkspaceSnapshot & { chat?: StoredChat }

function recordFrom(id: string, name: string, createdAt: string, updatedAt: string, body: StoredBody, documents: SnapshotDocument[]): ProjectRecord {
  return {
    id,
    name,
    createdAt,
    updatedAt,
    projectSetup: body.projectSetup,
    drawingScale: body.drawingScale ?? '',
    lines: Array.isArray(body.lines) ? body.lines : [],
    tabs: Array.isArray(body.tabs) && body.tabs.length ? body.tabs : [CANVAS_TAB],
    activeTabId: body.activeTabId || 'canvas',
    priceSheet: withElementRates(Array.isArray(body.priceSheet) ? body.priceSheet : buildSeedPriceSheet()),
    stageView:
      body.stageView === 'pricing' || body.stageView === 'measure' || body.stageView === 'summary' ? body.stageView : 'takeoff',
    status: body.status || 'idle',
    statusMessage: body.statusMessage || 'Drop a client drawing PDF to begin',
    activeDocumentId: body.activeDocumentId ?? null,
    documents,
    projectContext: normalizeContext(body.projectContext),
    measurements: normalizeMeasurements(body.measurements),
    pageScales: normalizeScales(body.pageScales),
    measureTarget:
      body.measureTarget && typeof body.measureTarget.fileId === 'string' && Number.isFinite(body.measureTarget.pageNumber)
        ? { fileId: body.measureTarget.fileId, pageNumber: body.measureTarget.pageNumber }
        : null,
    revisions: normalizeRevisions(body.revisions),
    chat: normalizeChat(body.chat),
  }
}

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  let stored: { id: string; name: string; createdAt: string; updatedAt: string; body: StoredBody; files: Array<{ docId: string; size: number }> }
  try {
    stored = await apiJson(`/api/projects/${id}`)
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return null
    throw error
  }
  const documents: SnapshotDocument[] = []
  for (const doc of stored.body.documents ?? []) {
    const meta = stored.files.find((file) => file.docId === doc.id)
    let file: Blob | null = null
    if (meta) {
      const res = await apiFetch(`/api/projects/${id}/files/${doc.id}`)
      if (res.ok) {
        file = await res.blob()
        savedFileSizes.set(fileKey(id, doc.id), file.size)
      }
    }
    documents.push({
      id: doc.id,
      name: doc.name,
      sourceName: doc.sourceName || doc.name,
      category: doc.category,
      status: doc.status,
      error: doc.error,
      analysis: doc.analysis ?? null,
      file,
    })
  }
  return recordFrom(stored.id, stored.name, stored.createdAt, stored.updatedAt, stored.body, documents)
}

function normalizeRevisions(value: unknown): EstimateRevision[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is EstimateRevision => Boolean(item) && typeof item === 'object' && typeof (item as EstimateRevision).id === 'string')
    .map((rev) => ({
      id: rev.id,
      label: typeof rev.label === 'string' ? rev.label : 'R?',
      savedAt: typeof rev.savedAt === 'string' ? rev.savedAt : new Date().toISOString(),
      note: typeof rev.note === 'string' ? rev.note : '',
      gfaM2: Number.isFinite(rev.gfaM2) ? rev.gfaM2 : 0,
      directAed: Number.isFinite(rev.directAed) ? rev.directAed : 0,
      sellAed: Number.isFinite(rev.sellAed) ? rev.sellAed : 0,
      systems: rev.systems && typeof rev.systems === 'object' ? rev.systems : {},
      lineCount: Number.isFinite(rev.lineCount) ? rev.lineCount : 0,
    }))
}

export async function ensureProject(id: string, name: string): Promise<ProjectRecord> {
  const existing = await loadProject(id)
  if (existing) return existing
  const trimmed = name.trim() || 'Estimate'
  const now = new Date().toISOString()
  const record: ProjectRecord = {
    id,
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    projectSetup: {
      projectName: trimmed,
      floors: 1,
      disciplines: [],
      floorComponents: {},
      floorMaterials: {},
      completed: false,
    },
    drawingScale: '',
    lines: [],
    tabs: [CANVAS_TAB],
    activeTabId: 'canvas',
    stageView: 'takeoff',
    priceSheet: withElementRates(buildSeedPriceSheet()),
    status: 'idle',
    statusMessage: 'Drop a client drawing PDF to begin',
    activeDocumentId: null,
    documents: [],
    projectContext: emptyProjectContext(),
    measurements: [],
    pageScales: {},
    measureTarget: null,
    revisions: [],
    chat: emptyChat(),
  }
  await persistRecord(record)
  notify(null)
  return record
}

export async function createProject(name: string): Promise<ProjectRecord> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Project name is required')
  const now = new Date().toISOString()
  const record: ProjectRecord = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    projectSetup: {
      projectName: trimmed,
      floors: 1,
      disciplines: [],
      floorComponents: {},
      floorMaterials: {},
      completed: false,
    },
    drawingScale: '',
    lines: [],
    tabs: [CANVAS_TAB],
    activeTabId: 'canvas',
    stageView: 'takeoff',
    priceSheet: withElementRates(buildSeedPriceSheet()),
    status: 'idle',
    statusMessage: 'Drop a client drawing PDF to begin',
    activeDocumentId: null,
    documents: [],
    projectContext: emptyProjectContext(),
    measurements: [],
    pageScales: {},
    measureTarget: null,
    revisions: [],
    chat: emptyChat(),
  }
  await persistRecord(record)
  notify(null)
  return record
}

export async function deleteProject(id: string) {
  await apiJson(`/api/projects/${id}`, { method: 'DELETE' })
  for (const key of [...savedFileSizes.keys()]) {
    if (key.startsWith(`${id}:`)) savedFileSizes.delete(key)
  }
  writeIndex(readIndex().filter((item) => item.id !== id))
  if (activeId === id) endSession()
}

export function beginSession(record: ProjectRecord) {
  activeId = record.id
  activeCreatedAt = record.createdAt
  activeName = record.name
  chatBuffer = normalizeChat(record.chat)
}

export function endSession() {
  activeId = null
  activeCreatedAt = ''
  activeName = ''
  chatBuffer = emptyChat()
}

export function getChatBuffer(): StoredChat {
  return chatBuffer
}

export function updateChatBuffer(chat: StoredChat) {
  chatBuffer = normalizeChat(chat)
}

export function suspendWrites() {
  writeDepth += 1
}

export function resumeWrites() {
  writeDepth = Math.max(0, writeDepth - 1)
}

function captureRecord(): ProjectRecord | null {
  if (!activeId) return null
  const s = useAppStore.getState()
  const active =
    s.documents.find((doc) => doc.analysis && doc.analysis === s.analysis) ??
    s.documents.find((doc) => doc.file === s.file) ??
    null
  const name = s.projectSetup.projectName.trim() || activeName || 'Untitled project'
  const documents: SnapshotDocument[] = s.documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    sourceName: doc.sourceName || doc.file?.name || doc.name,
    category: doc.category,
    status: doc.status,
    error: doc.error,
    analysis: doc.analysis,
    file: doc.file && doc.file.size > 0 ? doc.file : null,
  }))
  return {
    id: activeId,
    name,
    createdAt: activeCreatedAt,
    updatedAt: new Date().toISOString(),
    projectSetup: s.projectSetup,
    drawingScale: s.drawingScale,
    lines: s.lines,
    tabs: s.tabs,
    activeTabId: s.activeTabId,
    stageView: s.stageView,
    priceSheet: s.priceSheet,
    status: s.status,
    statusMessage: s.statusMessage,
    activeDocumentId: active?.id ?? null,
    documents,
    projectContext: s.projectContext,
    measurements: s.measurements,
    pageScales: s.pageScales,
    measureTarget: s.measureTarget,
    revisions: s.revisions,
    chat: chatBuffer,
  }
}

async function writeActive() {
  if (writeDepth > 0 || !activeId) return
  const record = captureRecord()
  if (!record || record.id !== activeId) return
  try {
    await persistRecord(record)
    activeName = record.name
    notify(null)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Could not save this project')
  }
}

export function schedulePersist() {
  if (writeDepth > 0 || !activeId) return
  if (timer != null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    void flushPersist()
  }, 400)
}

export function flushPersist() {
  if (timer != null) {
    window.clearTimeout(timer)
    timer = null
  }
  if (writeDepth > 0 || !activeId) return chain
  const run = chain.then(() => writeActive())
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

const CLIENTS_KEY = 'uq-known-clients'

function readRememberedClients(): string[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
  } catch {
    return []
  }
}

/** Remember a client name for later suggestions in Settings. */
export function rememberClient(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const next = [trimmed, ...readRememberedClients().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 60)
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

async function scanIndexedDbClients(): Promise<string[]> {
  try {
    const db = await openDb()
    const tx = db.transaction(PROJECTS, 'readonly')
    const rows = await requestToPromise(tx.objectStore(PROJECTS).getAll())
    await txDone(tx)
    const names: string[] = []
    for (const row of rows as StoredProject[]) {
      try {
        const body = JSON.parse(row.body) as { projectContext?: { client?: unknown } }
        const client = typeof body.projectContext?.client === 'string' ? body.projectContext.client.trim() : ''
        if (client) names.push(client)
      } catch {
        /* skip bad rows */
      }
    }
    return names
  } catch {
    return []
  }
}

/** Unique client names from this device's projects plus remembered entries. */
export async function listKnownClients(): Promise<string[]> {
  const current = useAppStore.getState().projectContext.client?.trim() || ''
  const [fromIdb, remembered] = await Promise.all([scanIndexedDbClients(), Promise.resolve(readRememberedClients())])
  const seen = new Map<string, string>()
  for (const name of [...fromIdb, ...remembered, current]) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) seen.set(key, trimmed)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
