'use client'

import React, { useState, useEffect } from 'react'
import { ProjectCard } from './ProjectCard'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { ProfessionalGamingProgress } from '@/components/gaming/ProfessionalGamingProgress'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Filter, Zap, Activity, Database, Users, TrendingUp, AlertTriangle, Building2, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

interface Project {
  id: string
  name: string
  description?: string
  totalPanels: number
  completedPanels: number
  status: 'active' | 'completed' | 'on-hold' | 'planning'
  lastUpdated: string
  modelUrl?: string
  groups?: Array<{
    id: string
    name: string
    status: string
    panelCount: number
  }>
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()

  // Mock data for development - replace with API call
  useEffect(() => {
    const mockProjects: Project[] = [
      {
        id: '1',
        name: 'Office Building Complex',
        description: 'Modern office building with 15 floors and underground parking',
        totalPanels: 247,
        completedPanels: 156,
        status: 'active',
        lastUpdated: '2024-10-14T10:30:00Z',
        modelUrl: '/models/office-building.ifc',
        groups: [
          { id: '1', name: 'Foundation', status: 'completed', panelCount: 45 },
          { id: '2', name: 'Ground Floor', status: 'active', panelCount: 67 },
          { id: '3', name: 'Upper Floors', status: 'planning', panelCount: 135 }
        ]
      },
      {
        id: '2',
        name: 'Residential Tower A',
        description: 'High-rise residential building with 30 floors',
        totalPanels: 389,
        completedPanels: 389,
        status: 'completed',
        lastUpdated: '2024-10-12T15:45:00Z',
        modelUrl: '/models/residential-tower.ifc',
        groups: [
          { id: '4', name: 'Structure', status: 'completed', panelCount: 200 },
          { id: '5', name: 'Facades', status: 'completed', panelCount: 189 }
        ]
      },
      {
        id: '3',
        name: 'Shopping Mall Phase 1',
        description: 'Large retail complex with multiple anchor stores',
        totalPanels: 156,
        completedPanels: 45,
        status: 'on-hold',
        lastUpdated: '2024-10-10T09:20:00Z',
        groups: [
          { id: '6', name: 'Main Structure', status: 'active', panelCount: 89 },
          { id: '7', name: 'Store Fronts', status: 'planning', panelCount: 67 }
        ]
      },
      {
        id: '4',
        name: 'Manufacturing Facility',
        description: 'Industrial facility for automotive parts production',
        totalPanels: 78,
        completedPanels: 0,
        status: 'planning',
        lastUpdated: '2024-10-08T14:15:00Z',
        groups: [
          { id: '8', name: 'Production Hall', status: 'planning', panelCount: 45 },
          { id: '9', name: 'Office Wing', status: 'planning', panelCount: 33 }
        ]
      }
    ]

    // Simulate API delay
    setTimeout(() => {
      setProjects(mockProjects)
      setFilteredProjects(mockProjects)
      setLoading(false)
    }, 1000)
  }, [])

  // Filter projects based on search and status
  useEffect(() => {
    let filtered = projects

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    setFilteredProjects(filtered)
  }, [projects, searchTerm, statusFilter])

  const handleViewProject = (projectId: string) => {
    router.push(`/projects/${projectId}`)
  }

  const handleCreateProject = () => {
    router.push('/projects/new')
  }

  const handleEditProject = (projectId: string) => {
    router.push(`/projects/${projectId}/edit`)
  }

  const handleDeleteProject = (projectId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete project:', projectId)
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

        {/* Professional Loading Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* Professional Loading Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[rgba(26,31,46,0.8)] border border-[rgba(58,123,213,0.1)] rounded-xl overflow-hidden animate-pulse">
              {/* Card Header */}
              <div className="p-4 border-b border-[rgba(58,123,213,0.1)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-5 bg-[rgba(58,123,213,0.2)] rounded w-20 animate-pulse"></div>
                  <div className="w-6 h-6 bg-[rgba(184,188,200,0.2)] rounded animate-pulse"></div>
                </div>
                <div className="h-6 bg-[rgba(232,234,240,0.2)] rounded w-3/4 animate-pulse"></div>
              </div>
              
              {/* Card Content */}
              <div className="p-4 space-y-4">
                {/* Progress Section */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-16 animate-pulse"></div>
                    <div className="h-4 bg-[rgba(58,123,213,0.2)] rounded w-10 animate-pulse"></div>
                  </div>
                  <div className="h-2 bg-[#252A3A] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#3A7BD5] to-[#2E5F9F] rounded-full animate-pulse" style={{ width: `${30 + (i * 10)}%` }}></div>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[rgba(37,42,58,0.6)] rounded-lg p-3 space-y-2">
                    <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-12 animate-pulse"></div>
                    <div className="h-6 bg-[rgba(232,234,240,0.2)] rounded w-8 animate-pulse"></div>
                  </div>
                  <div className="bg-[rgba(37,42,58,0.6)] rounded-lg p-3 space-y-2">
                    <div className="h-4 bg-[rgba(184,188,200,0.2)] rounded w-14 animate-pulse"></div>
                    <div className="h-6 bg-[rgba(232,234,240,0.2)] rounded w-6 animate-pulse"></div>
                  </div>
                </div>
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

  return (
    <div className="p-6">
      {/* Professional Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[#E8EAF0] mb-2 uppercase tracking-wider">PROJECT DASHBOARD</h1>
          <p className="text-lg text-[#B8BCC8] uppercase tracking-wider font-medium">
            3D IFC PROJECT MANAGEMENT SYSTEM
          </p>
        </div>
        <ProfessionalGamingButton onClick={handleCreateProject} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          DEPLOY PROJECT
        </ProfessionalGamingButton>
      </div>

      {/* Gaming Stats Overview */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6 mb-6">
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
            label="TOTAL PANELS"
            value={projects.reduce((sum, p) => sum + p.totalPanels, 0).toLocaleString()}
            variant="default"
          />
        </div>
      </ProfessionalGamingCard>

      {/* System Health Monitor */}
      <ProfessionalGamingCard variant="monitor" className="p-4 sm:p-6 mb-6">
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

      {/* Professional Control Panel */}
      <ProfessionalGamingCard variant="panel" className="p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#E8EAF0] mb-2 sm:mb-0 uppercase tracking-wider">PROJECT FINDER</h3>
          <div className="flex items-center gap-2">
            <ProfessionalGamingBadge variant="info" icon={<Search className="w-3 h-3" />}>
              {filteredProjects.length} DETECTED
            </ProfessionalGamingBadge>
          </div>
        </div>
      </ProfessionalGamingCard>

      {/* Professional Projects Grid */}
      {filteredProjects.length === 0 ? (
        <ProfessionalGamingCard variant="panel" className="p-12 text-center">
          <div className="text-6xl mb-4 text-[#4A90E2]">🚀</div>
          <div className="text-2xl font-semibold text-[#E8EAF0] mb-2 uppercase tracking-wider">
            {searchTerm || statusFilter !== 'all' ? 'NO PROJECTS DETECTED' : 'PROJECT HUB READY'}
          </div>
          <div className="text-[#B8BCC8] mb-6 uppercase tracking-wider">
            {searchTerm || statusFilter !== 'all' 
              ? 'ADJUST SEARCH FILTERS' 
              : 'DEPLOY YOUR FIRST PROJECT TO BEGIN'
            }
          </div>
          {!searchTerm && statusFilter === 'all' && (
            <ProfessionalGamingButton onClick={handleCreateProject} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              INITIALIZE PROJECT
            </ProfessionalGamingButton>
          )}
        </ProfessionalGamingCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onView={handleViewProject}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
