import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { DocumentAnalysis, PageAnalysis, PageQuality } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const standardFontDataUrl = '/pdf-standard-fonts/'

function openPdfData(data: Uint8Array) {
  return pdfjs.getDocument({ data, standardFontDataUrl }).promise
}

const RENDER_SCALE = 1.35

function varianceOfLaplacian(data: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = (y * w + x) * 4
      const c = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const up = (y - 1) * w + x
      const dn = (y + 1) * w + x
      const lf = y * w + (x - 1)
      const rt = y * w + (x + 1)
      const u = 0.299 * data[up * 4] + 0.587 * data[up * 4 + 1] + 0.114 * data[up * 4 + 2]
      const d = 0.299 * data[dn * 4] + 0.587 * data[dn * 4 + 1] + 0.114 * data[dn * 4 + 2]
      const l = 0.299 * data[lf * 4] + 0.587 * data[lf * 4 + 1] + 0.114 * data[lf * 4 + 2]
      const r = 0.299 * data[rt * 4] + 0.587 * data[rt * 4 + 1] + 0.114 * data[rt * 4 + 2]
      const lap = Math.abs(4 * c - u - d - l - r)
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (!n) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

function contrastScore(data: Uint8ClampedArray): number {
  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 16) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (g < min) min = g
    if (g > max) max = g
  }
  return max - min
}

function classifyPage(
  textChars: number,
  imageCoverage: number,
  sharpness: number,
  contrast: number,
): { quality: PageQuality; route: PageAnalysis['route'] } {
  const hasSelectableText = textChars >= 80
  const looksLikeScan = !hasSelectableText && imageCoverage > 0.45
  const isPoor =
    (looksLikeScan || imageCoverage > 0.7) &&
    (sharpness < 18 || contrast < 55)

  if (isPoor) return { quality: 'poor', route: 'ai-vision' }
  if (looksLikeScan || (!hasSelectableText && imageCoverage > 0.25)) {
    return { quality: 'scanned', route: 'ocr-cv' }
  }
  return { quality: 'normal', route: 'direct' }
}

function overallFromPages(pages: PageAnalysis[]): PageQuality {
  if (pages.some((p) => p.quality === 'poor')) return 'poor'
  if (pages.some((p) => p.quality === 'scanned')) return 'scanned'
  return 'normal'
}

