import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CreateEstimatePage, type CreatedEstimate } from './CreateEstimatePage'
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

export function nextEstimationName(names: string[]): string {
  let max = 0
  for (const name of names) {
    const match = /^estimation v(\d+)$/i.exec(name.trim())
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `Estimation v${max + 1}`
}

export function EstimationsPage({
  currentId,
  busy,
  notice,
  creating,
  onCreating,
  onOpen,
  onCreate,
}: {
  currentId: string | null
  busy: boolean
  notice: string | null
  creating: boolean
  onCreating: (creating: boolean) => void
  onOpen: (id: string) => void
  onCreate: (draft: CreatedEstimate) => void
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load estimations')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (creating) {
    return (
      <CreateEstimatePage
        busy={busy}
        notice={notice}
        defaultName={nextEstimationName(items.map((item) => item.name))}
        onBack={() => onCreating(false)}
        onCreate={onCreate}
      />
    )
  }

  return (
    <div className="est-board">
      {error && <p className="projects__error">{error}</p>}
      {notice && <p className="projects__error">{notice}</p>}
      {items.length === 0 && !error ? (
        <p className="projects__empty">No projects yet. Create one and add the drawings.</p>
      ) : (
        <div className="est-board__grid">
          <table className="est-table">
            <thead>
              <tr>
                <th className="est-num">#</th>
                <th>Project</th>
                <th>Drawings</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className={clsx('is-open', item.id === currentId && 'is-current')} onClick={() => onOpen(item.id)}>
                  <td className="est-num">{items.length - index}</td>
                  <td>
                    <b>{item.name}</b>
                  </td>
                  <td>{item.fileCount}</td>
                  <td>{item.updatedAt ? formatWhen(item.updatedAt) : '—'}</td>
                  <td>
                    <span className={item.fileCount > 0 ? 'est-pill is-done' : 'est-pill is-now'}>
                      {item.fileCount > 0 ? 'Ready' : 'Needs drawings'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
