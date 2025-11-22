import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { CheckCircle, ArrowLeft, Box, MapPin, Layers, Tag, FileText } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { getLucideIconName } from '@/utils/iconMapping'
import { useAuth } from '@/contexts/AuthContext'
import { useRBAC } from '@/contexts/RBACContext'

interface Status {
    id: string
    name: string
    color: string
    icon: string
}

interface Group {
    id: string
    name: string
    status: string
}

interface Panel {
    id: string
    name: string
    tag: string
    objectType: string
    location: string
    material: string
    dimensions: string
    weight: number
    area: number
    productionDate: string
    shippingDate: string
    installationDate: string
    notes: string
    metadata: any
    statuses: Array<{ status: Status }>
    groups: Array<{ group: Group }>
}

interface Project {
    id: string
    organizationId: string
}

export default function ElementReportPage() {
    const params = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const projectId = params.id as string
    const { isAuthenticated, isLoading: authLoading, user } = useAuth()
    const { canViewProject, isLoading: rbacLoading } = useRBAC()

    // Get UUID from hash fragment (e.g., #cmi8s5dv1000bugu1exk91jxl)
    const [uuid, setUuid] = useState<string | null>(null)

    const [panel, setPanel] = useState<Panel | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [availableStatuses, setAvailableStatuses] = useState<Status[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

    // Form state
    const [initialStatusIds, setInitialStatusIds] = useState<string[]>([])
    const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([])
    const [note, setNote] = useState('')
    const [reporterName, setReporterName] = useState('')

    // Extract UUID from hash on mount and when hash changes
    useEffect(() => {
        const hash = window.location.hash.substring(1) // Remove the # symbol
        setUuid(hash || null)
    }, [])

    // Authentication and authorization check
    useEffect(() => {
        // Wait for auth to initialize
        if (authLoading || rbacLoading) {
            return
        }

        // Check if user is authenticated
        if (!isAuthenticated) {
            // Build the return URL with the current path and hash
            const returnUrl = encodeURIComponent(location.pathname + location.hash)
            navigate(`/login?redirect=${returnUrl}`, { replace: true })
            return
        }

        // Check if user has access to the project
        if (projectId && !canViewProject(projectId)) {
            setError('Access Denied: You do not have permission to view this project.')
            setLoading(false)
            return
        }
    }, [isAuthenticated, authLoading, rbacLoading, projectId, canViewProject, navigate, location])

    // Load data
    useEffect(() => {
        const loadData = async () => {
            // Don't load data if not authenticated or still checking auth
            if (authLoading || rbacLoading || !isAuthenticated) {
                return
            }

            try {
                setLoading(true)
                setError(null)

                if (!uuid) {
                    throw new Error('Panel UUID is required')
                }

                // 1. Fetch Project Details (for reference, RBAC already verified access)
                const projectRes = await authenticatedFetch(`/projects/${projectId}`)
                if (!projectRes.ok) {
                    throw new Error('Failed to load project details')
                }
                const projectData = await projectRes.json()
                setProject(projectData)

                // Note: Organization check is handled by RBAC canViewProject above
                // No need for additional organization validation here

                // 2. Fetch Panel Details
                const panelRes = await authenticatedFetch(`/panels/${projectId}/${uuid}`)
                if (!panelRes.ok) {
                    const errorData = await panelRes.json().catch(() => ({}))
                    console.error('Panel fetch error:', errorData)
                    throw new Error(errorData.details || errorData.error || 'Failed to load element data')
                }
                const panelData = await panelRes.json()
                setPanel(panelData)

                // Initialize selected statuses
                const currentStatusIds = panelData.statuses.map((s: any) => s.status.id)
                setInitialStatusIds(currentStatusIds)
                setSelectedStatusIds(currentStatusIds)

                // 3. Fetch Available Statuses
                const statusRes = await authenticatedFetch(`/status-management/${projectId}`)
                if (statusRes.ok) {
                    const statusData = await statusRes.json()
                    setAvailableStatuses(statusData.statuses || [])
                }

            } catch (err) {
                console.error('Error loading data:', err)
                setError(err instanceof Error ? err.message : 'Failed to load element data. Please check the URL or try again.')
            } finally {
                setLoading(false)
            }
        }

        if (uuid && projectId && isAuthenticated && !authLoading && !rbacLoading) {
            loadData()
        } else if (!uuid && !authLoading && !rbacLoading) {
            setError('Panel UUID is missing from URL')
            setLoading(false)
        }
    }, [uuid, projectId, isAuthenticated, authLoading, rbacLoading, user])

    const handleInitialSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsConfirmModalOpen(true)
    }

    const confirmSubmit = async () => {
        if (!uuid) {
            alert('Panel UUID is missing')
            return
        }

        try {
            setSubmitting(true)

            // Calculate changes
            const addedStatusIds = selectedStatusIds.filter(id => !initialStatusIds.includes(id))
            const removedStatusIds = initialStatusIds.filter(id => !selectedStatusIds.includes(id))
            const unchangedStatusIds = selectedStatusIds.filter(id => initialStatusIds.includes(id))

            console.log('Submission Debug:', {
                addedStatusIds,
                removedStatusIds,
                unchangedStatusIds,
                note: note.trim(),
                reporterName: reporterName.trim()
            })

            // Determine where to attach the note
            // Priority: 1. First added status, 2. First removed status, 3. First unchanged status
            let noteAttached = false
            const attachNote = () => {
                if (!noteAttached) {
                    noteAttached = true
                    return note.trim() || undefined
                }
                return undefined
            }

            // Prepare payload for batch update
            const payload = {
                projectId: parseInt(projectId),
                panelIds: [uuid],
                addedStatusIds: addedStatusIds,
                removedStatusIds: removedStatusIds,
                reporterName: reporterName.trim() || undefined,
                note: note.trim() || undefined
            }

            console.log('Submitting batch update with payload:', payload)

            const response = await authenticatedFetch('/status-management/batch-update-panels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await response.json().catch(() => ({}))
            console.log('Batch update response:', { status: response.status, ok: response.ok, data })

            if (!response.ok) {
                throw new Error(`Failed to submit report: ${JSON.stringify(data)}`)
            }

            // Refresh panel data
            console.log('Refreshing panel data...')
            const panelRes = await authenticatedFetch(`/panels/${projectId}/${uuid}`)
            if (panelRes.ok) {
                const panelData = await panelRes.json()
                console.log('Panel data refreshed:', panelData)
                setPanel(panelData)
                // Update initial state
                const currentStatusIds = panelData.statuses.map((s: any) => s.status.id)
                setInitialStatusIds(currentStatusIds)
                setSelectedStatusIds(currentStatusIds)
            } else {
                console.error('Failed to refresh panel data:', panelRes.status)
            }

            // Show success
            setSuccess(true)
            setNote('')
            setReporterName('')
            setIsConfirmModalOpen(false)

            // Hide success message after 3 seconds
            setTimeout(() => {
                setSuccess(false)
            }, 3000)

        } catch (err) {
            console.error('Error submitting report:', err)
            alert(`Failed to submit report: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setSubmitting(false)
        }
    }

    // const toggleStatus = (statusId: string) => {
    //     setSelectedStatusIds(prev =>
    //         prev.includes(statusId)
    //             ? prev.filter(id => id !== statusId)
    //             : [...prev, statusId]
    //     )
    // }

    // Enforce single status change at a time
    const toggleStatus = (statusId: string) => {
        setSelectedStatusIds(prev => {
            // 1. Calculate what the new state WOULD be with normal toggle
            const isCurrentlySelected = prev.includes(statusId)
            const newState = isCurrentlySelected
                ? prev.filter(id => id !== statusId)
                : [...prev, statusId]

            // 2. Calculate changes compared to initial
            const added = newState.filter(id => !initialStatusIds.includes(id))
            const removed = initialStatusIds.filter(id => !newState.includes(id))
            const totalChanges = added.length + removed.length

            // 3. If more than 1 change, reset to initial and apply ONLY this change
            if (totalChanges > 1) {
                // If we are clicking a status that is currently selected (removing it)
                // We want the result to be: Initial State - This Status
                if (initialStatusIds.includes(statusId)) {
                    return initialStatusIds.filter(id => id !== statusId)
                }
                // If we are clicking a status that is NOT currently selected (adding it)
                // We want the result to be: Initial State + This Status
                else {
                    return [...initialStatusIds, statusId]
                }
            }

            return newState
        })
    }

    // Helper to get icon component using iconMapping utility
    const getIconComponent = (iconName: string) => {
        const lucideIconName = getLucideIconName(iconName)
        const Icon = (LucideIcons as any)[lucideIconName]
        return Icon || LucideIcons.Circle
    }

    // Calculate changes for modal
    const addedStatusIds = selectedStatusIds.filter(id => !initialStatusIds.includes(id))
    const removedStatusIds = initialStatusIds.filter(id => !selectedStatusIds.includes(id))

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        )
    }

    if (error || !panel) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LucideIcons.AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Unable to Load Report</h2>
                    <p className="text-slate-500 mb-6">{error || 'Element not found'}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 flex-shrink-0 z-10 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button> */}
                        <div>
                            <h1 className="text-lg font- font-bold text-slate-900 leading-tight">
                                Element Report
                            </h1>
                        </div>
                    </div>
                    {/* <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                            {panel.objectType || 'Element'}
                        </span>
                    </div> */}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">
                    {/* 1. Element Identity Card */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-1">{panel.name}</h2>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Tag className="w-4 h-4" />
                                    <span className="font-mono">{(panel.metadata as any).ifcElementId}</span>
                                </div>
                            </div>
                            {/* Current Statuses - Icon Only, Limited to 5 */}
                            <div className="flex flex-wrap gap-2 justify-end items-center">
                                {panel.statuses && panel.statuses.length > 0 ? (
                                    <>
                                        {panel.statuses.slice(0, 5).map((ps, idx) => (
                                            <div
                                                key={idx}
                                                className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                                                style={{
                                                    backgroundColor: `${ps.status.color}15`,
                                                    borderColor: ps.status.color
                                                }}
                                                title={ps.status.name}
                                            >
                                                {(() => {
                                                    const Icon = getIconComponent(ps.status.icon)
                                                    return <Icon className="w-4 h-4" style={{ color: ps.status.color }} />
                                                })()}
                                            </div>
                                        ))}
                                        {panel.statuses.length > 5 && (
                                            <span className="text-xs text-slate-500 font-medium">
                                                and {panel.statuses.length - 5} more
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-sm font-medium border border-slate-200">
                                        No Status
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-slate-100">
                            <div className="bg-white p-4">
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    <Box className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Type</span>
                                </div>
                                <p className="font-medium text-slate-900">{panel.objectType || 'N/A'}</p>
                            </div>
                            <div className="bg-white p-4">
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Location</span>
                                </div>
                                <p className="font-medium text-slate-900">{panel.location || 'N/A'}</p>
                            </div>
                        </div>
                    </section>

                    {/* 2. Groups Section */}
                    {panel.groups && panel.groups.length > 0 && (
                        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-slate-400" />
                                Groups
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {panel.groups.map((pg) => (
                                    <div
                                        key={pg.group.id}
                                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 flex items-center gap-2"
                                    >
                                        <div className={`w-2 h-2 rounded-full ${pg.group.status === 'COMPLETED' ? 'bg-green-500' :
                                            pg.group.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-slate-400'
                                            }`} />
                                        {pg.group.name}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 3. Submit Report Form (Unified) */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-500" />
                                Submit Report
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">
                                Update statuses and add notes below. Changes are saved when you click Submit.
                            </p>
                        </div>

                        <div className="p-5">
                            <form onSubmit={handleInitialSubmit} className="space-y-6">
                                {/* Status Selection Grid */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        Edit Status
                                    </label>
                                    {availableStatuses.length === 0 ? (
                                        <div className="text-center py-8 px-4 bg-slate-50 border border-slate-200 rounded-lg">
                                            <div className="text-slate-400 mb-2">
                                                <LucideIcons.AlertCircle className="w-12 h-12 mx-auto mb-3" />
                                            </div>
                                            <p className="text-slate-600 font-medium mb-1">No Statuses Available</p>
                                            <p className="text-sm text-slate-500">Please create statuses in the project settings first.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableStatuses.map((status) => {
                                                const StatusIcon = getIconComponent(status.icon)
                                                const isSelected = selectedStatusIds.includes(status.id)

                                                return (
                                                    <button
                                                        key={status.id}
                                                        type="button"
                                                        onClick={() => toggleStatus(status.id)}
                                                        className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium flex items-center gap-2 ${isSelected
                                                            ? 'border-[#3A7BD5] bg-[rgba(58,123,213,0.1)] text-slate-900 ring-1 ring-[#3A7BD5]'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <StatusIcon
                                                            className="w-4 h-4"
                                                            style={{ color: status.color }}
                                                        />
                                                        {status.name}
                                                        {isSelected && (
                                                            <CheckCircle className="w-4 h-4 ml-auto text-[#3A7BD5]" />
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Reporter Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Reporter Name
                                    </label>
                                    <input
                                        type="text"
                                        value={reporterName}
                                        onChange={(e) => setReporterName(e.target.value)}
                                        placeholder="Your name"
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Note (Optional)
                                    </label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Add details about this report..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    />
                                </div>

                                {/* Submit Button */}
                                {(() => {
                                    // Check if there are any status changes (added or removed)
                                    const hasStatusChanges = addedStatusIds.length > 0 || removedStatusIds.length > 0

                                    return (
                                        <button
                                            type="submit"
                                            disabled={submitting || !hasStatusChanges}
                                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                            title={!hasStatusChanges ? "Please add or remove at least one status to submit" : ""}
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-5 h-5" />
                                                    Submit Report
                                                </>
                                            )}
                                        </button>
                                    )
                                })()}
                            </form>

                            {/* Success Message */}
                            {success && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center text-green-700 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">Report submitted successfully!</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 4. Metadata / Extra Info */}
                    {(panel.metadata as any)?.ifcElementId && (
                        <div className="text-center text-xs text-slate-400 font-mono pb-8">
                            ELEMENT ID: {(panel.metadata as any).ifcElementId}
                        </div>
                    )}
                </div>
            </main>

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setIsConfirmModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">Confirm Changes</h3>
                            <p className="text-sm text-slate-500 mt-1">Please review your changes before submitting.</p>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Added Statuses */}
                            {addedStatusIds.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adding Statuses</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {addedStatusIds.map(id => {
                                            const status = availableStatuses.find(s => s.id === id)
                                            return status ? (
                                                <span key={id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium border border-blue-100 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }}></span>
                                                    {status.name}
                                                </span>
                                            ) : null
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Removed Statuses */}
                            {removedStatusIds.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Removing Statuses</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {removedStatusIds.map(id => {
                                            const status = availableStatuses.find(s => s.id === id)
                                            return status ? (
                                                <span key={id} className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm font-medium border border-red-100 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                    {status.name}
                                                </span>
                                            ) : null
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Reporter */}
                            {reporterName.trim() && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reporter</h4>
                                    <p className="text-slate-900 font-medium">{reporterName}</p>
                                </div>
                            )}

                            {/* Note */}
                            {note.trim() && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Note</h4>
                                    <p className="text-slate-700 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                        "{note}"
                                    </p>
                                </div>
                            )}

                            {/* No changes warning (shouldn't happen due to button disable) */}
                            {addedStatusIds.length === 0 && removedStatusIds.length === 0 && !note.trim() && !reporterName.trim() && (
                                <p className="text-slate-500 italic text-center">No changes detected.</p>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSubmit}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                Confirm & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}