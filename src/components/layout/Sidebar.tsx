import React, { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FolderKanban,
  Bell,
  Settings,
  User,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/useNotifications'
import { useRBAC } from '@/contexts/RBACContext'
import { useAuth } from '@/contexts/AuthContext'

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  match?: (path: string) => boolean
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount } = useNotifications()
  const { isAdmin } = useRBAC()
  const { user, logout } = useAuth()

  const navigation: SidebarItem[] = useMemo(
    () => [
      {
        name: 'Projects',
        href: '/projects',
        icon: FolderKanban,
        match: (p) => p === '/' || p.startsWith('/projects'),
      },
      {
        name: 'Alerts',
        href: '/notifications',
        icon: Bell,
        count: unreadCount > 0 ? unreadCount : undefined,
      },
      {
        name: 'Profile',
        href: '/profile',
        icon: User,
      },
      ...(isAdmin ? [{ name: 'Administration', href: '/admin', icon: Settings }] : []),
    ],
    [unreadCount, isAdmin]
  )

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
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = item.match
            ? item.match(location.pathname)
            : location.pathname === item.href || location.pathname.startsWith(item.href + '/')

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => navigate(item.href)}
              className={cn('uq-nav-item', isActive && 'uq-nav-item-active')}
            >
              <Icon className="h-[16px] w-[16px] shrink-0" />
              <span className="uq-nav-label">{item.name}</span>
              {item.count != null && (
                <span className="uq-nav-count">{item.count}</span>
              )}
            </button>
          )
        })}
      </nav>

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
    </aside>
  )
}
