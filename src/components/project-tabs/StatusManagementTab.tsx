'use client'

import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { Plus, Package, CheckCircle, Clock, Eye, AlertCircle, MoreVertical, Edit, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { StatusDetailModal } from '@/components/modals/StatusDetailModal'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { EditStatusModal } from '@/components/modals/EditStatusModal'
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal'
import { toast } from '@/components/ui/use-toast'

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

interface Panel {
  id: string
  name: string
  objectType: string
  location: string
  status: string
  group?: {
    id: string
    name: string
  }
}

interface StatusManagementTabProps {
  projectId: number
  onCreateStatus: () => void
  onStatusClick: (statusId: string) => void
  refreshKey?: number // Add refresh trigger
}

export function StatusManagementTab({ 
  projectId, 
  onCreateStatus,
  onStatusClick,
  refreshKey 
}: StatusManagementTabProps) {
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPanels, setTotalPanels] = useState(0)
  const [selectedStatus, setSelectedStatus] = useState<CustomStatus | null>(null)
  const [showStatusDetail, setShowStatusDetail] = useState(false)
  const [statusPanels, setStatusPanels] = useState<Panel[]>([])
  const [loadingPanels, setLoadingPanels] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingStatus, setDeletingStatus] = useState<CustomStatus | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null)
  const [showEditPanelModal, setShowEditPanelModal] = useState(false)
  const [statuses, setStatuses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])

  useEffect(() => {
    loadCustomStatuses()
    loadPanelCount()
    loadStatuses()
    loadGroups()
  }, [projectId, refreshKey]) // Reload when refreshKey changes

  const loadStatuses = async () => {
    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Loaded statuses:', data)
        // Handle both array and object response formats
        setStatuses(Array.isArray(data) ? data : (data.statuses || []))
      }
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/groups/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Loaded groups:', data)
        // Handle both array and object response formats
        setGroups(Array.isArray(data) ? data : (data.groups || []))
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadCustomStatuses = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomStatuses(data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading custom statuses:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPanelCount = async () => {
    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/panels/${projectId}/statistics`)
      if (response.ok) {
        const data = await response.json()
        setTotalPanels(data.totalPanels || 0)
      }
    } catch (error) {
      console.error('Error loading panel count:', error)
    }
  }

  const loadPanelsByStatus = async (statusId: string) => {
    try {
      setLoadingPanels(true)
      // Include groups in the API request
      const response = await authenticatedFetch(`http://localhost:4000/api/panels/${projectId}?customStatusId=${statusId}&limit=100&includeGroups=true`)
      if (response.ok) {
        const data = await response.json()
        console.log('📦 Panels with groups:', data.panels || data)
        setStatusPanels(data.panels || [])
      }
    } catch (error) {
      console.error('Error loading panels by status:', error)
      setStatusPanels([])
    } finally {
      setLoadingPanels(false)
    }
  }

  const handleStatusClick = async (status: CustomStatus) => {
    setSelectedStatus(status)
    setShowStatusDetail(true)
    await loadPanelsByStatus(status.id)
  }

  const handleViewPanel = (panelId: string) => {
    const panel = statusPanels.find(p => p.id === panelId)
    if (panel) {
      setSelectedPanel(panel)
      setShowPanelDetail(true)
    }
  }

  const handleEditStatus = (status: CustomStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setEditingStatus(status)
    setShowEditModal(true)
  }

  const handleUpdateStatus = async (statusData: {
    name: string
    icon: string
    color: string
    description?: string
  }) => {
    if (!editingStatus) return

    console.log('Updating status:', editingStatus.id, statusData)

    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/${editingStatus.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusData)
      })

      console.log('Update response status:', response.status)
      const data = await response.json()
      console.log('Update response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      // Reload statuses
      await loadCustomStatuses()
      await loadPanelCount()
      setShowEditModal(false)
      setEditingStatus(null)
      toast({
        title: "Success",
        description: "Status updated successfully",
      })
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: "Error",
        description: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
      throw error
    }
  }

  const handleDeleteStatus = (status: CustomStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setDeletingStatus(status)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingStatus) return

    console.log('Deleting status:', deletingStatus.id, deletingStatus.name)
    setIsDeleting(true)

    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/${deletingStatus.id}`, {
        method: 'DELETE'
      })

      console.log('Delete response status:', response.status)
      const data = await response.json()
      console.log('Delete response data:', data)

      if (response.ok) {
        // Reload statuses
        await loadCustomStatuses()
        await loadPanelCount()
        console.log('Status deleted and list refreshed')
        setShowDeleteModal(false)
        setDeletingStatus(null)
        toast({
          title: "Success",
          description: "Status deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: `Failed to delete status: ${data.error || 'Unknown error'}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting status:', error)
      toast({
        title: "Error",
        description: `Error deleting status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleMenu = (statusId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === statusId ? null : statusId)
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
    return Package
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Status Management</h2>
            <p className="text-sm text-slate-500 mt-1">Create and manage custom statuses for your panels</p>
          </div>
          <button
            onClick={onCreateStatus}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Status
          </button>
        </div>
      </div>

      {/* Status Cards Grid */}
      {customStatuses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
          {customStatuses.map((status) => {
            const IconComponent = getIconComponent(status.icon)
            const panelCount = status.panelCount || 0
            
            // Auto-generate description if not present
            const displayDescription = status.description || `Status for tracking ${status.name.toLowerCase()} panels`

            return (
              <div
                key={status.id}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer relative"
                onClick={() => handleStatusClick(status)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-8 h-8" style={{ color: status.color }} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{status.name}</h3>
                      <p className="text-xs text-slate-500">{panelCount} panels</p>
                    </div>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="relative" ref={openMenuId === status.id ? menuRef : null}>
                    <button
                      onClick={(e) => toggleMenu(status.id, e)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === status.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(null)
                            handleStatusClick(status)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Panels
                        </button>
                        <button
                          onClick={(e) => handleEditStatus(status, e)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Status
                        </button>
                        <button
                          onClick={(e) => handleDeleteStatus(status, e)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Status
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description - Always show (auto-generated if not present) */}
                <p className="text-xs text-slate-600 line-clamp-2">{displayDescription}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No custom statuses yet</h3>
            <p className="text-sm text-slate-500 mb-6">
              Create custom statuses to track panel progress through your workflow
            </p>
            <button
              onClick={onCreateStatus}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Status
            </button>
          </div>
        </div>
      )}

      {/* Status Detail Modal */}
      {selectedStatus && (
        <StatusDetailModal
          isOpen={showStatusDetail}
          onClose={() => setShowStatusDetail(false)}
          status={selectedStatus}
          panels={statusPanels}
          loading={loadingPanels}
          onViewPanel={handleViewPanel}
        />
      )}

      {/* Panel Detail Modal */}
      {selectedPanel && (
        <PanelDetailModal
          isOpen={showPanelDetail}
          onClose={() => {
            setShowPanelDetail(false)
            setSelectedPanel(null)
          }}
          panel={selectedPanel}
          onEdit={() => {
            console.log('Edit panel:', selectedPanel.id)
            console.log('Selected panel data:', selectedPanel)
            console.log('Available statuses:', statuses)
            console.log('Available groups:', groups)
            setShowPanelDetail(false)
            setEditingPanel(selectedPanel)
            setShowEditPanelModal(true)
          }}
        />
      )}

      {/* Edit Panel Modal */}
      {editingPanel && statuses.length > 0 && groups.length > 0 && (
        <EditPanelModal
          isOpen={showEditPanelModal}
          onClose={() => {
            setShowEditPanelModal(false)
            setEditingPanel(null)
          }}
          panel={{
            ...editingPanel,
            projectId: projectId,
            status: 'PENDING' as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          projectId={projectId.toString()}
          availableStatuses={statuses}
          availableGroups={groups as any}
          onUpdate={async () => {
            setShowEditPanelModal(false)
            setEditingPanel(null)
            setSelectedPanel(null)
            if (selectedStatus) {
              await loadPanelsByStatus(selectedStatus.id)
            }
          }}
        />
      )}

      {/* Edit Status Modal */}
      {editingStatus && (
        <EditStatusModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingStatus(null)
          }}
          status={editingStatus}
          onSubmit={handleUpdateStatus}
        />
      )}

      {/* Confirm Delete Modal */}
      {deletingStatus && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingStatus(null)
          }}
          onConfirm={confirmDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete the status"
          itemName={deletingStatus.name}
          panelCount={deletingStatus.panelCount}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
