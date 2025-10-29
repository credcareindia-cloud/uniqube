import { useState, useEffect } from 'react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { ProfessionalGamingProgress } from '@/components/gaming/ProfessionalGamingProgress'
import { Plus, Building2, Activity, Zap, Package, Search, AlertTriangle, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '@/services/api'
import { ModelCreation } from '@/components/projects/ModelCreation'

// Mock data for development
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
  }
]

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [loading, setLoading] = useState(false)
  const [showModelCreation, setShowModelCreation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

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
        // Fallback to mock data
        setProjects(mockProjects)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  const handleCreateProject = () => {
    setShowModelCreation(true)
  }

  // Handle project creation success
  const handleProjectCreated = (newProject: any) => {
    // Add new project to the list
    setProjects(prev => [newProject, ...prev])
    setShowModelCreation(false)
    // Navigate to the new project
    navigate(`/projects/${newProject.id}`)
  }

  const handleViewAllProjects = () => {
    navigate('/projects')
  }

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`)
  }

  if (loading) {
    return (
      <div className="w-full h-full space-y-6">
        {/* Professional Loading Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
          <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] rounded-lg animate-pulse shadow-lg"></div>
              <div className="space-y-2">
                <div className="h-6 bg-[rgba(58,123,213,0.2)] rounded w-48 animate-pulse"></div>
                <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-64 animate-pulse"></div>
              </div>
            </div>
          </ProfessionalGamingCard>
        </div>

        {/* Professional Loading Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-[rgba(58,123,213,0.3)] rounded animate-pulse"></div>
                <div className="w-6 h-6 bg-[rgba(184,188,200,0.2)] rounded animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-[rgba(58,123,213,0.2)] rounded w-16 animate-pulse"></div>
                <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-24 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Professional Loading Indicator */}
        <div className="flex items-center justify-center mt-8 p-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] rounded animate-spin"></div>
            <span className="text-[#B8BCC8] text-sm uppercase tracking-wider font-medium">LOADING PROJECTS...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full">
        <ProfessionalGamingCard variant="panel" className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <AlertTriangle className="h-12 w-12 text-red-400" />
            <div>
              <h2 className="text-xl font-bold text-[#E8EAF0] mb-2">CONNECTION ERROR</h2>
              <p className="text-[#B8BCC8] mb-4">{error}</p>
              <ProfessionalGamingButton 
                onClick={() => window.location.reload()} 
                variant="primary"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                RETRY CONNECTION
              </ProfessionalGamingButton>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Professional Header with Enhanced Styling */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
        <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] rounded-xl blur-md opacity-60"></div>
                <div className="relative p-4 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-2xl">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E8EAF0] to-[#3A7BD5] uppercase tracking-wider">
                  PROJECT DASHBOARD
                </h1>
                <p className="text-[#B8BCC8] text-base mt-1">3D IFC PROJECT MANAGEMENT SYSTEM</p>
              </div>
            </div>
            <ProfessionalGamingButton onClick={handleCreateProject} className="flex items-center gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              DEPLOY PROJECT
            </ProfessionalGamingButton>
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Gaming Stats Overview */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ProfessionalGamingStat
            icon={<Building2 className="w-6 h-6" />}
            label="TOTAL PROJECTS"
            value={projects.length}
            variant="primary"
          />
          <ProfessionalGamingStat
            icon={<Activity className="w-6 h-6" />}
            label="ACTIVE PROJECTS"
            value={projects.filter(p => p.status === 'active').length}
            variant="success"
          />
          <ProfessionalGamingStat
            icon={<Zap className="w-6 h-6" />}
            label="COMPLETION RATE"
            value="87%"
            variant="warning"
          />
          <ProfessionalGamingStat
            icon={<Package className="w-6 h-6" />}
            label="TOTAL MODELS"
            value={projects.reduce((sum, p) => sum + (p.stats?.totalModels || 0), 0).toLocaleString()}
            variant="default"
          />
        </div>
      </ProfessionalGamingCard>

      {/* Project Management Quick Actions */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2 sm:mb-0 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            PROJECT MANAGEMENT CENTER
          </h3>
          <ProfessionalGamingBadge variant="active" icon={<Activity className="w-3 h-3" />}>
            ACTIVE
          </ProfessionalGamingBadge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ProfessionalGamingButton 
            onClick={handleCreateProject}
            className="flex items-center gap-2 justify-center"
            variant="primary"
          >
            <Plus className="h-4 w-4" />
            CREATE NEW PROJECT
          </ProfessionalGamingButton>
          <ProfessionalGamingButton 
            onClick={handleViewAllProjects}
            className="flex items-center gap-2 justify-center"
            variant="secondary"
          >
            <Building2 className="h-4 w-4" />
            VIEW ALL PROJECTS
          </ProfessionalGamingButton>
        </div>
        <div className="mt-4 p-3 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-[#B8BCC8] uppercase tracking-wider font-medium">SYSTEM STATUS</span>
          </div>
          <p className="text-sm text-[#E8EAF0]">
            Project Management System <span className="font-mono text-blue-400">OPERATIONAL</span>
          </p>
          <p className="text-xs text-[#B8BCC8] mt-1">
            FRAG Upload • Real-time Processing • Project Analytics
          </p>
        </div>
      </ProfessionalGamingCard>

      {/* System Health Monitor */}
      <ProfessionalGamingCard variant="monitor" className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2 sm:mb-0 uppercase tracking-wider">SYSTEM HEALTH MONITOR</h3>
          <ProfessionalGamingBadge variant="active" icon={<Activity className="w-3 h-3" />}>
            OPERATIONAL
          </ProfessionalGamingBadge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-[#B8BCC8] uppercase tracking-wider font-medium">CPU USAGE</span>
              <span className="text-[#4A90E2] font-mono text-sm font-semibold">45%</span>
            </div>
            <ProfessionalGamingProgress value={45} variant="default" animated />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-[#B8BCC8] uppercase tracking-wider font-medium">MEMORY</span>
              <span className="text-[#7B68EE] font-mono text-sm font-semibold">67%</span>
            </div>
            <ProfessionalGamingProgress value={67} variant="warning" animated />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm text-[#B8BCC8] uppercase tracking-wider font-medium">STORAGE</span>
              <span className="text-[#50C878] font-mono text-sm font-semibold">23%</span>
            </div>
            <ProfessionalGamingProgress value={23} variant="success" animated />
          </div>
        </div>
      </ProfessionalGamingCard>

      {/* Recent Projects Preview */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2 sm:mb-0 uppercase tracking-wider">RECENT PROJECTS</h3>
          <div className="flex items-center gap-2">
            <ProfessionalGamingBadge variant="info" icon={<Search className="w-3 h-3" />}>
              {projects.length} DETECTED
            </ProfessionalGamingBadge>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 text-[#4A90E2]">🚀</div>
            <div className="text-2xl font-semibold text-[#E8EAF0] mb-2 uppercase tracking-wider">
              PROJECT HUB READY
            </div>
            <div className="text-[#B8BCC8] mb-6 uppercase tracking-wider">
              DEPLOY YOUR FIRST PROJECT TO BEGIN
            </div>
            <ProfessionalGamingButton onClick={handleCreateProject} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              INITIALIZE PROJECT
            </ProfessionalGamingButton>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.slice(0, 3).map((project) => {
              const completionPercentage = project.totalPanels > 0 
                ? Math.round((project.completedPanels / project.totalPanels) * 100)
                : 0

              return (
                <div 
                  key={project.id} 
                  className="bg-[rgba(37,42,58,0.6)] rounded-lg p-4 border border-[rgba(58,123,213,0.1)] hover:border-[rgba(58,123,213,0.2)] transition-colors cursor-pointer group"
                  onClick={() => handleViewProject(project.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-[#E8EAF0] font-semibold uppercase tracking-wider group-hover:text-[#3A7BD5] transition-colors">{project.name}</h4>
                      <p className="text-[#B8BCC8] text-sm">{project.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProfessionalGamingBadge 
                        variant={project.status === 'active' ? 'active' : project.status === 'completed' ? 'completed' : 'neutral'}
                      >
                        {project.status.toUpperCase()}
                      </ProfessionalGamingBadge>
                      <Eye className="h-4 w-4 text-[#B8BCC8] group-hover:text-[#3A7BD5] transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#B8BCC8]">Progress</span>
                      <span className="text-[#3A7BD5] font-semibold">{completionPercentage}%</span>
                    </div>
                    <ProfessionalGamingProgress value={completionPercentage} variant="default" />
                  </div>
                </div>
              )
            })}
            
            {projects.length > 3 && (
              <div className="text-center pt-4">
                <ProfessionalGamingButton onClick={handleViewAllProjects} variant="secondary">
                  VIEW ALL {projects.length} PROJECTS
                </ProfessionalGamingButton>
              </div>
            )}
          </div>
        )}
      </ProfessionalGamingCard>
      
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
