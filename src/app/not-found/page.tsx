import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'

function NotFoundCard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const attempted = location.pathname || '/'

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-8 sm:p-10">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--uq-orange)]">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-[var(--uq-muted)]">
          That URL is not part of UNIQUBE. Check the address or go back to a known page.
        </p>
        <p className="mt-4 text-sm font-mono break-all text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          {attempted}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            className="uq-btn hover:bg-[var(--uq-yellow-hover)]"
            onClick={() => navigate(isAuthenticated ? '/projects' : '/login')}
          >
            {isAuthenticated ? 'Go to Projects' : 'Go to Login'}
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NotFoundPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--uq-content)]">
        <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-[var(--uq-orange)] animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <NotFoundCard />
      </AppLayout>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--uq-content)] p-4">
      <NotFoundCard />
    </div>
  )
}
