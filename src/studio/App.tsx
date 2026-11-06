import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AgentPanel } from './components/AgentPanel'
import { EstimationStage } from './components/EstimationStage'
import { FileRail } from './components/FileRail'
import { LandingPage } from './components/LandingPage'
import { LoginPage } from './components/LoginPage'
import { OsShell, readSession, writeSession, type AgentFocus, type OsScreen, type OsUser } from './components/OsChrome'
import { ProjectHome } from './components/ProjectHome'
import { ProjectNameDialog } from './components/ProjectNameDialog'
import { AgentsPage } from './components/AgentsPage'
import { BoqPage } from './components/BoqPage'
import { DryCostPage } from './components/DryCostPage'
import { CostingPage } from './components/CostingPage'
import { PackageRegisterPage } from './components/PackageRegisterPage'
import { QuotationPage } from './components/QuotationPage'
import { EstimationsPage } from './components/EstimationsPage'
import type { CreatedEstimate } from './components/CreateEstimatePage'
import { openSettings } from './lib/settingsDialog'
import { DocumentsPanel } from './components/DocumentsPanel'
import { RulesPage } from './components/RulesPage'
import {
  beginSession,
  createProject,
  deleteProject,
  ensureProject,
  flushPersist,
  loadProject,
  resumeWrites,
  schedulePersist,
  suspendWrites,
} from './lib/projectLibrary'
import type { ProjectRecord } from './lib/projectRecord'
import { hydratePriceSheet } from './lib/priceSheet'
import { withElementRates } from './lib/elements'
import { agentFrom, estimateLocation, parseEstimateLocation, parsePath, screenFrom, studioPath } from './lib/routes'
import { useAppStore } from './store'
import { restoreMissingDrawings } from './lib/restoreDrawing'

const MIN = 180
const MAX = 520
const LEFT_DEFAULT = 300
const RIGHT_DEFAULT = 260
const LEFT_KEY = 'estimation-left-width'
const RIGHT_KEY = 'estimation-right-width'
const ACTIVE_KEY = 'estimation-active-project-id'

function loadWidth(key: string, fallback: number) {
  try {
    const n = Number(localStorage.getItem(key))
    if (!Number.isFinite(n)) return fallback
    return Math.min(MAX, Math.max(MIN, n))
  } catch {
    return fallback
  }
}

function rememberActive(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id)
  } catch {
    /* ignore */
  }
}

