import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Bell, CheckCircle, AlertTriangle, Info, Clock, Loader, AlertCircle, Box, Power } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title?: string
  subtitle?: string
  viewerProjectId?: string | null
  leading?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  viewerProjectId,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const { logout } = useAuth()
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const navigate = useNavigate()
  const notificationRef = useRef<HTMLDivElement>(null)

  const unreadNotifications = notifications.filter((n) => !n.read)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false)
      }
    }
    if (showNotificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotificationDropdown])

  const getNotificationIcon = (notification: any) => {
    const type = notification.type
    const titleText = (notification.title || '').toLowerCase()
    const message = (notification.message || '').toLowerCase()
    if (titleText.includes('failed') || message.includes('failed')) {
      return <AlertCircle className="h-4 w-4 text-red-600" />
    }
    if (titleText.includes('processing') || titleText.includes('started')) {
      return <Loader className="h-4 w-4 text-sky-600 animate-spin" />
    }
    if (titleText.includes('successfully') || titleText.includes('completed')) {
      return <CheckCircle className="h-4 w-4 text-emerald-600" />
    }
    switch (type) {
      case 'model-processed':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'user-mention':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />
      default:
        return <Info className="h-4 w-4 text-sky-600" />
    }
  }

  return (
    <div className={cn('shrink-0 bg-white', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {(title || subtitle) && (
      <div className="shrink-0">
        {title && (
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[var(--uq-ink)]">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-sm text-[var(--uq-muted)] mt-1 font-medium">{subtitle}</p>
        )}
      </div>
      )}

      {leading && <div className="flex-1 min-w-0 w-full">{leading}</div>}

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0 sm:ml-auto">
        {actions}
        {viewerProjectId && (
          <Button
            onClick={() => navigate(`/projects/${viewerProjectId}/viewer-engine`)}
          >
            <Box className="h-4 w-4" />
            Open 3D Viewer
          </Button>
        )}

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            className="uq-util-btn"
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                <button
                  type="button"
                  className="text-sm text-[var(--uq-orange)] font-medium"
                  onClick={() => {
                    setShowNotificationDropdown(false)
                    navigate('/notifications')
                  }}
                >
                  View All
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {unreadNotifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No new notifications</div>
                ) : (
                  unreadNotifications.slice(0, 5).map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-l-4 border-l-[var(--uq-orange)]"
                      onClick={() => {
                        markAsRead(notification.id)
                        setShowNotificationDropdown(false)
                        navigate('/notifications')
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5">{getNotificationIcon(notification)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center mt-2 text-xs text-slate-400">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(notification.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="uq-util-btn"
          aria-label="Sign out"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <Power className="h-4 w-4" />
        </button>
      </div>
      </div>
    </div>
  )
}
