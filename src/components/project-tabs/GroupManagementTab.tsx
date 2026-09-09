'use client'

import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { Plus, Grid3x3, Eye, MoreVertical, Edit, Trash2, AlertCircle } from 'lucide-react'
import { GroupDetailModal } from '@/components/modals/GroupDetailModal'
import { EditGroupModal } from '@/components/modals/EditGroupModal'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal'
import { toast } from '@/components/ui/use-toast'
import { getApiUrl } from '@/config/api'

interface Group {
  id: string
  name: string
  description?: string
  status: string
  type?: string
  color?: string
  panelCount?: number
  metadata?: {
    type?: string
    panelCount?: number
  }
  _count?: {
    panels?: number
    panelGroups?: number
  }
}

interface Panel {
  id: string
  name: string
  tag?: string
  objectType?: string
  location?: string
  panelMark?: string
  memberCount?: number
  metadata?: Record<string, unknown> | null
  status?: string
  group?: { id: string; name: string }
  groups?: Array<{ id: string; group: { id: string; name: string; color?: string } }>
  statuses?: Array<{ id: string; status: { id: string; name: string; icon: string; color: string } }>
}

interface GroupManagementTabProps {
  projectId: number
  onCreateGroup: () => void
  onViewGroup: (group: Group) => void
  onDataChange?: () => void
  refreshKey?: number
}

