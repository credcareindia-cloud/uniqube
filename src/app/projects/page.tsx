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
import { api } from '@/services/api'
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

  // Handle project creation success
  const handleProjectCreated = (newProject: any) => {
    setProjects(prev => [newProject, ...prev])
    setShowModelCreation(false)
    // Navigate to the new project
    navigate(`/projects/${newProject.id}`)
  }

  // Load projects from backend
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getProjects()
        setProjects(response.projects)
      } catch (err) {
        console.error('Failed to load projects:', err)
        setError('Failed to load projects. Using mock data for development.')
        
        // Fallback to mock data for development
        const mockProjects: Project[] = [
          {
            id: '1',
            name: 'Downtown Office Complex',
            description: 'Modern 15-story office building with retail space',
            status: 'active',
            totalPanels: 450,
            completedPanels: 387,
            lastUpdated: '2024-01-15T10:30:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            stats: { totalModels: 125 }
          },
          {
            id: '2',
            name: 'Residential Tower A',
            description: '32-floor luxury residential building',
            status: 'planning',
            totalPanels: 680,
            completedPanels: 45,
            lastUpdated: '2024-01-14T16:45:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-14T16:45:00Z',
            stats: { totalModels: 89 }
          },
          {
            id: '3',
            name: 'Shopping Mall Renovation',
            description: 'Complete renovation of existing shopping center',
            status: 'completed',
            totalPanels: 320,
            completedPanels: 320,
            lastUpdated: '2024-01-10T09:15:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-10T09:15:00Z',
            stats: { totalModels: 67 }
          },
          {
            id: '4',
            name: 'Industrial Warehouse',
            description: 'Large-scale industrial storage facility',
            status: 'on-hold',
            totalPanels: 280,
            completedPanels: 150,
            lastUpdated: '2024-01-12T14:20:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-12T14:20:00Z',
            stats: { totalModels: 45 }
          }
        ]
        setProjects(mockProjects)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

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
    totalPanels: projects.reduce((sum, p) => sum + (p.totalPanels || 0), 0)
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
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#E8EAF0] uppercase tracking-wider mb-1">
            Projects
          </h1>
          <p className="text-sm sm:text-base text-[#B8BCC8] uppercase tracking-wider font-medium">
            3D IFC Project Management
          </p>
        </div>
        <button
          onClick={() => setShowModelCreation(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-lg hover:from-[#357ABD] hover:to-[#2E5F9F] transition-all duration-300 font-medium uppercase tracking-wider"
        >
          <Upload className="h-4 w-4" />
          Create Project with Model
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-6">
        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Total</span>
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-[#4A90E2]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{stats.total}</div>
          <div className="text-xs text-[#6B7BD5] uppercase tracking-wider">Projects</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Active</span>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-[#10B981]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{stats.active}</div>
          <div className="text-xs text-[#10B981] uppercase tracking-wider">In Progress</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Completed</span>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-[#8B5CF6]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{stats.completed}</div>
          <div className="text-xs text-[#8B5CF6] uppercase tracking-wider">Finished</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Planning</span>
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-[#F59E0B]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{stats.planning}</div>
          <div className="text-xs text-[#F59E0B] uppercase tracking-wider">Upcoming</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Panels</span>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-[#EF4444]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{stats.totalPanels.toLocaleString()}</div>
          <div className="text-xs text-[#EF4444] uppercase tracking-wider">Components</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B8BCC8]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[rgba(74,144,226,0.5)] focus:outline-none"
          />
        </div>

        {/* Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-4 py-2 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg text-[#E8EAF0] focus:border-[rgba(74,144,226,0.5)] focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="planning">Planning</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' 
              ? 'bg-[rgba(74,144,226,0.2)] text-[#4A90E2]' 
              : 'text-[#B8BCC8] hover:text-[#E8EAF0]'
            } transition-colors`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded ${viewMode === 'table' 
              ? 'bg-[rgba(74,144,226,0.2)] text-[#4A90E2]' 
              : 'text-[#B8BCC8] hover:text-[#E8EAF0]'
            } transition-colors`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg p-4 mb-6">
          <p className="text-[#EF4444] text-sm">{error}</p>
        </div>
      )}

      {/* Projects Content */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-[#B8BCC8] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#E8EAF0] mb-2">No projects found</h3>
          <p className="text-[#B8BCC8] mb-4">
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating your first project.'
            }
          </p>
          <button
            onClick={() => setShowModelCreation(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-lg hover:from-[#357ABD] hover:to-[#2E5F9F] transition-all duration-300"
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
                    const progress = project.totalPanels > 0 ? Math.round((project.completedPanels / project.totalPanels) * 100) : 0
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
                            <span>{project.completedPanels.toLocaleString()} / {project.totalPanels.toLocaleString()} Panels</span>
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
      
      {/* Model Creation Modal */}
      {showModelCreation && (
        <ModelCreation
          onProjectCreated={handleProjectCreated}
          onClose={() => setShowModelCreation(false)}
        />
      )}
    </div>
  )
}