export default function App({ embed }: { embed?: { projectId: string; projectName: string; user: OsUser } } = {}) {
  const projectId = useAppStore((s) => s.projectId)
  const projectName = useAppStore((s) => s.projectSetup.projectName)
  const [left, setLeft] = useState(() => loadWidth(LEFT_KEY, LEFT_DEFAULT))
  const [right, setRight] = useState(() => loadWidth(RIGHT_KEY, RIGHT_DEFAULT))
  const stageView = useAppStore((s) => s.stageView)
  const embeddedStart = embed ? parseEstimateLocation(window.location.pathname) : null
  const [screen, setScreen] = useState<OsScreen>(() => embeddedStart?.screen ?? (embed ? 'documents' : screenFrom(parsePath(window.location.pathname))))
  const [agentFocus, setAgentFocus] = useState<AgentFocus>(() => embeddedStart?.agent ?? agentFrom(parsePath(window.location.pathname)))
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [settingsNonce, setSettingsNonce] = useState(0)
  const [user, setUser] = useState<OsUser | null>(() => embed?.user ?? readSession())
  const [gate, setGate] = useState<'site' | 'studio'>(() => (parsePath(window.location.pathname).kind === 'site' ? 'site' : 'studio'))
  useEffect(() => {
    document.documentElement.classList.toggle('os-on', Boolean(user))
    return () => document.documentElement.classList.remove('os-on')
  }, [user])
  const [naming, setNaming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null)
  const dragRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null)
  const openExistingRef = useRef<(id: string, next?: OsScreen) => void>(() => {})
  const holdUrl = useRef(false)
  const userRef = useRef(user)
  userRef.current = user
  const leftRef = useRef(left)
  const rightRef = useRef(right)
  leftRef.current = left
  rightRef.current = right

  const persist = useCallback((side: 'left' | 'right', w: number) => {
    try {
      localStorage.setItem(side === 'left' ? LEFT_KEY : RIGHT_KEY, String(w))
    } catch {
      /* ignore */
    }
  }, [])

  const onPointerDown = useCallback((side: 'left' | 'right', e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      side,
      startX: e.clientX,
      startW: side === 'left' ? leftRef.current : rightRef.current,
    }
    setDragging(side)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const next = Math.min(MAX, Math.max(MIN, drag.side === 'left' ? drag.startW + dx : drag.startW - dx))
    if (drag.side === 'left') setLeft(next)
    else setRight(next)
  }, [])

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      setDragging(null)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      persist(drag.side, drag.side === 'left' ? leftRef.current : rightRef.current)
    },
    [persist],
  )

  const embedId = embed?.projectId ?? null
  const embedName = embed?.projectName ?? ''
  const activeProjectId = projectId ?? embedId
  const navigate = useNavigate()

  useEffect(() => {
    if (embedId) {
      if (projectId === embedId) {
        setBooting(false)
        return
      }
      let cancelled = false
      setBooting(true)
      suspendWrites()
      ensureProject(embedId, embedName)
        .then(async (record) => {
          if (cancelled) return
          beginSession(record)
          useAppStore.getState().applyProject(record)
          resumeWrites()
          await restoreMissingDrawings(embedId)
        })
        .catch((error) => {
          if (!cancelled) setListError(error instanceof Error ? error.message : 'Could not open the estimate')
        })
        .finally(() => {
          resumeWrites()
          if (!cancelled) setBooting(false)
        })
      return () => {
        cancelled = true
      }
    }
  }, [embedId, embedName, projectId])

  useEffect(() => {
    if (embedId) return
    let cancelled = false
    const urlId = (() => {
      const route = parsePath(window.location.pathname)
      return route.kind === 'project' ? route.projectId : null
    })()
    const id = urlId ?? (() => {
      try {
        return localStorage.getItem(ACTIVE_KEY)
      } catch {
        return null
      }
    })()
    if (!id) {
      void hydratePriceSheet()
        .then((rows) => {
          if (!cancelled && rows?.length) useAppStore.setState({ priceSheet: withElementRates(rows) })
        })
        .finally(() => {
          if (!cancelled) setBooting(false)
        })
      return () => {
        cancelled = true
      }
    }
    suspendWrites()
    loadProject(id)
      .then((record) => {
        if (cancelled) return
        if (!record) {
          try {
            localStorage.removeItem(ACTIVE_KEY)
          } catch {
            /* ignore */
          }
          if (urlId) setScreen('projects')
          return
        }
        beginSession(record)
        useAppStore.getState().applyProject(record)
      })
      .catch(() => {
        if (!cancelled) {
          try {
            localStorage.removeItem(ACTIVE_KEY)
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => {
        resumeWrites()
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [embedId])

  useEffect(() => {
    if (!embed) return
    const numericId = embed.projectId.replace(/^p/, '')
    const path = estimateLocation(numericId, screen, agentFocus)
    if (window.location.pathname === path) return
    navigate(path, { replace: true })
  }, [embed, screen, agentFocus, navigate])

  useEffect(() => {
    if (embed) return
    if (!user) return
    if (booting) return
    const path = studioPath(screen, projectId, agentFocus)
    if (holdUrl.current) {
      const route = parsePath(window.location.pathname)
      if (route.kind === 'project' && route.projectId !== projectId) return
      holdUrl.current = false
      return
    }
    if (window.location.pathname === path) return
    const arrival = window.location.pathname === '/' || window.location.pathname === '/login'
    window.history[arrival ? 'replaceState' : 'pushState'](null, '', path)
  }, [user, booting, screen, projectId, agentFocus])

  useEffect(() => {
    const onPop = () => {
      if (embed) {
        const here = parseEstimateLocation(window.location.pathname)
        if (!here) return
        setAgentFocus(here.agent)
        setScreen(here.screen)
        if (here.screen === 'documents') setDocumentsOpen(false)
        return
      }
      const route = parsePath(window.location.pathname)
      holdUrl.current = true
      if (!userRef.current) {
        setGate(route.kind === 'site' ? 'site' : 'studio')
        return
      }
      if (route.kind === 'site' || route.kind === 'login') {
        setScreen('projects')
        return
      }
      setGate('studio')
      const next = screenFrom(route)
      setAgentFocus(agentFrom(route))
      setScreen(next)
      if (route.kind === 'project' && route.projectId !== useAppStore.getState().projectId) {
        void openExistingRef.current(route.projectId, route.screen)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!projectId) return
    const unsub = useAppStore.subscribe(() => schedulePersist())
    const flush = () => {
      void flushPersist()
    }
    window.addEventListener('pagehide', flush)
    return () => {
      unsub()
      window.removeEventListener('pagehide', flush)
      void flushPersist()
    }
  }, [projectId])

  useEffect(() => {
    if (screen === 'guide') setScreen('documents')
    if (screen === 'setup') {
      openSettings()
      setScreen('documents')
    }
  }, [screen])

  const go = useCallback((next: OsScreen, view?: 'takeoff' | 'pricing' | 'summary' | 'settings', agent?: AgentFocus) => {
    setNameError(null)
    if (agent) setAgentFocus(agent)
    if (view === 'settings') {
      setSettingsNonce((n) => n + 1)
      setScreen('workspace')
      return
    }
    if (next === 'documents') setDocumentsOpen(false)
    if (view) useAppStore.getState().setStageView(view)
    if (embed && (next === 'projects' || next === 'create')) return
    setScreen(next)
  }, [embed])

  const adopt = useCallback(async (record: ProjectRecord, next: OsScreen = 'workspace') => {
    await flushPersist()
    suspendWrites()
    try {
      beginSession(record)
      useAppStore.getState().applyProject(record)
      rememberActive(record.id)
    } finally {
      resumeWrites()
    }
    setNaming(false)
    setNameError(null)
    setScreen(next)
  }, [])

  const saveNamedProject = useCallback(
    async (name: string) => {
      setSaving(true)
      setNameError(null)
      try {
        await flushPersist()
        const record = await createProject(name)
        await adopt(record, 'documents')
      } catch (error) {
        setNameError(error instanceof Error ? error.message : 'Could not save the project')
      } finally {
        setSaving(false)
      }
    },
    [adopt],
  )

  const createFromWizard = useCallback(
    async (draft: CreatedEstimate) => {
      setSaving(true)
      setNameError(null)
      try {
        await flushPersist()
        const record = await createProject(draft.name)
        await adopt(record, 'documents')
        const store = useAppStore.getState()
        store.setFloorCount(draft.levels)
        const each = draft.levels > 0 && draft.gfaM2 > 0 ? Math.round((draft.gfaM2 / draft.levels) * 100) / 100 : undefined
        const floors = useAppStore.getState().projectContext.floors.map((floor) => ({
          ...floor,
          ...(each ? { areaM2: each } : {}),
        }))
        store.setProjectContext({
          client: draft.client,
          location: draft.location,
          buildingType: draft.buildingType,
          floors,
          description: [
            'Opened from the rules screen. Template money is provisional until a geometry takeoff is measured and a person confirms the lines.',
            draft.specSummary ? `Build-up: ${draft.specSummary}` : '',
          ].filter(Boolean).join(' '),
        })
        store.setCommercials(draft.commercials)
        if (draft.files.length) await useAppStore.getState().addClientFiles(draft.files)
      } catch (error) {
        setNameError(error instanceof Error ? error.message : 'Could not create the estimate')
        setScreen('projects')
      } finally {
        setSaving(false)
      }
    },
    [adopt],
  )

  const removeProject = useCallback(async (id: string) => {
    const current = useAppStore.getState().projectId === id
    if (current) suspendWrites()
    try {
      await deleteProject(id)
      if (current) {
        try {
          localStorage.removeItem(ACTIVE_KEY)
        } catch {
          /* ignore */
        }
        useAppStore.setState({ projectId: null })
        useAppStore.getState().reset()
      }
    } finally {
      if (current) resumeWrites()
    }
  }, [])

  const openExisting = useCallback(
    async (id: string, next: OsScreen = 'workspace') => {
      if (id === useAppStore.getState().projectId) {
        setScreen(next)
        return
      }
      setSaving(true)
      try {
        await flushPersist()
        const record = await loadProject(id)
        if (!record) throw new Error('That project is no longer saved in this browser')
        await adopt(record, next)
      } catch (error) {
        setListError(error instanceof Error ? error.message : 'Could not open the project')
      } finally {
        setSaving(false)
      }
    },
    [adopt],
  )
  openExistingRef.current = (id, next = 'workspace') => {
    void openExisting(id, next)
  }

  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.cursor
    const select = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = select
    }
  }, [dragging])

  const sashProps = (side: 'left' | 'right') => ({
    className: clsx('sash', dragging === side && 'sash--active'),
    role: 'separator' as const,
    'aria-orientation': 'vertical' as const,
    'aria-label': side === 'left' ? 'Resize estimator' : 'Resize files',
    tabIndex: 0,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => onPointerDown(side, e),
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  })

  const dialog = naming ? (
    <ProjectNameDialog
      busy={saving}
      error={nameError}
      onCancel={() => {
        if (saving) return
        setNaming(false)
        setNameError(null)
      }}
      onSave={(name) => void saveNamedProject(name)}
    />
  ) : null

  if (!user) {
    if (gate === 'site') {
      return (
        <LandingPage
          onEnter={() => {
            setGate('studio')
            if (window.location.pathname !== '/login') window.history.pushState(null, '', '/login')
          }}
        />
      )
    }
    return (
      <LoginPage
        onLogin={(next) => {
          writeSession(next)
          setUser(next)
        }}
      />
    )
  }

  const page = booting && screen !== 'projects' && screen !== 'create' && !projectId ? (
      <div className="projects uq-home">
        <p className="projects__empty">Opening the project…</p>
      </div>
    ) : !embed && (screen === 'projects' || screen === 'create' || !projectId) ? (
      <EstimationsPage
        currentId={projectId}
        busy={saving}
        notice={nameError}
        creating={screen === 'create'}
        onCreating={(on) => setScreen(on ? 'create' : 'projects')}
        onOpen={(id) => void openExisting(id, 'documents')}
        onCreate={(draft) => void createFromWizard(draft)}
      />
    ) : screen === 'guide' ? (
      <ProjectHome
        projectId={activeProjectId ?? ''}
        projectName={projectName || embedName}
        onContinue={(dest) => {
          if (dest.agent) setAgentFocus(dest.agent)
          setScreen(dest.screen)
        }}
        onDelete={() => {
          void removeProject(projectId).then(() => {
            if (embed) window.location.assign('/requests')
            else setScreen('projects')
          })
        }}
      />
    ) : screen === 'agents' ? (
      <AgentsPage projectId={activeProjectId ?? ''} focus={agentFocus} />
    ) : screen === 'boq' ? (
      <BoqPage projectId={projectId} />
    ) : screen === 'dry-cost' ? (
      <DryCostPage projectId={activeProjectId ?? ''} />
    ) : screen === 'costing' ? (
      <CostingPage />
    ) : screen === 'packages' ? (
      <PackageRegisterPage />
    ) : screen === 'share' ? (
      <QuotationPage projectId={projectId} onBack={() => setScreen('agents')} />
    ) : screen === 'rules' ? (
      <RulesPage />
    ) : screen === 'documents' || screen === 'setup' ? (
      <DocumentsPanel variant="page" />
    ) : (
    <div className="app-frame">
      <div className={clsx('app-shell', dragging && 'app-shell--dragging')}>
        <div className="pane-slot" style={{ width: left }}>
          <AgentPanel key={projectId ?? 'none'} projectId={projectId} />
        </div>
        <div {...sashProps('left')} />
        <EstimationStage settingsNonce={settingsNonce} />
        <div {...sashProps('right')} />
        <div className="pane-slot" style={{ width: right }}>
          <FileRail booting={booting} onCreateProject={() => setNaming(true)} />
        </div>
      </div>
    </div>
    )

  return (
    <OsShell
      user={user}
      active={screen}
      activeView={stageView}
      agentFocus={agentFocus}
      projectId={activeProjectId}
      projectName={projectName || embedName}
      onOpenProject={(id) => void openExisting(id, 'documents')}
      onNavigate={go}
      onNewProject={embed ? undefined : () => setScreen('create')}
      documentsOpen={documentsOpen}
      onToggleDocuments={() => setDocumentsOpen((open) => !open)}
      onSignOut={() => {
        if (embed) {
          window.location.assign('/projects')
          return
        }
        writeSession(null)
        setUser(null)
        setGate('site')
        setScreen('projects')
        window.history.pushState(null, '', '/')
      }}
    >
      {listError && <p className="projects__error uq-banner">{listError}</p>}
      {page}
      {dialog}
    </OsShell>
  )
}
