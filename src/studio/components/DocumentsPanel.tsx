import { useRef, useState } from 'react'
import clsx from 'clsx'
import { FileText, Pencil, Upload } from 'lucide-react'
import { useAppStore } from '../store'
import { documentCategoryLabel, type DocumentCategory } from '../types'
import { FilePagesDialog } from './FilePagesDialog'

const CATEGORIES: Array<{ id: DocumentCategory; label: string }> = [
  { id: 'drawing', label: 'Drawing' },
  { id: 'bid', label: 'Bid' },
  { id: 'other', label: 'Other' },
]

type PendingFile = { file: File; name: string; category: DocumentCategory }

export function DocumentsPanel({ variant = 'drawer' }: { variant?: 'page' | 'drawer' }) {
  const documents = useAppStore((s) => s.documents)
  const analyzeProgress = useAppStore((s) => s.analyzeProgress)
  const addClientFiles = useAppStore((s) => s.addClientFiles)
  const updateDocument = useAppStore((s) => s.updateDocument)
  const retryDocument = useAppStore((s) => s.retryDocument)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState<DocumentCategory>('drawing')
  const uploadRef = useRef<HTMLInputElement>(null)
  const openDoc = documents.find((doc) => doc.id === openId && doc.status === 'ready') ?? null

  const queueFiles = (list: FileList | null) => {
    if (!list?.length) return
    const next = Array.from(list)
      .filter((file) => file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => ({ file, name: file.name.replace(/\.pdf$/i, ''), category: 'drawing' as const }))
    if (next.length) setPending((current) => [...current, ...next])
  }

  const startEdit = (id: string) => {
    const doc = documents.find((item) => item.id === id)
    if (!doc) return
    setEditId(id)
    setEditName(doc.name)
    setEditCategory(doc.category ?? 'drawing')
  }

  const saveEdit = () => {
    if (!editId) return
    updateDocument(editId, { name: editName, category: editCategory })
    setEditId(null)
  }

  const Tag = variant === 'page' ? 'main' : 'aside'
  return (
    <Tag className={clsx('agents-files est-docs', variant === 'page' && 'est-docs--page')}>
      <header>
        <div>
          <h2>Documents</h2>
          <span>{documents.length === 1 ? '1 PDF' : `${documents.length} PDFs`}</span>
        </div>
        <label className="est-primary">
          <Upload size={14} />
          Add document
          <input
            ref={uploadRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => {
              queueFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
      </header>
      {pending.length > 0 && (
        <form
          className="est-docs__pending"
          onSubmit={(event) => {
            event.preventDefault()
            void addClientFiles(
              pending.map((item) => item.file),
              pending.map((item) => ({ name: item.name.trim() || item.file.name.replace(/\.pdf$/i, ''), category: item.category })),
            )
            setPending([])
          }}
        >
          {pending.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="est-docs__draft">
              <label>
                Name
                <input
                  value={item.name}
                  aria-label={`Name for ${item.file.name}`}
                  onChange={(event) =>
                    setPending((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, name: event.target.value } : row)))
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={item.category}
                  aria-label={`Category for ${item.file.name}`}
                  onChange={(event) =>
                    setPending((current) =>
                      current.map((row, rowIndex) => (rowIndex === index ? { ...row, category: event.target.value as DocumentCategory } : row)),
                    )
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <div className="est-docs__draft-actions">
            <button type="button" onClick={() => setPending([])}>
              Cancel
            </button>
            <button type="submit" className="est-primary">
              Add
            </button>
          </div>
        </form>
      )}
      {documents.length === 0 ? (
        <p className="agents-files__empty">No documents yet. Add a PDF to start.</p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              {editId === doc.id ? (
                <form
                  className="est-docs__draft"
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveEdit()
                  }}
                >
                  <label>
                    Name
                    <input value={editName} aria-label="Document name" onChange={(event) => setEditName(event.target.value)} />
                  </label>
                  <label>
                    Category
                    <select value={editCategory} aria-label="Document category" onChange={(event) => setEditCategory(event.target.value as DocumentCategory)}>
                      {CATEGORIES.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="est-docs__draft-actions">
                    <button type="button" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="est-primary">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="est-docs__row">
                  <button
                    type="button"
                    className={clsx(openId === doc.id && 'is-on')}
                    onClick={() => {
                      if (doc.status === 'ready') setOpenId(doc.id)
                      else if (doc.status === 'error' && doc.file.size > 0) retryDocument(doc.id)
                      else if (doc.status === 'error') uploadRef.current?.click()
                    }}
                  >
                    <FileText size={16} />
                    <span>
                      <b>{doc.name}</b>
                      <small>
                        {documentCategoryLabel(doc.category)}
                        {' · '}
                        {doc.status === 'reading'
                          ? `reading… ${Math.round(analyzeProgress * 100)} %`
                          : doc.status === 'error'
                            ? `error${doc.error ? `: ${doc.error}` : ''}`
                            : 'ready'}
                        {doc.analysis ? ` · ${doc.analysis.pageCount} pages` : ''}
                      </small>
                      {doc.status === 'reading' && (
                        <span className="agents-files__progress" aria-hidden>
                          <i style={{ width: `${Math.round(analyzeProgress * 100)}%` }} />
                        </span>
                      )}
                    </span>
                  </button>
                  <button type="button" className="est-docs__rename" aria-label={`Rename ${doc.name}`} onClick={() => startEdit(doc.id)}>
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {openDoc && <FilePagesDialog doc={openDoc} onClose={() => setOpenId(null)} />}
    </Tag>
  )
}
