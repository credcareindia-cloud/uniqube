import { useState, useEffect } from 'react'
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Clock, 
  User, 
  Building2, 
  Upload,
  Eye,
  MoreHorizontal,
  Settings,
  Filter
} from 'lucide-react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { api } from '@/services/api'
import type { Notification } from '@/services/api'

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Model Upload Complete',
    message: 'Tower A - Level 15.ifc has been successfully processed and is ready for viewing.',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago
  },
  {
    id: '2',
    type: 'warning',
    title: 'Panel Status Update Required',
    message: 'Panel PA-1205 in Group G-12 needs status verification. Last updated 3 days ago.',
    read: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
  },
  {
    id: '3',
    type: 'info',
    title: 'New Team Member Added',
    message: 'John Smith has been added to the Manufacturing Complex project team.',
    read: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
  },
  {
    id: '4',
    type: 'success',
    title: 'Group G-08 Completed',
    message: 'All 45 panels in Group G-08 have been marked as completed. Great work!',
    read: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
  },
  {
    id: '5',
    type: 'error',
    title: 'Model Processing Failed',
    message: 'Failed to process Residential_Block_B.ifc. File may be corrupted or too large.',
    read: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
  },
  {
    id: '6',
    type: 'info',
    title: 'Weekly Report Available',
    message: 'Your weekly project summary report is ready for download.',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  }
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  // Load notifications from backend
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getNotifications()
        setNotifications(response.notifications)
      } catch (err) {
        console.error('Failed to load notifications:', err)
        setError('Failed to load notifications. Using mock data for development.')
        
        // Fallback to mock data for development
        setNotifications(mockNotifications)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationsRead({ notificationIds: [id] })
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
      // Optimistically update UI even if API call fails
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.markNotificationsRead({ markAll: true })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
      // Optimistically update UI even if API call fails
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-[#4A9B6B]" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
      default:
        return <Info className="h-5 w-5 text-[#3A7BD5]" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="w-full h-full space-y-6">
        <div className="animate-pulse">
          <div className="h-24 bg-[rgba(26,31,46,0.8)] rounded mb-6"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-[rgba(26,31,46,0.8)] rounded mb-4"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-4 sm:space-y-6">
      {/* Professional Header */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-lg">
              <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">NOTIFICATIONS</h1>
                {unreadCount > 0 && (
                  <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-[rgba(239,68,68,0.2)] border-[#EF4444] text-[#EF4444]">
                    {unreadCount} NEW
                  </div>
                )}
              </div>
              <p className="text-[#B8BCC8] text-sm">Stay updated with your project activities and alerts</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {unreadCount > 0 && (
              <ProfessionalGamingButton variant="secondary" onClick={markAllAsRead} className="flex-1 sm:flex-none">
                MARK ALL READ
              </ProfessionalGamingButton>
            )}
            <div className="flex gap-2">
              <ProfessionalGamingButton 
                variant={filter === 'all' ? 'primary' : 'secondary'}
                onClick={() => setFilter('all')}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Filter className="h-4 w-4 mr-2" />
                ALL
              </ProfessionalGamingButton>
              <ProfessionalGamingButton 
                variant={filter === 'unread' ? 'primary' : 'secondary'}
                onClick={() => setFilter('unread')}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                UNREAD ({unreadCount})
              </ProfessionalGamingButton>
            </div>
          </div>
        </div>
      </ProfessionalGamingCard>

      {/* Error Message */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg p-4">
          <p className="text-[#EF4444] text-sm">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredNotifications.length === 0 ? (
          <ProfessionalGamingCard variant="panel" className="p-8 sm:p-12 text-center">
            <div className="space-y-4">
              <Bell className="h-12 w-12 sm:h-16 sm:w-16 text-[#6B7280] mx-auto" />
              <h3 className="text-lg sm:text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">
                {filter === 'unread' ? 'NO UNREAD NOTIFICATIONS' : 'NO NOTIFICATIONS'}
              </h3>
              <p className="text-[#B8BCC8] text-sm">
                {filter === 'unread' 
                  ? 'All caught up! Check back later for new updates.'
                  : 'You\'ll see notifications about your projects here.'}
              </p>
            </div>
          </ProfessionalGamingCard>
        ) : (
          filteredNotifications.map((notification) => (
            <ProfessionalGamingCard 
              key={notification.id} 
              variant={!notification.read ? "monitor" : "panel"}
              className={`transition-all duration-200 hover:border-[rgba(58,123,213,0.4)] ${
                !notification.read ? 'border-l-4 border-l-[#3A7BD5] bg-[rgba(58,123,213,0.05)]' : ''
              }`}
            >
              <div 
                className="p-4 sm:p-6 cursor-pointer"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="relative">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-[rgba(58,123,213,0.3)]">
                      <AvatarImage src="/avatars/system.png" />
                      <AvatarFallback className="bg-[rgba(37,42,58,0.8)]">
                        {getNotificationIcon(notification.type)}
                      </AvatarFallback>
                    </Avatar>
                    {!notification.read && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#3A7BD5] rounded-full border-2 border-[#1A1F2E]"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h3 className="font-bold text-[#E8EAF0] text-sm sm:text-base uppercase tracking-wider truncate">
                        {notification.title}
                      </h3>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        notification.type === 'success' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                        notification.type === 'warning' ? 'bg-[rgba(245,158,11,0.2)] border-[#F59E0B] text-[#F59E0B]' :
                        notification.type === 'error' ? 'bg-[rgba(239,68,68,0.2)] border-[#EF4444] text-[#EF4444]' :
                        'bg-[rgba(58,123,213,0.2)] border-[#3A7BD5] text-[#3A7BD5]'
                      }`}>
                        {notification.type.toUpperCase()}
                      </div>
                    </div>
                    <p className="text-[#B8BCC8] text-sm mb-3 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(notification.createdAt)}
                      </div>
                      <ProfessionalGamingButton variant="secondary" size="sm">
                        <Eye className="h-3 w-3 mr-2" />
                        VIEW DETAILS
                      </ProfessionalGamingButton>
                    </div>
                  </div>
                  
                  <ProfessionalGamingButton variant="secondary" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </ProfessionalGamingButton>
                </div>
              </div>
            </ProfessionalGamingCard>
          ))
        )}
      </div>

      {/* Professional Quick Actions */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-[#3A7BD5]" />
            <h3 className="text-base sm:text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">NOTIFICATION PREFERENCES</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <ProfessionalGamingButton variant="secondary" className="justify-start h-12">
              <User className="h-4 w-4 mr-3" />
              TEAM UPDATES
            </ProfessionalGamingButton>
            <ProfessionalGamingButton variant="secondary" className="justify-start h-12">
              <Building2 className="h-4 w-4 mr-3" />
              PROJECT CHANGES
            </ProfessionalGamingButton>
            <ProfessionalGamingButton variant="secondary" className="justify-start h-12">
              <Upload className="h-4 w-4 mr-3" />
              FILE PROCESSING
            </ProfessionalGamingButton>
          </div>
        </div>
      </ProfessionalGamingCard>
    </div>
  )
}
