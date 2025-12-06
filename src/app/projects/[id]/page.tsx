import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  Package,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  AlertCircle,
  Users,
  FileText,
  Layers,
  Box,
  ExternalLink,
  Building2,
  Activity,
  BarChart3,
  X
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateStatusModal } from '@/components/modals/CreateStatusModal'
import { CreateGroupModal } from '@/components/modals/CreateGroupModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { OverviewTab } from '@/components/project-tabs/OverviewTab'
import { StatusManagementTab } from '@/components/project-tabs/StatusManagementTab'
import { GroupManagementTab } from '@/components/project-tabs/GroupManagementTab'
import { PanelManagementTab } from '@/components/project-tabs/PanelManagementTab'
import { ProjectDetailsTab } from '@/components/project-tabs/ProjectDetailsTab'
import { EditProjectModal } from '@/components/modals/EditProjectModal'
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal'
import { DeletingProjectModal } from '@/components/modals/DeletingProjectModal'

import type { Panel } from '@/types/panel'
import type { Group } from '@/types/group'
import { PanelStatus, PANEL_STATUS_CONFIG } from '@/types/panel'
import { GroupStatus, GROUP_STATUS_CONFIG } from '@/types/group'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { getApiUrl } from '@/config/api'
import { useNotifications } from '@/hooks/useNotifications'
import { useProjectPermissions } from '@/hooks/useProjectPermissions'
import { useRBAC } from '@/contexts/RBACContext'


