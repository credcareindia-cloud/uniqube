'use client'

import { useState, useEffect } from 'react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { Eye, Download, Filter, Search, Circle } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { RemoveStatusModal } from '@/components/modals/RemoveStatusModal'
import { RemoveGroupModal } from '@/components/modals/RemoveGroupModal'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { toast } from '@/components/ui/use-toast'

// Icon name mapping from database names to Lucide React names
// const ICON_NAME_MAP: Record<string, string> = {
//   'angle-double-down': 'ChevronsDown',
//   'angle-double-left': 'ChevronsLeft',
//   'angle-double-right': 'ChevronsRight',
//   'angle-double-up': 'ChevronsUp',
//   'angle-down': 'ChevronDown',
//   'angle-left': 'ChevronLeft',
//   'angle-right': 'ChevronRight',
//   'angle-up': 'ChevronUp',
//   'bell': 'Bell',
//   'bookmark': 'Bookmark',
//   'box': 'Box',
//   'check': 'Check',
//   'circle': 'Circle',
//   'clock': 'Clock',
//   'code': 'Code',
//   'exclamation': 'AlertTriangle',
//   'eye': 'Eye',
//   'file': 'File',
//   'folder': 'Folder',
//   'forward': 'Forward',
//   'hashtag': 'Hash',
//   'info': 'Info',
//   'lightbulb': 'Lightbulb',
//   'lock': 'Lock',
//   'lock-open': 'LockOpen',
//   'map-marker': 'MapPin',
//   'minus': 'Minus',
//   'pause': 'Pause',
//   'pen-to-square': 'Edit',
//   'phone': 'Phone',
//   'play': 'Play',
//   'plus': 'Plus',
//   'reply': 'Reply',
//   'save': 'Save',
//   'search': 'Search',
//   'send': 'Send',
//   'server': 'Server',
//   'share-alt': 'Share2',
//   'shield': 'Shield',
//   'shop': 'ShoppingBag',
//   'sign-in': 'LogIn',
//   'sign-out': 'LogOut',
//   'sliders-h': 'SlidersHorizontal',
//   'sort': 'ArrowUpDown',
//   'spinner': 'Loader',
//   'star': 'Star',
//   'stop-circle': 'StopCircle',
//   'stopwatch': 'Timer',
//   'tag': 'Tag',
//   'thumbs-down': 'ThumbsDown',
//   'thumbs-up': 'ThumbsUp',
//   'thumbtack': 'Pin',
//   'th-large': 'Grid3x3',
//   'ticket': 'Ticket',
//   'times': 'X',
//   'times-circle': 'XCircle',
//   'trash': 'Trash2',
//   'undo': 'Undo',
//   'unlock': 'Unlock',
//   'user': 'User',
//   'users': 'Users',
//   'verified': 'BadgeCheck',
//   'warehouse': 'Warehouse',
//   'maximize': 'Maximize',
//   'minimize': 'Minimize',
//   'wrench': 'Wrench',
//   'package': 'Package',
// }

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
  
  // Map the icon name from database format to Lucide format
  const mappedName = iconNameMap[iconName] || iconName
  
  // Try to get the icon
  const IconComponent = (LucideIcons as any)[mappedName]
  
  if (IconComponent) {
    return IconComponent
  }
  
  // Fallback to Circle
  console.warn(`❌ Icon "${iconName}" (mapped to "${mappedName}") not found in Lucide, using Circle`)
  return Circle
}

interface Panel {
  id: string
  name: string
  tag?: string
  objectType?: string
  location?: string
  groups?: any[]
  statuses?: any[]
  totalPanels?: number
}

interface Group {
  id: string
  name: string
}

interface Status {
  id: string
  name: string
  color: string
}

interface PanelManagementTabProps {
  projectId: number
  onPanelClick?: (panel: Panel) => void
}

