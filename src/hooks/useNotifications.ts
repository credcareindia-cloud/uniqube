import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/services/api'
import type { Notification } from '@/services/api'
import { useWebSocket } from './useWebSocket'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to track if we're currently fetching to prevent overlapping requests
  const isFetchingRef = useRef(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // WebSocket connection
  const { isConnected, on, off } = useWebSocket({
    enabled: true,
    onConnect: () => {
      console.log('WebSocket connected - stopping polling');
      // Stop polling when WebSocket connects
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // Fetch latest notifications on connect
      fetchNotifications();
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - polling will start via useEffect');
      // Polling will be started automatically by the useEffect when isConnected changes
    },
  });

  // Track last fetch time to throttle requests (min 2s interval)
  const lastFetchTimeRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    // Prevent overlapping requests
    if (isFetchingRef.current) return;

    // Throttle requests to prevent flooding (e.g. on rapid connect/disconnect)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      console.log('Skipping notification fetch - throttled');
      return;
    }
    lastFetchTimeRef.current = now;

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

  // Stabilize fetchNotifications with a ref to avoid dependency issues
  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Use refs to store the latest callback functions to avoid dependency issues
  const onRef = useRef(on);
  const offRef = useRef(off);

  useEffect(() => {
    onRef.current = on;
    offRef.current = off;
  }, [on, off]);

  useEffect(() => {
    // Initial fetch
    fetchNotificationsRef.current()

    // Listen for WebSocket notifications
    const handleNotification = (notification: Notification) => {
      console.log('Received WebSocket notification:', notification);
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    };

    onRef.current('notification', handleNotification);

    // Start polling if WebSocket is not connected
    if (!isConnected && !pollingIntervalRef.current) {
      console.log('WebSocket not connected, starting polling fallback (30s interval)');
      pollingIntervalRef.current = setInterval(() => {
        fetchNotificationsRef.current();
      }, 30000);
    }

    return () => {
      offRef.current('notification', handleNotification);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isConnected]) // ONLY depend on isConnected - nothing else!

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
