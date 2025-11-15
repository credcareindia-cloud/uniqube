import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Settings, Menu, X, Box, LogOut, User as UserIcon, CheckCircle, AlertTriangle, Info, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { useRBAC } from '@/contexts/RBACContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RoleBadge } from '@/components/ui/RoleBadge'

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false)
  const { user, logout } = useAuth()
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const { isAdmin } = useRBAC()
  const navigate = useNavigate()
  const notificationRef = useRef<HTMLDivElement>(null)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false)
      }
    }

    if (showNotificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotificationDropdown])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId)
    setShowNotificationDropdown(false)
    navigate('/notifications')
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
                <img src="/uniQube.png" alt="UniQube Logo" className="w-8 h-8 sm:w-12 sm:h-8" />
              </div>
              <div className="hidden sm:block">
               <h1 className="text-lg sm:text-xl font-bold text-slate-900">
  Uni<span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">Qube</span> 3D
</h1>

                <p className="text-xs text-slate-600">Centralized Project Manager</p>
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
            <div className="relative" ref={notificationRef}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1">
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              {/* Notification Dropdown */}
              {showNotificationDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Notifications</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowNotificationDropdown(false)
                          navigate('/notifications')
                        }}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        View All
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">
                        <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <p>No notifications yet</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-slate-50 cursor-pointer border-l-4 ${
                              notification.read 
                                ? 'border-l-transparent bg-white' 
                                : 'border-l-blue-500 bg-blue-50/30'
                            }`}
                            onClick={() => handleNotificationClick(notification.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${
                                  notification.read ? 'text-slate-600' : 'text-slate-900'
                                }`}>
                                  {notification.title}
                                </p>
                                <p className={`text-xs mt-1 ${
                                  notification.read ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                  {notification.message}
                                </p>
                                <div className="flex items-center mt-2 text-xs text-slate-400">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {new Date(notification.createdAt).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div> 

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
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    {user?.email || 'user@example.com'}
                    {user?.role && <RoleBadge role={user.role as any} size="sm" />}
                  </div>
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
