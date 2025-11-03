'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

interface Panel {
  id: string
  name: string
  tag?: string
  objectType: string
  location: string
  status: string
  description?: string
  group?: {
    id: string
    name: string
  }
  groups?: Array<{
    id: string
    group: {
      id: string
      name: string
    }
  }>
}

interface StatusDetailModalProps {
  isOpen: boolean
  onClose: () => void
  status: {
    id: string
    name: string
    icon: string
    color: string
    description?: string
    panelCount?: number
  }
  panels: Panel[]
  loading: boolean
  onEditStatus?: () => void
  onDeleteStatus?: () => void
  onViewPanel?: (panelId: string) => void
}

export function StatusDetailModal({
  isOpen,
  onClose,
  status,
  panels,
  loading,
  onEditStatus,
  onDeleteStatus,
  onViewPanel
}: StatusDetailModalProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  if (!isOpen) return null

  // Get icon component
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
    
    const lucideIconName = iconNameMap[iconName?.toLowerCase()] || iconName
    const LucideIcon = (LucideIcons as any)[lucideIconName]
    return LucideIcon || (LucideIcons as any)['Package']
  }

  const IconComponent = getIconComponent(status.icon)

  // Pagination
  const totalPages = Math.ceil(panels.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPanels = panels.slice(startIndex, endIndex)

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg border border-slate-200 max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <IconComponent 
                className="w-10 h-10" 
                style={{ color: status.color }} 
              />
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{status.name}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {status.panelCount || panels.length} panels with this status
                </p>
                {status.description && (
                  <p className="text-sm text-slate-600 mt-2">{status.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onEditStatus && (
                <button
                  onClick={onEditStatus}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit Status"
                >
                  <Edit className="w-5 h-5" />
                </button>
              )}
              {onDeleteStatus && (
                <button
                  onClick={onDeleteStatus}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Status"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
          ) : currentPanels.length > 0 ? (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Panel ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Groups
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {currentPanels.map((panel) => (
                  <tr key={panel.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{panel.name}</div>
                      {panel.tag && (
                        <div className="text-xs text-slate-500">{panel.tag}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {panel.groups && panel.groups.length > 0 ? (
                          panel.groups.map((groupRel: any) => (
                            <span
                              key={groupRel.group.id}
                              className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium"
                            >
                              {groupRel.group.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No groups</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => onViewPanel?.(panel.id)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="View panel details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">No panels with this status</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {startIndex + 1}-{Math.min(endIndex, panels.length)} of {panels.length} {panels.length === 1 ? 'panel' : 'panels'}
            </div>
            <div className="flex items-center gap-3">
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
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
    </div>
  )

  return createPortal(modalContent, document.body)
}
