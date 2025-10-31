'use client'

import { useState } from 'react'
import { X, Edit, MoreVertical, Trash2, Copy, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import type { Panel } from '@/types/panel'
import { PANEL_STATUS_CONFIG } from '@/types/panel'

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
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [expandedInstructions, setExpandedInstructions] = useState<Set<number>>(new Set([0]))
  const [isDeleting, setIsDeleting] = useState(false)

  const statusConfig = PANEL_STATUS_CONFIG[panel.status] || PANEL_STATUS_CONFIG.EDIT
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

  const handleDelete = async () => {
    if (!onDelete) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete panel "${panel.name}"? This action cannot be undone.`
    )
    
    if (confirmed) {
      setIsDeleting(true)
      try {
        await onDelete(panel.id)
        onClose()
      } catch (error) {
        console.error('Failed to delete panel:', error)
        alert('Failed to delete panel. Please try again.')
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const handleDuplicate = async () => {
    if (!onDuplicate) return
    
    try {
      await onDuplicate(panel.id)
      onClose()
    } catch (error) {
      console.error('Failed to duplicate panel:', error)
      alert('Failed to duplicate panel. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(58,123,213,0.2)]">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">
                {panel.name}
              </h2>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${statusConfig.color}20`,
                  color: statusConfig.color,
                  border: `1px solid ${statusConfig.color}40`
                }}
              >
                {statusConfig.label}
              </div>
            </div>
            <p className="text-[#B8BCC8] text-sm">
              ID: <span className="font-mono text-[#3A7BD5]">{panel.id}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Edit Button */}
            <button
              onClick={onEdit}
              className="p-2 bg-[rgba(58,123,213,0.2)] border border-[rgba(58,123,213,0.3)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.3)] transition-all"
              title="Edit Panel"
            >
              <Edit className="w-5 h-5" />
            </button>
            
            {/* Quick Actions Menu */}
            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="p-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-all"
                title="Quick Actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {showQuickActions && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg shadow-lg overflow-hidden z-10">
                  {onDuplicate && (
                    <button
                      onClick={handleDuplicate}
                      className="w-full px-4 py-2 flex items-center gap-3 text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-colors text-left"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Duplicate</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(panel.id)
                      alert('Panel ID copied to clipboard!')
                      setShowQuickActions(false)
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-colors text-left"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy ID</span>
                  </button>
                  {onDelete && (
                    <>
                      <div className="h-px bg-[rgba(58,123,213,0.2)]" />
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full px-4 py-2 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors text-left disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-[#B8BCC8] hover:text-[#E8EAF0] transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Panel Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Type</p>
              <p className="text-[#E8EAF0] font-semibold">{panel.objectType || 'N/A'}</p>
            </div>
            
            <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Tag</p>
              <p className="text-[#E8EAF0] font-mono text-sm">{panel.tag || 'N/A'}</p>
            </div>
            
            <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Location</p>
              <p className="text-[#E8EAF0]">{panel.location || 'N/A'}</p>
            </div>
            
            <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Material</p>
              <p className="text-[#E8EAF0]">{panel.material || 'N/A'}</p>
            </div>
            
            {panel.dimensions && (
              <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Dimensions</p>
                <p className="text-[#E8EAF0] font-mono text-sm">{panel.dimensions}</p>
              </div>
            )}
            
            {panel.weight && (
              <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Weight</p>
                <p className="text-[#E8EAF0]">{panel.weight} kg</p>
              </div>
            )}
          </div>

          {/* Current Status and Groups */}
          <div className="space-y-4">
            {/* Custom Statuses */}
            {panel.customStatuses && panel.customStatuses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  Custom Statuses
                </h3>
                <div className="flex flex-wrap gap-2">
                  {panel.customStatuses.map((status) => (
                    <div
                      key={status.id}
                      className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"
                      style={{
                        backgroundColor: `${status.color}20`,
                        border: `1px solid ${status.color}40`,
                        color: status.color
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Group */}
            {panel.group && (
              <div>
                <h3 className="text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  Group
                </h3>
                <div className="p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)] flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[rgba(58,123,213,0.2)] border border-[rgba(58,123,213,0.3)]">
                    <svg className="w-4 h-4 text-[#3A7BD5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-[#E8EAF0] font-semibold">{panel.group.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Description/Notes */}
          {panel.notes && (
            <div>
              <h3 className="text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                Description / Notes
              </h3>
              <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <p className="text-[#E8EAF0] whitespace-pre-wrap">{panel.notes}</p>
              </div>
            </div>
          )}

          {/* Assembly Instructions Accordion */}
          {assemblyInstructions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#B8BCC8] mb-3 uppercase tracking-wider">
                Assembly Instructions ({assemblyInstructions.length})
              </h3>
              <div className="space-y-2">
                {assemblyInstructions.map((instruction: any, index: number) => {
                  const isExpanded = expandedInstructions.has(index)
                  return (
                    <div
                      key={instruction.id || index}
                      className="bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleInstruction(index)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[rgba(58,123,213,0.05)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(58,123,213,0.2)] text-[#3A7BD5] text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-[#E8EAF0] font-semibold text-left">
                            {instruction.title}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-[#B8BCC8]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[#B8BCC8]" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-[rgba(58,123,213,0.1)]">
                          <p className="text-[#B8BCC8] whitespace-pre-wrap">
                            {instruction.content}
                          </p>
                          {instruction.attachments && instruction.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs text-[#B8BCC8] uppercase tracking-wider">
                                Attachments
                              </p>
                              {instruction.attachments.map((attachment: any) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-[rgba(26,31,46,0.6)] rounded border border-[rgba(58,123,213,0.2)] hover:border-[rgba(58,123,213,0.4)] transition-colors"
                                >
                                  <Eye className="w-4 h-4 text-[#3A7BD5]" />
                                  <span className="text-[#E8EAF0] text-sm">
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

          {/* Metadata */}
          {panel.metadata && Object.keys(panel.metadata).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                Additional Metadata
              </h3>
              <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
                <pre className="text-[#E8EAF0] text-xs font-mono overflow-x-auto">
                  {JSON.stringify(panel.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[rgba(58,123,213,0.1)]">
            <div>
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Created</p>
              <p className="text-[#E8EAF0] text-sm">
                {new Date(panel.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Last Updated</p>
              <p className="text-[#E8EAF0] text-sm">
                {new Date(panel.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[rgba(58,123,213,0.2)]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-all"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Panel
          </button>
        </div>
      </div>
    </div>
  )
}
