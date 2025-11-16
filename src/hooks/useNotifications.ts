import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import type { Notification } from '@/services/api'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.getNotifications()
      setNotifications(response.notifications)
      setUnreadCount(response.unreadCount)
      setError(null)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()

    const interval = setInterval(fetchNotifications, 5000)

    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationsRead({ notificationIds: [id] })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  const markAsUnread = useCallback(async (id: string) => {
    try {
      await api.markNotificationsUnread({ notificationIds: [id] })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: false } : n)
      )
      setUnreadCount(prev => prev + 1)
    } catch (err) {
      console.error('Error marking notification as unread:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markNotificationsRead({ markAll: true })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      const wasUnread = notifications.find(n => n.id === id)?.read === false
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }, [notifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
