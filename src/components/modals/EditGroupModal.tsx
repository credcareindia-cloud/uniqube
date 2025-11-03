'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface EditGroupModalProps {
  isOpen: boolean
  onClose: () => void
  group: {
    id: string
    name: string
    description?: string
  }
  onSubmit: (groupData: {
    name: string
    description: string
  }) => Promise<void>
}

export function EditGroupModal({ isOpen, onClose, group, onSubmit }: EditGroupModalProps) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(group.name)
      setDescription(group.description || '')
      setError('')
    }
  }, [isOpen, group])

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
        description: description.trim()
      })
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group')
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
            Edit Group
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
            <label className="block text-sm font-medium text-slate-600 mb-2">
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
            <label className="block text-sm font-medium text-slate-600 mb-2">
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

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

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
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
