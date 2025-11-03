import { useState } from 'react'
import { Bell, Search, Settings, Menu, X, Box, LogOut, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <nav className="relative h-16 bg-white border-b border-slate-200">
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-16">
          {/* Left Section - Logo and Mobile Menu */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleMobileMenu}
              className="lg:hidden"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700 rounded-lg flex items-center justify-center shadow-sm">
                <Box className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                  UniQube 3D
                </h1>
                <p className="text-xs text-slate-600">IFC Project Control</p>
              </div>
            </div>
          </div>

          {/* Center Section - Search */}
          {/* <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, models..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-slate-600 transition-colors"
              />
            </div>
          </div> */}

          {/* Right Section - Actions and Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Notifications */}
            {/* <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1">
                3
              </Badge>
            </Button> */}

            {/* Settings */}
            {/* <Button
              variant="ghost"
              size="icon-sm"
              className="hidden sm:flex"
            >
              <Settings className="h-5 w-5" />
            </Button> */}

            {/* User Profile */}
            <div className="relative">
              <div 
                className="flex items-center space-x-3 px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user ? getUserInitials(user.name) : 'U'}
                    </span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-sm font-medium text-slate-900">{user?.name || 'User'}</div>
                  <div className="text-xs text-slate-600">{user?.email || 'user@example.com'}</div>
                </div>
              </div>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                      <p className="text-xs text-slate-600 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate('/profile')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <UserIcon className="w-4 h-4" />
                      Profile Settings
                    </button>
                    <div className="border-t border-slate-200 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
