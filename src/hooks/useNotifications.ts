import { useState, useEffect } from 'react'
import { notificationService } from '@/services/notifications'
import type { Notification } from '@/services/api'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    try {
      console.log('🔔 useNotifications: Initializing...')
      
      // Initialize with current notifications
      setNotifications(notificationService.getNotifications())
      setUnreadCount(notificationService.getUnreadCount())

      // Subscribe to changes
      const unsubscribe = notificationService.subscribe((updatedNotifications) => {
        setNotifications(updatedNotifications)
        setUnreadCount(updatedNotifications.filter(n => !n.read).length)
      })

      // Return cleanup function
      return () => {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe()
          }
        } catch (error) {
          console.error('Error during notification cleanup:', error)
        }
      }
    } catch (error) {
      console.error('Error initializing notifications:', error)
      return () => {} // Return empty cleanup function
    }
  }, [])

  const markAsRead = (id: string) => {
    notificationService.markAsRead(id)
  }

  const markAllAsRead = () => {
    notificationService.markAllAsRead()
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}
