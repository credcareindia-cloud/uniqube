import type { Notification } from './api'

// In-memory notification store (could be replaced with Redux/Zustand later)
class NotificationService {
  private notifications: Notification[] = []
  private listeners: ((notifications: Notification[]) => void)[] = []

  // Subscribe to notification changes
  subscribe(callback: (notifications: Notification[]) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  // Notify all listeners
  private notify() {
    this.listeners.forEach(callback => callback([...this.notifications]))
  }

  // Add a new notification
  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>) {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    }

    this.notifications.unshift(newNotification) // Add to beginning
    this.notify()
    return newNotification
  }

  // Mark notification as read
  markAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id)
    if (notification) {
      notification.read = true
      this.notify()
    }
  }

  // Mark all as read
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true)
    this.notify()
  }

  // Get all notifications
  getNotifications() {
    return [...this.notifications]
  }

  // Get unread count
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length
  }

  // Project-specific notification helpers
  addProjectCreatedNotification(projectName: string, projectId?: string) {
    return this.addNotification({
      type: 'success',
      title: 'Project Created Successfully',
      message: `${projectName} has been created and is ready to explore. Your IFC model has been processed successfully.${projectId ? ` Project ID: ${projectId}` : ''}`,
      read: false,
      metadata: { projectId, projectName }
    })
  }

  addProjectProcessingNotification(projectName: string) {
    return this.addNotification({
      type: 'info',
      title: 'Project Processing Started',
      message: `${projectName} is being processed. You'll be notified when it's ready.`,
      read: false,
    })
  }

  addProjectProcessingFailedNotification(projectName: string, error?: string) {
    return this.addNotification({
      type: 'error',
      title: 'Project Processing Failed',
      message: `Failed to process ${projectName}. ${error || 'Please try uploading again or contact support if the issue persists.'}`,
      read: false,
    })
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
