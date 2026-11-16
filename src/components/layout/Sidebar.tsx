import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  FolderKanban,
  Inbox,
  Settings,
  LogOut,
  ChevronDown,
  Box,
  Calculator,
  Activity,
  Calendar,
  CheckCircle2,
  Ban,
  FileSpreadsheet,
  DraftingCompass,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRBAC } from '@/contexts/RBACContext'
import { useAuth } from '@/contexts/AuthContext'

type ProjectStatusKey = 'active' | 'planning' | 'completed' | 'cancelled'

function normalizeStatus(s?: string): ProjectStatusKey | 'on-hold' {
  if (!s) return 'planning'
  const kebab = s.toString().trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (kebab === 'onhold') return 'on-hold'
  if (kebab === 'active' || kebab === 'completed' || kebab === 'planning' || kebab === 'cancelled' || kebab === 'on-hold') {
    return kebab
  }
  return 'planning'
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { hasPermission, userProjects } = useRBAC()
  const { user, logout } = useAuth()

  const onProjects = location.pathname.startsWith('/projects')
  const onEstimation =
    location.pathname.startsWith('/estimation') || location.pathname.startsWith('/requests')
  const onModeling = location.pathname.startsWith('/modeling')
  const onFinalQuotation = location.pathname.startsWith('/modeling/final-quotation')
  const onSettings = location.pathname.startsWith('/settings') || location.pathname.startsWith('/profile') || location.pathname.startsWith('/admin')

  const [projectsOpen, setProjectsOpen] = useState(onProjects)
  const [modelingOpen, setModelingOpen] = useState(onModeling)
  const [estimationOpen, setEstimationOpen] = useState(onEstimation)

  useEffect(() => {
    if (onProjects) setProjectsOpen(true)
  }, [onProjects])

  useEffect(() => {
    if (onModeling) setModelingOpen(true)
  }, [onModeling])

  useEffect(() => {
    if (onEstimation) setEstimationOpen(true)
  }, [onEstimation])

  const projectCounts = useMemo(() => {
    const counts = { active: 0, planning: 0, completed: 0, cancelled: 0 }
    for (const project of userProjects) {
      const status = normalizeStatus(project.status)
      if (status === 'active') counts.active += 1
      else if (status === 'completed') counts.completed += 1
      else if (status === 'cancelled') counts.cancelled += 1
      else counts.planning += 1 // planning + on-hold fall under planning bucket in nav
    }
    return counts
  }, [userProjects])

  const projectStatus = (searchParams.get('status') || '').toLowerCase() as ProjectStatusKey | ''
  const estimationSection = location.pathname.includes('/estimation/rough')
    ? 'rough'
    : location.pathname.includes('/requests') || location.pathname.includes('/estimation/requests')
      ? 'requests'
      : ''

  const projectChildren: { key: ProjectStatusKey; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'active', label: 'Active', icon: Activity, count: projectCounts.active },
    { key: 'planning', label: 'Planning', icon: Calendar, count: projectCounts.planning },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, count: projectCounts.completed },
    { key: 'cancelled', label: 'Cancelled', icon: Ban, count: projectCounts.cancelled },
  ]

  return (
    <aside className="uq-sidebar h-full w-[240px] flex flex-col">
      <div className="uq-sidebar-brand">
        <div className="h-10 w-10 rounded-full bg-[var(--uq-blue)] overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-white/25">
          <img src="/uniQube.png" alt="UNIQUBE" className="h-8 w-8 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-wide leading-tight text-[var(--uq-yellow)]">UNIQUBE</p>
          <p className="text-[11px] text-white/70 truncate">{user?.name || 'Workspace'}</p>
        </div>
      </div>

      <nav className="uq-sidebar-nav">
        {hasPermission('projects.view') && (
          <div className="uq-nav-group">
            <button
              type="button"
              onClick={() => {
                setProjectsOpen((open) => !open)
                navigate('/projects')
              }}
              className={cn('uq-nav-item', onProjects && !projectStatus && 'uq-nav-item-active')}
              aria-expanded={projectsOpen}
            >
              <FolderKanban className="h-[16px] w-[16px] shrink-0" />
              <span className="uq-nav-label">Projects</span>
              <ChevronDown className={cn('uq-nav-chevron ml-auto h-4 w-4 shrink-0 transition-transform', projectsOpen && 'rotate-180')} />
            </button>
            {projectsOpen && (
              <div className="uq-nav-children">
                {projectChildren.map((child) => {
                  const Icon = child.icon
                  const active = onProjects && projectStatus === child.key
                  return (
                    <button
                      key={child.key}
                      type="button"
                      onClick={() => navigate(`/projects?status=${child.key}`)}
                      className={cn('uq-nav-item uq-nav-item-nested', active && 'uq-nav-item-active')}
                    >
                      <Icon className="h-[14px] w-[14px] shrink-0" />
                      <span className="uq-nav-label">{child.label}</span>
                      <span className="uq-nav-count">{child.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="uq-nav-group">
          <button
            type="button"
            onClick={() => {
              setModelingOpen((open) => !open)
              navigate('/modeling')
            }}
            className={cn('uq-nav-item', onModeling && !onFinalQuotation && 'uq-nav-item-active')}
            aria-expanded={modelingOpen}
          >
            <Box className="h-[16px] w-[16px] shrink-0" />
            <span className="uq-nav-label">Modeling</span>
            <span className="uq-nav-beta">Beta</span>
            <ChevronDown className={cn('uq-nav-chevron ml-auto h-4 w-4 shrink-0 transition-transform', modelingOpen && 'rotate-180')} />
          </button>
          {modelingOpen && (
            <div className="uq-nav-children">
              <button
                type="button"
                onClick={() => navigate('/modeling/final-quotation')}
                className={cn('uq-nav-item uq-nav-item-nested', onFinalQuotation && 'uq-nav-item-active')}
              >
                <FileSpreadsheet className="h-[14px] w-[14px] shrink-0" />
                <span className="uq-nav-label">Final Quotation</span>
              </button>
            </div>
          )}
        </div>

        {hasPermission('estimate.view') && (
          <div className="uq-nav-group">
            <button
              type="button"
              onClick={() => {
                setEstimationOpen((open) => !open)
                navigate('/estimation/rough')
              }}
              className={cn('uq-nav-item', onEstimation && !estimationSection && 'uq-nav-item-active')}
              aria-expanded={estimationOpen}
            >
              <Calculator className="h-[16px] w-[16px] shrink-0" />
              <span className="uq-nav-label">Estimation</span>
              <ChevronDown className={cn('uq-nav-chevron ml-auto h-4 w-4 shrink-0 transition-transform', estimationOpen && 'rotate-180')} />
            </button>
            {estimationOpen && (
              <div className="uq-nav-children">
                <button
                  type="button"
                  onClick={() => navigate('/estimation/rough')}
                  className={cn('uq-nav-item uq-nav-item-nested', estimationSection === 'rough' && 'uq-nav-item-active')}
                >
                  <DraftingCompass className="h-[14px] w-[14px] shrink-0" />
                  <span className="uq-nav-label">Rough Estimation</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/estimation/requests')}
                  className={cn('uq-nav-item uq-nav-item-nested', estimationSection === 'requests' && 'uq-nav-item-active')}
                >
                  <Inbox className="h-[14px] w-[14px] shrink-0" />
                  <span className="uq-nav-label">Requests</span>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="uq-sidebar-footer">
        <button
          type="button"
          className={cn('uq-sidebar-settings', onSettings && 'uq-sidebar-settings-active')}
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </button>
        <button
          type="button"
          className="uq-sidebar-signout"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
