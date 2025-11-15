import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Calendar, Users, Package, MoreVertical, Zap, Activity, AlertTriangle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Project {
  id: string
  displayNumber?: number
  name: string
  description?: string
  totalPanels?: number
  completedPanels?: number
  status: 'active' | 'completed' | 'on-hold' | 'planning'
  lastUpdated?: string
  updatedAt?: string
  modelUrl?: string
  groups?: Array<{
    id: string
    name: string
    status: string
    panelCount: number
  }>
  stats?: {
    totalPanels?: number
  }
}

interface ProjectCardProps {
  project: Project
  onView: (projectId: string) => void
  onEdit?: (projectId: string) => void
  onDelete?: (projectId: string) => void
}

const statusConfig = {
  active: { 
    variant: 'success' as const, 
    label: 'Active', 
    icon: Activity,
  },
  completed: { 
    variant: 'default' as const, 
    label: 'Completed', 
    icon: Zap,
  },
  'on-hold': { 
    variant: 'destructive' as const, 
    label: 'On Hold', 
    icon: AlertTriangle,
  },
  planning: { 
    variant: 'secondary' as const, 
    label: 'Planning', 
    icon: Package,
  }
}

export function ProjectCard({ project, onView }: ProjectCardProps) {
  const totalPanels = project.stats?.totalPanels || project.totalPanels || 0
  const completedPanels = project.completedPanels || 0
  const completionPercentage = totalPanels > 0 
    ? Math.round((completedPanels / totalPanels) * 100)
    : 0

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const statusInfo = statusConfig[project.status]
  const StatusIcon = statusInfo.icon

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full justify-between">
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold truncate">
              {/* {project.displayNumber && <span className="text-slate-500">#{project.displayNumber} </span>} */}
              {project.name}
            </h2>
            <Badge variant={statusInfo.variant} className="text-xs shrink-0">
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground text-sm truncate">{project.description}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 text-sm mb-3">
        {/* <div className="flex items-center text-gray-600">
          <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-2">
            <Package className="h-3 w-3 text-blue-600" />
          </div>
          <span>Building Panels: {project.totalPanels}</span>
        </div>
        
        <div className="flex items-center text-gray-600">
          <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mr-2">
            <Users className="h-3 w-3 text-green-600" />
          </div>
          <span>Model Groups: {project.groups?.length || 0}</span>
        </div> */}
        
        <div className="flex items-center text-gray-600">
          <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mr-2">
            <Calendar className="h-3 w-3 text-purple-600" />
          </div>
          <span>Updated: {formatDate(project.lastUpdated || project.updatedAt)}</span>
        </div>
      </div>

      {/* View Details Button */}
      <div className="border-t pt-3 mt-auto">
        <Button 
          variant="outline" 
          className="w-full hover:bg-gray-50 text-sm"
          onClick={() => onView(project.id)}
        >
          View Details
        </Button>
      </div>
    </div>
  )
}
