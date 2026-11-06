import { useCallback, useState } from 'react'
import clsx from 'clsx'
import { Plus, X } from 'lucide-react'
import { useAppStore } from '../store'
import { FilePagesDialog } from './FilePagesDialog'

export function FileRail({
  booting,
  onCreateProject,
}: {
  booting: boolean
  onCreateProject: () => void
}) {
  const projectId = useAppStore((s) => s.projectId)
  const documents = useAppStore((s) => s.documents)
  const analysis = useAppStore((s) => s.analysis)
  const status = useAppStore((s) => s.status)
  const addClientFiles = useAppStore((s) => s.addClientFiles)
  const selectDocument = useAppStore((s) => s.selectDocument)
  const removeDocument = useAppStore((s) => s.removeDocument)
  const [over, setOver] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const openDoc = documents.find((doc) => doc.id === openId && doc.status === 'ready') ?? null

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return
      void addClientFiles(Array.from(list))
    },
    [addClientFiles],
  )

  return (
    <aside
      className={clsx('file-rail', over && 'file-rail--over')}
      onDragOver={(e) => {
        if (!projectId) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!projectId) return
        e.preventDefault()
        setOver(false)
        onFiles(e.dataTransfer.files)
      }}
    >
      {booting ? (
        <p className="file-rail__empty file-rail__wait">Loading project…</p>
      ) : (
        <div className="file-rail__bar">
          <span>Drawings</span>
          {projectId ? (
            <label className="file-rail__add" title="Add drawings">
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                hidden
                onChange={(e) => {
                  onFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <Plus size={16} strokeWidth={1.75} />
            </label>
          ) : (
            <button type="button" className="file-rail__add" title="New project" onClick={onCreateProject}>
              <Plus size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}

      <ul className="file-rail__list">
        {!booting && documents.length === 0 && (
          <li className="file-rail__empty">
            {projectId ? 'Nothing added yet.' : 'Create a project before adding drawings.'}
          </li>
        )}
        {documents.map((doc) => {
          const active = analysis?.fileName === doc.name && doc.status === 'ready'
          return (
            <li key={doc.id} className={clsx('file-row', active && 'file-row--on')}>
              <button
                type="button"
                className="file-row__main"
                disabled={doc.status !== 'ready'}
                onClick={() => {
                  selectDocument(doc.id)
                  setOpenId(doc.id)
                }}
              >
                <span className="file-row__name">{doc.name}</span>
                <span className="file-row__meta">
                  {doc.status === 'reading' && (status === 'analyzing' ? 'Reading…' : 'Queued')}
                  {doc.status === 'error' && (doc.error || 'Could not read')}
                  {doc.status === 'ready' &&
                    `${doc.analysis?.pageCount ?? 0} pages · ${doc.analysis?.overall ?? 'ready'}`}
                </span>
              </button>
              <button
                type="button"
                className="file-row__remove"
                aria-label={`Remove ${doc.name}`}
                onClick={() => removeDocument(doc.id)}
              >
                <X size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      {openDoc && <FilePagesDialog doc={openDoc} onClose={() => setOpenId(null)} />}
    </aside>
  )
}