interface ProjectData {
  id: number
  displayNumber?: number
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface Model {
  id: string
  originalFilename: string
  type: string
  status: string
  sizeBytes: string
  processingProgress: number
  elementCount: number | null
  version: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ProjectModels {
  currentModel: Model | null
  modelHistory: Model[]
  totalVersions: number
  hasModel: boolean
}

interface PanelStatusSummary {
  status: PanelStatus
  count: number
  percentage: number
  color: string
  label: string
}

interface CustomStatus {
  id: string
  projectId: number
  name: string
  icon: string
  color: string
  description?: string
  order: number
  panelCount?: number
  createdAt: string
  updatedAt: string
}

// Helper function to get panel status variant for badge - DEPRECATED (now using custom statuses)
// const getPanelStatusVariant = (status: PanelStatus): 'neutral' | 'active' | 'warning' | 'completed' | 'error' | 'info' => {
//   switch (status) {
//     case PanelStatus.SHIPPED:
//       return 'completed'
//     case PanelStatus.READY_FOR_PRODUCTION:
//     case PanelStatus.PRODUCED:
//       return 'active'
//     case PanelStatus.PRE_FABRICATED:
//     case PanelStatus.READY_FOR_TRUCK_LOAD:
//       return 'info'
//     case PanelStatus.EDIT:
//       return 'error'
//     default:
//       return 'neutral'
//   }
// }

// Status configuration for badges - using panel status config
const statusConfig = {
  // Project statuses (uppercase)
  'PLANNING': { label: 'Planning', variant: 'neutral' as const, icon: Clock, color: '#8B5CF6' },
  'ACTIVE': { label: 'Active', variant: "default" as const, icon: CheckCircle, color: '#3B82F6' },
  'ON_HOLD': { label: 'On Hold', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'COMPLETED': { label: 'Completed', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  // 'CANCELLED': { label: 'Cancelled', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  // Model statuses (uppercase)
  'READY': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'PROCESSING': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'UPLOADED': { label: 'Uploaded', variant: 'neutral' as const, icon: Package, color: '#8B5CF6' },
  'FAILED': { label: 'Failed', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  // Transformed statuses (lowercase with hyphens from backend)
  'planning': { label: 'Planning', variant: 'neutral' as const, icon: Clock, color: '#8B5CF6' },
  'active': { label: 'Active', variant: "default" as const, icon: CheckCircle, color: '#3B82F6' },
  'on-hold': { label: 'On Hold', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'completed': { label: 'Completed', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  // 'cancelled': { label: 'Cancelled', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  // Model statuses (lowercase)
  'ready': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'processing': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'error': { label: 'Error', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' }
}


const getIconComponent = (iconName: string) => {
  // Map FontAwesome/kebab-case names to Lucide PascalCase names (matching CreateStatusModal)
  const iconNameMap: Record<string, string> = {
    'angle-double-down': 'ChevronsDown',
    'angle-double-left': 'ChevronsLeft',
    'angle-double-right': 'ChevronsRight',
    'angle-double-up': 'ChevronsUp',
    'angle-down': 'ChevronDown',
    'angle-left': 'ChevronLeft',
    'angle-right': 'ChevronRight',
    'angle-up': 'ChevronUp',
    'bell': 'Bell',
    'bookmark': 'Bookmark',
    'box': 'Box',
    'check': 'Check',
    'circle': 'Circle',
    'clock': 'Clock',
    'code': 'Code',
    'exclamation': 'AlertTriangle',
    'eye': 'Eye',
    'file': 'File',
    'folder': 'Folder',
    'forward': 'Forward',
    'hashtag': 'Hash',
    'info': 'Info',
    'lightbulb': 'Lightbulb',
    'lock': 'Lock',
    'lock-open': 'LockOpen',
    'map-marker': 'MapPin',
    'minus': 'Minus',
    'pause': 'Pause',
    'pen-to-square': 'Edit',
    'phone': 'Phone',
    'play': 'Play',
    'plus': 'Plus',
    'reply': 'Reply',
    'save': 'Save',
    'search': 'Search',
    'send': 'Send',
    'server': 'Server',
    'share-alt': 'Share2',
    'shield': 'Shield',
    'shop': 'ShoppingBag',
    'sign-in': 'LogIn',
    'sign-out': 'LogOut',
    'sliders-h': 'SlidersHorizontal',
    'sort': 'ArrowUpDown',
    'spinner': 'Loader',
    'star': 'Star',
    'stop-circle': 'StopCircle',
    'stopwatch': 'Timer',
    'tag': 'Tag',
    'thumbs-down': 'ThumbsDown',
    'thumbs-up': 'ThumbsUp',
    'thumbtack': 'Pin',
    'th-large': 'Grid3x3',
    'ticket': 'Ticket',
    'times': 'X',
    'times-circle': 'XCircle',
    'trash': 'Trash2',
    'undo': 'Undo',
    'unlock': 'Unlock',
    'user': 'User',
    'users': 'Users',
    'verified': 'BadgeCheck',
    'warehouse': 'Warehouse',
    'maximize': 'Maximize',
    'minimize': 'Minimize',
    'wrench': 'Wrench',
    'package': 'Package',
  }

  // Convert icon name to Lucide format
  const lucideIconName = iconNameMap[iconName.toLowerCase()] || iconName

  // Try to get icon from Lucide
  const LucideIcon = (LucideIcons as any)[lucideIconName]
  if (LucideIcon) {
    return LucideIcon
  }

  // Default fallback
  return (LucideIcons as any).Circle
}
// Helper function to get status config
const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || statusConfig.PLANNING
}

// Calculate panel statuses from real data
const calculatePanelStatuses = (panels: Panel[]): PanelStatusSummary[] => {
  const statusCounts: Record<string, number> = {}
  const totalPanels = panels.length

  if (totalPanels === 0) return []

  // Count panels by status
  panels.forEach(panel => {
    statusCounts[panel.status] = (statusCounts[panel.status] || 0) + 1
  })

  // Convert to PanelStatusSummary array with icons and colors
  return Object.entries(statusCounts).map(([status, count]) => {
    const config = PANEL_STATUS_CONFIG[status as PanelStatus]
    return {
      status: status as PanelStatus,
      count,
      percentage: Math.round((count / totalPanels) * 100),
      color: config?.color || '#6B7280',
      label: config?.label || status,
    }
  })
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notifications } = useNotifications()
  const permissions = useProjectPermissions(id)
  const { refreshUserProjects, isAdmin } = useRBAC()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [models, setModels] = useState<ProjectModels | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')
  const [panels, setPanels] = useState<Panel[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [panelStatuses, setPanelStatuses] = useState<PanelStatusSummary[]>([])
  const [panelsLoading, setPanelsLoading] = useState(false)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [totalPanelCount, setTotalPanelCount] = useState<number>(0)
  const [displayedPanelCount, setDisplayedPanelCount] = useState<number>(0)
  const [panelPage, setPanelPage] = useState(1)
  const [panelTotalPages, setPanelTotalPages] = useState(1)
  const [panelLimit] = useState(50) // Panels per page

  // Group management state
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>('all')
  const [groupStatusFilter, setGroupStatusFilter] = useState<string>('all')
  const [groupPage, setGroupPage] = useState(1)
  const [groupTotalPages, setGroupTotalPages] = useState(1)
  const [groupTotalCount, setGroupTotalCount] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showGroupDetail, setShowGroupDetail] = useState(false)

  // Status management state
  const [selectedStatus, setSelectedStatus] = useState<PanelStatus | null>(null)
  const [showStatusDetail, setShowStatusDetail] = useState(false)
  const [statusPanels, setStatusPanels] = useState<Panel[]>([])
  const [loadingStatusPanels, setLoadingStatusPanels] = useState(false)
  const [showCreateStatusModal, setShowCreateStatusModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([])
  const [statusRefreshKey, setStatusRefreshKey] = useState(0)
  const [groupRefreshKey, setGroupRefreshKey] = useState(0)
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0)
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)

  // Model metadata state (storeys and panels from IFC)
  const [modelMetadata, setModelMetadata] = useState<any>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [expandedStoreys, setExpandedStoreys] = useState<Set<string>>(new Set())

  // Edit/Delete Project state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false)
  const [showDeletingProjectModal, setShowDeletingProjectModal] = useState(false)
  const [isSavingProject, setIsSavingProject] = useState(false)

  const [isDeletingProject, setIsDeletingProject] = useState(false)



  useEffect(() => {
    loadProjectData()
    loadAllPanels()
    loadGroups(1)
    loadCustomStatuses()
  }, [id])

  useEffect(() => {
    if (!permissions.canManage && ['status', 'groups', 'panels'].includes(activeTab)) {
      setActiveTab('overview')
    }
  }, [permissions.canManage])

  // Load model metadata when current model changes
  useEffect(() => {
    if (models?.currentModel?.id) {
      loadModelMetadata(models.currentModel.id)
    }
  }, [models?.currentModel?.id])

  // Listen for project creation notifications and refresh project data
  useEffect(() => {
    const projectCreatedNotifications = notifications.filter(
      n => n.type === 'success' && n.title.includes('Project Created') &&
        (n.metadata?.projectId === id || n.message.includes(id || ''))
    )

    if (projectCreatedNotifications.length > 0) {
      // Refresh project data when we get a notification for this specific project
      console.log('🔄 Detected project creation notification for this project, refreshing data...')
      loadProjectData()
      loadAllPanels()
      loadGroups(1)
    }
  }, [notifications, id])

  const loadProjectData = async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)

      const response = await authenticatedFetch(getApiUrl(`projects/${id}`))
      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Project data:', data)

      // The simplified API returns the project directly, not wrapped in a project property
      setProject(data)

      // Set models from project data (modelHistory)
      if (data.modelHistory && data.modelHistory.length > 0) {
        setModels({
          currentModel: data.currentModel,
          modelHistory: data.modelHistory,
          totalVersions: data.modelHistory.length,
          hasModel: data.currentModel !== null
        })

        // Use spatial structure to get total panel count only
        // Status overview will be calculated in real-time from actual panel data
        if (data.currentModel && data.currentModel.spatialStructure) {
          try {
            // spatialStructure is already parsed as an object from the database (Json type in Prisma)
            const spatialData = data.currentModel.spatialStructure
            console.log('📊 Spatial structure metadata:', spatialData)
            setTotalPanelCount(spatialData.totalPanels || 0)
            setDisplayedPanelCount(spatialData.displayedPanels || 0)

            // Don't load status overview from cached metadata
            // It will be calculated in real-time by calculatePanelStatusCounts()
          } catch (error) {
            console.error('Failed to process spatial structure:', error)
          }
        }
      } else {
        setModels({
          currentModel: null,
          modelHistory: [],
          totalVersions: 0,
          hasModel: false
        })
      }

      // Load panels and groups from API
      await Promise.all([
        loadAllPanels(),
        loadGroups()
      ])

    } catch (err) {
      console.error('Error loading project data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  const loadModelMetadata = async (modelId: string) => {
    try {
      setMetadataLoading(true)
      console.log('📊 Loading model metadata from database...')

      const response = await authenticatedFetch(getApiUrl(`models/${modelId}/metadata`))
      if (!response.ok) {
        console.error('Failed to fetch model metadata:', response.status)
        return
      }

      const data = await response.json()
      console.log('✅ Model metadata loaded from database:', data)

      if (data.success && data.model) {
        setModelMetadata(data.model)
        console.log('📦 Storeys and panels:', data.model.spatialStructure)
      }
    } catch (error) {
      console.error('Error loading model metadata:', error)
    } finally {
      setMetadataLoading(false)
    }
  }

  const loadPanels = async (page = panelPage) => {
    if (!id) return

    try {
      setPanelsLoading(true)
      // Request with pagination
      const response = await authenticatedFetch(getApiUrl(`panels/${id}?page=${page}&limit=${panelLimit}`))

      if (!response.ok) {
        console.error('Failed to fetch panels:', response.status, response.statusText)
        return
      }

      const data = await response.json()

      // Handle paginated response
      const panelsData = data.panels || data
      console.log('✅ Panels loaded:', panelsData.length, `(Page ${page})`)

      if (data.pagination) {
        console.log('📄 Pagination:', data.pagination)
        setPanelTotalPages(data.pagination.totalPages || 1)

        // Set total panel count from metadata (actual FRAG file count)
        if (data.pagination.totalFromMetadata) {
          setTotalPanelCount(data.pagination.totalFromMetadata)
          setDisplayedPanelCount(data.pagination.total)
        }
      }

      setPanels(panelsData)

      // Calculate real-time panel status counts (only once, not per page)
      if (page === 1) {
        await calculatePanelStatusCounts()
      }
    } catch (error) {
      console.error('Error loading panels:', error)
      setPanelStatuses([])
    } finally {
      setPanelsLoading(false)
    }
  }

  // Calculate panel status counts from statistics endpoint (efficient!)
  const calculatePanelStatusCounts = async () => {
    if (!id) {
      console.log('⚠️ No project ID, skipping status calculation')
      return
    }

    console.log('🔄 Fetching panel statistics for project:', id)

    try {
      // Use the efficient statistics endpoint instead of fetching all panels
      const response = await authenticatedFetch(getApiUrl(`panels/${id}/statistics`))

      if (!response.ok) {
        console.error('❌ Failed to fetch panel statistics:', response.status)
        return
      }

      const data = await response.json()
      const { totalPanels, statusDistribution } = data

      console.log('✅ Panel statistics:', { totalPanels, statusDistribution })

      // Convert to status summary format
      const statusOverview = Object.entries(statusDistribution).map(([status, count]) => {
        const statusConfig = PANEL_STATUS_CONFIG[status as PanelStatus] || {
          label: status,
          color: '#6B7280',
          icon: Package
        }

        return {
          status: status as PanelStatus,
          count: count as number,
          percentage: totalPanels > 0 ? Math.round((count as number / totalPanels) * 100) : 0,
          color: statusConfig.color,
          label: statusConfig.label
        }
      })

      console.log('📊 Real-time status overview:', statusOverview)
      setPanelStatuses(statusOverview)
    } catch (error) {
      console.error('❌ Error fetching panel statistics:', error)
    }
  }

  const loadAllPanels = async () => {
    if (!id) return

    try {
      setPanelsLoading(true)
      const response = await authenticatedFetch(getApiUrl(`panels/${id}/all`))

      if (!response.ok) {
        console.error('Failed to fetch all panels:', response.status, response.statusText)
        return
      }

      const data = await response.json()
      const panelsData = data.panels || []
      console.log('✅ All panels loaded:', panelsData.length)

      setPanels(panelsData)
      setTotalPanelCount(panelsData.length)
      setDisplayedPanelCount(panelsData.length)

      await calculatePanelStatusCounts()
    } catch (error) {
      console.error('Error loading all panels:', error)
      setPanelStatuses([])
    } finally {
      setPanelsLoading(false)
    }
  }

  const handleEditProject = async (data: { name: string; description: string; status: string }) => {
    if (!id || !project) return

    try {
      setIsSavingProject(true)
      const response = await authenticatedFetch(getApiUrl(`projects/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Failed to update project')
      }

      const responseData = await response.json()
      if (responseData?.project) {
        setProject(responseData.project)
      } else if (responseData) {
        setProject(responseData)
      }
      setShowEditProjectModal(false)
      await refreshUserProjects()
      await loadProjectData()
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project')
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!id) return

    try {
      // Close confirmation modal and show deleting modal
      setShowDeleteProjectModal(false)
      setShowDeletingProjectModal(true)
      setIsDeletingProject(true)

      // Use the safe-delete endpoint for batched deletion
      const response = await authenticatedFetch(getApiUrl(`projects/${id}/safe-delete`), {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      const result = await response.json()
      console.log('✅ Project deleted successfully:', result.summary)

      await refreshUserProjects()

      // Keep the modal visible briefly before navigating
      setTimeout(() => {
        navigate('/projects')
      }, 500)
    } catch (error) {
      console.error('Error deleting project:', error)
      setShowDeletingProjectModal(false)
      setIsDeletingProject(false)
      alert('Failed to delete project. Please try again.')
    }
  }


  const loadGroups = async (page: number = 1) => {
    if (!id) return

    try {
      setGroupsLoading(true)
      // Request with pagination: 50 items per page
      const response = await authenticatedFetch(getApiUrl(`groups/${id}?page=${page}&limit=50`))
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Groups data:', data)

        // Handle paginated response
        const groupsData = data.groups || data
        console.log('✅ Groups loaded:', Array.isArray(groupsData) ? groupsData.length : 0)
        console.log('🎨 Group colors:', groupsData?.map((g: any) => ({ name: g.name, color: g.color })))

        if (data.pagination) {
          console.log('📄 Groups pagination:', data.pagination)
          setGroupTotalPages(data.pagination.totalPages || 1)
          setGroupTotalCount(data.pagination.total || 0)
        }

        const groups = Array.isArray(groupsData) ? groupsData : []
        setGroups(groups)
      } else {
        console.error('Failed to fetch groups')
        setGroups([])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
      setGroups([])
    } finally {
      setGroupsLoading(false)
    }
  }

  // Calculate group progress from panel statuses
  const calculateGroupProgress = async (groupId: string): Promise<number> => {
    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${id}?groupId=${groupId}`))
      if (response.ok) {
        const data = await response.json()
        const panels = data.panels || []
        if (panels.length === 0) return 0

        const completedStatuses = ['SHIPPED']
        const completedCount = panels.filter((p: Panel) => completedStatuses.includes(p.status)).length
        return Math.round((completedCount / panels.length) * 100)
      }
    } catch (error) {
      console.error('Error calculating group progress:', error)
    }
    return 0
  }

  // Filter groups by type and status
  const filteredGroups = groups.filter(group => {
    const typeMatch = groupTypeFilter === 'all' || group.metadata?.type === groupTypeFilter
    const statusMatch = groupStatusFilter === 'all' || group.status === groupStatusFilter
    return typeMatch && statusMatch
  })

  // Handle group detail view
  const handleViewGroup = (group: Group) => {
    setSelectedGroup(group)
    setShowGroupDetail(true)
  }

  // Handle pagination
  const handleGroupPageChange = (newPage: number) => {
    setGroupPage(newPage)
    loadGroups(newPage)
  }

  // Load panels by status
  const loadPanelsByStatus = async (status: PanelStatus) => {
    if (!id) return

    try {
      setLoadingStatusPanels(true)
      const response = await authenticatedFetch(getApiUrl(`panels/${id}?status=${status}&limit=100`))
      if (response.ok) {
        const data = await response.json()
        setStatusPanels(data.panels || [])
      }
    } catch (error) {
      console.error('Error loading panels by status:', error)
      setStatusPanels([])
    } finally {
      setLoadingStatusPanels(false)
    }
  }

  // Handle status card click
  const handleStatusClick = async (status: PanelStatus) => {
    setSelectedStatus(status)
    setShowStatusDetail(true)
    await loadPanelsByStatus(status)
  }

  // Handle custom status card click
  const handleCustomStatusClick = async (customStatusId: string) => {
    if (!id) return

    try {
      setLoadingStatusPanels(true)
      setShowStatusDetail(true)

      // Fetch panels with this custom status
      const response = await authenticatedFetch(getApiUrl(`panels/${id}?customStatusId=${customStatusId}&limit=100`))
      if (response.ok) {
        const data = await response.json()
        setStatusPanels(data.panels || [])

        // Find the custom status name for display
        const customStatus = customStatuses.find(s => s.id === customStatusId)
        setSelectedStatus(customStatus?.name as any || 'Custom Status')
      }
    } catch (error) {
      console.error('Error loading panels by custom status:', error)
      setStatusPanels([])
    } finally {
      setLoadingStatusPanels(false)
    }
  }

  // Bulk update panel status
  const handleBulkStatusUpdate = async (panelIds: string[], newStatus: PanelStatus) => {
    if (!id) return

    try {
      const response = await authenticatedFetch(getApiUrl('panels/bulk-update-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelIds, status: newStatus })
      })

      if (response.ok) {
        // Reload panels and status overview
        await loadPanels()
        await loadProjectData()
        await refreshUserProjects()
        setShowStatusDetail(false)
      }
    } catch (error) {
      console.error('Error updating panel statuses:', error)
    }
  }

  // Load custom statuses
  const loadCustomStatuses = async () => {
    if (!id) return

    try {
      const response = await authenticatedFetch(getApiUrl(`status-management/${id}`))
      if (response.ok) {
        const data = await response.json()
        setCustomStatuses(data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading custom statuses:', error)
    }
  }

  // Create custom status
  const handleCreateStatus = async (statusData: {
    name: string
    icon: string
    color: string
    description?: string
  }) => {
    if (!id) return

    try {
      console.log('📤 Sending status data:', statusData);
      console.log('📤 Stringified:', JSON.stringify(statusData));
      const response = await authenticatedFetch(getApiUrl(`status-management/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusData)
      })

      if (!response.ok) {
        throw new Error('Failed to create status')
      }

      // Reload custom statuses
      await loadCustomStatuses()

      // Trigger refresh in StatusManagementTab
      setStatusRefreshKey(prev => prev + 1)
      await refreshUserProjects() // Refresh global project list
    } catch (error) {
      console.error('Error creating status:', error)
      throw error
    }
  }

  // Create group
  const handleCreateGroup = async (groupData: {
    name: string
    description: string
    type: string
    color: string
  }) => {
    if (!id) return

    console.log('🚀 Creating group with data:', groupData)

    try {
      const response = await authenticatedFetch(getApiUrl(`group-management/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData)
      })

      if (!response.ok) {
        throw new Error('Failed to create group')
      }

      // Reload groups and trigger refresh in other tabs
      await loadGroups(groupPage)
      setGroupRefreshKey(prev => prev + 1)
      setOverviewRefreshKey(prev => prev + 1)
      await refreshUserProjects() // Refresh global project list to update group count
    } catch (error) {
      console.error('Error creating group:', error)
      throw error
    }
  }

  // Panel selection handlers
  const togglePanelSelection = (panelId: string) => {
    setSelectedPanels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(panelId)) {
        newSet.delete(panelId)
      } else {
        newSet.add(panelId)
      }
      return newSet
    })
  }

  const selectAllPanels = () => {
    const filteredPanelIds = panels
      .filter(panel => {
        const matchesSearch = panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (panel.tag && panel.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (panel.location && panel.location.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesStatus = statusFilter === 'all' || panel.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .map(p => String(p.id))
    setSelectedPanels(new Set(filteredPanelIds))
  }

  const clearPanelSelection = () => {
    setSelectedPanels(new Set())
  }

  // Bulk operations
  const handleBulkAssignStatus = async (statusId: string) => {
    if (!id || selectedPanels.size === 0) return

    try {
      const response = await authenticatedFetch(getApiUrl('status-management/assign-to-panels'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(id),
          statusId,
          panelIds: Array.from(selectedPanels)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to assign status')
      }

      // Reload panels
      await loadPanels()
      await refreshUserProjects() // Refresh global project list
      clearPanelSelection()
    } catch (error) {
      console.error('Error assigning status:', error)
      throw error
    }
  }

  const handleBulkAddToGroup = async (groupId: string) => {
    if (!id || selectedPanels.size === 0) return

    try {
      console.log(`🔄 Assigning ${selectedPanels.size} panels to group ${groupId}`)

      // Update each panel individually with the new groupId
      const updatePromises = Array.from(selectedPanels).map(async (panelId) => {
        const response = await authenticatedFetch(getApiUrl(`panels/${id}/${panelId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId })
        })

        if (!response.ok) {
          throw new Error(`Failed to update panel ${panelId}`)
        }

        return response.json()
      })

      await Promise.all(updatePromises)

      console.log(`✅ Successfully assigned ${selectedPanels.size} panels to group`)

      // Reload panels and groups
      await loadPanels()
      await loadGroups(groupPage)
      await refreshUserProjects() // Refresh global project list
      clearPanelSelection()
    } catch (error) {
      console.error('❌ Error adding panels to group:', error)
      alert('Failed to assign panels to group. Please try again.')
    }
  }

  // Panel detail and edit handlers
  const handlePanelClick = (panel: Panel) => {
    setSelectedPanel(panel)
    setShowPanelDetail(true)
  }

  const handleEditPanel = () => {
    setShowPanelDetail(false)
    setShowEditPanel(true)
  }

  const handleUpdatePanel = async (panelId: string, updates: {
    description?: string
    status?: PanelStatus
    customStatusIds?: string[]
    groupIds?: string[]
    assemblyInstructions?: any[]
  }) => {
    if (!id) return

    try {
      console.log('🔄 Updating panel:', panelId, updates)

      // Use PATCH endpoint to update statuses and groups correctly
      const response = await authenticatedFetch(getApiUrl(`panels/${panelId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusIds: updates.customStatusIds,
          groupIds: updates.groupIds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update panel')
      }

      console.log('✅ Panel updated successfully')

      // Reload panels
      await loadPanels()
      await refreshUserProjects() // Refresh global project list

      // Close modal
      setShowEditPanel(false)
      setSelectedPanel(null)
    } catch (error) {
      console.error('❌ Error updating panel:', error)
      throw error
    }
  }

  const handleDeletePanel = async (panelId: string) => {
    if (!id) return

    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${id}/${panelId}`), {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete panel')
      }

      console.log('✅ Panel deleted successfully')

      // Reload panels
      await loadPanels()

      // Close modals
      setShowPanelDetail(false)
      setSelectedPanel(null)
    } catch (error) {
      console.error('❌ Error deleting panel:', error)
      throw error
    }
  }

  const handleDuplicatePanel = async (panelId: string) => {
    if (!id) return

    try {
      const panel = panels.find(p => p.id === panelId)
      if (!panel) return

      const response = await authenticatedFetch(getApiUrl(`panels/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${panel.name} (Copy)`,
          tag: panel.tag,
          objectType: panel.objectType,
          dimensions: panel.dimensions,
          location: panel.location,
          material: panel.material,
          weight: panel.weight,
          area: panel.area,
          status: panel.status,
          groupId: panel.groupId,
          notes: panel.notes,
          metadata: panel.metadata
        })
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate panel')
      }

      console.log('✅ Panel duplicated successfully')

      // Reload panels
      await loadPanels()

      // Close modals
      setShowPanelDetail(false)
      setSelectedPanel(null)
    } catch (error) {
      console.error('❌ Error duplicating panel:', error)
      throw error
    }
  }

  const handleCreatePanel = async (panelData: any) => {
    if (!id) return

    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${id}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(panelData)
      })
      if (response.ok) {
        await loadPanels() // Refresh panels
      }
    } catch (err) {
      console.error('Error creating panel:', err)
    }
  }

  const handleUpdatePanelStatus = async (panelId: string, status: PanelStatus, notes?: string) => {
    if (!id) return

    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${id}/${panelId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, notes })
      })
      if (response.ok) {
        await loadPanels() // Refresh panels
      }
    } catch (err) {
      console.error('Error updating panel status:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const openViewer = (modelId?: string) => {
    if (models?.currentModel?.id || modelId) {
      navigate(`/projects/${id}/viewer-engine`)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-slate-700 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-slate-900">Loading Project...</h2>
          <p className="text-slate-600 mt-2">Fetching project details</p>
        </div>
      </div>
    )
  }

  if (!permissions.canView) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-4">You don't have permission to view this project.</p>
          <Button onClick={() => navigate('/projects')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="w-full h-full">
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <Building2 className="h-12 w-12 text-red-400" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">PROJECT NOT FOUND</h2>
                <p className="text-slate-600 mb-4">{error || 'Project could not be loaded'}</p>
                <Button
                  onClick={() => navigate('/projects')}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  BACK TO PROJECTS
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      {/* Minimal Header - MyAssembly Style */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects')}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-semibold text-slate-900">
                {/* {project.displayNumber && <span className="text-slate-500">#{project.displayNumber} </span>} */}
                {project.name}
              </h1>
            </div>
            {models?.currentModel && (models.currentModel.status === 'READY' || models.currentModel.status === 'ready') && (
              <button
                onClick={() => openViewer(models?.currentModel?.id)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open 3D Viewer
              </button>
            )}
          </div>
        </div>

        {/* Minimal Tabs */}
        <div className="px-8">
          <div className="flex gap-8 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'overview'
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Overview
              {activeTab === 'overview' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
            {permissions.canManage && (
              <>
                <button
                  onClick={() => setActiveTab('status')}
                  className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'status'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Status Management
                  {activeTab === 'status' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('groups')}
                  className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'groups'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Group Management
                  {activeTab === 'groups' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('panels')}
                  className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'panels'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Panel Management
                  {activeTab === 'panels' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-3 text-sm font-medium transition-colors relative ml-auto ${activeTab === 'details'
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Project Details
              {activeTab === 'details' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Panel Status Overview - Only on Overview Tab */}
      {activeTab === 'overview' && (
        <div className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="flex items-start gap-8 overflow-x-auto pb-2">
            {/* Total Panels */}
            <div className="flex-shrink-0 pt-1">
              <div className="text-xs text-slate-500 mb-1">Total Panels</div>
              <div className="text-2xl font-semibold text-slate-900">{totalPanelCount > 0 ? totalPanelCount : panels.length}</div>
            </div>

            {/* Status Cards - Horizontal */}
            {customStatuses.length > 0 ? customStatuses.map((status) => {
              const panelCount = status.panelCount || 0;
              const percentage = totalPanelCount > 0 ? Math.round((panelCount / totalPanelCount) * 100) : 0;
              const IconComponent = getIconComponent(status.icon);

              return (
                <div key={status.id} className="flex-shrink-0 min-w-[160px] pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className="w-5 h-5" style={{ color: status.color }} />
                    <div className="text-xs text-slate-500">{status.name}</div>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <div className="text-2xl font-semibold text-slate-900">{panelCount}</div>
                    <div className="text-xs text-slate-500">{percentage}%</div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: status.color,
                        width: `${percentage}%`
                      }}
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="flex-1 py-8 text-center text-slate-500 text-sm">
                No status data available. Create statuses in Status Management.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-slate-50">
        <div className="px-8 py-6">
          {activeTab === 'overview' && (
            <OverviewTab
              key={overviewRefreshKey}
              projectId={parseInt(id!)}
              totalPanels={totalPanelCount > 0 ? totalPanelCount : panels.length}
              groups={groups}
              panels={panels}
              panelStatuses={panelStatuses}
              groupsCount={groupTotalCount > 0 ? groupTotalCount : groups.length}
              onCreateStatus={() => setShowCreateStatusModal(true)}
              onCreateGroup={() => setShowCreateGroupModal(true)}
              canManage={permissions.canManage}
            />
          )}

          {activeTab === 'status' && (
            <StatusManagementTab
              projectId={parseInt(id!)}
              onCreateStatus={() => setShowCreateStatusModal(true)}
              onStatusClick={handleCustomStatusClick}
              refreshKey={statusRefreshKey}
            />
          )}

          {activeTab === 'groups' && (
            <GroupManagementTab
              key={groupRefreshKey}
              projectId={parseInt(id)}
              onCreateGroup={() => setShowCreateGroupModal(true)}
              onViewGroup={handleViewGroup}
              onDataChange={() => {
                setGroupRefreshKey(prev => prev + 1)
                setOverviewRefreshKey(prev => prev + 1)
              }}
            />
          )}

          {activeTab === 'panels' && (
            <PanelManagementTab projectId={parseInt(id)} />
          )}

          {activeTab === 'details' && (
            <ProjectDetailsTab
              project={project}
              models={models}
              panels={panels}
              formatDate={formatDate}
              formatFileSize={formatFileSize}
              getStatusConfig={getStatusConfig}
              navigate={navigate}
              openViewer={openViewer}
              onEditClick={isAdmin ? () => setShowEditProjectModal(true) : undefined}
              onDeleteClick={isAdmin ? () => setShowDeleteProjectModal(true) : undefined}
            />
          )}

          {/* OLD STATUS CODE - COMMENTED OUT - NOW USING StatusManagementTab COMPONENT */}
          {/* {activeTab === 'status' && (
          <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">STATUS MANAGEMENT</h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => setShowCreateStatusModal(true)}
                >
                  + CREATE NEW STATUS
                </Button>
                <Button variant="secondary" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  EXPORT REPORT
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customStatuses.map((customStatus) => {
                const iconMap: any = {
                  'Circle': Package,
                  'Check': CheckCircle,
                  'Clock': Clock,
                  'Truck': Package,
                  'Package': Package,
                  'Star': Package,
                  'Bell': Package,
                  'Box': Package,
                }
                const IconComponent = iconMap[customStatus.icon] || Package
                const panelCount = customStatus.panelCount || 0
                const totalPanels = panels?.length || 1
                const percentage = Math.round((panelCount / totalPanels) * 100)
                
                return (
                  <div 
                    key={customStatus.id} 
                    className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
                    onClick={() => handleCustomStatusClick(customStatus.id)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${customStatus.color}20`, border: `1px solid ${customStatus.color}40` }}>
                        <IconComponent className="w-4 h-4" style={{ color: customStatus.color }} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm uppercase">{customStatus.name}</h4>
                        <p className="text-slate-600 text-xs">{panelCount} panels</p>
                      </div>
                      <Eye className="h-4 w-4 text-slate-600" />
                    </div>
                    {customStatus.description && (
                      <p className="text-slate-600 text-xs mb-3">{customStatus.description}</p>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Percentage</span>
                        <span className="text-slate-900 font-medium">{percentage}%</span>
                      </div>
                      <div className="w-full bg-white rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-300" style={{ backgroundColor: customStatus.color, width: `${percentage}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {panelStatuses.length === 0 && customStatuses.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">No Status Data Available</h4>
                  <p className="text-slate-600">Upload a FRAG model or create custom statuses.</p>
                </div>
              )}
            </div>
            
            </CardContent>
        </Card>
          )} */}

          {/* Create Status Modal */}
          <CreateStatusModal
            isOpen={showCreateStatusModal}
            onClose={() => setShowCreateStatusModal(false)}
            onSubmit={handleCreateStatus}
            projectId={parseInt(id!)}
          />

          {/* Create Group Modal */}
          <CreateGroupModal
            isOpen={showCreateGroupModal}
            onClose={() => setShowCreateGroupModal(false)}
            onSubmit={handleCreateGroup}
          />

          {/* Panel Detail Modal */}
          {showPanelDetail && selectedPanel && (
            <PanelDetailModal
              isOpen={showPanelDetail}
              onClose={() => {
                setShowPanelDetail(false)
                setSelectedPanel(null)
              }}
              panel={selectedPanel}
              onEdit={handleEditPanel}
              onDelete={handleDeletePanel}
              onDuplicate={handleDuplicatePanel}
            />
          )}

          {/* Edit Panel Modal */}
          {showEditPanel && selectedPanel && (
            <EditPanelModal
              isOpen={showEditPanel}
              onClose={() => {
                setShowEditPanel(false)
                setSelectedPanel(null)
              }}
              panel={selectedPanel}
              projectId={id!}
              availableStatuses={customStatuses}
              availableGroups={groups}
              onUpdate={handleUpdatePanel}
            />
          )}

          {/* Status Detail Modal */}
          {showStatusDetail && selectedStatus && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowStatusDetail(false)}>
              <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${PANEL_STATUS_CONFIG[selectedStatus]?.color}20`, border: `1px solid ${PANEL_STATUS_CONFIG[selectedStatus]?.color}40` }}>
                      <Package className="w-6 h-6" style={{ color: PANEL_STATUS_CONFIG[selectedStatus]?.color }} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 uppercase">{PANEL_STATUS_CONFIG[selectedStatus]?.label}</h3>
                      <p className="text-slate-600">{statusPanels.length} panels with this status</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowStatusDetail(false)}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {loadingStatusPanels ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto"></div>
                    <p className="text-slate-600 mt-4">Loading panels...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Panel List */}
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {statusPanels.map(panel => (
                        <div key={panel.id} className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300" />
                              <div>
                                <p className="text-slate-900 font-semibold">{panel.name}</p>
                                <p className="text-slate-600 text-sm">{panel.objectType} • {panel.location}</p>
                              </div>
                            </div>
                            <Button variant="secondary" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bulk Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <div className="text-sm text-slate-600">
                        Select panels to perform bulk actions
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowStatusDetail(false)}>
                          Close
                        </Button>
                        <Button variant="primary" size="sm">
                          Update Status
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* IFC Model Structure - Building Storeys and Panels */}
          {activeTab === 'groups' && modelMetadata && modelMetadata.spatialStructure && modelMetadata.spatialStructure.length > 0 && (
            <Card className="border-slate-200 mt-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-slate-900 uppercase tracking-wider">Building Structure</h3>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {modelMetadata.totalElements} Total Elements
                  </Badge>
                </div>

                <div className="space-y-3">
                  {modelMetadata.spatialStructure.map((storey: any, index: number) => {
                    const storeyId = storey.id || `storey-${index}`;
                    const isExpanded = expandedStoreys.has(storeyId);

                    return (
                      <div key={storeyId} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Storey Header - Clickable to expand/collapse */}
                        <div
                          className="bg-slate-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => {
                            const newExpanded = new Set(expandedStoreys);
                            if (isExpanded) {
                              newExpanded.delete(storeyId);
                            } else {
                              newExpanded.add(storeyId);
                            }
                            setExpandedStoreys(newExpanded);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Layers className="h-5 w-5 text-slate-600" />
                            <h5 className="font-semibold text-slate-900">{storey.name}</h5>
                            <Badge variant="secondary" className="text-xs">
                              {storey.elementCount} elements
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{storey.type}</span>
                            <svg
                              className={`h-5 w-5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Panels Grid - Collapsible */}
                        {isExpanded && storey.children && storey.children.length > 0 && (
                          <div className="p-4 bg-white border-t border-slate-200">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                              {storey.children.map((panel: any) => (
                                <div
                                  key={panel.id}
                                  className="px-3 py-2 bg-slate-50 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                                  title={`${panel.name} (${panel.type})`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Box className="h-3 w-3 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
                                    <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 truncate">
                                      {panel.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 truncate block">
                                    {panel.type.replace('Ifc', '')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <strong>Real IFC Data:</strong> This structure was extracted directly from your IFC file during upload. 
                      All storey names and panel identifiers are authentic from your building model. Click on any storey to expand/collapse panels.
                    </div>
                  </div>
                </div> */}
              </CardContent>
            </Card>
          )}

          {/* Group Detail Modal */}
          {showGroupDetail && selectedGroup && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowGroupDetail(false)}>
              <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 uppercase">{selectedGroup.name}</h3>
                  <button
                    onClick={() => setShowGroupDetail(false)}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-slate-600 text-sm mb-1">Type</p>
                      <p className="text-slate-900 font-semibold uppercase">{selectedGroup.metadata?.type || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-slate-600 text-sm mb-1">Status</p>
                      <Badge variant={getStatusConfig(selectedGroup.status).variant}>
                        <span className="uppercase">{getStatusConfig(selectedGroup.status).label}</span>
                      </Badge>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-slate-600 text-sm mb-1">Panel Count</p>
                      <p className="text-slate-900 font-semibold">{(selectedGroup as any)._count?.panelGroups || 0}</p>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                      <p className="text-slate-600 text-sm mb-1">Unassigned</p>
                      <p className="text-slate-900 font-semibold">{selectedGroup.elementIds?.length || 0}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <p className="text-slate-600 text-sm mb-2">Description</p>
                    <p className="text-slate-900">{selectedGroup.description || 'No description available'}</p>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowGroupDetail(false)}
                    >
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setShowGroupDetail(false)
                        setActiveTab('panels')
                        // TODO: Filter panels by this group
                      }}
                    >
                      View Panels
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DUPLICATE PANEL MANAGEMENT - REMOVED - USE TAB VERSION INSTEAD */}
        </div>
      </div>

      {/* Edit Project Modal */}
      {showEditProjectModal && project && (
        <EditProjectModal
          project={project}
          isOpen={showEditProjectModal}
          onClose={() => setShowEditProjectModal(false)}
          onSave={handleEditProject}
          isSaving={isSavingProject}
        />
      )}

      {/* Delete Project Modal */}
      {showDeleteProjectModal && project && (
        <ConfirmDeleteModal
          isOpen={showDeleteProjectModal}
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone. All associated panels, groups, and models will be permanently deleted."
          itemName={project.name}
          itemType="project"
          onConfirm={handleDeleteProject}
          onCancel={() => setShowDeleteProjectModal(false)}
          isLoading={isDeletingProject}
        />
      )}

      {/* Deleting Project Modal */}
      {showDeletingProjectModal && project && (
        <DeletingProjectModal
          isOpen={showDeletingProjectModal}
          projectName={project.name}
        />
      )}
    </div>
  )
}
