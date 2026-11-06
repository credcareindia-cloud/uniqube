import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { loadPdf, renderPdfPage } from '../lib/pdfAnalyze'
import { useAppStore } from '../store'
import type { ClientDocument } from '../types'

export function FilePagesDialog({
  doc,
  onClose,
}: {
  doc: ClientDocument
  onClose: () => void
}) {
  const setChatPage = useAppStore((s) => s.setChatPage)
  const setMeasureTarget = useAppStore((s) => s.setMeasureTarget)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(doc.analysis?.pageCount ?? doc.analysis?.pages.length ?? 0)
  const [full, setFull] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdf>> | null>(null)
  const tokenRef = useRef(0)
  const activeThumb = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const seeded: Record<number, string> = {}
    for (const page of doc.analysis?.pages ?? []) {
      if (page.thumbnail) seeded[page.pageNumber] = page.thumbnail
    }
    setThumbs(seeded)
    setPageNumber(1)
    setError(null)

    async function open() {
      if (!doc.file || doc.file.size === 0) {
        setError('This drawing file is not stored. Add the PDF again.')
        return
      }
      const pdf = await loadPdf(doc.file)
      if (cancelled) {
        await pdf.cleanup()
        return
      }
      pdfRef.current = pdf
      setPageCount(pdf.numPages)
      const token = ++tokenRef.current
      const stored = doc.analysis?.pages.find((page) => page.pageNumber === 1)?.imageDataUrl
      const first = stored ?? (await renderPdfPage(pdf, 1, 1400))
      if (!cancelled && token === tokenRef.current) setFull(first)
      for (let n = 1; n <= pdf.numPages; n++) {
        if (cancelled) return
        if (seeded[n]) continue
        const url = await renderPdfPage(pdf, n, 160)
        if (cancelled) return
        setThumbs((current) => ({ ...current, [n]: url }))
      }
    }

    void open().catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not open this PDF')
    })

    return () => {
      cancelled = true
      tokenRef.current += 1
      const pdf = pdfRef.current
      pdfRef.current = null
      void pdf?.cleanup()
    }
  }, [doc])

  useEffect(() => {
    activeThumb.current?.scrollIntoView({ block: 'nearest' })
  }, [pageNumber])

  async function choose(next: number) {
    setPageNumber(next)
    const stored = doc.analysis?.pages.find((page) => page.pageNumber === next)?.imageDataUrl
    if (stored) {
      setFull(stored)
      setDrawing(false)
      return
    }
    const pdf = pdfRef.current
    if (!pdf) return
    const token = ++tokenRef.current
    setDrawing(true)
    setFull(null)
    try {
      const url = await renderPdfPage(pdf, next, 1400)
      if (token === tokenRef.current) setFull(url)
    } catch (reason) {
      if (token === tokenRef.current) {
        setError(reason instanceof Error ? reason.message : 'Could not draw this page')
      }
    } finally {
      if (token === tokenRef.current) setDrawing(false)
    }
  }

  function addToChat() {
    setChatPage({
      fileId: doc.id,
      fileName: doc.name,
      pageNumber,
    })
    onClose()
  }

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  return createPortal(
    <div className="pages-backdrop" onMouseDown={onClose}>
      <div
        className="pages-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pages-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pages-dialog__head">
          <div>
            <h2 id="pages-dialog-title">{doc.name}</h2>
            <p>
              {pageCount > 0 ? `Page ${pageNumber} of ${pageCount}` : 'Opening pages…'}
            </p>
          </div>
          <div className="pages-dialog__actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={pageCount < 1}
              onClick={() => {
                setMeasureTarget({ fileId: doc.id, pageNumber })
                onClose()
              }}
            >
              Measure this page
            </button>
            <button type="button" className="modal__save" disabled={pageCount < 1} onClick={addToChat}>
              Add to chat
            </button>
            <button type="button" className="pages-dialog__close" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>

        {error ? (
          <p className="pages-dialog__error">{error}</p>
        ) : (
          <div className="pages-dialog__body">
            <div className="pages-dialog__strip" role="listbox" aria-label="Pages">
              {pages.map((n) => (
                <button
                  key={n}
                  ref={n === pageNumber ? activeThumb : undefined}
                  type="button"
                  role="option"
                  aria-selected={n === pageNumber}
                  className={clsx('page-pick', n === pageNumber && 'page-pick--on')}
                  onClick={() => void choose(n)}
                >
                  <span className="page-pick__frame">
                    {thumbs[n] ? <img src={thumbs[n]} alt="" /> : <span />}
                  </span>
                  <span>{n}</span>
                </button>
              ))}
            </div>
            <div className="pages-dialog__sheet">
              {full ? (
                <img src={full} alt={`Page ${pageNumber} of ${doc.name}`} />
              ) : (
                <p>{drawing ? 'Opening this page…' : 'Opening pages…'}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
