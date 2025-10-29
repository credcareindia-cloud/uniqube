import { useState } from 'react'
import { Bell, Search, Settings, Menu, X, Zap, Activity, Wifi, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <nav className="relative h-16">
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-16">
          {/* Left Section - Logo and Mobile Menu */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg hover:bg-[rgba(74,144,226,0.1)] transition-all duration-300"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5 text-[#E8EAF0]" /> : <Menu className="h-5 w-5 text-[#E8EAF0]" />}
            </Button>

            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-lg flex items-center justify-center shadow-lg">
                  <Zap className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#50C878] rounded-full border-2 border-[#0F1419] animate-pulse"></div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">
                  UniQube 3D
                </h1>
                <div className="flex items-center space-x-2 text-xs text-[#B8BCC8]">
                  <Activity className="h-3 w-3 text-[#50C878]" />
                  <span className="font-mono">ONLINE</span>
                  <Wifi className="h-3 w-3 text-[#4A90E2]" />
                  <span className="font-mono">CONNECTED</span>
                  <Shield className="h-3 w-3 text-[#50C878]" />
                  <span className="font-mono">SECURE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B8BCC8]" />
              <input
                type="text"
                placeholder="Search projects, models, or commands..."
                className="w-full pl-10 pr-4 py-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[rgba(74,144,226,0.5)] focus:ring-1 focus:ring-[rgba(74,144,226,0.3)] transition-all duration-300"
              />
            </div>
          </div>

          {/* Right Section - Actions and Profile */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg hover:bg-[rgba(74,144,226,0.1)] transition-all duration-300"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-[#E8EAF0]" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs bg-[#FF6B6B] text-white rounded-full flex items-center justify-center">
                3
              </span>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:block p-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg hover:bg-[rgba(74,144,226,0.1)] transition-all duration-300"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-[#E8EAF0]" />
            </Button>

            {/* User Profile */}
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-[rgba(74,144,226,0.1)] hover:border-[rgba(74,144,226,0.2)] transition-all duration-300">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="relative">
                  <div className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-[rgba(74,144,226,0.3)] rounded-full bg-gradient-to-br from-[#4A90E2] to-[#357ABD] flex items-center justify-center">
                    <span className="text-white font-bold text-xs sm:text-sm">U</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-[#50C878] border-2 border-[#0F1419] rounded-full"></div>
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-sm font-medium text-[#E8EAF0] uppercase tracking-wider">Demo User</div>
                  <div className="text-xs text-[#B8BCC8] font-mono">demo@uniqube3d.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
