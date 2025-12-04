'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { getLucideIconName } from '@/utils/iconMapping'

interface Status {
    id: string
    name: string
    color: string
    icon: string
}

interface AssignStatusModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (statusIds: string[]) => void
    availableStatuses: Status[]
    selectedPanelCount: number
}

export function AssignStatusModal({
    isOpen,
    onClose,
    onConfirm,
    availableStatuses,
    selectedPanelCount
}: AssignStatusModalProps) {
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())

    if (!isOpen) return null

    const toggleStatus = (statusId: string) => {
        const newSelection = new Set(selectedStatuses)
        if (newSelection.has(statusId)) {
            newSelection.delete(statusId)
        } else {
            newSelection.add(statusId)
        }
        setSelectedStatuses(newSelection)
    }

    const handleConfirm = () => {
        if (selectedStatuses.size > 0) {
            onConfirm(Array.from(selectedStatuses))
            setSelectedStatuses(new Set())
        }
    }

    const handleClose = () => {
        setSelectedStatuses(new Set())
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Assign Status to Selected Panels
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
                        Assign status to {selectedPanelCount} selected panel{selectedPanelCount !== 1 ? 's' : ''}:
                    </p>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {availableStatuses.length > 0 ? (
                            availableStatuses.map((status) => (
                                <label
                                    key={status.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedStatuses.has(status.id)}
                                        onChange={() => toggleStatus(status.id)}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                        {(() => {
                                            const iconName = getLucideIconName(status.icon)
                                            const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Circle
                                            return (
                                                <IconComponent
                                                    className="w-4 h-4"
                                                    style={{ color: status.color }}
                                                />
                                            )
                                        })()}
                                        <span className="text-sm font-medium text-slate-900">{status.name}</span>
                                    </div>
                                </label>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">
                                No statuses available to assign
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
                        disabled={selectedStatuses.size === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Check className="w-4 h-4 inline mr-2" />
                        Assign {selectedStatuses.size > 0 ? `(${selectedStatuses.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}
