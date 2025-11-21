/**
 * Centralized icon mapping utility
 * Maps FontAwesome/kebab-case icon names to Lucide PascalCase component names
 * Used across the application for consistent icon rendering
 */

export const iconNameMap: Record<string, string> = {
  'angle-double-down': 'ChevronsDown',
  'angle-double-left': 'ChevronsLeft',
  'angle-double-right': 'ChevronsRight',
  'angle-double-up': 'ChevronsUp',
  'angle-down': 'ChevronDown',
  'angle-left': 'ChevronLeft',
  'angle-right': 'ChevronRight',
  'angle-up': 'ChevronUp',
  'bell': 'Bell',
  'bookmark': 'Bookmark',
  'box': 'Box',
  'check': 'Check',
  'check-circle': 'CheckCircle',
  'circle': 'Circle',
  'clock': 'Clock',
  'code': 'Code',
  'cog': 'Settings',
  'exclamation': 'AlertTriangle',
  'exclamation-triangle': 'AlertTriangle',
  'eye': 'Eye',
  'file': 'File',
  'folder': 'Folder',
  'forward': 'Forward',
  'hammer': 'Hammer',
  'hashtag': 'Hash',
  'hourglass': 'Hourglass',
  'info': 'Info',
  'lightbulb': 'Lightbulb',
  'lock': 'Lock',
  'lock-open': 'LockOpen',
  'map-marker': 'MapPin',
  'minus': 'Minus',
  'pause': 'Pause',
  'pen-to-square': 'Edit',
  'phone': 'Phone',
  'play': 'Play',
  'plus': 'Plus',
  'reply': 'Reply',
  'rocket': 'Rocket',
  'save': 'Save',
  'search': 'Search',
  'send': 'Send',
  'server': 'Server',
  'share-alt': 'Share2',
  'shield': 'Shield',
  'shop': 'ShoppingBag',
  'sign-in': 'LogIn',
  'sign-out': 'LogOut',
  'sliders-h': 'SlidersHorizontal',
  'sort': 'ArrowUpDown',
  'spinner': 'Loader',
  'star': 'Star',
  'stop-circle': 'StopCircle',
  'stopwatch': 'Timer',
  'tag': 'Tag',
  'test': 'TestTube',
  'thumbs-down': 'ThumbsDown',
  'thumbs-up': 'ThumbsUp',
  'thumbtack': 'Pin',
  'th-large': 'Grid3x3',
  'ticket': 'Ticket',
  'times': 'X',
  'times-circle': 'XCircle',
  'trash': 'Trash2',
  'truck': 'Truck',
  'undo': 'Undo',
  'unlock': 'Unlock',
  'user': 'User',
  'users': 'Users',
  'verified': 'BadgeCheck',
  'warehouse': 'Warehouse',
  'maximize': 'Maximize',
  'minimize': 'Minimize',
  'wrench': 'Wrench',
  'package': 'Package',
  'zap': 'Zap',
}

/**
 * Get Lucide icon component name from kebab-case icon name
 * @param iconName - Icon name in kebab-case format (e.g., 'circle', 'thumbtack')
 * @returns Lucide component name in PascalCase (e.g., 'Circle', 'Pin')
 */
export const getLucideIconName = (iconName: string): string => {
  if (!iconName) return 'Circle'
  return iconNameMap[iconName.toLowerCase()] || iconName
}

/**
 * Get FontAwesome class name from icon name
 * @param iconName - Icon name in kebab-case format
 * @returns Icon name suitable for FontAwesome classes (e.g., 'circle' for 'fa-circle')
 */
export const getFontAwesomeIconName = (iconName: string): string => {
  if (!iconName) return 'circle'
  return iconName.toLowerCase()
}
