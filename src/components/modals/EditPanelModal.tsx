'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Panel } from '@/types/panel'
import type { Group } from '@/types/group'
import { PanelStatus, PANEL_STATUS_CONFIG } from '@/types/panel'

interface AssemblyInstruction {
  id?: string
  title: string
  content: string
  order: number
  attachments?: {
    id: string
    filename: string
    url: string
  }[]
}

interface EditPanelModalProps {
  isOpen: boolean
  onClose: () => void
  panel: Panel
  projectId: string
  availableStatuses: Array<{ id: string; name: string; color: string }>
  availableGroups: Group[]
  onUpdate: (panelId: string, updates: {
    description?: string
    status?: PanelStatus
    customStatusIds?: string[]
    groupIds?: string[]
    assemblyInstructions?: AssemblyInstruction[]
  }) => Promise<void>
}

export function EditPanelModal({
  isOpen,
  onClose,
  panel,
  projectId,
  availableStatuses,
  availableGroups,
  onUpdate
}: EditPanelModalProps) {
  // const [description, setDescription] = useState(panel.notes || '')
  const [selectedCustomStatuses, setSelectedCustomStatuses] = useState<string[]>(
    (panel as any).statuses?.map((ps: any) => ps.status.id) || []
  )
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    (panel as any).groups?.map((pg: any) => pg.group.id) || []
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      // setDescription(panel.notes || '')
      setSelectedCustomStatuses((panel as any).statuses?.map((ps: any) => ps.status.id) || [])
      setSelectedGroups((panel as any).groups?.map((pg: any) => pg.group.id) || [])
    }
  }, [isOpen, panel])



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await onUpdate(panel.id, {
        // description: description.trim() || undefined,
        customStatusIds: selectedCustomStatuses,
        groupIds: selectedGroups
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update panel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError('')
      onClose()
    }
  }

  const toggleCustomStatus = (statusId: string) => {
    setSelectedCustomStatuses(prev =>
      prev.includes(statusId)
        ? prev.filter(id => id !== statusId)
        : [...prev, statusId]
    )
  }

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-300">
          <h2 className="text-2xl font-bold text-slate-900">
            Edit Panel
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Panel Info (Read-only) */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-[rgba(58,123,213,0.1)]">
              <div>
                <p className="text-xs text-slate-600 mb-1">Name</p>
                <p className="text-slate-900 font-semibold">{panel.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Element ID</p>
                <p className="text-slate-900 font-mono text-sm">{(panel.metadata as any)?.ifcElementId || panel.elementId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Location</p>
                <p className="text-slate-900">{panel.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Material</p>
                <p className="text-slate-900">{panel.material || 'N/A'}</p>
              </div>
            </div>

            {/* Description */}
            {/* <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Description / Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add panel description or notes..."
                rows={4}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none resize-none"
                disabled={isSubmitting}
                maxLength={1000}
              />
              <p className="text-xs text-slate-600 mt-1">
                {description.length}/1000 characters
              </p>
            </div> */}

            {/* Statuses Multi-select */}
            {availableStatuses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Statuses (Multi-select)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableStatuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => toggleCustomStatus(status.id)}
                      disabled={isSubmitting}
                      className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                        selectedCustomStatuses.includes(status.id)
                          ? 'border-[#3A7BD5] bg-[rgba(58,123,213,0.2)] text-slate-900'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-[rgba(58,123,213,0.4)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Groups Multi-select */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Groups (Multi-select)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-white border border-slate-300 rounded-lg">
                {availableGroups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-2 hover:bg-[rgba(58,123,213,0.1)] rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      disabled={isSubmitting}
                      className="w-4 h-4 rounded border-slate-200 bg-white text-slate-700 focus:ring-[#3A7BD5]"
                    />
                    <span className="text-slate-900 text-sm">{group.name}</span>
                    {/* <span className="text-slate-600 text-xs ml-auto">
                      {(group as any)._count?.panels || 0} panels
                    </span> */}
                  </label>
                ))}
                {availableGroups.length === 0 && (
                  <p className="text-slate-600 text-sm text-center py-4">
                    No groups available
                  </p>
                )}
              </div>
            </div>



            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-slate-300">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 hover:bg-[rgba(58,123,213,0.1)] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Panel'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
