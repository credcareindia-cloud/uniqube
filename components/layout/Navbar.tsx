'use client'

import React, { useState } from 'react'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { useAuth } from '@/components/auth/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Bell, Search, Settings, LogOut, User, Zap, Activity, Shield, Wifi, Menu, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function Navbar() {
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
    const overlay = document.getElementById('mobile-sidebar-overlay')
    if (overlay) {
      overlay.style.display = isMobileMenuOpen ? 'none' : 'block'
    }
  }

  return (
    <nav className="relative">
      {/* Professional Background */}
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.95)] backdrop-blur-xl border-b border-[rgba(184,188,200,0.1)]"></div>
      
      <div className="relative px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Mobile Menu Button */}
        <div className="lg:hidden">
          <ProfessionalGamingButton 
            variant="secondary" 
            size="sm"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </ProfessionalGamingButton>
        </div>

        {/* Professional Logo and Status */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-lg sm:text-xl font-semibold text-[#E8EAF0] uppercase tracking-wider">UNIQUBE 3D</div>
              <div className="text-xs text-[#B8BCC8] uppercase tracking-wider">IFC PROJECT CONTROL</div>
            </div>
          </div>
          
          {/* System Status Indicators - Hidden on mobile and tablet */}
          <div className="hidden xl:flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#50C878]" />
              <span className="text-xs text-[#50C878] font-mono font-medium">SYS OK</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#4A90E2]" />
              <span className="text-xs text-[#4A90E2] font-mono font-medium">ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#7B68EE]" />
              <span className="text-xs text-[#7B68EE] font-mono font-medium">SECURE</span>
            </div>
          </div>
        </div>

        {/* Professional Search Terminal - Hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B8BCC8] h-4 w-4" />
            <Input
              placeholder="Search projects, groups, panels..."
              className="pl-10 bg-[rgba(37,42,58,0.8)] border-[rgba(184,188,200,0.1)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#4A90E2] focus:ring-[rgba(74,144,226,0.2)]"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-2 h-2 bg-[#4A90E2] rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Professional Control Panel */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Notifications */}
          <div className="relative">
            <ProfessionalGamingButton variant="secondary" size="sm">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </ProfessionalGamingButton>
            <ProfessionalGamingBadge variant="error" size="sm" className="absolute -top-2 -right-2">
              3
            </ProfessionalGamingBadge>
          </div>

          {/* Settings - Hidden on mobile */}
          <div className="hidden sm:block">
            <ProfessionalGamingButton variant="secondary" size="sm">
              <Settings className="h-5 w-5" />
            </ProfessionalGamingButton>
          </div>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-[rgba(74,144,226,0.1)] hover:border-[rgba(74,144,226,0.2)] transition-all duration-300">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="relative">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-[rgba(74,144,226,0.3)]">
                      <AvatarImage src="/avatars/demo-user.png" />
                      <AvatarFallback className="bg-gradient-to-br from-[#4A90E2] to-[#357ABD] text-white font-bold text-xs sm:text-sm">
                        {user?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-[#50C878] border-2 border-[#0F1419] rounded-full"></div>
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="text-sm font-medium text-[#E8EAF0] uppercase tracking-wider">{user?.name || 'USER'}</div>
                    <div className="text-xs text-[#B8BCC8] font-mono">{user?.email || 'demo@uniqube3d.com'}</div>
                  </div>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[rgba(15,20,25,0.95)] border-[rgba(184,188,200,0.1)] backdrop-blur-xl">
              <DropdownMenuItem className="text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[rgba(184,188,200,0.1)]" />
              <DropdownMenuItem onClick={handleLogout} className="text-[#FF6B6B] hover:text-[#FF5555] hover:bg-[rgba(255,107,107,0.1)]">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
