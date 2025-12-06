'use client'

import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { Eye, Download, Filter, Search, Circle, ChevronDown } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { RemoveStatusModal } from '@/components/modals/RemoveStatusModal'
import { RemoveGroupModal } from '@/components/modals/RemoveGroupModal'
import { AssignStatusModal } from '@/components/modals/AssignStatusModal'
import { AddToGroupModal } from '@/components/modals/AddToGroupModal'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { toast } from '@/components/ui/use-toast'
import { getApiUrl } from '@/config/api'

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
  metadata?: any
  model?: {
    id: string
    originalFilename: string
    category: string
    displayName: string
  }
}

interface Group {
  id: string
  name: string
  color?: string
}

interface Status {
  id: string
  name: string
  color: string
  icon: string
}

interface Model {
  id: string
  name: string
  filename: string
  category: string
  isActive: boolean
  elementCount: number
  sizeBytes: number
  createdAt: string
}

interface PanelManagementTabProps {
  projectId: number
  onPanelClick?: (panel: Panel) => void
}

export function PanelManagementTab({ projectId, onPanelClick }: PanelManagementTabProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('') // Server search term
  const [searchInput, setSearchInput] = useState('') // Local input value
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPanels, setTotalPanels] = useState(0)
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Group[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('all')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([])
  const [showRemoveStatusModal, setShowRemoveStatusModal] = useState(false)
  const [showRemoveGroupModal, setShowRemoveGroupModal] = useState(false)
  const [showAssignStatusModal, setShowAssignStatusModal] = useState(false)
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false)
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({})
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const groupDropdownRef = useRef<HTMLDivElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const limit = 50

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
      setPage(1) // Reset to first page when search changes
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [searchInput])

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false)
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadPanels()
    loadGroups()
    loadStatuses()
    loadModels()
    loadStatistics()
  }, [projectId, page, searchTerm, selectedModelId, selectedGroupIds, selectedStatusIds])


  const loadPanels = async () => {
    try {
      setLoading(true)

      // Build query parameters for server-side pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      // Add model filter if selected
      if (selectedModelId !== 'all') {
        params.append('modelId', selectedModelId)
      }

      // Add group filters if selected
      if (selectedGroupIds.length > 0) {
        selectedGroupIds.forEach(groupId => {
          params.append('groupIds', groupId)
        })
      }

      // Add status filters if selected
      if (selectedStatusIds.length > 0) {
        selectedStatusIds.forEach(statusId => {
          params.append('statusIds', statusId)
        })
      }

      // Add search term if present
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }

      // Use /api/panels/:projectId endpoint which supports pagination
      const url = getApiUrl(`panels/${projectId}?${params.toString()}`)
      console.log('🔍 Loading panels with URL:', url)
      console.log('📊 Params:', { page, limit, selectedModelId, selectedGroupIds, selectedStatusIds, searchTerm })

      const response = await authenticatedFetch(url)
      if (response.ok) {
        const data = await response.json()
        console.log('📦 Response data:', data)
        setPanels(data.panels || [])
        setTotalPanels(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
        console.log(`✅ Loaded ${data.panels?.length || 0} panels (page ${page}/${data.pagination?.totalPages || 1})`)
      } else {
        console.error('❌ Response not OK:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading panels:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await authenticatedFetch(getApiUrl(`panels/${projectId}/statistics`))
      if (response.ok) {
        const data = await response.json()
        setGroupCounts(data.groupCountsById || {})
        setStatusCounts(data.statusCountsById || {})
      }
    } catch (error) {
      console.error('Error loading statistics:', error)
    }
  }

  const loadModels = async () => {
    try {
      const response = await authenticatedFetch(getApiUrl(`projects/${projectId}/models-list`))
      if (response.ok) {
        const data = await response.json()

        // Remove duplicates on frontend as extra safety measure
        const uniqueModels = data.models?.filter((model: Model, index: number, array: Model[]) =>
          array.findIndex(m => m.id === model.id) === index
        ) || []

        setAvailableModels(uniqueModels)
        console.log(`✅ Loaded ${uniqueModels.length} unique models for project ${projectId}`)
      }
    } catch (error) {
      console.error('Error loading models:', error)
    }
  }

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId)
    setPage(1) // Reset to first page when changing model filter
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value) // Update local input value
    // The actual search term update and page reset will happen via the debounced useEffect
  }

  const loadGroups = async () => {
    try {
      const response = await authenticatedFetch(getApiUrl(`groups/${projectId}`))
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
      const response = await authenticatedFetch(getApiUrl(`status-management/${projectId}`))
      if (response.ok) {
        const data = await response.json()
        setStatuses(data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  // Panels are already filtered and sorted by the server
  // No need for client-side filtering or pagination
  const filteredPanels = panels
  const filteredTotalPages = totalPages

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
    // Add current page panels to existing selection
    const newSelection = new Set(selectedPanels)
    filteredPanels.forEach(p => newSelection.add(p.id))
    setSelectedPanels(newSelection)
  }

  const deselectCurrentPagePanels = () => {
    // Remove only current page panels from selection
    const newSelection = new Set(selectedPanels)
    filteredPanels.forEach(p => newSelection.delete(p.id))
    setSelectedPanels(newSelection)
  }

  const clearSelection = () => {
    setSelectedPanels(new Set())
  }

  // Check if all panels on current page are selected
  const areAllCurrentPagePanelsSelected = () => {
    if (filteredPanels.length === 0) return false
    return filteredPanels.every(p => selectedPanels.has(p.id))
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
              color: ps.status.color,
              icon: ps.status.icon
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
              name: pg.group.name,
              color: pg.group.color
            })
          }
        })
      }
    })

    return Array.from(groupMap.values())
  }

  const handleBulkAssignStatus = async (statusIds: string[]) => {
    if (selectedPanels.size === 0 || statusIds.length === 0) return

    try {
      const panelIds = Array.from(selectedPanels)

      // Assign each selected status to the panels
      for (const statusId of statusIds) {
        await authenticatedFetch(getApiUrl('status-management/assign-to-panels'), {
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
      setShowAssignStatusModal(false)
      toast({
        title: "Success",
        description: `Successfully assigned ${statusIds.length} status(es) to ${panelIds.length} panel(s)`,
      })
    } catch (error) {
      console.error('Error assigning status:', error)
      toast({
        title: "Error",
        description: "Error assigning status",
        variant: "destructive",
      })
    }
  }

  const handleBulkAddToGroup = async (groupIds: string[]) => {
    if (selectedPanels.size === 0 || groupIds.length === 0) return

    try {
      const panelIds = Array.from(selectedPanels)

      // Add panels to each selected group
      for (const groupId of groupIds) {
        await authenticatedFetch(getApiUrl(`groups/${projectId}/${groupId}/panels`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panelIds })
        })
      }

      await loadPanels()
      clearSelection()
      setShowAddToGroupModal(false)
      toast({
        title: "Success",
        description: `Successfully added ${panelIds.length} panel(s) to ${groupIds.length} group(s)`,
      })
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
        await authenticatedFetch(getApiUrl('status-management/remove-from-panels'), {
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
        await authenticatedFetch(getApiUrl(`groups/${projectId}/${groupId}/panels`), {
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

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search panels by name, tag, location, or type..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Model Selection Dropdown */}
            <div>
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:border-slate-500 focus:outline-none bg-white min-h-[42px] hover:border-slate-400 transition-colors cursor-pointer"
              >
                <option value="all">All Models ({availableModels.length})</option>
                {availableModels.map((model) => {
                  // Get category prefix (only for specific categories)
                  const getCategoryPrefix = (category: string) => {
                    switch (category) {
                      case 'STRUCTURE': return '[STR] ';
                      case 'MEP': return '[MEP] ';
                      case 'ELECTRICAL': return '[ELE] ';
                      default: return ''; // No prefix for OTHER
                    }
                  };

                  // Truncate long model names
                  const truncateName = (name: string, maxLength: number = 20) => {
                    if (name.length <= maxLength) return name;
                    return name.substring(0, maxLength - 3) + '...';
                  };

                  // Use original filename instead of display name
                  const modelName = model.filename?.replace(/\.(ifc|frag)$/i, '') || model.name;
                  const displayName = `${getCategoryPrefix(model.category)}${truncateName(modelName)} (${model.elementCount || 0})`;

                  return (
                    <option key={model.id} value={model.id} title={`${modelName} (${model.elementCount || 0} elements)`}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Group Filter - Custom Multi-Select */}
            <div className="relative" ref={groupDropdownRef}>
              <div
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:border-slate-400 transition-colors flex items-center gap-2 min-h-[42px] max-h-[80px]"
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
              >
                {selectedGroupIds.length === 0 ? (
                  <span className="text-slate-500 text-sm flex-1">Filter by Group</span>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto max-h-[60px] pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                      <div className="flex flex-wrap gap-1">
                        {selectedGroupIds.slice(0, 10).map(groupId => {
                          const group = groups.find(g => g.id === groupId);
                          if (!group) return null;
                          return (
                            <span
                              key={groupId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
                              style={{ backgroundColor: group.color || '#3B82F6' }}
                            >
                              {group.name}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
                                  setPage(1);
                                }}
                                className="hover:bg-black/20 rounded-full p-0.5"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                        {selectedGroupIds.length > 10 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                            +{selectedGroupIds.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedGroupIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupIds([]);
                          setPage(1);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded whitespace-nowrap"
                        title="Clear all groups"
                      >
                        Clear
                      </button>
                    )}
                  </>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selectedGroupIds.length > 0 && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedGroupIds.length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {/* Dropdown Menu */}
              {showGroupDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                  {selectedGroupIds.length > 0 && (
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">
                        {selectedGroupIds.length} selected
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupIds([]);
                          setPage(1);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-52">
                    {groups.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No groups available</div>
                    ) : (
                      groups.map(group => (
                        <label
                          key={group.id}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds(prev => [...prev, group.id]);
                              } else {
                                setSelectedGroupIds(prev => prev.filter(id => id !== group.id));
                              }
                              setPage(1);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <LucideIcons.Grid3x3
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: group.color || '#3B82F6' }}
                          />
                          <span className="text-sm text-slate-900 truncate flex-1">{group.name}</span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            {groupCounts[group.id] || 0}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter - Custom Multi-Select */}
            <div className="relative" ref={statusDropdownRef}>
              <div
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:border-slate-400 transition-colors flex items-center gap-2 min-h-[42px] max-h-[80px]"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                {selectedStatusIds.length === 0 ? (
                  <span className="text-slate-500 text-sm flex-1">Filter by Status</span>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto max-h-[60px] pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                      <div className="flex flex-wrap gap-1">
                        {selectedStatusIds.slice(0, 10).map(statusId => {
                          const status = statuses.find(s => s.id === statusId);
                          if (!status) return null;
                          const IconComponent = getIconComponent(status.icon);
                          return (
                            <span
                              key={statusId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: `${status.color}20`,
                                color: status.color,
                                border: `1px solid ${status.color}40`
                              }}
                            >
                              <IconComponent className="w-3 h-3" />
                              {status.name}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStatusIds(prev => prev.filter(id => id !== statusId));
                                  setPage(1);
                                }}
                                className="hover:bg-black/10 rounded-full p-0.5"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                        {selectedStatusIds.length > 10 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                            +{selectedStatusIds.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedStatusIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStatusIds([]);
                          setPage(1);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded whitespace-nowrap"
                        title="Clear all statuses"
                      >
                        Clear
                      </button>
                    )}
                  </>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selectedStatusIds.length > 0 && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedStatusIds.length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {/* Dropdown Menu */}
              {showStatusDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                  {selectedStatusIds.length > 0 && (
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">
                        {selectedStatusIds.length} selected
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStatusIds([]);
                          setPage(1);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-52">
                    {statuses.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No statuses available</div>
                    ) : (
                      statuses.map(status => {
                        const IconComponent = getIconComponent(status.icon);
                        return (
                          <label
                            key={status.id}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStatusIds.includes(status.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStatusIds(prev => [...prev, status.id]);
                                } else {
                                  setSelectedStatusIds(prev => prev.filter(id => id !== status.id));
                                }
                                setPage(1);
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <IconComponent
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: status.color }}
                            />
                            <span className="text-sm text-slate-900 truncate flex-1">{status.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {statusCounts[status.id] || 0}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
              <button
                onClick={() => setShowAssignStatusModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                Assign Status
              </button>
              <button
                onClick={() => setShowRemoveStatusModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                Remove Status
              </button>
              <button
                onClick={() => setShowAddToGroupModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                Add to Group
              </button>
              <button
                onClick={() => setShowRemoveGroupModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                Remove from Group
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
                    checked={areAllCurrentPagePanelsSelected()}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAllPanels()
                      } else {
                        deselectCurrentPagePanels()
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 bg-white checked:bg-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Panel
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Model
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
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {/* Category Icon */}
                        {panel.model?.category === 'STRUCTURE' && (
                          <div className="w-4 h-4 text-blue-600">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 21h18v-2H3v2zM5 10h4V8H5v2zm0 4h4v-2H5v2zm6-10h4V2h-4v2zm0 4h4V6h-4v2zm0 4h4v-2h-4v2zm6-8h4V2h-4v2zm0 4h4V6h-4v2zm0 4h4v-2h-4v2z" />
                            </svg>
                          </div>
                        )}
                        {panel.model?.category === 'MEP' && (
                          <div className="w-4 h-4 text-green-600">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
                            </svg>
                          </div>
                        )}
                        {panel.model?.category === 'ELECTRICAL' && (
                          <div className="w-4 h-4 text-yellow-600">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.5 2L6.5 9h4v6l5-7h-4V2z" />
                            </svg>
                          </div>
                        )}
                        {(panel.model?.category === 'OTHER' || !panel.model?.category) && (
                          <div className="w-4 h-4 text-slate-500">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                              <path d="M14 2v6h6" />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-slate-700 truncate max-w-[150px]" title={panel.model?.originalFilename || 'Unknown Model'}>
                          {panel.model?.originalFilename?.replace(/\.(ifc|frag)$/i, '') || 'Unknown Model'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">
                      {panel.objectType || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      {panel.groups && panel.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {panel.groups.map((pg: any, index: number) => {
                            // Check if this group matches the active filter
                            const isFilterMatch = selectedGroupIds.length === 0 || selectedGroupIds.includes(pg.group?.id);

                            return (
                              <span
                                key={pg.id || index}
                                className={`text-sm font-medium ${isFilterMatch ? 'font-semibold' : 'opacity-40'}`}
                                style={{ color: pg.group?.color || '#3B82F6' }}
                                title={isFilterMatch ? pg.group?.name : `${pg.group?.name} (not in filter)`}
                              >
                                {pg.group?.name}{index < (panel.groups?.length ?? 0) - 1 ? ',' : ''}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No group</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {panel.location || 'Unknown'}
                    </td>
                    <td className="py-3 px-4">
                      {panel.statuses && panel.statuses.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {panel.statuses.map((ps: any) => {
                            const IconComponent = getIconComponent(ps.status.icon);
                            // Check if this status matches the active filter
                            const isFilterMatch = selectedStatusIds.length === 0 || selectedStatusIds.includes(ps.status.id);

                            return (
                              <IconComponent
                                key={ps.id}
                                className={`w-5 h-5 ${isFilterMatch ? '' : 'opacity-40'}`}
                                style={{ color: ps.status.color }}
                                title={isFilterMatch ? ps.status.name : `${ps.status.name} (not in filter)`}
                              />
                            );
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
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-1">
                        {searchTerm || selectedModelId !== 'all' || selectedGroupIds.length > 0 || selectedStatusIds.length > 0 ? 'No panels match your filters' : 'No panels found'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {searchTerm
                          ? `No results for "${searchTerm}". Try different keywords or clear filters.`
                          : selectedModelId !== 'all' || selectedGroupIds.length > 0 || selectedStatusIds.length > 0
                            ? 'Try selecting different filters or clearing them.'
                            : 'Upload a 3D model to get started with panel management.'}
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
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalPanels)} of{' '}
              {totalPanels.toLocaleString()} panels
              {(searchTerm || selectedModelId !== 'all' || selectedGroupIds.length > 0 || selectedStatusIds.length > 0) && <span className="text-slate-500"> (filtered)</span>}
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

              {/* Page number display and input */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Page</span>
                <input
                  key={page} // Force re-render when page changes externally
                  type="number"
                  min="1"
                  max={filteredTotalPages}
                  defaultValue={page}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newPage = parseInt(e.currentTarget.value);
                      if (!isNaN(newPage) && newPage >= 1 && newPage <= filteredTotalPages) {
                        setPage(newPage);
                        e.currentTarget.blur();
                      } else if (!isNaN(newPage) && newPage < 1) {
                        setPage(1);
                        e.currentTarget.value = '1';
                      } else if (!isNaN(newPage) && newPage > filteredTotalPages) {
                        setPage(filteredTotalPages);
                        e.currentTarget.value = filteredTotalPages.toString();
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const newPage = parseInt(e.target.value);
                    if (isNaN(newPage) || newPage < 1) {
                      setPage(1);
                      e.target.value = '1';
                    } else if (newPage > filteredTotalPages) {
                      setPage(filteredTotalPages);
                      e.target.value = filteredTotalPages.toString();
                    } else if (newPage >= 1 && newPage <= filteredTotalPages) {
                      setPage(newPage);
                    }
                  }}
                  className="w-16 px-2 py-1 text-sm text-center font-semibold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                />
                <span className="text-sm text-slate-600">of {filteredTotalPages}</span>
              </div>

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

      {/* Assign Status Modal */}
      <AssignStatusModal
        isOpen={showAssignStatusModal}
        onClose={() => setShowAssignStatusModal(false)}
        onConfirm={handleBulkAssignStatus}
        availableStatuses={statuses}
        selectedPanelCount={selectedPanels.size}
      />

      {/* Add to Group Modal */}
      <AddToGroupModal
        isOpen={showAddToGroupModal}
        onClose={() => setShowAddToGroupModal(false)}
        onConfirm={handleBulkAddToGroup}
        availableGroups={groups}
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
              const response = await authenticatedFetch(getApiUrl(`panels/${panelId}`), {
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
