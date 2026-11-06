import { Label } from '@/components/ui/label'
import {
  PERMISSIONS,
  ROLE_LABELS,
  WORKSPACE_ROLES,
  defaultPermissions,
  resolvePermissions,
  type PermissionKey,
  type WorkspaceRole,
} from '@/auth/permissions'

interface RoleAccessFieldsProps {
  role: WorkspaceRole
  permissions: PermissionKey[]
  onRoleChange: (role: WorkspaceRole, permissions: PermissionKey[]) => void
  onPermissionsChange: (permissions: PermissionKey[]) => void
  lockRole?: boolean
  idPrefix: string
}

export function RoleAccessFields({
  role,
  permissions,
  onRoleChange,
  onPermissionsChange,
  lockRole = false,
  idPrefix,
}: RoleAccessFieldsProps) {
  const locked = role === 'ADMIN'
  const groups = PERMISSIONS.reduce<Record<string, typeof PERMISSIONS[number][]>>((acc, item) => {
    acc[item.group] = acc[item.group] || []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-role`} className="text-slate-700 font-medium text-sm">Role</Label>
        <select
          id={`${idPrefix}-role`}
          value={role}
          disabled={lockRole}
          onChange={(e) => {
            const next = e.target.value as WorkspaceRole
            onRoleChange(next, defaultPermissions(next))
          }}
          className="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-slate-100"
        >
          {WORKSPACE_ROLES.map((item) => (
            <option key={item} value={item}>{ROLE_LABELS[item]}</option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Access</legend>
        <p className="text-xs text-slate-500 mb-3">
          {locked
            ? 'Admin keeps every page.'
            : 'These start from the role. Uncheck a page this person should not open.'}
        </p>
        <div className="space-y-3">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{group}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={permissions.includes(item.key)}
                      disabled={locked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...permissions, item.key]
                          : permissions.filter((key) => key !== item.key)
                        onPermissionsChange(resolvePermissions(role, next))
                      }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    </>
  )
}