export function GroupManagementTab({
  projectId,
  onCreateGroup,
  onViewGroup,
  onDataChange,
  refreshKey,
}: GroupManagementTabProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [groupedBy, setGroupedBy] = useState<'bimsf' | 'members'>('members')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showGroupDetail, setShowGroupDetail] = useState(false)
  const [groupPanels, setGroupPanels] = useState<Panel[]>([])
  const [loadingPanels, setLoadingPanels] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null)
  const [showEditPanelModal, setShowEditPanelModal] = useState(false)
  const [statuses, setStatuses] = useState<any[]>([])
  const [allGroups, setAllGroups] = useState<any[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGroups()
    loadStatuses()
  }, [projectId, refreshKey])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(getApiUrl(`groups/${projectId}?limit=100`))
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
        setAllGroups(data.groups || [])
        setGroupedBy(data.groupedBy === 'bimsf' ? 'bimsf' : 'members')
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStatuses = async () => {
    try {
      const response = await authenticatedFetch(getApiUrl(`status-management/${projectId}`))
      if (response.ok) {
        const data = await response.json()
        setStatuses(Array.isArray(data) ? data : data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  const loadPanelsByGroup = async (groupId: string) => {
    try {
      setLoadingPanels(true)
      // Same panels API Status Management uses — already BIMSF-aware
      const response = await authenticatedFetch(
        getApiUrl(
          `panels/${projectId}?groupIds=${encodeURIComponent(groupId)}&limit=200&includeGroups=true`
        )
      )
      if (response.ok) {
        const data = await response.json()
        setGroupPanels(data.panels || [])
        if (data.groupedBy === 'bimsf' || data.groupedBy === 'members') {
          setGroupedBy(data.groupedBy)
        }
      } else {
        setGroupPanels([])
      }
    } catch (error) {
      console.error('Error loading panels by group:', error)
      setGroupPanels([])
    } finally {
      setLoadingPanels(false)
    }
  }

  const handleGroupClick = async (group: Group) => {
    setSelectedGroup(group)
    setShowGroupDetail(true)
    setOpenMenuId(null)
    await loadPanelsByGroup(group.id)
  }

  const handleViewPanel = (panelId: string) => {
    const panel = groupPanels.find((p) => p.id === panelId)
    if (panel) {
      setSelectedPanel(panel)
      setShowPanelDetail(true)
    }
  }

  const handleEditGroup = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setEditingGroup(group)
    setShowEditModal(true)
  }

  const handleDeleteGroup = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setDeletingGroup(group)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingGroup) return
    setIsDeleting(true)
    try {
      const response = await authenticatedFetch(
        getApiUrl(`groups/${projectId}/${deletingGroup.id}`),
        { method: 'DELETE' }
      )

      if (response.ok || response.status === 204) {
        await loadGroups()
        onDataChange?.()
        setShowDeleteModal(false)
        setDeletingGroup(null)
        toast({
          title: 'Success',
          description: 'Group deleted successfully',
        })
      } else {
        const data = await response.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: `Failed to delete group: ${data.error || 'Unknown error'}`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      toast({
        title: 'Error',
        description: 'Error deleting group',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateGroup = async (groupData: { name: string; description: string }) => {
    if (!editingGroup) return

    try {
      const response = await authenticatedFetch(
        getApiUrl(`groups/${projectId}/${editingGroup.id}`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupData),
        }
      )

      if (response.ok) {
        await loadGroups()
        onDataChange?.()
        setShowEditModal(false)
        setEditingGroup(null)
        toast({
          title: 'Success',
          description: 'Group updated successfully',
        })
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update group')
      }
    } catch (error) {
      console.error('Error updating group:', error)
      toast({
        title: 'Error',
        description: `Failed to update group: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      })
      throw error
    }
  }

  const toggleMenu = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === groupId ? null : groupId)
  }

  const panelCountOf = (group: Group) => {
    // Prefer server BIMSF panelCount — never fall back to raw member _count in BIMSF mode
    if (typeof group.panelCount === 'number') return group.panelCount
    if (groupedBy === 'bimsf') return 0
    return group._count?.panelGroups || group._count?.panels || group.metadata?.panelCount || 0
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
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Group Management</h2>
            <p className="text-sm text-slate-500 mt-1">
              Organize panels into groups
              {groupedBy === 'bimsf' ? ' · counts use BIMSF panels' : ''}
            </p>
          </div>
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium uq-btn rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
          {groups.map((group) => {
            const panelCount = panelCountOf(group)
            const displayDescription =
              group.description || `Group for organizing ${group.name.toLowerCase()} panels`

            return (
              <div
                key={group.id}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer relative"
                onClick={() => handleGroupClick(group)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Grid3x3
                      className="w-8 h-8 shrink-0"
                      style={{ color: group.color || '#3B82F6' }}
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {group.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {panelCount} {groupedBy === 'bimsf' ? 'BIMSF panels' : 'panels'}
                      </p>
                    </div>
                  </div>

                  <div className="relative" ref={openMenuId === group.id ? menuRef : null}>
                    <button
                      onClick={(e) => toggleMenu(group.id, e)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>

                    {openMenuId === group.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(null)
                            void handleGroupClick(group)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Panels
                        </button>
                        <button
                          onClick={(e) => handleEditGroup(group, e)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Group
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(group, e)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Group
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
            <h3 className="text-lg font-medium text-slate-900 mb-2">No groups yet</h3>
            <p className="text-sm text-slate-500 mb-6">
              Create groups to organize BIMSF panels for shipping, floors, or work packages
            </p>
            <button
              onClick={onCreateGroup}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium uq-btn rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Group
            </button>
          </div>
        </div>
      )}

      {selectedGroup && (
        <GroupDetailModal
          isOpen={showGroupDetail}
          onClose={() => {
            setShowGroupDetail(false)
            setSelectedGroup(null)
            setGroupPanels([])
          }}
          group={selectedGroup}
          projectId={projectId}
          panels={groupPanels}
          loading={loadingPanels}
          groupedBy={groupedBy}
          onViewPanel={handleViewPanel}
        />
      )}

      {selectedPanel && (
        <PanelDetailModal
          isOpen={showPanelDetail}
          onClose={() => {
            setShowPanelDetail(false)
            setSelectedPanel(null)
          }}
          panel={selectedPanel as any}
          onEdit={() => {
            setShowPanelDetail(false)
            setEditingPanel(selectedPanel)
            setShowEditPanelModal(true)
          }}
        />
      )}

      {editingPanel && statuses.length > 0 && allGroups.length > 0 && (
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
          availableGroups={allGroups as any}
          onUpdate={async (panelId, updates) => {
            try {
              const response = await authenticatedFetch(getApiUrl(`panels/${panelId}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  statusIds: updates.customStatusIds,
                  groupIds: updates.groupIds,
                }),
              })

              if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to update panel')
              }

              toast({
                title: 'Success',
                description: 'Panel updated successfully',
              })

              setShowEditPanelModal(false)
              setEditingPanel(null)
              setSelectedPanel(null)
              if (selectedGroup) {
                await loadPanelsByGroup(selectedGroup.id)
              }
              await loadGroups()
              onDataChange?.()
            } catch (error) {
              console.error('Error updating panel:', error)
              toast({
                title: 'Error',
                description: `Failed to update panel: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: 'destructive',
              })
              throw error
            }
          }}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingGroup(null)
          }}
          group={editingGroup}
          onSubmit={handleUpdateGroup}
        />
      )}

      {deletingGroup && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingGroup(null)
          }}
          onConfirm={confirmDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete the group"
          itemName={deletingGroup.name}
          itemType="group"
          panelCount={panelCountOf(deletingGroup)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
