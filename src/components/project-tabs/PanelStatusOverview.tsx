import * as LucideIcons from 'lucide-react'

export type StatusOverviewItem = {
  id: string
  name: string
  icon: string
  color: string
  panelCount?: number
}

const ICON_NAME_MAP: Record<string, string> = {
  'angle-double-down': 'ChevronsDown',
  'angle-double-left': 'ChevronsLeft',
  'angle-double-right': 'ChevronsRight',
  'angle-double-up': 'ChevronsUp',
  'angle-down': 'ChevronDown',
  'angle-left': 'ChevronLeft',
  'angle-right': 'ChevronRight',
  'angle-up': 'ChevronUp',
  bell: 'Bell',
  bookmark: 'Bookmark',
  box: 'Box',
  check: 'Check',
  circle: 'Circle',
  clock: 'Clock',
  code: 'Code',
  exclamation: 'AlertTriangle',
  eye: 'Eye',
  file: 'File',
  folder: 'Folder',
  forward: 'Forward',
  hashtag: 'Hash',
  info: 'Info',
  lightbulb: 'Lightbulb',
  lock: 'Lock',
  'lock-open': 'LockOpen',
  'map-marker': 'MapPin',
  minus: 'Minus',
  pause: 'Pause',
  'pen-to-square': 'Edit',
  phone: 'Phone',
  play: 'Play',
  plus: 'Plus',
  reply: 'Reply',
  save: 'Save',
  search: 'Search',
  send: 'Send',
  server: 'Server',
  'share-alt': 'Share2',
  shield: 'Shield',
  shop: 'ShoppingBag',
  'sign-in': 'LogIn',
  'sign-out': 'LogOut',
  'sliders-h': 'SlidersHorizontal',
  sort: 'ArrowUpDown',
  spinner: 'Loader',
  star: 'Star',
  'stop-circle': 'StopCircle',
  stopwatch: 'Timer',
  tag: 'Tag',
  'thumbs-down': 'ThumbsDown',
  'thumbs-up': 'ThumbsUp',
  thumbtack: 'Pin',
  'th-large': 'Grid3x3',
  ticket: 'Ticket',
  times: 'X',
  'times-circle': 'XCircle',
  trash: 'Trash2',
  undo: 'Undo',
  unlock: 'Unlock',
  user: 'User',
  users: 'Users',
  verified: 'BadgeCheck',
  warehouse: 'Warehouse',
  maximize: 'Maximize',
  minimize: 'Minimize',
  wrench: 'Wrench',
  package: 'Package',
}

export function getStatusIcon(iconName: string) {
  const lucideIconName = ICON_NAME_MAP[iconName.toLowerCase()] || iconName
  return (LucideIcons as Record<string, LucideIcons.LucideIcon>)[lucideIconName] || LucideIcons.Circle
}

export function PanelStatusOverview({
  totalPanels,
  statuses,
  hideTotal = false,
}: {
  totalPanels: number
  statuses: StatusOverviewItem[]
  hideTotal?: boolean
}) {
  return (
    <div className="flex items-start gap-8 overflow-x-auto pb-2">
      {!hideTotal && (
        <div className="flex-shrink-0 pt-1">
          <div className="text-xs text-slate-500 mb-1">Total Panels</div>
          <div className="text-2xl font-semibold text-slate-900">{totalPanels}</div>
        </div>
      )}

      {statuses.length > 0 ? (
        statuses.map((status) => {
          const panelCount = status.panelCount || 0
          const percentage = totalPanels > 0 ? Math.round((panelCount / totalPanels) * 100) : 0
          const IconComponent = getStatusIcon(status.icon)

          return (
            <div key={status.id} className="flex-shrink-0 min-w-[160px] pt-1">
              <div className="flex items-center gap-2 mb-2">
                <IconComponent className="w-5 h-5" style={{ color: status.color }} />
                <div className="text-xs text-slate-500">{status.name}</div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <div className="text-2xl font-semibold text-slate-900">{panelCount}</div>
                <div className="text-xs text-slate-500">{percentage}%</div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: status.color,
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>
          )
        })
      ) : (
        <div className="flex-1 py-8 text-center text-slate-500 text-sm">
          No status data available. Create statuses in Status Management.
        </div>
      )}
    </div>
  )
}
