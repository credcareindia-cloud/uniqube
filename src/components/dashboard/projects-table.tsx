import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api, Project } from '@/services/api'

interface ProjectsTableProps {
  onCreateProject?: () => void
}

export function ProjectsTable({ onCreateProject }: ProjectsTableProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true)
        const response = await api.getProjects()
        setProjects(response.projects)
      } catch (error) {
        console.error('Failed to load projects:', error)
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    loadProjects()
  }, [])

  return (
    <Card className="overflow-hidden border border-[rgba(184,188,200,0.1)] bg-[rgba(26,31,46,0.8)]">
      <div className="flex items-center justify-between border-b border-[rgba(184,188,200,0.1)] px-4 py-3">
        <input
          placeholder="Search projects..."
          className="h-9 w-64 rounded-md border border-[rgba(184,188,200,0.1)] bg-[rgba(15,20,25,0.8)] px-3 text-sm text-[#E8EAF0] placeholder-[#B8BCC8] outline-none focus:border-[rgba(74,144,226,0.5)]"
        />
        <Button 
          className="bg-gradient-to-r from-[#4A90E2] to-[#357ABD] text-white hover:from-[#357ABD] hover:to-[#2E5F9F]"
          onClick={() => onCreateProject?.()}
        >
          Create Project
        </Button>
      </div>
      <div className="divide-y divide-[rgba(184,188,200,0.1)]">
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-[#B8BCC8] uppercase tracking-wider font-medium">
          <div className="col-span-7">Project Name</div>
          <div className="col-span-3">Last Updated</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-[#B8BCC8]">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#B8BCC8]">No projects found</div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="grid grid-cols-12 items-center gap-4 px-4 py-3 hover:bg-[rgba(74,144,226,0.05)] transition-colors">
              <div className="col-span-7">
                <button 
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="font-medium text-[#E8EAF0] hover:text-[#4A90E2] hover:underline text-left"
                >
                  {project.name}
                </button>
                <div className="text-xs text-[#B8BCC8]">
                  Panels: {project.totalPanels || 0}
                </div>
              </div>
              <div className="col-span-3 text-sm text-[#B8BCC8]">
                {new Date(project.lastUpdated).toLocaleString()}
              </div>
              <div className="col-span-2 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="text-[#B8BCC8] hover:text-[#E8EAF0] hover:bg-[rgba(74,144,226,0.1)]"
                >
                  Open
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

