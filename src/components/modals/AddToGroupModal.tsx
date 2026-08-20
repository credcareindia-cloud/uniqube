'use client'

import { useState } from 'react'
import { X, Check, Grid3x3 } from 'lucide-react'

interface Group {
    id: string
    name: string
    color?: string
}

interface AddToGroupModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (groupIds: string[]) => void
    availableGroups: Group[]
    selectedPanelCount: number
}

export function AddToGroupModal({
    isOpen,
    onClose,
    onConfirm,
    availableGroups,
    selectedPanelCount
}: AddToGroupModalProps) {
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())

    if (!isOpen) return null

    const toggleGroup = (groupId: string) => {
        const newSelection = new Set(selectedGroups)
        if (newSelection.has(groupId)) {
            newSelection.delete(groupId)
        } else {
            newSelection.add(groupId)
        }
        setSelectedGroups(newSelection)
    }

    const handleConfirm = () => {
        if (selectedGroups.size > 0) {
            onConfirm(Array.from(selectedGroups))
            setSelectedGroups(new Set())
        }
    }

    const handleClose = () => {
        setSelectedGroups(new Set())
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Add to Groups
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4">
                        Add {selectedPanelCount} selected panel{selectedPanelCount !== 1 ? 's' : ''} to groups:
                    </p>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {availableGroups.length > 0 ? (
                            availableGroups.map((group) => (
                                <label
                                    key={group.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedGroups.has(group.id)}
                                        onChange={() => toggleGroup(group.id)}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                        <Grid3x3
                                            className="w-4 h-4"
                                            style={{ color: group.color || '#3B82F6' }}
                                        />
                                        <span className="text-sm font-medium text-slate-900">{group.name}</span>
                                    </div>
                                </label>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">
                                No groups available to add
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <X className="w-4 h-4 inline mr-2" />
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedGroups.size === 0}
                        className="px-4 py-2 text-sm font-medium uq-btn rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Check className="w-4 h-4 inline mr-2" />
                        Add {selectedGroups.size > 0 ? `(${selectedGroups.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}
