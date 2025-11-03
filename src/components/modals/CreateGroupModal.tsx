'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (groupData: {
    name: string
    description: string
    type: string
  }) => Promise<void>
}

const GROUP_TYPES = [
  { value: 'CUSTOM', label: 'Custom Group' },
  { value: 'STOREY', label: 'Storey/Floor' },
  { value: 'SYSTEM', label: 'System Group' },
  { value: 'ZONE', label: 'Zone/Area' },
  { value: 'PHASE', label: 'Construction Phase' }
]

export function CreateGroupModal({ isOpen, onClose, onSubmit }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('CUSTOM')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Group name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type
      })
      
      // Reset form
      setName('')
      setDescription('')
      setType('CUSTOM')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setDescription('')
      setType('CUSTOM')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={handleClose}
    >
      <div 
        className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Create New Group
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2 ">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
              disabled={isSubmitting}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2 ">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter group description"
              rows={3}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none resize-none"
              disabled={isSubmitting}
              maxLength={500}
            />
          </div>

          {/* Group Type */}
          {/* <div>
            <label className="block text-sm font-medium text-slate-600 mb-2 ">
              Group Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-500 focus:outline-none"
              disabled={isSubmitting}
            >
              {GROUP_TYPES.map((groupType) => (
                <option key={groupType.value} value={groupType.value}>
                  {groupType.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600 mt-1">
              Select the type of group for better organization
            </p>
          </div> */}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preview
          <div className="p-4 bg-white rounded-lg border border-[rgba(58,123,213,0.1)]">
            <p className="text-xs text-slate-600 mb-2 ">Preview</p>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-50 border border-[rgba(58,123,213,0.3)]">
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-slate-900 font-semibold">{name || 'Group Name'}</p>
                {description && (
                  <p className="text-slate-600 text-sm">{description}</p>
                )}
                <p className="text-slate-600 text-xs mt-1">
                  {GROUP_TYPES.find(t => t.value === type)?.label}
                </p>
              </div>
            </div>
          </div> */}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
