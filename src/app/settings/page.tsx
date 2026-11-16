import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Settings, Shield, User } from 'lucide-react'
import { useRBAC } from '@/contexts/RBACContext'
import ProfilePage from '@/app/profile/page'
import AdminPage from '@/app/admin/page'

type SettingsTab = 'profile' | 'admin'

export default function SettingsPage() {
  const { hasPermission } = useRBAC()
  const canAdmin = hasPermission('admin')
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = useMemo<SettingsTab>(() => {
    const raw = (searchParams.get('tab') || 'profile').toLowerCase()
    if (raw === 'admin' && canAdmin) return 'admin'
    return 'profile'
  }, [searchParams, canAdmin])

  if (searchParams.get('tab') === 'admin' && !canAdmin) {
    return <Navigate to="/settings?tab=profile" replace />
  }

  const setTab = (next: SettingsTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--uq-ink)] flex items-center gap-2">
            <Settings className="h-6 w-6" /> Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--uq-muted)]">Profile and workspace administration.</p>
        </div>
        <div className="inline-flex rounded-xl bg-[var(--uq-offwhite)] p-1 border border-black/5" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            onClick={() => setTab('profile')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === 'profile'
                ? 'bg-white text-[var(--uq-ink)] shadow-sm border border-black/5'
                : 'text-[var(--uq-muted)] hover:text-[var(--uq-ink)]'
            }`}
          >
            <User className="h-4 w-4" />
            Profile
          </button>
          {canAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'admin'}
              onClick={() => setTab('admin')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === 'admin'
                  ? 'bg-white text-[var(--uq-ink)] shadow-sm border border-black/5'
                  : 'text-[var(--uq-muted)] hover:text-[var(--uq-ink)]'
              }`}
            >
              <Shield className="h-4 w-4" />
              Administration
            </button>
          )}
        </div>
      </div>

      {tab === 'profile' ? <ProfilePage /> : <AdminPage />}
    </div>
  )
}
