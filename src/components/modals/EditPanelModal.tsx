'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
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
  const [description, setDescription] = useState(panel.notes || '')
  const [selectedStatus, setSelectedStatus] = useState<PanelStatus>(panel.status)
  const [selectedCustomStatuses, setSelectedCustomStatuses] = useState<string[]>(
    panel.customStatuses?.map(s => s.id) || []
  )
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    panel.groupId ? [panel.groupId] : []
  )
  const [assemblyInstructions, setAssemblyInstructions] = useState<AssemblyInstruction[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showInstructionForm, setShowInstructionForm] = useState(false)
  const [newInstruction, setNewInstruction] = useState({ title: '', content: '' })

  useEffect(() => {
    if (isOpen) {
      setDescription(panel.notes || '')
      setSelectedStatus(panel.status)
      setSelectedCustomStatuses(panel.customStatuses?.map(s => s.id) || [])
      setSelectedGroups(panel.groupId ? [panel.groupId] : [])
      // Load assembly instructions from panel metadata if available
      setAssemblyInstructions(
        (panel.metadata as any)?.assemblyInstructions || []
      )
    }
  }, [isOpen, panel])

  const handleAddInstruction = () => {
    if (!newInstruction.title.trim() || !newInstruction.content.trim()) {
      setError('Instruction title and content are required')
      return
    }

    const instruction: AssemblyInstruction = {
      id: `temp-${Date.now()}`,
      title: newInstruction.title.trim(),
      content: newInstruction.content.trim(),
      order: assemblyInstructions.length + 1,
      attachments: []
    }

    setAssemblyInstructions([...assemblyInstructions, instruction])
    setNewInstruction({ title: '', content: '' })
    setShowInstructionForm(false)
    setError('')
  }

  const handleDeleteInstruction = (id: string) => {
    setAssemblyInstructions(
      assemblyInstructions
        .filter(inst => inst.id !== id)
        .map((inst, index) => ({ ...inst, order: index + 1 }))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      await onUpdate(panel.id, {
        description: description.trim() || undefined,
        status: selectedStatus,
        customStatusIds: selectedCustomStatuses,
        groupIds: selectedGroups,
        assemblyInstructions
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
      setShowInstructionForm(false)
      setNewInstruction({ title: '', content: '' })
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

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(58,123,213,0.2)]">
          <div>
            <h2 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">
              Edit Panel
            </h2>
            <p className="text-[#B8BCC8] text-sm mt-1">
              Panel ID: <span className="font-mono text-[#3A7BD5]">{panel.id}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-[#B8BCC8] hover:text-[#E8EAF0] transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Panel Info (Read-only) */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
              <div>
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Name</p>
                <p className="text-[#E8EAF0] font-semibold">{panel.name}</p>
              </div>
              <div>
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Type</p>
                <p className="text-[#E8EAF0]">{panel.objectType || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Location</p>
                <p className="text-[#E8EAF0]">{panel.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-[#B8BCC8] mb-1 uppercase tracking-wider">Material</p>
                <p className="text-[#E8EAF0]">{panel.material || 'N/A'}</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                Description / Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add panel description or notes..."
                rows={4}
                className="w-full px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none resize-none"
                disabled={isSubmitting}
                maxLength={1000}
              />
              <p className="text-xs text-[#B8BCC8] mt-1">
                {description.length}/1000 characters
              </p>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                Built-in Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as PanelStatus)}
                className="w-full px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] focus:border-[#3A7BD5] focus:outline-none"
                disabled={isSubmitting}
              >
                {Object.entries(PANEL_STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Statuses */}
            {availableStatuses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  Custom Statuses (Multi-select)
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
                          ? 'border-[#3A7BD5] bg-[rgba(58,123,213,0.2)] text-[#E8EAF0]'
                          : 'border-[rgba(58,123,213,0.2)] bg-[rgba(37,42,58,0.6)] text-[#B8BCC8] hover:border-[rgba(58,123,213,0.4)]'
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
              <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                Groups (Multi-select)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg">
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
                      className="w-4 h-4 rounded border-[rgba(58,123,213,0.3)] bg-[rgba(37,42,58,0.6)] text-[#3A7BD5] focus:ring-[#3A7BD5]"
                    />
                    <span className="text-[#E8EAF0] text-sm">{group.name}</span>
                    <span className="text-[#B8BCC8] text-xs ml-auto">
                      {(group as any)._count?.panels || 0} panels
                    </span>
                  </label>
                ))}
                {availableGroups.length === 0 && (
                  <p className="text-[#B8BCC8] text-sm text-center py-4">
                    No groups available
                  </p>
                )}
              </div>
            </div>

            {/* Assembly Instructions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">
                  Assembly Instructions
                </label>
                <button
                  type="button"
                  onClick={() => setShowInstructionForm(!showInstructionForm)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(58,123,213,0.2)] border border-[rgba(58,123,213,0.3)] rounded-lg text-[#E8EAF0] text-sm hover:bg-[rgba(58,123,213,0.3)] transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add Instruction
                </button>
              </div>

              {/* Add Instruction Form */}
              {showInstructionForm && (
                <div className="mb-4 p-4 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg space-y-3">
                  <input
                    type="text"
                    value={newInstruction.title}
                    onChange={(e) => setNewInstruction({ ...newInstruction, title: e.target.value })}
                    placeholder="Instruction title"
                    className="w-full px-4 py-2 bg-[rgba(26,31,46,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none"
                    maxLength={100}
                  />
                  <textarea
                    value={newInstruction.content}
                    onChange={(e) => setNewInstruction({ ...newInstruction, content: e.target.value })}
                    placeholder="Instruction content"
                    rows={3}
                    className="w-full px-4 py-2 bg-[rgba(26,31,46,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none resize-none"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddInstruction}
                      className="px-4 py-2 bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white rounded-lg font-semibold hover:opacity-90 transition-all text-sm"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInstructionForm(false)
                        setNewInstruction({ title: '', content: '' })
                      }}
                      className="px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-all text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions List */}
              <div className="space-y-2">
                {assemblyInstructions.map((instruction, index) => (
                  <div
                    key={instruction.id}
                    className="p-4 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(58,123,213,0.2)] text-[#3A7BD5] text-xs font-bold">
                            {index + 1}
                          </span>
                          <h4 className="text-[#E8EAF0] font-semibold">{instruction.title}</h4>
                        </div>
                        <p className="text-[#B8BCC8] text-sm whitespace-pre-wrap">
                          {instruction.content}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteInstruction(instruction.id!)}
                        disabled={isSubmitting}
                        className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {assemblyInstructions.length === 0 && !showInstructionForm && (
                  <p className="text-[#B8BCC8] text-sm text-center py-8">
                    No assembly instructions added yet
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
        <div className="flex gap-3 p-6 border-t border-[rgba(58,123,213,0.2)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Panel'}
          </button>
        </div>
      </div>
    </div>
  )
}