export function PanelManagementTab({ projectId, onPanelClick }: PanelManagementTabProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPanels, setTotalPanels] = useState(0)
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Group[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [showRemoveStatusModal, setShowRemoveStatusModal] = useState(false)
  const [showRemoveGroupModal, setShowRemoveGroupModal] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const limit = 50

  useEffect(() => {
    loadPanels()
    loadGroups()
    loadStatuses()
  }, [projectId, page])

  const loadPanels = async () => {
    try {
      setLoading(true)
      // Fetch ALL panels (no pagination on backend)
      const response = await authenticatedFetch(
        `http://localhost:4000/api/panels/${projectId}/all`
      )
      if (response.ok) {
        const data = await response.json()
        const allPanels = data.panels || []
        setPanels(allPanels)
        setTotalPanels(allPanels.length)
        // Calculate total pages for client-side pagination
        setTotalPages(Math.ceil(allPanels.length / limit))
        console.log(`✅ Loaded ${allPanels.length} panels (client-side pagination)`)
      }
    } catch (error) {
      console.error('Error loading panels:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/groups/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  const loadStatuses = async () => {
    try {
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setStatuses(data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  // Helper function to extract storey/floor number from panel
  const getStorey = (panel: Panel): number => {
    // Try to extract storey number from location (e.g., "1ST FLOOR", "2ND FLOOR", "FLOOR 3")
    const location = panel.location?.toLowerCase() || ''
    const storeyMatch = location.match(/(\d+)(st|nd|rd|th)?\s*floor|floor\s*(\d+)|storey\s*(\d+)|level\s*(\d+)/i)
    if (storeyMatch) {
      return parseInt(storeyMatch[1] || storeyMatch[3] || storeyMatch[4] || storeyMatch[5] || '0')
    }
    
    // Try to extract from metadata if available
    if (panel.metadata && typeof panel.metadata === 'object') {
      const metadata = panel.metadata as any
      if (metadata.storey) return parseInt(metadata.storey) || 0
      if (metadata.floor) return parseInt(metadata.floor) || 0
      if (metadata.level) return parseInt(metadata.level) || 0
    }
    
    return 999 // Put panels without storey info at the end
  }

  // Filter and sort all panels
  const filteredAndSortedPanels = panels
    .filter(panel =>
      panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      panel.tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      panel.location?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const storeyA = getStorey(a)
      const storeyB = getStorey(b)
      
      // First sort by storey (ascending)
      if (storeyA !== storeyB) {
        return storeyA - storeyB
      }
      
      // Then sort by name (ascending)
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
    })

  // Apply client-side pagination
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const filteredPanels = filteredAndSortedPanels.slice(startIndex, endIndex)
  
  // Update total pages based on filtered results
  const filteredTotalPages = Math.ceil(filteredAndSortedPanels.length / limit)

  const handlePanelClick = (panel: Panel) => {
    setSelectedPanel(panel)
    setShowPanelDetail(true)
    if (onPanelClick) {
      onPanelClick(panel)
    }
  }

  const handleEditPanel = () => {
    setShowPanelDetail(false)
    setShowEditPanel(true)
  }

  const handlePanelUpdate = async () => {
    await loadPanels()
    setShowEditPanel(false)
    setSelectedPanel(null)
  }

  const togglePanelSelection = (panelId: string) => {
    const newSelection = new Set(selectedPanels)
    if (newSelection.has(panelId)) {
      newSelection.delete(panelId)
    } else {
      newSelection.add(panelId)
    }
    setSelectedPanels(newSelection)
  }

  const selectAllPanels = () => {
    const allPanelIds = filteredPanels.map(p => p.id)
    setSelectedPanels(new Set(allPanelIds))
  }

  const clearSelection = () => {
    setSelectedPanels(new Set())
  }

  // Get unique statuses from selected panels
  const getStatusesFromSelectedPanels = (): Status[] => {
    const statusMap = new Map<string, Status>()
    
    panels.forEach(panel => {
      if (selectedPanels.has(panel.id) && panel.statuses) {
        panel.statuses.forEach((ps: any) => {
          if (ps.status && !statusMap.has(ps.status.id)) {
            statusMap.set(ps.status.id, {
              id: ps.status.id,
              name: ps.status.name,
              color: ps.status.color
            })
          }
        })
      }
    })
    
    return Array.from(statusMap.values())
  }

  // Get unique groups from selected panels
  const getGroupsFromSelectedPanels = (): Group[] => {
    const groupMap = new Map<string, Group>()
    
    panels.forEach(panel => {
      if (selectedPanels.has(panel.id) && panel.groups) {
        panel.groups.forEach((pg: any) => {
          if (pg.group && !groupMap.has(pg.group.id)) {
            groupMap.set(pg.group.id, {
              id: pg.group.id,
              name: pg.group.name
            })
          }
        })
      }
    })
    
    return Array.from(groupMap.values())
  }

  const handleBulkAssignStatus = async (statusId: string) => {
    if (selectedPanels.size === 0) return

    try {
      const panelIds = Array.from(selectedPanels)
      const response = await authenticatedFetch(`http://localhost:4000/api/status-management/assign-to-panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          panelIds,
          statusId,
          projectId
        })
      })

      if (response.ok) {
        await loadPanels()
        clearSelection()
        toast({
          title: "Success",
          description: `Successfully assigned status to ${panelIds.length} panel(s)`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to assign status",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error assigning status:', error)
      toast({
        title: "Error",
        description: "Error assigning status",
        variant: "destructive",
      })
    }
  }

  const handleBulkAddToGroup = async (groupId: string) => {
    if (selectedPanels.size === 0) return

    try {
      const panelIds = Array.from(selectedPanels)
      const response = await authenticatedFetch(`http://localhost:4000/api/groups/${projectId}/${groupId}/panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelIds })
      })

      if (response.ok) {
        await loadPanels()
        clearSelection()
        toast({
          title: "Success",
          description: `Successfully added ${panelIds.length} panel(s) to group`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to add panels to group",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding to group:', error)
      toast({
        title: "Error",
        description: "Error adding panels to group",
        variant: "destructive",
      })
    }
  }

  const handleBulkRemoveStatus = async (statusIds: string[]) => {
    if (selectedPanels.size === 0 || statusIds.length === 0) return

    try {
      const panelIds = Array.from(selectedPanels)
      
      // Remove each selected status from the panels
      for (const statusId of statusIds) {
        await authenticatedFetch(`http://localhost:4000/api/status-management/remove-from-panels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            panelIds,
            statusId,
            projectId
          })
        })
      }

      await loadPanels()
      clearSelection()
      setShowRemoveStatusModal(false)
      toast({
        title: "Success",
        description: `Successfully removed ${statusIds.length} status(es) from ${panelIds.length} panel(s)`,
      })
    } catch (error) {
      console.error('Error removing status:', error)
      toast({
        title: "Error",
        description: "Error removing status",
        variant: "destructive",
      })
    }
  }

  const handleBulkRemoveFromGroup = async (groupIds: string[]) => {
    if (selectedPanels.size === 0 || groupIds.length === 0) return

    try {
      const panelIds = Array.from(selectedPanels)
      
      // Remove panels from each selected group
      for (const groupId of groupIds) {
        await authenticatedFetch(`http://localhost:4000/api/groups/${projectId}/${groupId}/panels`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panelIds })
        })
      }

      await loadPanels()
      clearSelection()
      setShowRemoveGroupModal(false)
      toast({
        title: "Success",
        description: `Successfully removed ${panelIds.length} panel(s) from ${groupIds.length} group(s)`,
      })
    } catch (error) {
      console.error('Error removing from group:', error)
      toast({
        title: "Error",
        description: "Error removing panels from group",
        variant: "destructive",
      })
    }
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

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Panel Management</h2>
            <p className="text-sm text-slate-500 mt-1">
              {totalPanels.toLocaleString()} panels in project
            </p>
          </div>
          {/* <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div> */}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search panels by name, tag, or location..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedPanels.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-slate-900 font-semibold">
                  {selectedPanels.size} panel{selectedPanels.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={clearSelection}
                  className="text-slate-600 hover:text-slate-900 text-sm underline"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssignStatus(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-slate-700"
                >
                  <option value="">Assign Status...</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRemoveStatusModal(true)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
                >
                  Remove Status...
                </button>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAddToGroup(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-slate-700"
                >
                  <option value="">Add to Group...</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRemoveGroupModal(true)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
                >
                  Remove from Group...
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Panel Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedPanels.size > 0 && selectedPanels.size === filteredPanels.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllPanels()
                      } else {
                        clearSelection()
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 bg-white checked:bg-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Panel
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Group
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Location
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPanels.length > 0 ? (
                filteredPanels.map((panel) => (
                  <tr
                    key={panel.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input, button')) return
                      handlePanelClick(panel)
                    }}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedPanels.has(panel.id)}
                        onChange={() => togglePanelSelection(panel.id)}
                        className="w-4 h-4 rounded border-slate-300 bg-white checked:bg-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{panel.name}</p>
                        <p className="text-xs text-slate-500">{panel.tag || 'No tag'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">
                      {panel.objectType || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">
                      {panel.groups && panel.groups.length > 0
                        ? panel.groups.map((pg: any) => pg.group?.name).join(', ')
                        : 'No group'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {panel.location || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      {panel.statuses && panel.statuses.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {panel.statuses.map((ps: any) => {
                            const IconComponent = getIconComponent(ps.status.icon)
                            return (
                              <IconComponent 
                                key={ps.id}
                                className="w-5 h-5" 
                                style={{ color: ps.status.color }}
                                title={ps.status.name}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">No status</span>
                      )}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handlePanelClick(panel)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-slate-400">
                      <p className="text-lg font-semibold text-slate-900 mb-2">
                        No Panels Found
                      </p>
                      <p className="text-sm text-slate-600">
                        {searchTerm
                          ? 'Try adjusting your search'
                          : 'Upload a model to see panels'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
            <div className="text-sm text-slate-600">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, filteredAndSortedPanels.length)} of{' '}
              {filteredAndSortedPanels.length.toLocaleString()} panels
              {searchTerm && <span className="text-slate-500"> (filtered from {totalPanels.toLocaleString()} total)</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm font-semibold text-slate-900">
                Page {page} of {filteredTotalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === filteredTotalPages}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => setPage(filteredTotalPages)}
                disabled={page === filteredTotalPages}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Remove Status Modal */}
      <RemoveStatusModal
        isOpen={showRemoveStatusModal}
        onClose={() => setShowRemoveStatusModal(false)}
        onConfirm={handleBulkRemoveStatus}
        availableStatuses={getStatusesFromSelectedPanels()}
        selectedPanelCount={selectedPanels.size}
      />

      {/* Remove Group Modal */}
      <RemoveGroupModal
        isOpen={showRemoveGroupModal}
        onClose={() => setShowRemoveGroupModal(false)}
        onConfirm={handleBulkRemoveFromGroup}
        availableGroups={getGroupsFromSelectedPanels()}
        selectedPanelCount={selectedPanels.size}
      />

      {/* Panel Detail Modal */}
      {selectedPanel && (
        <PanelDetailModal
          isOpen={showPanelDetail}
          onClose={() => {
            setShowPanelDetail(false)
            setSelectedPanel(null)
          }}
          panel={selectedPanel as any}
          onEdit={handleEditPanel}
        />
      )}

      {/* Edit Panel Modal */}
      {selectedPanel && (
        <EditPanelModal
          isOpen={showEditPanel}
          onClose={() => {
            setShowEditPanel(false)
            setSelectedPanel(null)
          }}
          panel={selectedPanel as any}
          projectId={projectId.toString()}
          availableStatuses={statuses}
          availableGroups={groups as any}
          onUpdate={async (panelId: string, updates: any) => {
            try {
              const response = await authenticatedFetch(`http://localhost:4000/api/panels/${panelId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  // notes: updates.description,
                  statusIds: updates.customStatusIds,
                  groupIds: updates.groupIds,
                }),
              })

              if (!response.ok) {
                throw new Error('Failed to update panel')
              }

              await handlePanelUpdate()
            } catch (error) {
              console.error('Error updating panel:', error)
              throw error
            }
          }}
        />
      )}
    </div>
  )
}
