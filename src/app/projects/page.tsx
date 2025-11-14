import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, 
  Plus, 
  Search, 
  Grid3X3, 
  List,
  Calendar,
  Activity,
  TrendingUp,
  Package,
  Upload
} from 'lucide-react'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { ModelCreation } from '@/components/projects/ModelCreation'
import { MultiFileModelCreation } from '@/components/projects/MultiFileModelCreation'
import { api } from '@/services/api'
import { useNotifications } from '@/hooks/useNotifications'
import type { Project } from '@/services/api'

type ViewMode = 'grid' | 'table'
type FilterStatus = 'all' | 'active' | 'completed' | 'planning'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [showModelCreation, setShowModelCreation] = useState(false)
  const [showMultiFileCreation, setShowMultiFileCreation] = useState(false)
  const [showCreationChoice, setShowCreationChoice] = useState(false)
  const { notifications } = useNotifications()

  // Handle project creation success
  const handleProjectCreated = (newProject: any) => {
    setProjects(prev => [newProject, ...prev])
    setShowModelCreation(false)
    setShowMultiFileCreation(false)
    setShowCreationChoice(false)
    // Navigate to the new project
    navigate(`/projects/${newProject.id}`)
  }

  // Load projects from backend
  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getProjects()
      setProjects(response.projects)
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError('Failed to load projects. Please check your connection and try again.')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  // Removed automatic refresh on notifications per user request
  // Projects page will not auto-refresh when notifications arrive
  // Users can manually refresh if needed

  // Filter projects based on search and status
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  // Calculate stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planning: projects.filter(p => p.status === 'planning').length,
    totalPanels: projects.reduce((sum, p) => sum + (p.stats?.totalPanels || 0), 0)
  }

  if (loading) {
    return (
      <div className="w-full h-full space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[rgba(26,31,46,0.8)] rounded mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[rgba(26,31,46,0.8)] rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-[rgba(26,31,46,0.8)] rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="h-7 w-7 text-slate-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Projects
            </h1>
            <p className="text-slate-600 mt-1">
              Projects Assigned to You
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* <button
            onClick={() => loadProjects()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors shadow-sm font-medium"
            disabled={loading}
          >
            <Activity className="h-4 w-4" />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button> */}
          <button
            onClick={() => setShowCreationChoice(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Create New Project
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stats.total}</div>
          <div className="text-sm text-slate-600">Total Projects</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stats.active}</div>
          <div className="text-sm text-slate-600">Active Projects</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stats.completed}</div>
          <div className="text-sm text-slate-600">Completed</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stats.planning}</div>
          <div className="text-sm text-slate-600">Planning</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Filter */}
        {/* <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-600 focus:ring-2 focus:ring-slate-600 focus:outline-none transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="planning">Planning</option>
        </select> */}

        {/* View Mode Toggle */}
        {/* <div className="flex bg-white border border-slate-300 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid' 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'table' 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div> */}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Projects Content */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects found</h3>
          <p className="text-slate-600 mb-4">
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating your first project.'
            }
          </p>
          <button
            onClick={() => setShowModelCreation(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create New Project
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onView={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="space-y-4">
                  {filteredProjects.map((project) => {
                    const totalPanels = project.stats?.totalPanels || 0
                    const completedPanels = project.completedPanels || 0
                    const progress = totalPanels > 0 ? Math.round((completedPanels / totalPanels) * 100) : 0
                    return (
                      <div key={project.id} className="flex items-center justify-between p-4 bg-[rgba(15,20,25,0.5)] rounded-lg border border-[rgba(184,188,200,0.1)] hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
                        <div className="flex-1">
                          <h3 className="text-[#E8EAF0] font-semibold mb-1">{project.name}</h3>
                          <p className="text-[#B8BCC8] text-sm mb-2">{project.description}</p>
                          <div className="flex items-center gap-4 text-xs text-[#B8BCC8]">
                            <span className={`px-2 py-1 rounded uppercase tracking-wider ${
                              project.status === 'active' ? 'bg-[rgba(16,185,129,0.2)] text-[#10B981]' :
                              project.status === 'completed' ? 'bg-[rgba(139,92,246,0.2)] text-[#8B5CF6]' :
                              project.status === 'planning' ? 'bg-[rgba(245,158,11,0.2)] text-[#F59E0B]' :
                              'bg-[rgba(107,123,213,0.2)] text-[#6B7BD5]'
                            }`}>
                              {project.status}
                            </span>
                            <span>{progress}% Complete</span>
                            <span>{completedPanels.toLocaleString()} / {totalPanels.toLocaleString()} Panels</span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-lg hover:from-[#357ABD] hover:to-[#2E5F9F] transition-all duration-300"
                        >
                          View
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Creation Choice Modal */}
      {showCreationChoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Project</h2>
            <p className="text-slate-600 mb-6">Upload IFC files to create your project:</p>
            
            <div className="space-y-3">
              {/* Primary Option: Multi-Component Project */}
              <button
                onClick={() => {
                  setShowCreationChoice(false)
                  setShowMultiFileCreation(true)
                }}
                className="w-full flex items-center gap-3 p-4 border-2 border-blue-200 bg-blue-50 rounded-lg hover:border-blue-300 hover:bg-blue-100 transition-colors text-left"
              >
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-slate-900">Create Project with Model</h3>
                  <p className="text-sm text-slate-600">Upload IFC files to create a project with building components</p>
                </div>
              </button>
              
              {/* Commented out for now - Single file option */}
              {/* 
              <button
                onClick={() => {
                  setShowCreationChoice(false)
                  setShowModelCreation(true)
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
              >
                <Upload className="h-5 w-5 text-slate-600" />
                <div>
                  <h3 className="font-medium text-slate-900">Single IFC File</h3>
                  <p className="text-sm text-slate-600">Upload one IFC or FRAG file for a simple project</p>
                </div>
              </button>
              */}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowCreationChoice(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single File Model Creation Modal */}
      {showModelCreation && (
        <ModelCreation
          onProjectCreated={handleProjectCreated}
          onClose={() => setShowModelCreation(false)}
        />
      )}

      {/* Multi-File Model Creation Modal */}
      {showMultiFileCreation && (
        <MultiFileModelCreation
          onProjectCreated={handleProjectCreated}
          onClose={() => setShowMultiFileCreation(false)}
        />
      )}
    </div>
  )
}
