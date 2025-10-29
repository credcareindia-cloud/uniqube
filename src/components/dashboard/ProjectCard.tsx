import React from 'react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingProgress } from '@/components/gaming/ProfessionalGamingProgress'
import { Calendar, Users, Package, MoreVertical, Zap, Activity, AlertTriangle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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

interface ProjectCardProps {
  project: Project
  onView: (projectId: string) => void
  onEdit?: (projectId: string) => void
  onDelete?: (projectId: string) => void
}

const statusConfig = {
  active: { 
    variant: 'active' as const, 
    label: 'ACTIVE', 
    icon: Activity,
    color: 'text-[#50C878]'
  },
  completed: { 
    variant: 'completed' as const, 
    label: 'COMPLETED', 
    icon: Zap,
    color: 'text-[#4A90E2]'
  },
  'on-hold': { 
    variant: 'warning' as const, 
    label: 'ON HOLD', 
    icon: AlertTriangle,
    color: 'text-[#FFB347]'
  },
  planning: { 
    variant: 'neutral' as const, 
    label: 'PLANNING', 
    icon: Package,
    color: 'text-[#B8BCC8]'
  }
}

export function ProjectCard({ project, onView, onEdit, onDelete }: ProjectCardProps) {
  const completionPercentage = project.totalPanels > 0 
    ? Math.round((project.completedPanels / project.totalPanels) * 100)
    : 0

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const statusInfo = statusConfig[project.status]
  const StatusIcon = statusInfo.icon

  return (
    <ProfessionalGamingCard className="cursor-pointer group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
      {/* Professional Header */}
      <div className="p-4 sm:p-6 border-b border-[rgba(184,188,200,0.1)]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-lg sm:text-xl font-semibold text-[#E8EAF0] mb-2 group-hover:text-[#4A90E2] transition-colors uppercase tracking-wider">
              {project.name}
            </div>
            {project.description && (
              <div className="text-sm text-[#B8BCC8] line-clamp-2">
                {project.description}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ProfessionalGamingBadge variant={statusInfo.variant} icon={<StatusIcon className="w-3 h-3" />}>
              {statusInfo.label}
            </ProfessionalGamingBadge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ProfessionalGamingButton variant="secondary" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </ProfessionalGamingButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[rgba(15,20,25,0.95)] border-[rgba(184,188,200,0.1)] backdrop-blur-xl">
                <DropdownMenuItem 
                  onClick={() => onView(project.id)}
                  className="text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]"
                >
                  View Project
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem 
                    onClick={() => onEdit(project.id)}
                    className="text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]"
                  >
                    Edit Project
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(project.id)}
                    className="text-[#FF6B6B] hover:text-[#FF5555] hover:bg-[rgba(255,107,107,0.1)]"
                  >
                    Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Professional Content */}
      <div className="p-4 sm:p-6" onClick={() => onView(project.id)}>
        <div className="space-y-4">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#B8BCC8] uppercase tracking-wider font-medium">PROGRESS</span>
              <span className="text-lg font-bold text-[#3A7BD5]">{completionPercentage}%</span>
            </div>
            <ProfessionalGamingProgress value={completionPercentage} variant="default" animated />
          </div>

          {/* Professional Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-[#3A7BD5]" />
                <span className="text-xs text-[#B8BCC8] uppercase tracking-wider font-medium">PANELS</span>
              </div>
              <div className="text-lg font-bold text-[#E8EAF0]">{project.totalPanels}</div>
              <div className="text-xs text-[#6B7280]">Total Panels</div>
            </div>
            
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-[#6B7BD5]" />
                <span className="text-xs text-[#B8BCC8] uppercase tracking-wider font-medium">GROUPS</span>
              </div>
              <div className="text-lg font-bold text-[#E8EAF0]">{project.groups?.length || 0}</div>
              <div className="text-xs text-[#6B7280]">Groups</div>
            </div>
          </div>

          {/* Professional Timeline */}
          <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-[#50C878]" />
              <span className="text-xs text-[#B8BCC8] uppercase tracking-wider font-medium">UPDATED</span>
              <span className="text-[#50C878] font-mono ml-auto font-medium">{formatDate(project.lastUpdated)}</span>
            </div>
          </div>

          {/* 3D Model Status */}
          {project.modelUrl && (
            <div className="bg-[rgba(26,31,46,0.8)] border border-[rgba(80,200,120,0.3)] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#50C878] rounded-full animate-pulse"></div>
                <span className="text-sm text-[#50C878] uppercase tracking-wider font-medium">3D MODEL AVAILABLE</span>
                <Zap className="w-4 h-4 text-[#50C878] ml-auto" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Professional Border Effect */}
      <div className="absolute inset-0 border border-[rgba(184,188,200,0.1)] rounded-lg pointer-events-none group-hover:border-[rgba(74,144,226,0.3)] transition-all duration-300"></div>
      
      {/* Corner Accent */}
      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[rgba(74,144,226,0.4)]"></div>
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[rgba(74,144,226,0.4)]"></div>
    </ProfessionalGamingCard>
  )
}
