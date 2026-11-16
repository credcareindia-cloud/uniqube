import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Plus, Search, Trash2 } from 'lucide-react'
import { SCOPE_AGENTS } from '../lib/agentScopes'
import { useSidebarMarks, type SidebarMarks } from '../lib/sidebarMarks'
import { openSettings, useSettingsDialog } from '../lib/settingsDialog'
import { SettingsDialogHost } from './CreateEstimatePage'
import { EstimateRunDialog, StartEstimateButton } from './EstimateRunDialog'
import { DocumentsPanel } from './DocumentsPanel'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { readIndex, refreshIndex } from '../lib/projectLibrary'
import type { ProjectIndexItem } from '../lib/projectRecord'

export type OsScreen = 'projects' | 'guide' | 'create' | 'agents' | 'boq' | 'dry-cost' | 'costing' | 'packages' | 'rules' | 'share' | 'setup' | 'documents' | 'workspace'

export type AgentFocus = 'foundation' | 'structure' | 'architecture' | 'mep'

export interface OsUser {
  name: string
  email: string
}

const SESSION_KEY = 'uniqube-os-session'

export function readSession(): OsUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OsUser
    if (!parsed?.email || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSession(user: OsUser | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

const CONTEXT: Array<{ id: OsScreen; label: string; mark: keyof SidebarMarks }> = [
  { id: 'setup', label: 'Settings', mark: 'setup' },
  { id: 'packages', label: 'Packages', mark: 'packages' },
  { id: 'rules', label: 'Rules', mark: 'rules' },
]

const OUTPUT: Array<{ id: OsScreen; label: string; mark: keyof SidebarMarks }> = [
  { id: 'boq', label: 'BOQ', mark: 'boq' },
  { id: 'dry-cost', label: 'Dry cost', mark: 'dryCost' },
]

const VERIFICATION: Array<{ id: OsScreen; label: string; mark: keyof SidebarMarks }> = [
  { id: 'workspace', label: 'Estimation Agent', mark: 'workspace' },
  { id: 'share', label: 'Offer', mark: 'share' },
]

export function ProjectSwitcher({
  currentId,
  currentName,
  onOpen,
  onNew,
  onDelete,
}: {
  currentId: string | null
  currentName: string
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const [items, setItems] = useState<ProjectIndexItem[]>(() => readIndex())
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const label = currentId
    ? currentName.trim() || items.find((item) => item.id === currentId)?.name || 'Project'
    : 'Projects'

  useEffect(() => {
    let cancelled = false
    refreshIndex()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentId, currentName])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingId) {
        setPendingId(null)
        setDeleteError(null)
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, pendingId])

  const confirmDelete = async (id: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(id)
      setItems(readIndex())
      setPendingId(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the project')
    } finally {
      setDeleting(false)
    }
  }

  const choices = currentId && !items.some((item) => item.id === currentId)
    ? [{ id: currentId, name: label, createdAt: '', updatedAt: '', lineCount: 0, fileCount: 0 }, ...items]
    : items

  return (
    <div className="os-switch" ref={root}>
      <button
        type="button"
        className="os-switch__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <ul className="os-switch__menu" role="listbox" aria-label="Projects">
          {choices.length === 0 && <li className="os-switch__empty">No saved projects</li>}
          {choices.map((item) => (
            <li key={item.id}>
              {pendingId === item.id ? (
                <div className="os-switch__confirm">
                  <p>Delete {item.name}?</p>
                  {deleteError && <p className="os-switch__confirm-error">{deleteError}</p>}
                  <div>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setPendingId(null)
                        setDeleteError(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="os-switch__confirm-yes" disabled={deleting} onClick={() => void confirmDelete(item.id)}>
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="os-switch__item">
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.id === currentId}
                    className={clsx('os-switch__open', item.id === currentId && 'is-on')}
                    onClick={() => {
                      setOpen(false)
                      onOpen(item.id)
                    }}
                  >
                    {item.name}
                  </button>
                  <button
                    type="button"
                    className="os-switch__delete"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => {
                      setDeleteError(null)
                      setPendingId(item.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
          <li className="os-switch__new">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onNew()
              }}
            >
              New project
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

function RailItem({
  label,
  done,
  on,
  disabled,
  title,
  onClick,
}: {
  label: string
  done: boolean
  on: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={clsx('is-nested', 'est-rail__item', on && 'is-on', done && 'is-done')}
      disabled={disabled}
      title={title ?? (done ? `${label}, completed` : label)}
      onClick={onClick}
    >
      <span className="est-rail__mark" aria-hidden>
        {done ? <Check size={12} strokeWidth={2.6} /> : <Clock size={12} />}
      </span>
      <span>{label}</span>
    </button>
  )
}

export function OsShell({
  user,
  active,
  activeView,
  projectId,
  projectName,
  onOpenProject,
  agentFocus,
  onNavigate,
  onNewProject,
  onSignOut,
  documentsOpen,
  onToggleDocuments,
  children,
}: {
  user: OsUser
  active: OsScreen
  activeView?: string
  agentFocus: AgentFocus
  projectId: string | null
  projectName: string
  onOpenProject: (id: string) => void
  onNavigate: (screen: OsScreen, view?: 'takeoff' | 'pricing' | 'summary' | 'settings', agent?: AgentFocus) => void
  onNewProject?: () => void
  onSignOut: () => void
  documentsOpen: boolean
  onToggleDocuments: () => void
  children: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<ProjectIndexItem[]>(() => readIndex())
  const [searchOpen, setSearchOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [railLine, setRailLine] = useState<{ top: number; height: number; left: number } | null>(null)
  const marks = useSidebarMarks(projectId)
  const settingsDialog = useSettingsDialog()
  const [runOpen, setRunOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    refreshIndex()
      .then((list) => {
        if (!cancelled) setProjects(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [projectId, projectName])

  useEffect(() => {
    if (!searchOpen && !userOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (searchOpen && !searchRef.current?.contains(target)) setSearchOpen(false)
      if (userOpen && !userRef.current?.contains(target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [searchOpen, userOpen])

  const inside = Boolean(projectId) && active !== 'projects'

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail || !inside) return
    const measure = () => {
      const nodes = rail.querySelectorAll<HTMLElement>('.est-rail__mark')
      if (nodes.length < 2) {
        setRailLine(null)
        return
      }
      const railBox = rail.getBoundingClientRect()
      const first = nodes[0].getBoundingClientRect()
      const last = nodes[nodes.length - 1].getBoundingClientRect()
      const top = first.top - railBox.top + first.height / 2
      const bottom = last.top - railBox.top + last.height / 2
      const next = {
        top,
        height: Math.max(0, bottom - top),
        left: first.left - railBox.left + first.width / 2,
      }
      setRailLine((current) =>
        current &&
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5 &&
        Math.abs(current.left - next.left) < 0.5
          ? current
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [inside, projectId, marks])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects.slice(0, 8)
    return projects.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 8)
  }, [projects, query])

  return (
    <div className="os os-app est">
      <header className="est-bar">
        <div className="est-brand">
          <img className="est-mark" src="/UniQube_Logo.png" alt="UNIQUBE" />
          <span className="est-title">Estimation</span>
        </div>
        {inside && <span className="est-project">{projectName.trim() || 'Project'}</span>}
        <div className="est-search" ref={searchRef}>
          <Search size={14} />
          <input
            value={query}
            placeholder="Find a project"
            aria-label="Find a project"
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            }}
          />
          {searchOpen && (
            <ul className="uq-search__menu">
              {matches.length === 0 && <li className="uq-search__empty">No matching project</li>}
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false)
                      setQuery('')
                      onOpenProject(item.id)
                    }}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {inside && <StartEstimateButton onClick={() => setRunOpen(true)} />}
        {active === 'projects' && onNewProject && (
          <button type="button" className="est-primary" onClick={onNewProject}>
            <Plus size={15} /> New project
          </button>
        )}
        <div className="est-user" ref={userRef}>
          <button
            type="button"
            className="est-user__btn"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            onClick={() => setUserOpen((open) => !open)}
          >
            {user.name}
            <ChevronDown size={14} />
          </button>
          {userOpen && (
            <ul className="est-user__menu" role="menu">
              <li>
                <button type="button" role="menuitem" onClick={() => window.location.assign('/profile')}>
                  Profile
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserOpen(false)
                    onSignOut()
                  }}
                >
                  Sign out
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>
      <div className="est-body">
        {inside && (
          <nav className="est-side" aria-label="Estimate">
            <div className="est-rail" ref={railRef}>
              {railLine && <span className="est-rail__line" style={{ top: railLine.top, height: railLine.height, left: railLine.left }} />}
              <span className="est-side__tag">Input</span>
              <RailItem label="Documents" done={marks.documents} on={active === 'documents'} onClick={() => onNavigate('documents')} />
              <span className="est-side__tag">Context</span>
              {CONTEXT.map((link) => (
                <RailItem
                  key={link.id}
                  label={link.label}
                  done={marks[link.mark]}
                  on={link.id === 'setup' ? settingsDialog.open : active === link.id}
                  onClick={() => (link.id === 'setup' ? openSettings() : onNavigate(link.id))}
                />
              ))}
              <span className="est-side__tag">Agents</span>
              {SCOPE_AGENTS.map((item) => (
                <RailItem
                  key={item.id}
                  label={item.label}
                  done={marks[item.id]}
                  on={active === 'agents' && agentFocus === item.id}
                  disabled={!item.ready}
                  title={item.ready ? item.label : 'Coming soon'}
                  onClick={() => {
                    if (item.ready) onNavigate('agents', undefined, item.id)
                  }}
                />
              ))}
              <span className="est-side__tag">Output</span>
              {OUTPUT.map((link) => (
                <RailItem key={link.id} label={link.label} done={marks[link.mark]} on={active === link.id} onClick={() => onNavigate(link.id)} />
              ))}
              <span className="est-side__tag">Verification</span>
              {VERIFICATION.map((link) => (
                <RailItem key={link.id} label={link.label} done={marks[link.mark]} on={active === link.id} onClick={() => onNavigate(link.id)} />
              ))}
            </div>
          </nav>
        )}
        <div className="est-canvas">
          <div className="os-fill">{children}</div>
        </div>
        <SettingsDialogHost />
        {runOpen && projectId ? (
          <EstimateRunDialog
            projectId={projectId}
            onClose={() => setRunOpen(false)}
            onOpenBoq={() => onNavigate('boq')}
          />
        ) : null}
        {inside && active !== 'documents' && (
          <div className={clsx('est-docs-dock', documentsOpen && 'is-open')}>
            <button
              type="button"
              className="est-docs-tab"
              aria-expanded={documentsOpen}
              aria-label={documentsOpen ? 'Close documents' : 'Open documents'}
              onClick={onToggleDocuments}
            >
              {documentsOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {documentsOpen && <DocumentsPanel />}
          </div>
        )}
      </div>
    </div>
  )
}
