'use client'

import { useState, useEffect } from 'react'
import { Clock, User, Package, Layers, FileText, CheckCircle, AlertCircle, Info, Users, Tag, Plus, TrendingUp } from 'lucide-react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { getApiUrl } from '@/config/api'

// DEPRECATED: Using centralized authenticatedFetch from utils
// Helper function to make authenticated fetch requests
const authenticatedFetch_OLD = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (options.headers) {
    const existingHeaders = new Headers(options.headers)
    existingHeaders.forEach((value, key) => {
      headers[key] = value
    })
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(url, {
    ...options,
    headers,
  })
}

interface Activity {
  id: string
  type: 'panel_created' | 'panel_updated' | 'group_created' | 'status_changed' | 'model_uploaded'
  title: string
  description: string
  timestamp: string
  user?: string
  metadata?: any
}

interface OverviewTabProps {
  projectId: number
  totalPanels: number
  groups: any[]
  panels: any[]
  panelStatuses: any[]
  groupsCount: number
  onCreateStatus?: () => void
  onCreateGroup?: () => void
  canManage?: boolean
}

export function OverviewTab({ projectId, totalPanels, groups, panels, groupsCount, onCreateStatus, onCreateGroup, canManage = false }: OverviewTabProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [customStatuses, setCustomStatuses] = useState<any[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [healthStats, setHealthStats] = useState({
    panelsWithoutGroups: 0,
    panelsWithoutStatus: 0,
    totalPanels: 0
  })

  useEffect(() => {
    fetchActivities()
    fetchCustomStatuses()
    fetchHealthStats()
  }, [projectId])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(getApiUrl(`projects/${projectId}/activities`))
      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomStatuses = async () => {
    try {
      setLoadingStats(true)
      const response = await authenticatedFetch(getApiUrl(`status-management/${projectId}`))
      if (response.ok) {
        const data = await response.json()
        setCustomStatuses(Array.isArray(data) ? data : (data.statuses || []))
      }
    } catch (error) {
      console.error('Error fetching statuses:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchHealthStats = async () => {
    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${projectId}/health`))
      if (response.ok) {
        const data = await response.json()
        setHealthStats({
          panelsWithoutGroups: data.panelsWithoutGroups || 0,
          panelsWithoutStatus: data.panelsWithoutStatus || 0,
          totalPanels: data.totalPanels || 0
        })
      }
    } catch (error) {
      console.error('Error fetching health stats:', error)
    }
  }

  // Use health stats from API instead of calculating from limited panels array
  const panelsWithoutGroups = healthStats.panelsWithoutGroups
  const panelsWithoutStatus = healthStats.panelsWithoutStatus
  
  // Get top 3 groups by panel count
  const topGroups = groups
    .map(g => ({
      ...g,
      panelCount: g._count?.panelGroups || 0
    }))
    .sort((a, b) => b.panelCount - a.panelCount)
    .slice(0, 3)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'panel_created':
      case 'panel_updated':
        return <Package className="w-5 h-5 text-blue-600" />
      case 'group_created':
        return <Layers className="w-5 h-5 text-green-600" />
      case 'status_changed':
        return <CheckCircle className="w-5 h-5 text-orange-600" />
      case 'model_uploaded':
        return <FileText className="w-5 h-5 text-purple-600" />
      default:
        return <Info className="w-5 h-5 text-slate-600" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'panel_created':
      case 'panel_updated':
        return 'bg-blue-50 border-blue-200'
      case 'group_created':
        return 'bg-green-50 border-green-200'
      case 'status_changed':
        return 'bg-orange-50 border-orange-200'
      case 'model_uploaded':
        return 'bg-purple-50 border-purple-200'
      default:
        return 'bg-slate-50 border-slate-200'
    }
  }

  if (loading || loadingStats) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Panels */}
        {/* <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Panels</p>
              <p className="text-3xl font-bold text-slate-900">{totalPanels}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div> */}

        {/* Total Groups */}
        {/* <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Groups</p>
              <p className="text-3xl font-bold text-slate-900">{groupsCount}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
              <Layers className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div> */}

        {/* Total Statuses */}
        {/* <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Statuses</p>
              <p className="text-3xl font-bold text-slate-900">{customStatuses.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div> */}

        {/* Completion Rate */}
        {/* <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Completion</p>
              <p className="text-3xl font-bold text-slate-900">
                {totalPanels > 0 ? Math.round(((totalPanels - panelsWithoutStatus) / totalPanels) * 100) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div> */}
      </div>

      {/* Quick Actions */}
      {canManage && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={onCreateStatus}
              className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Create New Status</p>
                <p className="text-sm text-slate-500">Add a custom status for panels</p>
              </div>
            </button>

            <button
              onClick={onCreateGroup}
              className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Create New Group</p>
                <p className="text-sm text-slate-500">Organize panels into groups</p>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups Overview */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Top Groups</h3>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          {topGroups.length > 0 ? (
            <div className="space-y-3">
              {topGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{group.name}</p>
                    {group.description && (
                      <p className="text-sm text-slate-500 truncate">{group.description}</p>
                    )}
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-900">{group.panelCount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No groups created yet</p>
            </div>
          )}
        </div>

        {/* Project Health Indicators */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Project Health</h3>
            <CheckCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {/* Panels without groups */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  panelsWithoutGroups > 0 ? 'bg-yellow-50' : 'bg-green-50'
                }`}>
                  <Layers className={`w-5 h-5 ${
                    panelsWithoutGroups > 0 ? 'text-yellow-600' : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Panels without Groups</p>
                  <p className="text-sm text-slate-500">Panels not assigned to any group</p>
                </div>
              </div>
              <span className={`text-2xl font-bold ${
                panelsWithoutGroups > 0 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {panelsWithoutGroups}
              </span>
            </div>

            {/* Panels without status */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  panelsWithoutStatus > 0 ? 'bg-yellow-50' : 'bg-green-50'
                }`}>
                  <Tag className={`w-5 h-5 ${
                    panelsWithoutStatus > 0 ? 'text-yellow-600' : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Panels without Status</p>
                  <p className="text-sm text-slate-500">Panels not assigned any status</p>
                </div>
              </div>
              <span className={`text-2xl font-bold ${
                panelsWithoutStatus > 0 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {panelsWithoutStatus}
              </span>
            </div>

            {/* Overall health score */}
            {/* <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Overall Health</span>
                <span className={`text-lg font-bold ${
                  panelsWithoutGroups === 0 && panelsWithoutStatus === 0 
                    ? 'text-green-600' 
                    : (panelsWithoutGroups + panelsWithoutStatus) < totalPanels * 0.2
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {panelsWithoutGroups === 0 && panelsWithoutStatus === 0 
                    ? 'Excellent' 
                    : (panelsWithoutGroups + panelsWithoutStatus) < totalPanels * 0.2
                    ? 'Good'
                    : 'Needs Attention'}
                </span>
              </div>
            </div> */}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {/* <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-slate-700" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500">Track all changes and updates to your project</p>
            </div>
          </div>
        </div>

        {activities.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {activities.map((activity) => (
              <div key={activity.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-slate-900">{activity.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                        {activity.user && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            <span>{activity.user}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No activity yet</h3>
            <p className="text-sm text-slate-500">
              Activity will appear here as you work on your project
            </p>
          </div>
        )}
      </div> */}
    </div>
  )
}
