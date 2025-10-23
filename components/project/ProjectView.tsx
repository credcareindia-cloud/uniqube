'use client'

import React, { useState, useEffect } from 'react'
import IFCViewer from '@/components/viewer/IFCViewer'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { ProfessionalGamingProgress } from '@/components/gaming/ProfessionalGamingProgress'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Upload, Download, Settings, Eye, Building2, Package, Users, Calendar, Activity, Zap, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Group {
  id: string
  name: string
  description?: string
  panelCount: number
  status: 'not-started' | 'in-progress' | 'ready-for-truck' | 'shipped' | 'ready-for-production' | 'pre-fabricated'
}

interface Project {
  id: string
  name: string
  description?: string
  totalPanels: number
  completedPanels: number
  status: 'active' | 'completed' | 'on-hold' | 'planning'
  lastUpdated: string
  modelUrl?: string
  groups: Group[]
}

interface ProjectViewProps {
  projectId: string
}

const statusConfig = {
  'not-started': { 
    label: 'Planning', 
    variant: 'secondary' as const, 
    icon: Package,
    color: '#6B7280'
  },
  'in-progress': { 
    label: 'In Progress', 
    variant: 'default' as const, 
    icon: Activity,
    color: '#3A7BD5'
  },
  'ready-for-truck': { 
    label: 'Ready to Ship', 
    variant: 'accent' as const, 
    icon: Zap,
    color: '#4A9B6B'
  },
  'shipped': { 
    label: 'Shipped', 
    variant: 'accent' as const, 
    icon: Zap,
    color: '#4A9B6B'
  },
  'ready-for-production': { 
    label: 'Production Ready', 
    variant: 'accent' as const, 
    icon: Zap,
    color: '#4A9B6B'
  },
  'pre-fabricated': { 
    label: 'Completed', 
    variant: 'accent' as const, 
    icon: Zap,
    color: '#4A9B6B'
  }
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const router = useRouter()

  useEffect(() => {
    // Mock data - replace with API call
    const mockProject: Project = {
      id: projectId,
      name: 'Office Building Complex',
      description: 'Modern office building with 15 floors and underground parking. This project includes precast concrete panels, steel framework, and glass facades.',
      totalPanels: 247,
      completedPanels: 156,
      status: 'active',
      lastUpdated: '2024-10-14T10:30:00Z',
      modelUrl: '/models/office-building.ifc',
      groups: [
        {
          id: '1',
          name: 'Foundation Panels',
          description: 'Ground level foundation and basement wall panels',
          panelCount: 45,
          status: 'pre-fabricated'
        },
        {
          id: '2',
          name: 'Ground Floor Walls',
          description: 'Main floor exterior and interior wall panels',
          panelCount: 67,
          status: 'ready-for-truck'
        },
        {
          id: '3',
          name: 'Upper Floor Panels',
          description: 'Floors 2-15 wall and structural panels',
          panelCount: 89,
          status: 'in-progress'
        },
        {
          id: '4',
          name: 'Roof Structure',
          description: 'Roof panels and structural elements',
          panelCount: 34,
          status: 'ready-for-production'
        },
        {
          id: '5',
          name: 'Facade Elements',
          description: 'Exterior facade panels and cladding',
          panelCount: 12,
          status: 'not-started'
        }
      ]
    }

    setTimeout(() => {
      setProject(mockProject)
      setLoading(false)
    }, 500)
  }, [projectId])

  const handleBack = () => {
    router.push('/dashboard')
  }

  const handleUploadModel = () => {
    // TODO: Implement file upload
    console.log('Upload model')
  }

  const handleOpen3DViewer = () => {
    setActiveTab('viewer')
  }

  if (loading) {
    return (
      <div className="p-6">
        {/* Professional Loading Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] rounded-lg animate-pulse shadow-lg"></div>
            <div className="space-y-2">
              <div className="h-6 bg-[rgba(58,123,213,0.2)] rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-64 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Professional Loading Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl h-64 animate-pulse"></div>
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl h-48 animate-pulse"></div>
          </div>
          <div className="space-y-6">
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl h-32 animate-pulse"></div>
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl h-48 animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <ProfessionalGamingCard className="p-12 text-center">
          <div className="space-y-4">
            <AlertTriangle className="h-12 w-12 text-[#D4A574] mx-auto" />
            <h1 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">PROJECT NOT FOUND</h1>
            <p className="text-[#B8BCC8]">The requested project could not be located</p>
            <ProfessionalGamingButton onClick={handleBack} variant="secondary" className="flex items-center gap-2 mx-auto">
              <ArrowLeft className="h-4 w-4" />
              BACK TO DASHBOARD
            </ProfessionalGamingButton>
          </div>
        </ProfessionalGamingCard>
      </div>
    )
  }

  const completionPercentage = project.totalPanels > 0 
    ? Math.round((project.completedPanels / project.totalPanels) * 100)
    : 0

  const statusCounts = project.groups.reduce((acc, group) => {
    acc[group.status] = (acc[group.status] || 0) + group.panelCount
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6">
      {/* Professional Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <ProfessionalGamingButton variant="secondary" onClick={handleBack} className="p-3">
            <ArrowLeft className="h-4 w-4" />
          </ProfessionalGamingButton>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#3A7BD5] to-[#2E5F9F] rounded-lg flex items-center justify-center shadow-lg">
              <Building2 className="h-6 w-6 text-[#E8EAF0]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#E8EAF0] uppercase tracking-wider">{project.name}</h1>
              {project.description && (
                <p className="text-[#B8BCC8] text-sm mt-1">{project.description}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          {project.modelUrl && (
            <ProfessionalGamingButton onClick={handleOpen3DViewer} variant="primary" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              3D VIEWER
            </ProfessionalGamingButton>
          )}
          <ProfessionalGamingButton onClick={handleUploadModel} variant="secondary" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            UPLOAD
          </ProfessionalGamingButton>
          <ProfessionalGamingButton variant="secondary" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            SETTINGS
          </ProfessionalGamingButton>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.2)]">
          <TabsTrigger value="overview" className="text-[#B8BCC8] data-[state=active]:text-[#E8EAF0] data-[state=active]:bg-[rgba(58,123,213,0.2)]">OVERVIEW</TabsTrigger>
          <TabsTrigger value="groups" className="text-[#B8BCC8] data-[state=active]:text-[#E8EAF0] data-[state=active]:bg-[rgba(58,123,213,0.2)]">GROUPS</TabsTrigger>
          <TabsTrigger value="panels" className="text-[#B8BCC8] data-[state=active]:text-[#E8EAF0] data-[state=active]:bg-[rgba(58,123,213,0.2)]">PANELS</TabsTrigger>
          <TabsTrigger value="viewer" className="text-[#B8BCC8] data-[state=active]:text-[#E8EAF0] data-[state=active]:bg-[rgba(58,123,213,0.2)]">3D VIEWER</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Professional Project Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ProfessionalGamingStat
              value={project.totalPanels}
              label="TOTAL PANELS"
              variant="default"
              icon={<Package className="h-5 w-5" />}
            />
            <ProfessionalGamingStat
              value={project.completedPanels}
              label="COMPLETED"
              variant="success"
              icon={<Zap className="h-5 w-5" />}
            />
            <ProfessionalGamingStat
              value={`${completionPercentage}%`}
              label="PROGRESS"
              variant="default"
              icon={<Activity className="h-5 w-5" />}
              trend="up"
            />
            <ProfessionalGamingStat
              value={project.groups.length}
              label="GROUPS"
              variant="default"
              icon={<Users className="h-5 w-5" />}
            />
          </div>

          {/* Progress Overview */}
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">PROJECT PROGRESS</h3>
                <span className="text-2xl font-bold text-[#3A7BD5]">{completionPercentage}%</span>
              </div>
              <ProfessionalGamingProgress value={completionPercentage} variant="default" animated />
              <div className="flex justify-between text-sm">
                <span className="text-[#B8BCC8]">{project.completedPanels} of {project.totalPanels} panels completed</span>
                <span className="text-[#6B7280]">Updated: {new Date(project.lastUpdated).toLocaleDateString()}</span>
              </div>
            </div>
          </ProfessionalGamingCard>

          {/* Groups Overview */}
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">GROUPS OVERVIEW</h3>
              <div className="space-y-3">
                {project.groups.map((group) => {
                  const config = statusConfig[group.status]
                  const Icon = config.icon
                  return (
                    <div key={group.id} className="flex items-center justify-between p-4 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.1)] rounded-lg hover:border-[rgba(58,123,213,0.2)] transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" style={{ color: config.color }} />
                        <div>
                          <div className="font-medium text-[#E8EAF0]">{group.name}</div>
                          {group.description && (
                            <div className="text-sm text-[#B8BCC8]">{group.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-[#B8BCC8]">{group.panelCount} panels</div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider border ${
                          group.status === 'pre-fabricated' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'ready-for-truck' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'shipped' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'ready-for-production' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'in-progress' ? 'bg-[rgba(58,123,213,0.2)] border-[#3A7BD5] text-[#3A7BD5]' :
                          'bg-[rgba(107,114,128,0.2)] border-[#6B7280] text-[#6B7280]'
                        }`}>
                          {config.label}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6 mt-6">
          <ProfessionalGamingCard variant="panel" className="p-6">
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">GROUP MANAGEMENT</h3>
              <div className="space-y-4">
                {project.groups.map((group) => {
                  const config = statusConfig[group.status]
                  const Icon = config.icon
                  return (
                    <ProfessionalGamingCard key={group.id} variant="monitor" className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" style={{ color: config.color }} />
                          <h4 className="text-lg font-medium text-[#E8EAF0]">{group.name}</h4>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider border ${
                          group.status === 'pre-fabricated' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'ready-for-truck' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'shipped' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'ready-for-production' ? 'bg-[rgba(74,155,107,0.2)] border-[#4A9B6B] text-[#4A9B6B]' :
                          group.status === 'in-progress' ? 'bg-[rgba(58,123,213,0.2)] border-[#3A7BD5] text-[#3A7BD5]' :
                          'bg-[rgba(107,114,128,0.2)] border-[#6B7280] text-[#6B7280]'
                        }`}>
                          {config.label}
                        </div>
                      </div>
                      {group.description && (
                        <p className="text-[#B8BCC8] text-sm mb-4">{group.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#B8BCC8]">{group.panelCount} panels in this group</span>
                        <ProfessionalGamingButton variant="secondary" size="sm">
                          MANAGE GROUP
                        </ProfessionalGamingButton>
                      </div>
                    </ProfessionalGamingCard>
                  )
                })}
              </div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>

        <TabsContent value="panels" className="space-y-6 mt-6">
          <ProfessionalGamingCard variant="panel" className="p-12 text-center">
            <div className="space-y-4">
              <Package className="h-12 w-12 text-[#6B7BD5] mx-auto" />
              <h3 className="text-xl font-bold text-[#E8EAF0] uppercase tracking-wider">PANEL MANAGEMENT</h3>
              <p className="text-[#B8BCC8]">Individual panel tracking and status management interface</p>
              <div className="text-sm text-[#6B7280]">Coming soon...</div>
            </div>
          </ProfessionalGamingCard>
        </TabsContent>

        <TabsContent value="viewer" className="space-y-6 mt-6">
          <ProfessionalGamingCard variant="monitor" className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[rgba(58,123,213,0.1)]">
              <h3 className="text-lg font-bold text-[#E8EAF0] uppercase tracking-wider">3D MODEL VIEWER</h3>
              <p className="text-[#B8BCC8] text-sm">Interactive 3D view of your IFC model</p>
            </div>
            <div className="h-[600px] bg-[#0F1419]">
              <IFCViewer modelUrl={project.modelUrl} />
            </div>
          </ProfessionalGamingCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
