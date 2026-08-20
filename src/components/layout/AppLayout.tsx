import React, { useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { WorkspaceHeader } from './WorkspaceHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading: loading } = useAuth()
  const { notifications, markAsRead } = useNotifications()
  const shownNotificationIds = useRef<Set<string>>(new Set())
  const navigate = useNavigate()
  const location = useLocation()
  const isViewer = /\/projects\/[^/]+\/viewer-engine/.test(location.pathname)
  const sessionSeenRef = useRef<Set<string>>(
    new Set<string>(
      (() => {
        try {
          const raw = sessionStorage.getItem('seen_project_created_toasts_v1')
          return raw ? (JSON.parse(raw) as string[]) : []
        } catch {
          return []
        }
      })()
    )
  )

  useEffect(() => {
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000

    notifications.forEach((n) => {
      if (shownNotificationIds.current.has(n.id)) return
      if (sessionSeenRef.current.has(n.id)) return

      const title = (n.title || '').toLowerCase()
      const isSuccess = title.includes('project created') || title.includes('created successfully')
      if (!isSuccess) return
      if (user?.role !== 'ADMIN') return

      const createdAtMs = n.createdAt ? new Date(n.createdAt).getTime() : now
      const isRecent = now - createdAtMs <= tenMinutes
      const isUnread = !n.read
      const createdByMatches = n.metadata?.createdByUserId
        ? n.metadata.createdByUserId === user?.id
        : true
      if (!(isUnread && isRecent && createdByMatches)) return

      shownNotificationIds.current.add(n.id)
      sessionSeenRef.current.add(n.id)
      try {
        sessionStorage.setItem(
          'seen_project_created_toasts_v1',
          JSON.stringify(Array.from(sessionSeenRef.current))
        )
      } catch {}

      toast({
        title: n.title || 'Project Created Successfully',
        description: n.message,
        action: n.metadata?.projectId ? (
          <ToastAction
            altText="View Project"
            onClick={() => {
              markAsRead(n.id).catch(() => {})
              navigate(`/projects/${n.metadata!.projectId}`)
            }}
          >
            View
          </ToastAction>
        ) : undefined,
        className: 'border-[var(--uq-orange)]',
      })
    })
  }, [notifications, navigate, markAsRead, user?.role, user?.id])

  useEffect(() => {
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, isViewer ? 80 : 480)
    const id2 = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 520)
    return () => {
      window.clearTimeout(id)
      window.clearTimeout(id2)
    }
  }, [isViewer])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--uq-content)]">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm max-w-md w-full mx-4">
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-[var(--uq-orange)] flex items-center justify-center">
            <img src="/uniQube.png" alt="" className="w-9 h-9 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.12em]">UNIQUBE</h1>
          <p className="text-sm text-[var(--uq-muted)] mt-1">Loading workspace…</p>
          <div className="mt-6 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-[var(--uq-orange)] rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <div className="min-h-screen bg-[var(--uq-content)]">{children}</div>
  }

  return (
    <div className={cn('uq-app-shell fixed inset-0 overflow-hidden flex', isViewer && 'uq-shell-3d')}>
      <aside className={cn('uq-shell-aside', isViewer && 'uq-shell-aside-off')}>
        <Sidebar />
      </aside>

      <main className={cn('uq-shell-main flex-1 min-w-0 min-h-0 h-full overflow-hidden', isViewer && 'uq-shell-main-expand')}>
        <div className="uq-main-canvas">
          <div className={cn('uq-shell-chrome shrink-0 bg-white', isViewer && 'uq-shell-chrome-off')}>
            <WorkspaceHeader />
          </div>
          <div className={cn('uq-canvas-body', isViewer && 'uq-stage-3d')}>{children}</div>
        </div>
      </main>
      <Toaster />
    </div>
  )
}
