import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { FolderOpen } from 'lucide-react'
import { readIndex, refreshIndex } from '../lib/projectLibrary'
import type { ProjectIndexItem } from '../lib/projectRecord'

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ProjectsPage({
  currentId,
  notice,
  onOpen,
}: {
  currentId: string | null
  notice: string | null
  onOpen: (id: string) => void
}) {
  const [items, setItems] = useState<ProjectIndexItem[]>(() => readIndex())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    refreshIndex()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load projects')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="projects">
      <header className="projects__head">
        <h1>Projects</h1>
        <span>{items.length === 1 ? '1 saved' : `${items.length} saved`}</span>
      </header>
      {error && <p className="projects__error">{error}</p>}
      {notice && <p className="projects__error">{notice}</p>}
      {items.length === 0 && !error ? (
        <p className="projects__empty">No projects yet. Use New project to start one.</p>
      ) : (
        <ul className="projects__grid">
          {items.map((item) => {
            const current = item.id === currentId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={clsx('project-tile', current && 'is-current')}
                  onClick={() => onOpen(item.id)}
                >
                  <span className="project-tile__icon" aria-hidden>
                    <FolderOpen size={16} />
                  </span>
                  {current && <span className="project-tile__mark">Current</span>}
                  <strong>{item.name}</strong>
                  <span className="project-tile__meta">
                    <span>{item.lineCount === 1 ? '1 line' : `${item.lineCount} lines`}</span>
                    <span>{item.fileCount === 1 ? '1 file' : `${item.fileCount} files`}</span>
                    {item.updatedAt && <span>{formatWhen(item.updatedAt)}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
