import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; description: string; status: string }) => void
  project: {
    name: string
    description?: string | null
    status: string
  } | null
  isSaving?: boolean
}

export function EditProjectModal({
  isOpen,
  onClose,
  onSave,
  project,
  isSaving = false
}: EditProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE'
  })

  useEffect(() => {
    if (project) {
      let normalizedStatus = project.status?.toUpperCase() || 'ACTIVE'
      
      if (normalizedStatus === 'ON_HOLD' || normalizedStatus === 'ONHOLD' || normalizedStatus === 'ON-HOLD') {
        normalizedStatus = 'ON_HOLD'
      } else if (!['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'].includes(normalizedStatus)) {
        normalizedStatus = 'ACTIVE'
      }
      
      setFormData({
        name: project.name || '',
        description: project.description || '',
        status: normalizedStatus
      })
    }
  }, [project, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Edit Project</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              disabled={isSaving}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter project description"
              disabled={isSaving}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              disabled={isSaving}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              {/* <option value="CANCELLED">Cancelled</option> */}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 uq-btn rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
