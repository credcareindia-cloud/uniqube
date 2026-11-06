import type { ReactNode } from 'react'
import { useRBAC } from '@/contexts/RBACContext'
import type { PermissionKey } from '@/auth/permissions'

export function PermissionGate({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { hasPermission } = useRBAC()
  if (hasPermission(permission)) return <>{children}</>
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center p-8">
      <p className="text-slate-600">Your role does not include this page.</p>
    </div>
  )
}
