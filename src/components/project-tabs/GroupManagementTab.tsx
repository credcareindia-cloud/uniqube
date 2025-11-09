'use client'

import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { Plus, Building2, Eye, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { GroupDetailModal } from '@/components/modals/GroupDetailModal'
import { EditGroupModal } from '@/components/modals/EditGroupModal'
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal'
import { toast } from '@/components/ui/use-toast'
import { getApiUrl } from '@/config/api'

interface Group {
  id: string
  name: string
  description?: string
  status: string
  type: string
  metadata?: {
    type?: string
    panelCount?: number
  }
  _count?: {
    panels?: number
    panelGroups?: number
  }
}

interface GroupManagementTabProps {
  projectId: number
  onCreateGroup: () => void
  onViewGroup: (group: Group) => void
  onDataChange?: () => void
}

export function GroupManagementTab({ projectId, onCreateGroup, onViewGroup, onDataChange }: GroupManagementTabProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showGroupDetail, setShowGroupDetail] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGroups()
  }, [projectId])

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

  const loadGroups = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch(getApiUrl(`groups/${projectId}`))
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group)
    setShowGroupDetail(true)
    setOpenMenuId(null)
  }

  const handleEditGroup = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setEditingGroup(group)
    setShowEditModal(true)
  }

  const handleDeleteGroup = async (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setDeletingGroup(group)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deletingGroup) return

    try {
      const response = await authenticatedFetch(getApiUrl(`groups/${projectId}/${deletingGroup.id}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadGroups()
        onDataChange?.()
        setShowDeleteModal(false)
        setDeletingGroup(null)
        toast({
          title: "Success",
          description: "Group deleted successfully",
        })
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: `Failed to delete group: ${data.error || 'Unknown error'}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      toast({
        title: "Error",
        description: "Error deleting group",
        variant: "destructive",
      })
    }
  }

  const handleUpdateGroup = async (groupData: { name: string; description: string }) => {
    if (!editingGroup) return

    try {
      const response = await authenticatedFetch(getApiUrl(`groups/${projectId}/${editingGroup.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData)
      })

      if (response.ok) {
        await loadGroups()
        onDataChange?.()
        setShowEditModal(false)
        setEditingGroup(null)
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update group')
      }
    } catch (error) {
      console.error('Error updating group:', error)
      throw error
    }
  }

  const toggleMenu = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(openMenuId === groupId ? null : groupId)
  }

  const getTypeIcon = (type: string) => {
    return Building2
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
            <h2 className="text-lg font-semibold text-slate-900">Group Management</h2>
            <p className="text-sm text-slate-500 mt-1">Organize and manage panel groups</p>
          </div>
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      </div>

      {/* Group Cards Grid */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
          {groups.map((group) => {
            const IconComponent = getTypeIcon(group.type)
            const panelCount = group._count?.panelGroups || group._count?.panels || group.metadata?.panelCount || 0
            const displayDescription = group.description || `Group for organizing ${group.name.toLowerCase()} panels`

            return (
              <div
                key={group.id}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer relative"
                onClick={() => handleGroupClick(group)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-8 h-8 text-slate-700" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                      <p className="text-xs text-slate-500">{panelCount} panels</p>
                    </div>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="relative" ref={openMenuId === group.id ? menuRef : null}>
                    <button
                      onClick={(e) => toggleMenu(group.id, e)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === group.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(null)
                            handleGroupClick(group)
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

                {/* Description - Always show (auto-generated if not present) */}
                <p className="text-xs text-slate-600 line-clamp-2">{displayDescription}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-12">
          <div className="text-center">
            <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Groups Yet</h3>
            <p className="text-slate-500 mb-6">Create your first group to organize panels</p>
            <button
              onClick={onCreateGroup}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      <GroupDetailModal
        isOpen={showGroupDetail}
        onClose={() => {
          setShowGroupDetail(false)
          setSelectedGroup(null)
        }}
        group={selectedGroup}
        projectId={projectId}
      />

      {/* Edit Group Modal */}
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

      {/* Delete Confirmation Modal */}
      {deletingGroup && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setDeletingGroup(null)
          }}
          onConfirm={confirmDelete}
          title="Delete Group"
          message={`Are you sure you want to delete this group? This action cannot be undone.`}
          itemName={deletingGroup.name}
          itemType="group"
          panelCount={deletingGroup._count?.panelGroups || 0}
        />
      )}
    </div>
  )
}
