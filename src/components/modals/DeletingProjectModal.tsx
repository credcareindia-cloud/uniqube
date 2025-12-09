'use client'

import { Cube } from '../ui/Cube'

interface DeletingProjectModalProps {
    isOpen: boolean
    projectName: string
    progress?: number
    message?: string
}

export function DeletingProjectModal({ isOpen, projectName, progress = 0, message = 'Preparing deletion...' }: DeletingProjectModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8">
                {/* Cube Loader */}
                <div className="flex justify-center mb-6">
                    <Cube size={48} color="slate" />
                </div>

                {/* Content */}
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-slate-900">Deleting Project</h2>
                    <p className="text-slate-700 text-base">
                        Deleting <span className="font-semibold text-slate-900">"{projectName}"</span>
                    </p>
                    <p className="text-slate-600 text-sm">
                        This may take a moment. Please do not close this window.
                    </p>

                    {/* Progress indicators */}
                    <div className="pt-4 space-y-3">
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-slate-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${Math.max(5, progress)}%` }}
                            ></div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span>{message}</span>
                            <span className="font-mono text-xs text-slate-400">({progress}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
