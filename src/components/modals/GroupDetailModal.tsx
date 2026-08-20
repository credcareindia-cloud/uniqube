'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Users, ChevronLeft, ChevronRight, Eye, Edit, Grid3x3 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { PanelDetailModal } from '@/components/modals/PanelDetailModal'
import { EditPanelModal } from '@/components/modals/EditPanelModal'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { toast } from '@/components/ui/use-toast'
import { getApiUrl } from '@/config/api'
import { collapseMembersToPanels } from '@/utils/panelMark'

interface Panel {
  id: string
  name: string
  tag?: string
  objectType?: string
  location?: string
  metadata?: Record<string, unknown> | null
  statuses?: Array<{
    id: string
    status: {
      id: string
      name: string
      icon: string
      color: string
    }
  }>
  groups?: Array<{
    id: string
    group: {
      id: string
      name: string
    }
  }>
}

interface Group {
  id: string
  name: string
  description?: string
  type?: string
  color?: string
  _count?: {
    panelGroups?: number
  }
}

interface GroupDetailModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group | null
  projectId: number
}

export function GroupDetailModal({ isOpen, onClose, group, projectId }: GroupDetailModalProps) {
  const [panels, setPanels] = useState<Panel[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 10
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null)
  const [showPanelDetail, setShowPanelDetail] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (isOpen && group) {
      setPage(1)
      loadPanels()
      loadStatuses()
      loadGroups()
    }
  }, [isOpen, group])

  const loadPanels = async () => {
    if (!group) return

    try {
      setLoading(true)
      const collected: Panel[] = []
      let pageNum = 1
      let pages = 1

      do {
        const response = await authenticatedFetch(
          `/groups/${projectId}/${group.id}/panels?page=${pageNum}&limit=100`
        )
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ Error response:', errorText)
          break
        }
        const data = await response.json()
        collected.push(...(data.panels || []))
        pages = data.pagination?.totalPages || 1
        pageNum += 1
      } while (pageNum <= pages)

      setPanels(collected)
    } catch (error) {
      console.error('❌ Error loading group panels:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStatuses = async () => {
    try {
      const response = await authenticatedFetch(`/status-management/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setStatuses(data.statuses || [])
      }
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await authenticatedFetch(`/groups/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  const uniquePanels = collapseMembersToPanels(panels)
  const filteredPanels = uniquePanels.filter(panel => {
    const mark = (panel.panelMark || panel.name || '').toLowerCase()
    const matchesSearch = searchTerm === '' ||
      mark.includes(searchTerm.toLowerCase()) ||
      panel.tag?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' ||
      panel.statuses?.some(ps => ps.status.id === statusFilter)

    return matchesSearch && matchesStatus
  })
  const displayTotal = filteredPanels.length
  const displayPages = Math.max(1, Math.ceil(displayTotal / limit))
  const currentPage = Math.min(page, displayPages)
  const pagedPanels = filteredPanels.slice((currentPage - 1) * limit, currentPage * limit)

  // Get icon component (matching StatusDetailModal)
  const getIconComponent = (iconName: string) => {
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

    const lucideIconName = iconNameMap[iconName?.toLowerCase()] || iconName
    const LucideIcon = (LucideIcons as any)[lucideIconName]
    return LucideIcon || (LucideIcons as any)['Package']
  }

  if (!isOpen || !group) return null

  const modalContent = (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose}></div>

      {/* Modal container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${group.color || '#3B82F6'}20` }}>
                <Grid3x3 className="w-6 h-6" style={{ color: group.color || '#3B82F6' }} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{group.name}</h2>
                <p className="text-sm text-slate-500">
                  {displayTotal} panel{displayTotal !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Search and Filters */}
          {/* <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by ID or description..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:border-slate-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div> */}

          {/* Panel List Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Panel ID
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Other Groups
                    </th>
                    <th className="text-center py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagedPanels.length > 0 ? (
                    pagedPanels.map((panel) => {
                      const otherGroups = panel.groups?.filter(pg => pg.group.id !== group.id) || []
                      const panelId = panel.panelMark || panel.name

                      return (
                        <tr key={`${panelId}-${panel.id}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-medium text-slate-900">{panelId}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {panel.statuses && panel.statuses.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {panel.statuses.map((ps) => {
                                  const IconComponent = getIconComponent(ps.status.icon)
                                  return (
                                    <div
                                      key={ps.id}
                                      className="p-1.5 rounded"
                                      style={{
                                        backgroundColor: ps.status.color + '20',
                                        border: `1px solid ${ps.status.color}40`
                                      }}
                                      title={ps.status.name}
                                    >
                                      <IconComponent className="w-4 h-4" style={{ color: ps.status.color }} />
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {otherGroups.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {otherGroups.map((pg) => (
                                  <span
                                    key={pg.id}
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: `${(pg.group as any).color || '#3B82F6'}20`,
                                      border: `1px solid ${(pg.group as any).color || '#3B82F6'}40`,
                                      color: (pg.group as any).color || '#3B82F6'
                                    }}
                                  >
                                    {pg.group.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedPanel(panel)
                                  setShowPanelDetail(true)
                                }}
                                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="View panel details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <p className="text-slate-500">No panels found in this group</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
            <div className="text-sm text-slate-600">
              Showing {displayTotal === 0 ? 0 : ((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, displayTotal)} of {displayTotal} {displayTotal === 1 ? 'panel' : 'panels'}
            </div>
            <div className="flex items-center gap-3">
              {displayPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {displayPages}
                  </span>
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === displayPages}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Detail Modal */}
      {selectedPanel && (
        <PanelDetailModal
          isOpen={showPanelDetail}
          onClose={() => {
            setShowPanelDetail(false)
            setSelectedPanel(null)
          }}
          panel={{
            ...selectedPanel,
            projectId: projectId,
            status: 'PENDING' as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onEdit={() => {
            setShowPanelDetail(false)
            setShowEditPanel(true)
          }}
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
          panel={{
            ...selectedPanel,
            projectId: projectId,
            status: 'PENDING' as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          projectId={projectId.toString()}
          availableStatuses={statuses}
          availableGroups={groups as any}
          onUpdate={async (panelId, updates) => {
            try {
              // Use getApiUrl if available, or fallback to relative path if that's what the project uses
              // Since I'm importing getApiUrl, I'll use it to be consistent with StatusManagementTab
              const response = await authenticatedFetch(getApiUrl(`panels/${panelId}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  statusIds: updates.customStatusIds,
                  groupIds: updates.groupIds
                })
              })

              if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to update panel')
              }

              toast({
                title: "Success",
                description: "Panel updated successfully",
              })

              await loadPanels()
              setShowEditPanel(false)
              setSelectedPanel(null)
            } catch (error) {
              console.error('Error updating panel:', error)
              toast({
                title: "Error",
                description: `Failed to update panel: ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
              })
              throw error
            }
          }}
        />
      )}
    </>
  )

  return createPortal(modalContent, document.body)
}
