import React, { useEffect, useRef } from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/components/ui/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { useNavigate } from 'react-router-dom'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading: loading } = useAuth()
  const { notifications, markAsRead } = useNotifications()
  const shownNotificationIds = useRef<Set<string>>(new Set())
  const navigate = useNavigate()
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
  const mountedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000

    notifications.forEach((n) => {
      if (shownNotificationIds.current.has(n.id)) return
      if (sessionSeenRef.current.has(n.id)) return

      const title = (n.title || '').toLowerCase()
      const isSuccess = title.includes('project created') || title.includes('created successfully')
      if (!isSuccess) return

      // Admin only
      if (user?.role !== 'ADMIN') return

      // Only unread and recent (last 10 minutes)
      const createdAtMs = n.createdAt ? new Date(n.createdAt).getTime() : now
      const isRecent = now - createdAtMs <= tenMinutes
      const isUnread = !n.read

      // Created by current user if provided; otherwise allow (admin-only flow)
      const createdByMatches = n.metadata?.createdByUserId ? (n.metadata.createdByUserId === user?.id) : true
      if (!(isUnread && isRecent && createdByMatches)) return

      shownNotificationIds.current.add(n.id)
      sessionSeenRef.current.add(n.id)
      try {
        sessionStorage.setItem('seen_project_created_toasts_v1', JSON.stringify(Array.from(sessionSeenRef.current)))
      } catch {}

      toast({
        title: n.title || 'Project Created Successfully',
        description: n.message,
        action: n.metadata?.projectId ? (
          <ToastAction altText="View Project" onClick={() => {
            markAsRead(n.id).catch(() => {})
            navigate(`/projects/${n.metadata!.projectId}`)
          }}>
            View
          </ToastAction>
        ) : undefined,
        className: 'border-slate-700'
      })
    })
  }, [notifications, navigate, markAsRead, user?.role, user?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        {/* Clean Loading Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm max-w-md w-full mx-4">
          {/* Logo/Icon */}
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto bg-slate-700 rounded-lg flex items-center justify-center shadow-sm">
              <div className="text-2xl font-bold text-white">3D</div>
            </div>
          </div>
          
          {/* Title */}
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-slate-900">UniQube 3D</h1>
            <p className="text-slate-600 text-sm mt-1">IFC Project Control</p>
          </div>
          
          {/* Status */}
          <div className="mb-6">
            <p className="text-slate-600 text-sm font-medium">Initializing system...</p>
          </div>
          
          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-slate-700 rounded-full animate-pulse" style={{ width: '75%' }}></div>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
              <span className="text-slate-600">Loading...</span>
              <span className="text-slate-900 font-medium">75%</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        {children}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-50">
      {/* Fixed Top Navigation - Full width */}
      <header className="absolute top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-200">
        <Navbar />
      </header>
      
      {/* Fixed Sidebar - Desktop */}
      <aside className="absolute top-16 left-0 bottom-0 w-60 z-40 hidden lg:block bg-slate-50 border-r border-slate-200">
        <Sidebar />
      </aside>
      
      {/* Mobile Sidebar Overlay */}
      <div className="absolute inset-0 z-30 lg:hidden" id="mobile-sidebar-overlay" style={{ display: 'none' }}>
        <div className="absolute inset-0 bg-black/50" id="mobile-sidebar-backdrop"></div>
        <aside className="absolute top-16 left-0 bottom-0 w-60 bg-slate-50 border-r border-slate-200">
          <Sidebar />
        </aside>
      </div>
      
      {/* Main Content Area - Full coverage */}
      <main className="absolute top-16 right-0 bottom-0 left-0 lg:left-60 overflow-auto bg-white">
        <div className="min-h-full p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    <Toaster />
    </div>
  )
}
