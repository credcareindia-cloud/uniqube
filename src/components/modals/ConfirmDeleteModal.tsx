'use client'

import { X, Trash2 } from 'lucide-react'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose?: () => void
  onCancel?: () => void
  onConfirm: () => void
  title: string
  message: string
  itemName?: string
  panelCount?: number
  itemType?: 'status' | 'group' | 'project'
  isDeleting?: boolean
  isLoading?: boolean
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  itemName,
  panelCount = 0,
  itemType = 'status',
  isDeleting = false,
  isLoading = false
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null

  const handleClose = onCancel || onClose || (() => {})
  const loading = isLoading || isDeleting

  const getPanelCountMessage = () => {
    if (panelCount === undefined || panelCount === 0) return null
    
    if (itemType === 'status') {
      return `This status is currently assigned to ${panelCount} panel(s).`
    } else if (itemType === 'group') {
      return `This group currently contains ${panelCount} panel(s).`
    }
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-700 text-base">
            {itemName ? (
              <>
                {message} <span className="font-semibold text-slate-900">"{itemName}"</span>?
              </>
            ) : (
              message
            )}
          </p>
          
          {getPanelCountMessage() && (
            <p className="text-slate-600 text-sm">
              {getPanelCountMessage()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
