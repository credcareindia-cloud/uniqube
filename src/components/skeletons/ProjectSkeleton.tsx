import React from 'react'

export function ProjectSkeleton() {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col h-full justify-between relative overflow-hidden">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10"></div>

            {/* Header */}
            <div className="flex justify-between items-start gap-2 mb-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        {/* Title Skeleton */}
                        <div className="h-6 w-3/4 bg-slate-100 rounded animate-pulse"></div>
                        {/* Badge Skeleton */}
                        <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse"></div>
                    </div>
                    {/* Description Skeleton */}
                    <div className="space-y-1">
                        <div className="h-4 w-full bg-slate-50 rounded animate-pulse"></div>
                        <div className="h-4 w-2/3 bg-slate-50 rounded animate-pulse"></div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-3 mt-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-slate-100 animate-pulse"></div>
                    <div className="h-4 w-32 bg-slate-50 rounded animate-pulse"></div>
                </div>
            </div>

            {/* Footer Button */}
            <div className="border-t pt-3 mt-auto">
                <div className="h-9 w-full bg-slate-100 rounded animate-pulse"></div>
            </div>
        </div>
    )
}
