import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/services/api'
import type { Notification } from '@/services/api'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to track if we're currently fetching to prevent overlapping requests
  const isFetchingRef = useRef(false)

  const fetchNotifications = useCallback(async () => {
    if (isFetchingRef.current) return

    try {
      isFetchingRef.current = true
      // Only set loading on initial fetch to avoid UI flickering
      if (notifications.length === 0) setLoading(true)

      const response = await api.getNotifications()
      setNotifications(response.notifications)
      setUnreadCount(response.unreadCount)
      setError(null)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      // Don't set error state for background polling failures to avoid UI disruption
      if (notifications.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
      }
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [notifications.length])

  useEffect(() => {
    // Initial fetch
    fetchNotifications()

    // Set up polling interval
    const interval = setInterval(() => {
      fetchNotifications()
    }, 5000)

    return () => clearInterval(interval)
  }, []) // Empty dependency array to ensure effect runs only once on mount

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
