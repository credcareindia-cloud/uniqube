'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Eye, Grid3x3 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { collapseMembersToPanels } from '@/utils/panelMark'
import { getLucideIconName } from '@/utils/iconMapping'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { getApiUrl } from '@/config/api'

interface Panel {
  id: string
  name: string
  tag?: string
  objectType?: string
  location?: string
  panelMark?: string
  memberCount?: number
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
      color?: string
    }
  }>
}

interface Group {
  id: string
  name: string
  description?: string
  type?: string
  color?: string
  panelCount?: number
  _count?: {
    panelGroups?: number
  }
}

interface GroupDetailModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group | null
  projectId: number
  /** When provided (Status Management style), skip internal fetch */
  panels?: Panel[]
  loading?: boolean
  groupedBy?: 'bimsf' | 'members'
  onViewPanel?: (panelId: string) => void
}

export function GroupDetailModal({
  isOpen,
  onClose,
  group,
  projectId,
  panels: panelsProp,
  loading: loadingProp,
  groupedBy = 'members',
  onViewPanel,
}: GroupDetailModalProps) {
  const controlled = panelsProp !== undefined
  const [internalPanels, setInternalPanels] = useState<Panel[]>([])
  const [internalLoading, setInternalLoading] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const panels = controlled ? panelsProp || [] : internalPanels
  const loading = controlled ? !!loadingProp : internalLoading

  useEffect(() => {
    if (!isOpen || !group || controlled) return
    setPage(1)
    void loadPanels()
  }, [isOpen, group?.id, controlled, projectId])

  useEffect(() => {
    if (isOpen) setPage(1)
  }, [isOpen, group?.id, panelsProp])

  const loadPanels = async () => {
    if (!group) return
    try {
      setInternalLoading(true)
      const collected: Panel[] = []
      let pageNum = 1
      let pages = 1
      do {
        const response = await authenticatedFetch(
          getApiUrl(`groups/${projectId}/${group.id}/panels?page=${pageNum}&limit=100`)
        )
        if (!response.ok) break
        const data = await response.json()
        collected.push(...(data.panels || []))
        pages = data.pagination?.totalPages || 1
        pageNum += 1
      } while (pageNum <= pages)
      setInternalPanels(collected)
    } catch (error) {
      console.error('Error loading group panels:', error)
      setInternalPanels([])
    } finally {
      setInternalLoading(false)
    }
  }

  if (!isOpen || !group) return null

  // Panels from the BIMSF-aware API already collapsed; still collapse as safety for member mode
  const uniquePanels = (() => {
    if (groupedBy === 'bimsf' && panels.some((p) => p.panelMark || p.memberCount)) {
      return panels.map((p) => ({
        ...p,
        panelMark: p.panelMark || p.name,
        memberCount: p.memberCount || 1,
        memberIds: (p as any).memberIds || [p.id],
      }))
    }
    const collapsed = collapseMembersToPanels(panels)
    if (collapsed.length) return collapsed
    return panels.map((p) => ({
      ...p,
      panelMark: p.panelMark || p.name,
      memberCount: p.memberCount || 1,
      memberIds: [p.id],
    }))
  })()

  const displayTotal = uniquePanels.length
  const displayPages = Math.max(1, Math.ceil(displayTotal / limit))
  const currentPage = Math.min(page, displayPages)
  const pagedPanels = uniquePanels.slice((currentPage - 1) * limit, currentPage * limit)

  const getIconComponent = (iconName: string) => {
    const lucideIconName = getLucideIconName(iconName)
    return (LucideIcons as any)[lucideIconName] || LucideIcons.Package
  }

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${group.color || '#3B82F6'}20` }}
              >
                <Grid3x3 className="w-6 h-6" style={{ color: group.color || '#3B82F6' }} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{group.name}</h2>
                <p className="text-sm text-slate-500">
                  {displayTotal} {groupedBy === 'bimsf' ? 'BIMSF panel' : 'panel'}
                  {displayTotal !== 1 ? 's' : ''}
                  {group.description ? ` · ${group.description}` : ''}
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

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Panel ID
                    </th>
                    {groupedBy === 'bimsf' && (
                      <th className="text-left py-3 px-6 text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Members
                      </th>
                    )}
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
                      const otherGroups =
                        panel.groups?.filter((pg) => pg.group.id !== group.id) || []
                      const panelId = panel.panelMark || panel.name

                      return (
                        <tr
                          key={`${panelId}-${panel.id}`}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <p className="font-medium text-slate-900">{panelId}</p>
                          </td>
                          {groupedBy === 'bimsf' && (
                            <td className="py-4 px-6 text-sm text-slate-600">
                              {panel.memberCount || 1}
                            </td>
                          )}
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
                                        border: `1px solid ${ps.status.color}40`,
                                      }}
                                      title={ps.status.name}
                                    >
                                      <IconComponent
                                        className="w-4 h-4"
                                        style={{ color: ps.status.color }}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
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
                                      backgroundColor: `${pg.group.color || '#3B82F6'}20`,
                                      border: `1px solid ${pg.group.color || '#3B82F6'}40`,
                                      color: pg.group.color || '#3B82F6',
                                    }}
                                  >
                                    {pg.group.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  if (onViewPanel) onViewPanel(panel.id)
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
                      <td
                        colSpan={groupedBy === 'bimsf' ? 5 : 4}
                        className="py-12 text-center"
                      >
                        <p className="text-slate-500">No panels found in this group</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
            <div className="text-sm text-slate-600">
              Showing{' '}
              {displayTotal === 0 ? 0 : (currentPage - 1) * limit + 1}–
              {Math.min(currentPage * limit, displayTotal)} of {displayTotal}{' '}
              {groupedBy === 'bimsf' ? 'BIMSF panels' : 'panels'}
            </div>
            <div className="flex items-center gap-3">
              {displayPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </>
  )

  return createPortal(modalContent, document.body)
}
