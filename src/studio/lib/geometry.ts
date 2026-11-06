import * as pdfjs from 'pdfjs-dist'
import { loadPdf } from './pdfAnalyze'
import { extractGeometryFromPage, type PageGeometry } from './geometryCore'
import type { ClientDocument, ProjectUnits } from '../types'

type PdfDoc = Awaited<ReturnType<typeof loadPdf>>

const docCache = new Map<string, { size: number; pdf: Promise<PdfDoc> }>()
const geoCache = new Map<string, Promise<PageGeometry>>()

export function geometryKey(fileId: string, pageNumber: number) {
  return `${fileId}:${pageNumber}`
}

/** One parsed PDF per file, reused by the measure workspace and the tools. */
export function openDocument(doc: ClientDocument): Promise<PdfDoc> {
  const cached = docCache.get(doc.id)
  if (cached && cached.size === doc.file.size) return cached.pdf
  if (!doc.file || doc.file.size === 0) return Promise.reject(new Error(`The PDF for ${doc.name} is not stored. Add it again from Input.`))
  const pdf = loadPdf(doc.file)
  docCache.set(doc.id, { size: doc.file.size, pdf })
  pdf.catch(() => docCache.delete(doc.id))
  return pdf
}

export function forgetDocument(fileId: string) {
  docCache.delete(fileId)
  for (const key of [...geoCache.keys()]) {
    if (key.startsWith(`${fileId}:`)) geoCache.delete(key)
  }
}

/** Vectors, text, dimensions, and scale candidates for one sheet. Cached for the session. */
export function getPageGeometry(doc: ClientDocument, pageNumber: number, units: ProjectUnits): Promise<PageGeometry> {
  const key = `${geometryKey(doc.id, pageNumber)}:${units}`
  const cached = geoCache.get(key)
  if (cached) return cached
  const job = openDocument(doc)
    .then((pdf) => pdf.getPage(pageNumber))
    .then((page) => extractGeometryFromPage(page, pdfjs.OPS, { units }))
  geoCache.set(key, job)
  job.catch(() => geoCache.delete(key))
  return job
}
