import React from 'react'
import { Badge } from '@/components/ui/badge'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Home,
  User,
  Bell,
  Shield,
  Database,
  Settings,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  count?: number
}

const navigation: SidebarItem[] = [
  // { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/projects', icon: Database },
  { name: 'Profile', href: '/profile', icon: User },
  // { name: 'Notifications', href: '/notifications', icon: Bell, count: 3 },
  { name: 'Administration', href: '/admin', icon: Shield },
]

const bottomNavigation: SidebarItem[] = [
  { name: 'Logout', href: '/logout', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigation = (href: string) => {
    navigate(href)
  }

  return (
    <aside className="h-full w-60 bg-slate-50 border-r border-slate-200 flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <div
              key={item.name}
              className={cn(
                "relative group cursor-pointer",
                isActive && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-slate-700 before:rounded-r"
              )}
              onClick={() => handleNavigation(item.href)}
            >
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive 
                  ? "bg-slate-100 text-slate-900" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              )}>
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.name}</span>
                
                {item.count && (
                  <div className="ml-auto">
                    <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center px-1.5">
                      {item.count}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </nav>
      

      {/* Logout */}
      <div className="p-3 border-t border-slate-200">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 transition-colors cursor-pointer"
          onClick={() => handleNavigation('/login')}
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Logout</span>
        </div>
      </div>
    </aside>
  )
}
