import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { isSymbolToken, placedMarks, proposeSheet } from './sheetText'
import type { FixtureRow, LegendEntry, MepDrawing, SheetMark } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
const standardFontDataUrl = '/pdf-standard-fonts/'

export interface SheetRead {
  drawings: MepDrawing[]
  legend: LegendEntry[]
  fixtures: FixtureRow[]
  marks: SheetMark[]
  sourceText: string
  note: string | null
}

export async function placeSheetMarks(file: { id: string; name: string; file: Blob }, codes: string[], pageNumber = 1): Promise<{ pageWidth: number; pageHeight: number; marks: SheetMark[] }> {
  if (!file.file || file.file.size === 0) throw new Error(`The PDF for ${file.name} is not stored. Add it again from Input.`)
  const data = new Uint8Array(await file.file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, standardFontDataUrl }).promise
  const located = await readPage(doc, pageNumber)
  return {
    pageWidth: located.pageWidth,
    pageHeight: located.pageHeight,
    marks: placedMarks(file.id, located.items, new Set(codes)),
  }
}

export async function readElectricalSheets(files: Array<{ id: string; name: string; file: Blob }>): Promise<SheetRead> {
  const drawings: MepDrawing[] = []
  const fixtures: FixtureRow[] = []
  const legend: LegendEntry[] = []
  const marks: SheetMark[] = []
  const texts: string[] = []
  let powerNeedsReview = false
  const stored = files.filter((file) => file.file && file.file.size > 0)
  if (!stored.length) throw new Error('No PDF with stored bytes. Add the drawing again from Input.')

  for (const file of stored) {
    const data = new Uint8Array(await file.file.arrayBuffer())
    const doc = await pdfjs.getDocument({ data, standardFontDataUrl }).promise
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const located = await readPage(doc, pageNumber)
      texts.push(located.text)
      const pageId = `${file.id}:p${pageNumber}`
      const proposed = proposeSheet({ id: pageId, name: file.name }, located.text, located.tokens)
      if (proposed.drawing.module === 'unknown') continue
      drawings.push({ ...proposed.drawing, pageNumber, pageWidth: located.pageWidth, pageHeight: located.pageHeight })
      legend.push(...proposed.legend)
      fixtures.push(...proposed.fixtures)
      marks.push(...placedMarks(pageId, located.items, new Set(proposed.fixtures.map((row) => row.code))))
      if (proposed.drawing.module === 'wall') powerNeedsReview = true
    }
  }

  return {
    drawings,
    legend,
    fixtures,
    marks,
    sourceText: texts.join('\n'),
    note: powerNeedsReview ? 'Socket and isolator symbols on the power sheet are drawn, not written. The repeated text tags are listed; confirm the rest before approval.' : null,
  }
}

async function readPage(doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>, pageNumber: number) {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const tokens: string[] = []
  const items: Array<{ text: string; x: number; y: number }> = []
  for (const item of content.items) {
    if (!('str' in item)) continue
    tokens.push(item.str)
    if (!isSymbolToken(item.str.trim().toUpperCase())) continue
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    items.push({ text: item.str, x: x + item.width / 2, y: y - item.height / 2 })
  }
  return { pageWidth: viewport.width, pageHeight: viewport.height, text: tokens.join(' '), tokens, items }
}
