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
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'

import type { Panel } from '@/types/panel'
import type { Group } from '@/types/group'
import { PanelStatus, PANEL_STATUS_CONFIG } from '@/types/panel'
import { GroupStatus, GROUP_STATUS_CONFIG } from '@/types/group'


interface ProjectData {
  id: number
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

// Helper function to get panel status variant for badge
const getPanelStatusVariant = (status: PanelStatus): 'neutral' | 'active' | 'warning' | 'completed' | 'error' | 'info' => {
  switch (status) {
    case PanelStatus.COMPLETED:
    case PanelStatus.INSTALLED:
      return 'completed'
    case PanelStatus.APPROVED:
    case PanelStatus.MANUFACTURED:
      return 'active'
    case PanelStatus.IN_PRODUCTION:
    case PanelStatus.SHIPPED:
      return 'info'
    case PanelStatus.ON_HOLD:
    case PanelStatus.REJECTED:
      return 'error'
    case PanelStatus.QUALITY_CHECK:
    case PanelStatus.ON_SITE:
      return 'warning'
    default:
      return 'neutral'
  }
}

// Status configuration for badges - using panel status config
const statusConfig = {
  // Project statuses
  'PLANNING': { label: 'Planning', variant: 'neutral' as const, icon: Clock, color: '#8B5CF6' },
  'ACTIVE': { label: 'Active', variant: 'active' as const, icon: CheckCircle, color: '#3B82F6' },
  'ON_HOLD': { label: 'On Hold', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'COMPLETED': { label: 'Completed', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'CANCELLED': { label: 'Cancelled', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  // Model statuses
  'READY': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'PROCESSING': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'UPLOADED': { label: 'Uploaded', variant: 'neutral' as const, icon: Package, color: '#8B5CF6' },
  'FAILED': { label: 'Failed', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  // Legacy statuses
  'ready': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'processing': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'error': { label: 'Error', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  'planning': { label: 'Planning', variant: 'neutral' as const, icon: Clock, color: '#8B5CF6' },
  'active': { label: 'Active', variant: 'active' as const, icon: CheckCircle, color: '#3B82F6' }
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
  
  // Group management state
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>('all')
  const [groupStatusFilter, setGroupStatusFilter] = useState<string>('all')
  const [groupPage, setGroupPage] = useState(1)
  const [groupTotalPages, setGroupTotalPages] = useState(1)
  const [groupTotalCount, setGroupTotalCount] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showGroupDetail, setShowGroupDetail] = useState(false)



  useEffect(() => {
    if (!id) return
    
    loadProjectData()
  }, [id])

  const loadProjectData = async () => {
    if (!id) return
    
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`http://localhost:4000/api/projects/${id}`)
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
        
        // Parse spatial structure to get total panel count and status overview
        if (data.currentModel && data.currentModel.spatialStructure) {
          try {
            const spatialData = JSON.parse(data.currentModel.spatialStructure)
            console.log('📊 Spatial structure metadata:', spatialData)
            setTotalPanelCount(spatialData.totalPanels || 0)
            setDisplayedPanelCount(spatialData.displayedPanels || 0)
            
            // Load status overview from pre-calculated filter metadata
            if (spatialData.filters && spatialData.filters.statusCounts) {
              const statusOverview = Object.entries(spatialData.filters.statusCounts).map(([status, count]) => {
                // Map FRAG statuses to database statuses for display
                const statusMap: Record<string, string> = {
                  'READY_FOR_PRODUCTION': 'APPROVED',
                  'EDIT': 'DESIGNED',
                  'PRODUCED': 'MANUFACTURED',
                  'SHIPPED': 'SHIPPED'
                };
                
                const dbStatus = statusMap[status] || status;
                const statusConfig = PANEL_STATUS_CONFIG[dbStatus as PanelStatus] || PANEL_STATUS_CONFIG.PLANNING;
                
                return {
                  status: dbStatus as PanelStatus,
                  count: count as number,
                  percentage: Math.round((count as number / spatialData.totalPanels) * 100),
                  color: statusConfig.color,
                  label: statusConfig.label
                };
              });
              
              console.log('📊 Status overview from metadata:', statusOverview);
              setPanelStatuses(statusOverview);
            }
          } catch (error) {
            console.error('Failed to parse spatial structure:', error)
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
        loadPanels(),
        loadGroups()
      ])
      
    } catch (err) {
      console.error('Error loading project data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  const loadPanels = async () => {
    if (!id) return
    
    try {
      setPanelsLoading(true)
      // Request with pagination: 50 items per page
      const response = await fetch(`http://localhost:4000/api/panels/${id}?page=1&limit=50`)
      
      if (!response.ok) {
        console.error('Failed to fetch panels:', response.status, response.statusText)
        return
      }
      
      const data = await response.json()
      
      // Handle paginated response
      const panelsData = data.panels || data
      console.log('✅ Panels loaded:', panelsData.length)
      if (data.pagination) {
        console.log('📄 Pagination:', data.pagination)
        // Set total panel count from metadata (actual FRAG file count)
        if (data.pagination.totalFromMetadata) {
          setTotalPanelCount(data.pagination.totalFromMetadata)
          setDisplayedPanelCount(data.pagination.total)
        }
      }
      
      setPanels(panelsData)
      
      // Don't calculate from paginated data - we'll use metadata from spatial structure instead
      // The status overview will be loaded from the project's spatial structure metadata
    } catch (error) {
      console.error('Error loading panels:', error)
      setPanelStatuses([])
    } finally {
      setPanelsLoading(false)
    }
  }

  const loadGroups = async (page: number = 1) => {
    if (!id) return
    
    try {
      setGroupsLoading(true)
      // Request with pagination: 50 items per page
      const response = await fetch(`http://localhost:4000/api/groups/${id}?page=${page}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Groups data:', data)
        
        // Handle paginated response
        const groupsData = data.groups || data
        console.log('✅ Groups loaded:', Array.isArray(groupsData) ? groupsData.length : 0)
        
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
      const response = await fetch(`http://localhost:4000/api/panels/${id}?groupId=${groupId}`)
      if (response.ok) {
        const data = await response.json()
        const panels = data.panels || []
        if (panels.length === 0) return 0
        
        const completedStatuses = ['COMPLETED', 'SHIPPED', 'INSTALLED']
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

  const handleCreatePanel = async (panelData: any) => {
    if (!id) return
    
    try {
      const response = await fetch(`http://localhost:4000/api/panels/${id}`, {
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
      const response = await fetch(`http://localhost:4000/api/panels/${id}/${panelId}/status`, {
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

  const handleDeletePanel = async (panelId: string) => {
    if (!id) return
    
    try {
      const response = await fetch(`http://localhost:4000/api/panels/${id}/${panelId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await loadPanels() // Refresh panels
      }
    } catch (err) {
      console.error('Error deleting panel:', err)
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#3A7BD5] mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-[#E8EAF0]">Loading Project...</h2>
          <p className="text-[#B8BCC8] mt-2">Fetching project details</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="w-full h-full">
        <ProfessionalGamingCard variant="panel" className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <Building2 className="h-12 w-12 text-red-400" />
            <div>
              <h2 className="text-xl font-bold text-[#E8EAF0] mb-2">PROJECT NOT FOUND</h2>
              <p className="text-[#B8BCC8] mb-4">{error || 'Project could not be loaded'}</p>
              <ProfessionalGamingButton 
                onClick={() => navigate('/projects')} 
                variant="primary"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO PROJECTS
              </ProfessionalGamingButton>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Professional Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
        <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
          <div className="flex items-center gap-6 mb-4">
            <ProfessionalGamingButton 
              onClick={() => navigate('/projects')} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              BACK
            </ProfessionalGamingButton>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] rounded-xl blur-md opacity-60"></div>
                <div className="relative p-4 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-2xl">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E8EAF0] to-[#3A7BD5] uppercase tracking-wider">
                  {project.name}
                </h1>
                <p className="text-[#B8BCC8] text-base mt-1">{project.description}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <ProfessionalGamingBadge variant={getStatusConfig(project.status).variant}>
                {getStatusConfig(project.status).label.toUpperCase()}
              </ProfessionalGamingBadge>
              <div className="text-sm text-[#B8BCC8]">
                Created {formatDate(project.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {models?.currentModel && (models.currentModel.status === 'READY' || models.currentModel.status === 'ready') && (
                <ProfessionalGamingButton 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  onClick={() => openViewer(models?.currentModel?.id)}
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  OPEN 3D VIEWER
                </ProfessionalGamingButton>
              )}
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Panel Status Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">PANEL STATUS OVERVIEW</h2>
          <div className="text-[#B8BCC8] flex flex-col items-end">
            <div>
              <span className="text-3xl font-bold text-[#E8EAF0]">{totalPanelCount > 0 ? totalPanelCount : panels.length}</span> Total Panels
            </div>
            {totalPanelCount > displayedPanelCount && displayedPanelCount > 0 && (
              <div className="text-sm text-[#8B5CF6] mt-1">
                ({displayedPanelCount} displayed for performance)
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <div className="flex gap-6 pb-4 min-w-max">
            {panelStatuses.length > 0 ? panelStatuses.map((status) => {
              return (
                <div 
                  key={status.status}
                  className="bg-[rgba(26,31,46,0.8)] backdrop-blur-sm border border-[rgba(58,123,213,0.2)] rounded-xl p-6 min-w-[200px] hover:border-[rgba(58,123,213,0.4)] transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: `${status.color}20`, border: `1px solid ${status.color}40` }}>
                      <Package className="w-5 h-5" style={{ color: status.color }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#E8EAF0] text-sm leading-tight uppercase tracking-wider">
                        {status.label}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#E8EAF0]">{status.count}</span>
                      <span 
                        className="text-sm font-medium px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: `${status.color}20`, 
                          color: status.color 
                        }}
                      >
                        {status.percentage}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-[rgba(37,42,58,0.6)] rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          backgroundColor: status.color,
                          width: `${status.percentage}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="bg-[rgba(26,31,46,0.8)] backdrop-blur-sm border border-[rgba(58,123,213,0.2)] rounded-xl p-12 min-w-[400px] text-center">
                <Package className="h-16 w-16 text-[#B8BCC8] mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[#E8EAF0] mb-2">No Panel Data Available</h3>
                <p className="text-[#B8BCC8]">Upload a FRAG model to see detailed panel status information.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Tab Navigation */}
      <div className="w-full">
        <div className="flex border-b border-[rgba(58,123,213,0.2)] bg-[rgba(26,31,46,0.8)] rounded-t-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white border-b-2 border-[#3A7BD5]'
                : 'text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)]'
            }`}
          >
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'status'
                ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white border-b-2 border-[#3A7BD5]'
                : 'text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)]'
            }`}
          >
            <Activity className="h-4 w-4 mr-2" />
            Status Management
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'groups'
                ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white border-b-2 border-[#3A7BD5]'
                : 'text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)]'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Group Management
          </button>
          <button
            onClick={() => setActiveTab('panels')}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'panels'
                ? 'bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white border-b-2 border-[#3A7BD5]'
                : 'text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)]'
            }`}
          >
            <Layers className="h-4 w-4 mr-2" />
            Panel Management
          </button>
        </div>

        
        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Information */}
        <ProfessionalGamingCard variant="panel" className="p-6">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-4 flex items-center uppercase tracking-wider">
            <Building2 className="h-5 w-5 mr-2 text-[#3A7BD5]" />
            PROJECT INFORMATION
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Name</label>
              <p className="text-[#E8EAF0] font-semibold">{project?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Description</label>
              <p className="text-[#E8EAF0]">{project?.description || 'No description provided'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Status</label>
              <div className="mt-1">
                <ProfessionalGamingBadge variant={getStatusConfig(project.status).variant}>
                  {getStatusConfig(project.status).label.toUpperCase()}
                </ProfessionalGamingBadge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Created</label>
              <p className="text-[#E8EAF0]">{formatDate(project.createdAt)}</p>
            </div>
          </div>
        </ProfessionalGamingCard>

        {/* Progress Overview */}
        <ProfessionalGamingCard variant="panel" className="p-6">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-4 flex items-center uppercase tracking-wider">
            <BarChart3 className="h-5 w-5 mr-2 text-[#3A7BD5]" />
            PROGRESS OVERVIEW
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[#B8BCC8] uppercase tracking-wider">Overall Progress</span>
              <span className="text-[#E8EAF0] font-semibold">{panels.length > 0 ? Math.round((panelStatuses.find(s => s.label.toLowerCase().includes('completed') || s.label.toLowerCase().includes('produced'))?.count || 0) / panels.length * 100) : 0}%</span>
            </div>
            <div className="w-full bg-[rgba(37,42,58,0.6)] rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] h-2 rounded-full transition-all duration-300" 
                style={{ width: `${panels.length > 0 ? Math.round((panelStatuses.find(s => s.label.toLowerCase().includes('completed') || s.label.toLowerCase().includes('produced'))?.count || 0) / panels.length * 100) : 0}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#B8BCC8] uppercase tracking-wider">Completed:</span>
                <span className="text-green-400 ml-2 font-semibold">{panelStatuses.find(s => s.label.toLowerCase().includes('completed') || s.label.toLowerCase().includes('produced'))?.count || 0}</span>
              </div>
              <div>
                <span className="text-[#B8BCC8] uppercase tracking-wider">Remaining:</span>
                <span className="text-yellow-400 ml-2 font-semibold">{panels.length - (panelStatuses.find(s => s.label.toLowerCase().includes('completed') || s.label.toLowerCase().includes('produced'))?.count || 0)}</span>
              </div>
            </div>
          </div>
        </ProfessionalGamingCard>

        {/* Current Model & Version History */}
        <ProfessionalGamingCard variant="panel" className="p-6">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-4 flex items-center uppercase tracking-wider">
            <Package className="h-5 w-5 mr-2 text-[#3A7BD5]" />
            MODEL & VERSIONS
          </h3>
          <div className="space-y-3">
            {models?.currentModel && (
              <div className="p-3 bg-gradient-to-r from-[rgba(58,123,213,0.2)] to-[rgba(16,185,129,0.2)] rounded-lg border border-[rgba(58,123,213,0.3)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-[#B8BCC8] mb-4">Current Model: {models?.currentModel?.originalFilename || 'No model loaded'}</p>
                      <ProfessionalGamingBadge variant="completed">
                        v{models.currentModel.version} (Current)
                      </ProfessionalGamingBadge>
                    </div>
                    <p className="text-[#B8BCC8] text-sm">{formatFileSize(Number(models.currentModel.sizeBytes))}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ProfessionalGamingBadge variant={getStatusConfig(models.currentModel.status).variant}>
                      {getStatusConfig(models.currentModel.status).label.toUpperCase()}
                    </ProfessionalGamingBadge>
                    <ProfessionalGamingButton
                      variant="secondary"
                      onClick={() => navigate(`/models/${models.currentModel!.id}`)}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Details
                    </ProfessionalGamingButton>
                    {(models.currentModel.status === 'READY' || models.currentModel.status === 'ready') && (
                      <ProfessionalGamingButton
                        variant="secondary"
                        onClick={() => openViewer(models.currentModel!.id)}
                        size="sm"
                        className="p-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </ProfessionalGamingButton>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Previous Versions */}
            {models?.modelHistory?.filter((model: any) => !model.isActive).slice(0, 2).map((model: any) => (
              <div key={model.id} className="flex items-center justify-between p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-[#B8BCC8] font-medium">{model.originalFilename}</p>
                    <ProfessionalGamingBadge variant="neutral">
                      v{model.version}
                    </ProfessionalGamingBadge>
                  </div>
                  <p className="text-[#6B7280] text-sm">{formatFileSize(Number(model.sizeBytes))}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <ProfessionalGamingBadge variant="neutral">
                    PREVIOUS
                  </ProfessionalGamingBadge>
                </div>
              </div>
            ))}
            
            {!models?.hasModel && (
              <p className="text-[#B8BCC8] text-center py-4">No model uploaded yet</p>
            )}
            
            {(models?.totalVersions || 0) > 3 && (
              <p className="text-[#B8BCC8] text-center text-sm">
                +{(models?.totalVersions || 0) - 3} more versions
              </p>
            )}
          </div>
        </ProfessionalGamingCard>
            </div>
          )}

          {activeTab === 'status' && (
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">STATUS MANAGEMENT</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B8BCC8] h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search panels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none"
                  />
                </div>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-[rgba(58,123,213,0.1)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] text-sm"
                >
                  <option value="all">All Status</option>
                  {Object.values(PanelStatus).map(status => (
                    <option key={status} value={status}>{PANEL_STATUS_CONFIG[status]?.label || status}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {panelStatuses.length > 0 ? panelStatuses.map((status) => {
                return (
                  <div key={status.status} className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)] hover:border-[rgba(58,123,213,0.3)] transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${status.color}20`, border: `1px solid ${status.color}40` }}>
                        <Package className="w-4 h-4" style={{ color: status.color }} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#E8EAF0] text-sm uppercase">{status.label}</h4>
                        <p className="text-[#B8BCC8] text-xs">{status.count} panels</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#B8BCC8]">Progress</span>
                        <span className="text-[#E8EAF0] font-medium">{status.percentage}%</span>
                      </div>
                      <div className="w-full bg-[rgba(26,31,46,0.6)] rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-300" style={{ backgroundColor: status.color, width: `${status.percentage}%` }} />
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="col-span-full text-center py-12">
                  <Package className="h-12 w-12 text-[#B8BCC8] mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-[#E8EAF0] mb-2">No Panel Data Available</h4>
                  <p className="text-[#B8BCC8]">Upload a FRAG model to see panel status information.</p>
                </div>
              )}
            </div>
          </ProfessionalGamingCard>
          )}

          {activeTab === 'groups' && (
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">GROUP MANAGEMENT</h3>
              <div className="flex items-center gap-2">
                <select
                  value={groupTypeFilter}
                  onChange={(e) => setGroupTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-[rgba(26,31,46,0.6)] border border-[rgba(58,123,213,0.3)] rounded-lg text-[#E8EAF0] text-sm focus:outline-none focus:border-[#3A7BD5]"
                >
                  <option value="all">All Types</option>
                  <option value="STOREY">Storey</option>
                  <option value="SYSTEM">System</option>
                </select>
                <select
                  value={groupStatusFilter}
                  onChange={(e) => setGroupStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-[rgba(26,31,46,0.6)] border border-[rgba(58,123,213,0.3)] rounded-lg text-[#E8EAF0] text-sm focus:outline-none focus:border-[#3A7BD5]"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
            
            {/* Groups count and pagination info */}
            <div className="mb-4 text-sm text-[#B8BCC8]">
              Showing {filteredGroups.length} of {groupTotalCount} groups (Page {groupPage} of {groupTotalPages})
            </div>
            
            <div className="space-y-4">
              {filteredGroups.length > 0 ? filteredGroups.map((group) => {
                const panelCount = group.metadata?.panelCount || group._count?.panels || 0;
                const groupType = group.metadata?.type || 'GROUP';
                const progress = 0; // Calculate from panel statuses later
                
                return (
                  <div key={group.id} className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)] hover:border-[rgba(58,123,213,0.3)] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-[rgba(58,123,213,0.2)] rounded-lg border border-[rgba(58,123,213,0.3)]">
                          <Building2 className="h-5 w-5 text-[#3A7BD5]" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-[#E8EAF0] uppercase">{group.name}</h4>
                          <p className="text-[#B8BCC8] text-sm">{groupType} • {panelCount} panels</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[#E8EAF0] font-medium">{progress}%</p>
                          <div className="w-20 bg-[rgba(26,31,46,0.6)] rounded-full h-2 mt-1">
                            <div className="bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <ProfessionalGamingBadge variant={getStatusConfig(group.status).variant}>
                          <span className="uppercase">{getStatusConfig(group.status).label}</span>
                        </ProfessionalGamingBadge>
                        <ProfessionalGamingButton 
                          variant="secondary" 
                          size="sm"
                          onClick={() => handleViewGroup(group)}
                        >
                          <Eye className="h-4 w-4" />
                        </ProfessionalGamingButton>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-[#B8BCC8] mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-[#E8EAF0] mb-2">No Groups Available</h4>
                  <p className="text-[#B8BCC8]">Upload a FRAG model to see spatial groups and organization.</p>
                </div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {groupTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-[rgba(58,123,213,0.2)]">
                <div className="text-sm text-[#B8BCC8]">
                  Page {groupPage} of {groupTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <ProfessionalGamingButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGroupPageChange(groupPage - 1)}
                    disabled={groupPage === 1}
                  >
                    Previous
                  </ProfessionalGamingButton>
                  <ProfessionalGamingButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGroupPageChange(groupPage + 1)}
                    disabled={groupPage === groupTotalPages}
                  >
                    Next
                  </ProfessionalGamingButton>
                </div>
              </div>
            )}
          </ProfessionalGamingCard>
          )}
          
          {/* Group Detail Modal */}
          {showGroupDetail && selectedGroup && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowGroupDetail(false)}>
              <div className="bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-[#E8EAF0] uppercase">{selectedGroup.name}</h3>
                  <button
                    onClick={() => setShowGroupDetail(false)}
                    className="text-[#B8BCC8] hover:text-[#E8EAF0] transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                      <p className="text-[#B8BCC8] text-sm mb-1">Type</p>
                      <p className="text-[#E8EAF0] font-semibold uppercase">{selectedGroup.metadata?.type || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                      <p className="text-[#B8BCC8] text-sm mb-1">Status</p>
                      <ProfessionalGamingBadge variant={getStatusConfig(selectedGroup.status).variant}>
                        <span className="uppercase">{getStatusConfig(selectedGroup.status).label}</span>
                      </ProfessionalGamingBadge>
                    </div>
                    <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                      <p className="text-[#B8BCC8] text-sm mb-1">Panel Count</p>
                      <p className="text-[#E8EAF0] font-semibold">{selectedGroup.metadata?.panelCount || 0}</p>
                    </div>
                    <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                      <p className="text-[#B8BCC8] text-sm mb-1">Elements</p>
                      <p className="text-[#E8EAF0] font-semibold">{selectedGroup.elementIds?.length || 0}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                    <p className="text-[#B8BCC8] text-sm mb-2">Description</p>
                    <p className="text-[#E8EAF0]">{selectedGroup.description || 'No description available'}</p>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-6">
                    <ProfessionalGamingButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowGroupDetail(false)}
                    >
                      Close
                    </ProfessionalGamingButton>
                    <ProfessionalGamingButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setShowGroupDetail(false)
                        setActiveTab('panels')
                        // TODO: Filter panels by this group
                      }}
                    >
                      View Panels
                    </ProfessionalGamingButton>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'panels' && (
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">PANEL MANAGEMENT</h3>
              <div className="flex items-center gap-2">
                <ProfessionalGamingButton variant="secondary" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  EXPORT
                </ProfessionalGamingButton>
                <ProfessionalGamingButton variant="primary" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  FILTER
                </ProfessionalGamingButton>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(58,123,213,0.2)]">
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Panel</th>
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Type</th>
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Group</th>
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Location</th>
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-[#B8BCC8] font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {panels.length > 0 ? panels.filter(panel => {
                    const matchesSearch = panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (panel.tag && panel.tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                        (panel.location && panel.location.toLowerCase().includes(searchTerm.toLowerCase()))
                    const matchesStatus = statusFilter === 'all' || panel.status === statusFilter
                    return matchesSearch && matchesStatus
                  }).map((panel) => (
                    <tr key={panel.id} className="border-b border-[rgba(58,123,213,0.1)] hover:bg-[rgba(58,123,213,0.05)] transition-all">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-[#E8EAF0]">{panel.name}</p>
                          <p className="text-sm text-[#B8BCC8]">{panel.tag || 'No tag'}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#E8EAF0]">{panel.objectType || 'Unknown'}</td>
                      <td className="py-3 px-4 text-[#E8EAF0]">{panel.group?.name || 'No group'}</td>
                      <td className="py-3 px-4 text-[#B8BCC8]">{panel.location || 'Unknown'}</td>
                      <td className="py-3 px-4">
                        <ProfessionalGamingBadge variant={getPanelStatusVariant(panel.status)}>
                          <span className="uppercase">{PANEL_STATUS_CONFIG[panel.status]?.label || panel.status}</span>
                        </ProfessionalGamingBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <ProfessionalGamingButton variant="secondary" size="sm">
                            <Eye className="h-4 w-4" />
                          </ProfessionalGamingButton>
                          <ProfessionalGamingButton variant="secondary" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </ProfessionalGamingButton>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Box className="h-12 w-12 text-[#B8BCC8] mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-[#E8EAF0] mb-2">No Panels Available</h4>
                        <p className="text-[#B8BCC8]">Upload a FRAG model to see detailed panel information.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ProfessionalGamingCard>
          )}
        </div>
      </div>
    </div>
  )
}
