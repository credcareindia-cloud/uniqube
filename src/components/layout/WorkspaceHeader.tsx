import { Plus, Search } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRBAC } from '@/contexts/RBACContext'

export function WorkspaceHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canCreateProjects } = useRBAC()
  const query = searchParams.get('q') || ''

  const setQuery = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    next.delete('create')
    const search = next.toString()
    if (location.pathname !== '/projects') {
      navigate({ pathname: '/projects', search: search ? `?${search}` : '' })
      return
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <PageHeader
      leading={
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Go to any project name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:border-black focus:ring-2 focus:ring-black/20 focus:outline-none"
          />
        </div>
      }
      actions={
        canCreateProjects() ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.set('create', '1')
              const search = `?${next.toString()}`
              if (location.pathname !== '/projects') {
                navigate({ pathname: '/projects', search })
                return
              }
              setSearchParams(next, { replace: true })
            }}
            className="flex items-center gap-2 px-4 py-2.5 uq-btn rounded-xl shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            New project
          </button>
        ) : undefined
      }
    />
  )
}
