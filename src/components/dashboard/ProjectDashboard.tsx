import { useState, useEffect } from 'react'
import { 
  Plus, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Building2, 
  Package
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '@/services/api'
import { ModelCreation } from '@/components/projects/ModelCreation'

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModelCreation, setShowModelCreation] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  // Handle project creation success
  const handleProjectCreated = (newProject: any) => {
    // Refresh projects list
    loadProjects()
    setShowModelCreation(false)
    // Navigate to the new project
    navigate(`/projects/${newProject.id}`)
  }

  const loadProjects = async () => {
    try {
      setLoading(true)
      
      // Mock data for development - replace with real API call when backend is ready
      const mockProjects: Project[] = [
        {
          id: '1',
          name: 'Residential Complex A',
          description: 'Modern residential building with 120 units',
          status: 'active',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z',
          lastUpdated: '2024-01-20T15:30:00Z',
          totalPanels: 1250,
          completedPanels: 875,
          modelUrl: '/models/residential-a.ifc',
          thumbnailUrl: '/thumbnails/residential-a.jpg'
        },
        {
          id: '2',
          name: 'Office Tower B',
          description: 'Commercial office building - 25 floors',
          status: 'active',
          createdAt: '2024-01-10T09:00:00Z',
          updatedAt: '2024-01-22T11:15:00Z',
          lastUpdated: '2024-01-22T11:15:00Z',
          totalPanels: 2100,
          completedPanels: 1680,
          modelUrl: '/models/office-b.ifc',
          thumbnailUrl: '/thumbnails/office-b.jpg'
        },
        {
          id: '3',
          name: 'Shopping Mall C',
          description: 'Large retail complex with parking',
          status: 'completed',
          createdAt: '2023-12-01T08:00:00Z',
          updatedAt: '2024-01-18T16:45:00Z',
          lastUpdated: '2024-01-18T16:45:00Z',
          totalPanels: 3200,
          completedPanels: 3200,
          modelUrl: '/models/mall-c.ifc',
          thumbnailUrl: '/thumbnails/mall-c.jpg'
        },
        {
          id: '4',
          name: 'Hospital Wing D',
          description: 'Medical facility expansion project',
          status: 'planning',
          createdAt: '2024-01-25T14:00:00Z',
          updatedAt: '2024-01-25T14:00:00Z',
          lastUpdated: '2024-01-25T14:00:00Z',
          totalPanels: 1800,
          completedPanels: 0,
          modelUrl: '/models/hospital-d.ifc',
          thumbnailUrl: '/thumbnails/hospital-d.jpg'
        }
      ]
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setProjects(mockProjects)
    } catch (err) {
      setError('Failed to load projects')
      console.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-8 bg-[rgba(74,144,226,0.1)] rounded w-80 animate-pulse"></div>
            <div className="h-5 bg-[rgba(184,188,200,0.1)] rounded w-64 animate-pulse"></div>
          </div>
          <div className="h-10 bg-[rgba(74,144,226,0.1)] rounded w-32 animate-pulse"></div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-[rgba(74,144,226,0.1)] rounded w-20 mb-2"></div>
              <div className="h-8 bg-[rgba(74,144,226,0.1)] rounded w-16 mb-2"></div>
              <div className="h-3 bg-[rgba(184,188,200,0.1)] rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(220,38,38,0.2)] rounded-lg p-8 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2">Error Loading Dashboard</h3>
          <p className="text-[#B8BCC8] mb-4">{error}</p>
          <button
            onClick={loadProjects}
            className="px-4 py-2 bg-[#4A90E2] text-white rounded-lg hover:bg-[#357ABD] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === 'active').length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const totalPanels = projects.reduce((sum, p) => sum + (p.totalPanels || 0), 0)

  return (
    <div className="w-full h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#E8EAF0] uppercase tracking-wider mb-1">
            Project Dashboard
          </h1>
          <p className="text-sm sm:text-base text-[#B8BCC8] uppercase tracking-wider font-medium">
            3D IFC Project Management System
          </p>
        </div>
        <button
          onClick={() => setShowModelCreation(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-lg hover:from-[#357ABD] hover:to-[#2E5F9F] transition-all duration-300 shadow-lg whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Total Projects</span>
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-[#4A90E2]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{totalProjects}</div>
          <div className="text-xs text-[#6B7BD5] uppercase tracking-wider">All Time</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Active</span>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-[#10B981]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{activeProjects}</div>
          <div className="text-xs text-[#10B981] uppercase tracking-wider">In Progress</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Completed</span>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-[#8B5CF6]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{completedProjects}</div>
          <div className="text-xs text-[#8B5CF6] uppercase tracking-wider">Finished</div>
        </div>

        <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-4 sm:p-6 hover:border-[rgba(74,144,226,0.3)] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#B8BCC8] text-xs sm:text-sm uppercase tracking-wider">Total Panels</span>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-[#F59E0B]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#E8EAF0] mb-1">{totalPanels.toLocaleString()}</div>
          <div className="text-xs text-[#F59E0B] uppercase tracking-wider">Components</div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg">
        <div className="p-6 border-b border-[rgba(184,188,200,0.1)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#E8EAF0] uppercase tracking-wider">
              Recent Projects
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-[#4A90E2] hover:text-[#357ABD] text-sm uppercase tracking-wider font-medium transition-colors"
            >
              View All
            </button>
          </div>
        </div>

        <div className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-[#4A90E2] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2 uppercase tracking-wider">
                No Projects Yet
              </h3>
              <p className="text-[#B8BCC8] mb-6 uppercase tracking-wider">
                Create your first project to get started
              </p>
              <button
                onClick={() => setShowModelCreation(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white rounded-lg hover:from-[#357ABD] hover:to-[#2E5F9F] transition-all duration-300"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-[rgba(15,20,25,0.5)] rounded-lg border border-[rgba(184,188,200,0.05)] hover:border-[rgba(74,144,226,0.2)] transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#4A90E2] to-[#357ABD] rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#E8EAF0] uppercase tracking-wider">
                        {project.name}
                      </h3>
                      <p className="text-sm text-[#B8BCC8] uppercase tracking-wider">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#E8EAF0]">
                        {((project.completedPanels || 0) / (project.totalPanels || 1) * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-[#B8BCC8] uppercase tracking-wider">
                        Complete
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                      project.status === 'active' 
                        ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]'
                        : project.status === 'completed'
                        ? 'bg-[rgba(139,92,246,0.1)] text-[#8B5CF6] border border-[rgba(139,92,246,0.2)]'
                        : 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border border-[rgba(245,158,11,0.2)]'
                    }`}>
                      {project.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
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
