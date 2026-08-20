import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Clock,
  Eye,
  MoreHorizontal,
  Filter,
  Loader,
  AlertCircle,
  X,
  Trash2,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/services/api'

// const mockNotifications: Notification[] = [
//   {
//     id: '1',
//     type: 'success',
//     title: 'Model Upload Complete',
//     message: 'Tower A - Level 15.ifc has been successfully processed and is ready for viewing.',
//     read: false,
//     createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago
//   },
//   {
//     id: '2',
//     type: 'warning',
//     title: 'Panel Status Update Required',
//     message: 'Panel PA-1205 in Group G-12 needs status verification. Last updated 3 days ago.',
//     read: false,
//     createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
//   },
//   {
//     id: '3',
//     type: 'info',
//     title: 'New Team Member Added',
//     message: 'John Smith has been added to the Manufacturing Complex project team.',
//     read: true,
//     createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
//   },
//   {
//     id: '4',
//     type: 'success',
//     title: 'Group G-08 Completed',
//     message: 'All 45 panels in Group G-08 have been marked as completed. Great work!',
//     read: true,
//     createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
//   },
//   {
//     id: '5',
//     type: 'error',
//     title: 'Model Processing Failed',
//     message: 'Failed to process Residential_Block_B.ifc. File may be corrupted or too large.',
//     read: false,
//     createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
//   },
//   {
//     id: '6',
//     type: 'info',
//     title: 'Weekly Report Available',
//     message: 'Your weekly project summary report is ready for download.',
//     read: true,
//     createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
//   }
// ]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAsUnread, markAllAsRead, deleteNotification } = useNotifications()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId && !(e.target as HTMLElement).closest('[data-menu]')) {
        setOpenMenuId(null)
      }
    }
    
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.type
    const title = notification.title || ''
    const message = notification.message || ''
    
    const isFailed = title.toLowerCase().includes('failed') || message.toLowerCase().includes('failed')
    const isProcessing = title.toLowerCase().includes('processing started') || title.toLowerCase().includes('started')
    const isSuccess = title.toLowerCase().includes('successfully') || title.toLowerCase().includes('completed')
    
    if (isFailed) {
      return <AlertCircle className="h-5 w-5 text-red-600" />
    }
    
    if (isProcessing) {
      return <Loader className="h-5 w-5 text-blue-600 animate-spin" />
    }
    
    if (isSuccess) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    }
    
    switch (type) {
      case 'project-update':
        return <Info className="h-5 w-5 text-blue-600" />
      case 'model-processed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'group-status-change':
        return <Info className="h-5 w-5 text-blue-600" />
      case 'user-mention':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />
      case 'system':
        return <Info className="h-5 w-5 text-blue-600" />
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
    <div className="w-full max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--uq-ink)]">Alerts</h1>
          <p className="text-sm text-[var(--uq-muted)] mt-1">Stay updated with project activities</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} New
                </Badge>
              )}
              {unreadCount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark All Read
                </Button>
              )}
              <div className="flex gap-2 border border-slate-200 rounded-lg p-1 bg-white">
                <Button 
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setFilter('all')}
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  All
                </Button>
                <Button 
                  variant={filter === 'unread' ? 'default' : 'ghost'}
                  onClick={() => setFilter('unread')}
                  size="sm"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Unread ({unreadCount})
                </Button>
              </div>
          </div>
      </div>

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
              className={`transition-all duration-200 hover:border-slate-300 border-slate-200 cursor-pointer ${
                !notification.read ? 'border-l-4 border-l-[var(--uq-orange)] bg-[var(--uq-orange-soft)]' : ''
              }`}
              onClick={() => {
                if (notification.read) {
                  markAsUnread(notification.id)
                } else {
                  markAsRead(notification.id)
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-slate-200">
                      <AvatarImage src="/avatars/system.png" />
                      <AvatarFallback className="bg-slate-100">
                        {getNotificationIcon(notification)}
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
                          notification.title?.toLowerCase().includes('failed') ? 'destructive' :
                          notification.title?.toLowerCase().includes('successfully') ? 'success' :
                          notification.title?.toLowerCase().includes('processing') ? 'default' :
                          'default'
                        }
                        className="text-xs"
                      >
                        {notification.type?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(notification.createdAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        {notification.title?.toLowerCase().includes('successfully') && 
                         notification.metadata?.projectId && (
                          <Button 
                            size="sm" 
                            className="h-8 px-3"
                            onClick={() => {
                              markAsRead(notification.id)
                              navigate(`/projects/${notification.metadata!.projectId}`)
                            }}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Go to Project
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (notification.read) {
                              markAsUnread(notification.id)
                            } else {
                              markAsRead(notification.id)
                            }
                          }}
                          title={notification.read ? 'Mark as Unread' : 'Mark as Read'}
                        >
                          {notification.read ? (
                            <Bell className="h-4 w-4 text-slate-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => deleteNotification(notification.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* <div className="relative" data-menu>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={() => setOpenMenuId(openMenuId === notification.id ? null : notification.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {openMenuId === notification.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10" data-menu>
                        <button
                          onClick={() => {
                            if (notification.read) {
                              markAsUnread(notification.id)
                            } else {
                              markAsRead(notification.id)
                            }
                            setOpenMenuId(null)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          {notification.read ? (
                            <>
                              <Bell className="h-4 w-4" />
                              Mark as Unread
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Mark as Read
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            deleteNotification(notification.id)
                            setOpenMenuId(null)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div> */}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Details Modal */}
      {selectedNotification && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedNotification(null)}
        >
          <Card 
            className="w-full max-w-md border-slate-200 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border-2 border-slate-200">
                    <AvatarImage src="/avatars/system.png" />
                    <AvatarFallback className="bg-slate-100">
                      {getNotificationIcon(selectedNotification)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedNotification.title}
                    </h2>
                    <Badge variant="outline" className="text-xs mt-1">
                      {selectedNotification.type?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <button
                    onClick={() => {
                      deleteNotification(selectedNotification.id)
                      setSelectedNotification(null)
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-slate-700 text-sm leading-relaxed">
                  {selectedNotification.message}
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Time:</span>
                  <span>{formatTimestamp(selectedNotification.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <Badge variant={selectedNotification.read ? 'outline' : 'destructive'} className="text-xs">
                    {selectedNotification.read ? 'Read' : 'Unread'}
                  </Badge>
                </div>
                {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="block font-semibold mb-2">Details:</span>
                    <div className="space-y-1">
                      {Object.entries(selectedNotification.metadata).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 flex-col sm:flex-row">
                {selectedNotification.title?.toLowerCase().includes('successfully') && 
                 selectedNotification.metadata?.projectId && (
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      markAsRead(selectedNotification.id)
                      navigate(`/projects/${selectedNotification.metadata!.projectId}`)
                      setSelectedNotification(null)
                    }}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Go to Project
                  </Button>
                )}
                <Button 
                  variant={selectedNotification.read ? 'outline' : 'default'}
                  className="flex-1"
                  onClick={() => {
                    if (selectedNotification.read) {
                      markAsUnread(selectedNotification.id)
                    } else {
                      markAsRead(selectedNotification.id)
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {selectedNotification.read ? 'Mark as Unread' : 'Mark as Read'}
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    deleteNotification(selectedNotification.id)
                    setSelectedNotification(null)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* {/* Quick Actions
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
      </Card> */}
    </div>
  )
}
