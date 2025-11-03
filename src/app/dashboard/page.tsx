import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Building2, 
  Plus, 
  Package, 
  Activity, 
  Zap,
  Eye,
  Clock,
  Upload,
  AlertTriangle
} from 'lucide-react'
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

  const handleProjectCreated = (newProject: any) => {
    setProjects(prev => [newProject, ...prev])
    setShowModelCreation(false)
    navigate(`/projects/${newProject.id}`)
  }

  const handleViewAllProjects = () => {
    navigate('/projects')
  }

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`)
  }

  // Calculate stats
  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === 'active').length
  const totalModels = projects.reduce((sum, p) => sum + (p.stats?.totalModels || 0), 0)
  const avgCompletion = projects.length > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.completedPanels / p.totalPanels * 100), 0) / projects.length)
    : 0

  if (loading) {
    return (
      <div className="w-full h-full space-y-6">
        {/* Loading Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
                <div className="h-4 bg-slate-100 rounded w-64 animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 bg-slate-200 rounded w-16"></div>
                  <div className="h-4 bg-slate-100 rounded w-24"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-center mt-8 p-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-600 text-sm">Loading projects...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Issue</h3>
                <p className="text-slate-600 mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="h-7 w-7 text-slate-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Project Dashboard</h1>
            <p className="text-slate-600 mt-1">Manage your 3D IFC projects</p>
          </div>
        </div>
        <Button onClick={handleCreateProject} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-slate-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalProjects}</div>
            <div className="text-sm text-slate-600">Total Projects</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-slate-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{activeProjects}</div>
            <div className="text-sm text-slate-600">Active Projects</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-slate-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{avgCompletion}%</div>
            <div className="text-sm text-slate-600">Completion Rate</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-slate-700" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalModels}</div>
            <div className="text-sm text-slate-600">Total Models</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription>Manage your IFC projects and models</CardDescription>
            </div>
            <Badge variant="success" className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              System Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              onClick={handleCreateProject} 
              className="flex items-center justify-center gap-2 h-12"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
            <Button 
              variant="outline"
              className="flex items-center justify-center gap-2 h-12"
            >
              <Upload className="h-4 w-4" />
              Upload Model
            </Button>
          </div>
          
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-900">System Status</span>
              <Badge variant="outline" className="text-xs">All Systems Operational</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Upload</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Processing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Analytics</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Management Center */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Management Center</CardTitle>
              <CardDescription>Create and manage your IFC projects</CardDescription>
            </div>
            <Badge variant="success" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline"
            onClick={handleCreateProject} 
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Project
          </Button>
          
          <div className="pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-600 mb-2">System Status</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Project Management System</span>
                <Badge variant="info">Operational</Badge>
              </div>
              <div className="text-xs text-slate-500">
                FRAG Upload • Real-time Processing • Project Analytics
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Your latest IFC projects</CardDescription>
            </div>
            <Button variant="outline" onClick={handleViewAllProjects}>
              View All Projects
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Projects Yet</h3>
              <p className="text-slate-600 mb-4">Get started by creating your first project</p>
              <Button variant="outline" onClick={handleCreateProject} className="flex items-center gap-2 mx-auto">
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 3).map((project) => {
                const completionPercentage = Math.round((project.completedPanels / project.totalPanels) * 100)
                const statusVariant = 
                  project.status === 'active' ? 'success' :
                  project.status === 'planning' ? 'warning' :
                  project.status === 'completed' ? 'info' : 'default'

                return (
                  <div
                    key={project.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleViewProject(project.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-600">{project.description}</p>
                      </div>
                      <Badge variant={statusVariant} className="ml-4">
                        {project.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {project.completedPanels} / {project.totalPanels} panels
                        </span>
                        <span className="font-medium text-slate-900">{completionPercentage}%</span>
                      </div>
                      <Progress value={completionPercentage} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{project.stats?.totalModels || 0} models</span>
                        <span>Updated {new Date(project.lastUpdated).toLocaleDateString()}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Creation Modal */}
      {showModelCreation && (
        <ModelCreation
          onClose={() => setShowModelCreation(false)}
        />
      )}
    </div>
  )
}