export async function analyzePdf(
  file: File,
  onProgress?: (msg: string, pct: number) => void,
): Promise<DocumentAnalysis> {
  const data = await file.arrayBuffer()
  const pdf = await openPdfData(new Uint8Array(data))
  const pages: PageAnalysis[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Analyzing page ${i} of ${pdf.numPages}…`, (i - 1) / pdf.numPages)

    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((it) => ('str' in it ? String(it.str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const textChars = pageText.replace(/\s+/g, '').length

    const ops = await page.getOperatorList()
    const imageOpIds = new Set([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintInlineImageXObjectGroup,
      pdfjs.OPS.paintImageMaskXObject,
      pdfjs.OPS.paintImageMaskXObjectGroup,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintImageMaskXObjectRepeat,
    ])
    let imageOps = 0
    for (const fn of ops.fnArray) {
      if (imageOpIds.has(fn)) imageOps++
    }

    const viewport = page.getViewport({ scale: RENDER_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const sharpness = varianceOfLaplacian(imageData.data, canvas.width, canvas.height)
    const contrast = contrastScore(imageData.data)
    const imageCoverage = Math.min(1, imageOps / 8 + (textChars < 40 ? 0.55 : 0))

    const { quality, route } = classifyPage(textChars, imageCoverage, sharpness, contrast)

    const thumbCanvas = document.createElement('canvas')
    const thumbScale = 160 / canvas.width
    thumbCanvas.width = 160
    thumbCanvas.height = Math.max(1, Math.floor(canvas.height * thumbScale))
    thumbCanvas.getContext('2d')!.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)

    pages.push({
      pageNumber: i,
      quality,
      textChars,
      imageCoverage,
      sharpness: Math.round(sharpness * 10) / 10,
      contrast: Math.round(contrast),
      thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.72),
      // Always keep a stage preview; poor/scanned keep higher quality for OCR/AI
      imageDataUrl: canvas.toDataURL(
        'image/jpeg',
        quality === 'poor' || quality === 'scanned' ? 0.85 : 0.72,
      ),
      /** Selectable PDF text — used for AI setup prefill */
      ocrText: pageText || undefined,
      route,
    })
  }

  onProgress?.('Analysis complete', 1)

  return {
    fileName: file.name,
    pageCount: pdf.numPages,
    overall: overallFromPages(pages),
    pages,
    poorCount: pages.filter((p) => p.quality === 'poor').length,
    scannedCount: pages.filter((p) => p.quality === 'scanned').length,
    normalCount: pages.filter((p) => p.quality === 'normal').length,
    analyzedAt: new Date().toISOString(),
  }
}

export function loadPdf(file: File) {
  return file.arrayBuffer().then((buffer) => openPdfData(new Uint8Array(buffer)))
}

type PdfDoc = Awaited<ReturnType<typeof loadPdf>>

/** Draw one page for the file viewer. `targetWidth` is the bitmap width in pixels. */
export async function renderPdfPage(pdf: PdfDoc, pageNumber: number, targetWidth: number): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const unscaled = page.getViewport({ scale: 1 })
  const scale = targetWidth / Math.max(1, unscaled.width)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not draw this page')
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', targetWidth > 400 ? 0.86 : 0.72)
}

/** Heuristic opening extraction from selectable / OCR text */
export function extractOpeningsFromText(text: string, pageRef?: number) {
  const lines: Array<{
    tag: string
    widthMm: number
    heightMm: number
    type: string
    quantity: number
    pageRef?: number
  }> = []

  const ftIn = /(\d+)\s*['′]\s*-?\s*(\d+)?\s*(?:["″])?/g
  const dims = [...text.matchAll(/(\d{3,5}(?:\.\d+)?)\s*[x×]\s*(\d{3,5}(?:\.\d+)?)\s*(mm)?/gi)]
  const tags = [...text.matchAll(/\b(W\d{1,3}|D\d{1,3}|CW\d{0,2})\b/gi)]

  for (let i = 0; i < Math.min(tags.length, 40); i++) {
    const tag = tags[i][1].toUpperCase()
    let widthMm = 0
    let heightMm = 0
    if (dims[i]) {
      widthMm = Number(dims[i][1])
      heightMm = Number(dims[i][2])
      if (!dims[i][3] && widthMm < 40) {
        // likely feet-ish — skip
        widthMm = 0
        heightMm = 0
      }
    }
    const typeHint = /sliding|door|window|curtain|fixed|hung/i.exec(text)?.[0] ?? 'Opening'
    lines.push({
      tag,
      widthMm: Math.round(widthMm * 100) / 100,
      heightMm: Math.round(heightMm * 100) / 100,
      type: typeHint,
      quantity: 1,
      pageRef,
    })
  }

  // imperial callouts like 9'-0" x 10'-0"
  const imperial = [
    ...text.matchAll(
      /(\d+)\s*['′]\s*-?\s*(\d+)?\s*["″]?\s*[x×]\s*(\d+)\s*['′]\s*-?\s*(\d+)?\s*["″]?/gi,
    ),
  ]
  imperial.slice(0, 20).forEach((m, idx) => {
    const w = (Number(m[1]) + Number(m[2] || 0) / 12) * 304.8
    const h = (Number(m[3]) + Number(m[4] || 0) / 12) * 304.8
    lines.push({
      tag: `AUTO-${idx + 1}`,
      widthMm: Math.round(w * 10) / 10,
      heightMm: Math.round(h * 10) / 10,
      type: 'Opening',
      quantity: 1,
      pageRef,
    })
  })

  void ftIn
  return lines
}

export async function extractPageText(file: File, pageNumber: number): Promise<string> {
  const data = await file.arrayBuffer()
  const pdf = await openPdfData(new Uint8Array(data))
  const page = await pdf.getPage(pageNumber)
  const textContent = await page.getTextContent()
  return textContent.items.map((it) => ('str' in it ? String(it.str) : '')).join(' ')
}
