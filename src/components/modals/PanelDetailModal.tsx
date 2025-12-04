'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Edit, Eye, ChevronDown, ChevronUp, Circle, Grid3x3 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { Panel } from '@/types/panel'

interface PanelDetailModalProps {
  isOpen: boolean
  onClose: () => void
  panel: Panel
  onEdit: () => void
  onDelete?: (panelId: string) => Promise<void>
  onDuplicate?: (panelId: string) => Promise<void>
}

export function PanelDetailModal({
  isOpen,
  onClose,
  panel,
  onEdit,
  onDelete,
  onDuplicate
}: PanelDetailModalProps) {
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set([0]))
  const assemblyInstructions = (panel.metadata as any)?.assemblyInstructions || []

  const toggleInstruction = (index: number) => {
    setExpandedInstructions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

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

    // Map the icon name from database format to Lucide format
    const mappedName = iconNameMap[iconName] || iconName

    // Try to get the icon
    const IconComponent = (LucideIcons as any)[mappedName]

    if (IconComponent) {
      return IconComponent
    }

    // Fallback to Circle
    return Circle
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-300">
          <div className="flex-1">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {panel.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Panel Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Element ID</p>
              <p className="text-slate-900 font-semibold font-mono text-sm">{(panel.metadata as any)?.ifcElementId || panel.elementId || 'N/A'}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Tag</p>
              <p className="text-slate-900 font-mono text-sm">{panel.tag || 'N/A'}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1 ">Location</p>
              <p className="text-slate-900">{panel.location || 'N/A'}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-1 ">Material</p>
              <p className="text-slate-900">{panel.material || 'N/A'}</p>
            </div>

            {panel.dimensions && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1 ">Dimensions</p>
                <p className="text-slate-900 font-mono text-sm">{panel.dimensions}</p>
              </div>
            )}

            {panel.weight && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1 ">Weight</p>
                <p className="text-slate-900">{panel.weight} kg</p>
              </div>
            )}
          </div>

          {/* Statuses */}
          {(panel as any).statuses && (panel as any).statuses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Statuses</h3>
              <div className="flex flex-wrap gap-2">
                {(panel as any).statuses.map((ps: any) => {
                  const IconComponent = getIconComponent(ps.status.icon)
                  return (
                    <div
                      key={ps.id}
                      className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium"
                      style={{
                        backgroundColor: `${ps.status.color}20`,
                        border: `1px solid ${ps.status.color}40`,
                        color: ps.status.color
                      }}
                    >
                      <IconComponent className="w-4 h-4" style={{ color: ps.status.color }} />
                      {ps.status.name}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Groups */}
          {(panel as any).groups && (panel as any).groups.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Groups</h3>
              <div className="flex flex-wrap gap-2">
                {(panel as any).groups.map((pg: any) => (
                  <div
                    key={pg.id}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium"
                    style={{
                      backgroundColor: `${pg.group.color || '#3B82F6'}20`,
                      border: `1px solid ${pg.group.color || '#3B82F6'}40`,
                      color: pg.group.color || '#3B82F6'
                    }}
                  >
                    <Grid3x3 className="w-4 h-4" style={{ color: pg.group.color || '#3B82F6' }} />
                    {pg.group.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description/Notes */}
          {panel.notes && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2 ">
                Description / Notes
              </h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-900 whitespace-pre-wrap">{panel.notes}</p>
              </div>
            </div>
          )}

          {/* Assembly Instructions Accordion */}
          {assemblyInstructions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3 ">
                Assembly Instructions ({assemblyInstructions.length})
              </h3>
              <div className="space-y-2">
                {assemblyInstructions.map((instruction: any, index: number) => {
                  const isExpanded = expandedInstructions.has(index)
                  return (
                    <div
                      key={instruction.id || index}
                      className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleInstruction(index)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[rgba(58,123,213,0.05)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(58,123,213,0.2)] text-slate-700 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-slate-900 font-semibold text-left">
                            {instruction.title}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-600" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-200">
                          <p className="text-slate-600 whitespace-pre-wrap">
                            {instruction.content}
                          </p>
                          {instruction.attachments && instruction.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs text-slate-600 ">
                                Attachments
                              </p>
                              {instruction.attachments.map((attachment: any) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-[rgba(26,31,46,0.6)] rounded border border-slate-300 hover:border-[rgba(58,123,213,0.4)] transition-colors"
                                >
                                  <Eye className="w-4 h-4 text-slate-700" />
                                  <span className="text-slate-900 text-sm">
                                    {attachment.filename}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}



          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <p className="text-xs text-slate-600 mb-1 ">Created</p>
              <p className="text-slate-900 text-sm">
                {new Date(panel.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1 ">Last Updated</p>
              <p className="text-slate-900 text-sm">
                {new Date(panel.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-300">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Panel
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
