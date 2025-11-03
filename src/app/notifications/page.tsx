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
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
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
          <div className="h-24 bg-slate-200 rounded mb-6"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 rounded mb-4"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-4 sm:space-y-6">
      {/* Header */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-slate-700">
                <Bell className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {unreadCount} New
                    </Badge>
                  )}
                </div>
                <p className="text-slate-600 text-sm">Stay updated with your project activities and alerts</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {unreadCount > 0 && (
                <Button variant="outline" onClick={markAllAsRead} className="flex-1 sm:flex-none">
                  Mark All Read
                </Button>
              )}
              <div className="flex gap-2">
                <Button 
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  All
                </Button>
                <Button 
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  onClick={() => setFilter('unread')}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  Unread ({unreadCount})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <Bell className="h-16 w-16 text-slate-400 mx-auto" />
                <h3 className="text-xl font-bold text-slate-900">
                  {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
                </h3>
                <p className="text-slate-600 text-sm">
                  {filter === 'unread' 
                    ? 'All caught up! Check back later for new updates.'
                    : 'You\'ll see notifications about your projects here.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all duration-200 hover:border-slate-300 border-slate-200 ${
                !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
              }`}
            >
              <CardContent 
                className="p-6 cursor-pointer"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-slate-200">
                      <AvatarImage src="/avatars/system.png" />
                      <AvatarFallback className="bg-slate-100">
                        {getNotificationIcon(notification.type)}
                      </AvatarFallback>
                    </Avatar>
                    {!notification.read && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-900 text-base truncate">
                        {notification.title}
                      </h3>
                      <Badge 
                        variant={
                          notification.type === 'success' ? 'success' :
                          notification.type === 'warning' ? 'warning' :
                          notification.type === 'error' ? 'destructive' :
                          'default'
                        }
                        className="text-xs"
                      >
                        {notification.type}
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(notification.createdAt)}
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-3 w-3 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-slate-700" />
              <h3 className="text-lg font-bold text-slate-900">Notification Preferences</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="justify-start h-12">
                <User className="h-4 w-4 mr-3" />
                Team Updates
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <Building2 className="h-4 w-4 mr-3" />
                Project Changes
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <Upload className="h-4 w-4 mr-3" />
                File Processing
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
