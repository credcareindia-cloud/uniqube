import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Plus,
  Calendar,
  Activity,
  TrendingUp,
  Package,
  Box,
  Eye,
  Layers,
} from 'lucide-react'
import { CubeLoader } from '@/components/ui/CubeLoader'
import { ModelCreation } from '@/components/projects/ModelCreation'
import { MultiFileModelCreation } from '@/components/projects/MultiFileModelCreation'
import { useNotifications } from '@/hooks/useNotifications'
import { useRBAC } from '@/contexts/RBACContext'

type FilterStatus = 'all' | 'active' | 'completed' | 'planning'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userProjects, canCreateProjects, isLoading: rbacLoading, refreshUserProjects } = useRBAC()
  const [error, setError] = useState<string | null>(null)
  const searchQuery = searchParams.get('q') || ''
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showModelCreation, setShowModelCreation] = useState(false)
  const [showMultiFileCreation, setShowMultiFileCreation] = useState(false)
  const [showCreationChoice, setShowCreationChoice] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const { notifications } = useNotifications()
  const ITEMS_PER_PAGE = 9

  const initials = (name?: string) => {
    const parts = (name || 'P').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Handle project creation success
  const handleProjectCreated = async (newProject: any) => {
    await refreshUserProjects()
    setShowModelCreation(false)
    setShowMultiFileCreation(false)
    setShowCreationChoice(false)
    navigate(`/projects/${newProject.id}`)
  }

  // Fetch on mount to ensure data is fresh when navigating back
  useEffect(() => {
    refreshUserProjects()
  }, [refreshUserProjects])

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    if (!canCreateProjects()) return
    setShowMultiFileCreation(true)
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [searchParams, canCreateProjects, setSearchParams])

  // Listen for notifications to trigger refresh
  useEffect(() => {
    // Check if there's a recent notification about projects
    const hasRecentProjectNotification = notifications.some(n => {
      const age = Date.now() - new Date(n.createdAt).getTime();
      const isRecent = age < 5000; // Within last 5 seconds
      const isProjectRelated =
        n.title.toLowerCase().includes('project') ||
        n.title.toLowerCase().includes('model') ||
        n.message.toLowerCase().includes('project');

      return isRecent && isProjectRelated;
    });

    if (hasRecentProjectNotification) {
      console.log('Refreshing projects due to notification update...')
      refreshUserProjects();
    }
  }, [notifications, refreshUserProjects]);

  // useEffect(() => {
  //   setLoading(rbacLoading)
  // }, [rbacLoading])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus])

  // Auto-polling disabled per request
  // useEffect(() => {
  //   const pollInterval = setInterval(() => {
  //     refreshUserProjects()
  //   }, 5000)
  //
  //   return () => clearInterval(pollInterval)
  // }, [refreshUserProjects])

  // Normalize various backend/legacy status formats to canonical keys
  const normalizeStatus = (s?: string) => {
    if (!s) return 'planning'
    const lower = s.toString().trim().toLowerCase()
    const kebab = lower.replace(/[_\s]+/g, '-')
    if (kebab === 'onhold') return 'on-hold'
    switch (kebab) {
      case 'active':
      case 'completed':
      case 'planning':
      case 'on-hold':
        return kebab
      default:
        return 'planning'
    }
  }

  // Filter projects based on search and status
  const filteredProjects = userProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)

    const matchesStatus = filterStatus === 'all' || normalizeStatus(project.status) === filterStatus

    return matchesSearch && matchesStatus
  })

  // Paginate filtered projects
  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

  // Calculate stats
  const stats = {
    total: userProjects.length,
    active: userProjects.filter(p => normalizeStatus(p.status) === 'active').length,
    completed: userProjects.filter(p => normalizeStatus(p.status) === 'completed').length,
    planning: userProjects.filter(p => normalizeStatus(p.status) === 'planning').length,
  }

  // Only show skeleton on initial load (when no projects and loading)
  // This prevents flickering during background refreshes
  if (rbacLoading && userProjects.length === 0) {
    return <CubeLoader text="LOADING PROJECTS" />
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      <div className="uq-stat-strip">
        {(
          [
            { key: 'all' as FilterStatus, label: 'Total', value: stats.total, icon: Building2 },
            { key: 'active' as FilterStatus, label: 'Active', value: stats.active, icon: Activity },
            { key: 'completed' as FilterStatus, label: 'Completed', value: stats.completed, icon: TrendingUp },
            { key: 'planning' as FilterStatus, label: 'Planning', value: stats.planning, icon: Calendar },
          ]
        ).map((item) => {
          const selected = filterStatus === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilterStatus(item.key)}
              className={`uq-stat-cell ${selected ? 'uq-stat-cell-active' : ''}`}
            >
              <span className="uq-stat-glyph">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="uq-stat-label block">{item.label}</span>
                <span className="uq-stat-value block">{item.value}</span>
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-[var(--uq-offwhite)] border border-black/5">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects found</h3>
          <p className="text-slate-600 mb-5 max-w-md mx-auto">
            {searchQuery || filterStatus !== 'all'
              ? 'Try a different search or clear the status filter.'
              : canCreateProjects()
                ? 'Create a project and publish Structure, MEP, or Architecture from Revit.'
                : 'No projects have been assigned to you yet.'}
          </p>
          {canCreateProjects() && (
            <button
              type="button"
              onClick={() => setShowMultiFileCreation(true)}
              className="inline-flex items-center gap-2 px-4 py-2 uq-btn rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              New project
            </button>
          )}
        </div>
      ) : (
        <>
            <div className="rounded-3xl bg-[var(--uq-offwhite)] p-3 sm:p-4 space-y-3">
                {paginatedProjects.map((project) => {
                  const totalPanels = project.stats?.totalPanels || project.totalPanels || 0
                  const completedPanels = project.completedPanels || 0
                  const pct = totalPanels > 0 ? Math.round((completedPanels / totalPanels) * 100) : 0
                  const s = normalizeStatus(project.status)
                  const hasModel = !!project.currentModel
                  return (
                    <article
                      key={project.id}
                      className="rounded-2xl border border-black/5 bg-[var(--uq-offwhite-card)] px-4 py-4 sm:px-5 hover:border-black/10 hover:shadow-sm transition-all"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="h-12 w-12 rounded-xl bg-[var(--uq-blue)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {initials(project.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {project.displayNumber != null && (
                              <span className="text-[11px] font-semibold text-slate-400">
                                #{String(project.displayNumber).padStart(2, '0')}
                              </span>
                            )}
                            <h3 className="text-base font-semibold text-[var(--uq-ink)] truncate">
                              {project.name}
                            </h3>
                            <span
                              className={`uq-pill capitalize ${
                                s === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : s === 'completed'
                                    ? 'bg-slate-100 text-slate-600'
                                    : s === 'planning'
                                      ? 'bg-[var(--uq-yellow-soft)] text-[var(--uq-ink)] border border-[var(--uq-yellow)]/40'
                                      : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {s === 'on-hold' ? 'On hold' : s}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--uq-muted)] truncate mb-3">
                            {project.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                                <span className="inline-flex items-center gap-1.5">
                                  <Layers className="h-3.5 w-3.5" />
                                  {totalPanels.toLocaleString()} panels
                                </span>
                                <span className="font-semibold text-[var(--uq-ink)]">{pct}%</span>
                              </div>
                              <div className="uq-progress-track">
                                <div
                                  className="uq-progress-fill"
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                            onClick={() => navigate(`/projects/${project.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            className="uq-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                            disabled={!hasModel}
                            title={hasModel ? 'Open 3D viewer' : 'No 3D model yet'}
                            onClick={() => navigate(`/projects/${project.id}/viewer-engine`)}
                          >
                            <Box className="h-4 w-4" />
                            3D
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
            </div>

          {filteredProjects.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1}–{Math.min(endIndex, filteredProjects.length)} of{' '}
                {filteredProjects.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreationChoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create new project</h2>
            <p className="text-slate-600 mb-6">Upload IFC files to create your project:</p>
            <button
              type="button"
              onClick={() => {
                setShowCreationChoice(false)
                setShowMultiFileCreation(true)
              }}
              className="w-full flex items-center gap-3 p-4 border-2 border-orange-200 bg-[var(--uq-orange-soft)] rounded-xl hover:border-[var(--uq-orange)] transition-colors text-left"
            >
              <Package className="h-5 w-5 text-[var(--uq-orange)]" />
              <div>
                <h3 className="font-medium text-slate-900">Create project with model</h3>
                <p className="text-sm text-slate-600">Upload IFC files for building components</p>
              </div>
            </button>
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowCreationChoice(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModelCreation && (
        <ModelCreation
          onProjectCreated={handleProjectCreated}
          onClose={() => setShowModelCreation(false)}
        />
      )}

      {showMultiFileCreation && (
        <MultiFileModelCreation
          onProjectCreated={handleProjectCreated}
          onClose={() => setShowMultiFileCreation(false)}
        />
      )}
    </div>
  )
}

