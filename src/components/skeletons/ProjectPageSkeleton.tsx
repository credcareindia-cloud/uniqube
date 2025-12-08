import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ProjectPageSkeleton() {
    return (
        <div className="w-full h-full min-h-screen bg-slate-50/50 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-full bg-slate-200" /> {/* Back Button */}
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-64 bg-slate-200" /> {/* Title */}
                                <Skeleton className="h-4 w-32 bg-slate-100" /> {/* Subtitle/ID */}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="h-10 w-32 rounded-md bg-slate-200" /> {/* Action Button */}
                            <Skeleton className="h-10 w-10 rounded-md bg-slate-200" /> {/* Icon Button */}
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="px-8 flex gap-8 mt-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="pb-4 relative">
                            <Skeleton className="h-5 w-24 bg-slate-200" />
                            {i === 1 && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-300 rounded-full" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="p-8 max-w-[1920px] mx-auto space-y-6">

                {/* Quick Actions Skeleton */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <Skeleton className="h-7 w-32 mb-4 bg-slate-200" /> {/* Title */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg">
                                <Skeleton className="h-10 w-10 rounded-lg bg-slate-100" />
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-40 bg-slate-200" />
                                    <Skeleton className="h-4 w-56 bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Groups Skeleton */}
                    <Card className="border-slate-200 shadow-sm h-full">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-32 bg-slate-200" />
                                <Skeleton className="h-5 w-5 rounded-full bg-slate-100" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50">
                                    <div className="flex items-center gap-3 flex-1">
                                        <Skeleton className="h-9 w-9 rounded-lg bg-slate-200" />
                                        <div className="space-y-1.5 flex-1">
                                            <Skeleton className="h-4 w-32 bg-slate-200" />
                                            <Skeleton className="h-3 w-48 bg-slate-100" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-8 bg-slate-200" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Project Health Skeleton */}
                    <Card className="border-slate-200 shadow-sm h-full">
                        <CardHeader className="p-6 pb-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-32 bg-slate-200" />
                                <Skeleton className="h-5 w-5 rounded-full bg-slate-100" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-10 w-10 rounded-lg bg-slate-200" />
                                        <div className="space-y-1.5">
                                            <Skeleton className="h-4 w-40 bg-slate-200" />
                                            <Skeleton className="h-3 w-48 bg-slate-100" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-8 w-8 bg-slate-200" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
