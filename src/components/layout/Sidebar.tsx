import React from 'react'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Home,
  User,
  Bell,
  Shield,
  Activity,
  Zap,
  Database,
  Settings
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
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/projects', icon: Database },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Notifications', href: '/notifications', icon: Bell, count: 3 },
  { name: 'Administration', href: '/admin', icon: Shield },
]

const bottomNavigation: SidebarItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigation = (href: string) => {
    navigate(href)
  }

  return (
    <div className="flex flex-col w-64 h-full relative">
      {/* Professional Background */}
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.95)] backdrop-blur-xl border-r border-[rgba(184,188,200,0.1)]"></div>
      
      {/* Main Navigation - Full Height */}
      <nav className="relative flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          const Icon = item.icon
          
          return (
            <div
              key={item.name}
              className={cn(
                "relative group cursor-pointer",
                isActive && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-[#4A90E2] before:rounded-r"
              )}
              onClick={() => handleNavigation(item.href)}
            >
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                isActive 
                  ? "bg-[rgba(74,144,226,0.15)] text-[#4A90E2] shadow-lg shadow-[rgba(74,144,226,0.2)]" 
                  : "text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]"
              )}>
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">{item.name}</span>
                
                {item.count && (
                  <div className="ml-auto">
                    <ProfessionalGamingBadge variant="info" size="sm">
                      {item.count}
                    </ProfessionalGamingBadge>
                  </div>
                )}
              </div>
              
              {/* Hover Effect */}
              <div className={cn(
                "absolute inset-0 rounded-lg border transition-all duration-300",
                isActive 
                  ? "border-[rgba(74,144,226,0.3)]" 
                  : "border-transparent group-hover:border-[rgba(74,144,226,0.2)]"
              )}></div>
            </div>
          )
        })}
      </nav>

      {/* Bottom Settings - Minimal */}
      <div className="relative px-4 py-4 border-t border-[rgba(184,188,200,0.1)]">
        {bottomNavigation.map((item) => {
          const isActive = location.pathname === item.href
          const Icon = item.icon
          
          return (
            <div
              key={item.name}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300",
                isActive 
                  ? "bg-[rgba(74,144,226,0.15)] text-[#4A90E2]" 
                  : "text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]"
              )}
              onClick={() => handleNavigation(item.href)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">{item.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
