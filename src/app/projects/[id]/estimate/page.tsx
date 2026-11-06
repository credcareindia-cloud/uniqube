import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { useAuth } from '@/contexts/AuthContext'
import { CubeLoader } from '@/components/ui/CubeLoader'
import { StudioHost } from './StudioHost'

export default function ProjectEstimatePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    authenticatedFetch(`projects/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((project) => {
        if (!cancelled) setProjectName(typeof project?.name === 'string' && project.name ? project.name : 'Estimate')
      })
      .catch(() => {
        if (!cancelled) setProjectName('Estimate')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id || !projectName) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B1020]">
        <CubeLoader text="LOADING ESTIMATE" />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <StudioHost
        projectId={`p${id}`}
        projectName={projectName}
        user={{ name: user?.name || 'Uniqube', email: user?.email || 'studio@uniqube.co' }}
      />
    </div>
  )
}
