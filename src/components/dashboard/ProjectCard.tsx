import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Box, Calendar, Layers, Package, Activity, Zap, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Project {
  id: string
  displayNumber?: number
  name: string
  description?: string
  totalPanels?: number
  completedPanels?: number
  status: string
  lastUpdated?: string
  updatedAt?: string
  currentModel?: { id: string } | null
  stats?: {
    totalPanels?: number
    totalModels?: number
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
    bar: 'bg-emerald-500',
  },
  completed: {
    variant: 'default' as const,
    label: 'Completed',
    icon: Zap,
    bar: 'bg-slate-700',
  },
  'on-hold': {
    variant: 'destructive' as const,
    label: 'On Hold',
    icon: AlertTriangle,
    bar: 'bg-red-500',
  },
  planning: {
    variant: 'secondary' as const,
    label: 'Planning',
    icon: Package,
    bar: 'bg-[var(--uq-orange)]',
  },
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizeStatus(s?: string) {
  if (!s) return 'planning'
  const kebab = s.toString().trim().toLowerCase().replace(/[_\s]+/g, '-')
  if (kebab === 'onhold') return 'on-hold'
  if (kebab === 'active' || kebab === 'completed' || kebab === 'planning' || kebab === 'on-hold') {
    return kebab
  }
  return 'planning'
}

function formatDate(dateString?: string) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ProjectCard({ project, onView }: ProjectCardProps) {
  const navigate = useNavigate()
  const totalPanels = project.stats?.totalPanels || project.totalPanels || 0
  const completedPanels = project.completedPanels || 0
  const completionPercentage =
    totalPanels > 0 ? Math.round((completedPanels / totalPanels) * 100) : 0
  const statusKey = normalizeStatus(project.status)
  const statusInfo = statusConfig[statusKey] || statusConfig.planning
  const StatusIcon = statusInfo.icon
  const hasModel = !!project.currentModel

  return (
    <article
      className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col h-full cursor-pointer"
      onClick={() => onView(project.id)}
    >
      <div className={`h-1 ${statusInfo.bar}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-11 w-11 rounded-xl bg-[var(--uq-navy)] text-white flex items-center justify-center text-sm font-bold tracking-wide shrink-0">
            {initials(project.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {project.displayNumber != null && (
                <span className="text-[11px] font-semibold text-[var(--uq-muted)] tracking-wide">
                  #{String(project.displayNumber).padStart(2, '0')}
                </span>
              )}
              <Badge variant={statusInfo.variant} className="text-[10px] shrink-0 rounded-full px-2.5">
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-[var(--uq-ink)] leading-snug line-clamp-2">
              {project.name}
            </h2>
          </div>
        </div>

        <p className="text-sm text-[var(--uq-muted)] line-clamp-2 min-h-[40px] mb-4">
          {project.description || 'No description yet'}
        </p>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[var(--uq-muted)] mb-1.5">
            <span>Install progress</span>
            <span className="font-semibold text-[var(--uq-ink)]">{completionPercentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${statusInfo.bar}`}
              style={{ width: `${Math.min(100, completionPercentage)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--uq-muted)] mb-4">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {totalPanels.toLocaleString()} panels
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(project.lastUpdated || project.updatedAt)}
          </span>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-sm uq-btn border-0"
            onClick={(e) => {
              e.stopPropagation()
              onView(project.id)
            }}
          >
            Open project
          </Button>
          {hasModel && (
            <Button
              className="uq-btn text-sm px-3"
              title="Open 3D viewer"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/projects/${project.id}/viewer-engine`)
              }}
            >
              <Box className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
