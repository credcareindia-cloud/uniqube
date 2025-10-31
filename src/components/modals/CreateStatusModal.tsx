'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface CreateStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (statusData: {
    name: string
    icon: string
    color: string
    description?: string
  }) => Promise<void>
  projectId: number
}

import * as LucideIcons from 'lucide-react'

const ICON_OPTIONS = [
  { value: 'angle-double-down', label: 'Angle Double Down', icon: 'ChevronsDown' },
  { value: 'angle-double-left', label: 'Angle Double Left', icon: 'ChevronsLeft' },
  { value: 'angle-double-right', label: 'Angle Double Right', icon: 'ChevronsRight' },
  { value: 'angle-double-up', label: 'Angle Double Up', icon: 'ChevronsUp' },
  { value: 'angle-down', label: 'Angle Down', icon: 'ChevronDown' },
  { value: 'angle-left', label: 'Angle Left', icon: 'ChevronLeft' },
  { value: 'angle-right', label: 'Angle Right', icon: 'ChevronRight' },
  { value: 'angle-up', label: 'Angle Up', icon: 'ChevronUp' },
  { value: 'bell', label: 'Bell', icon: 'Bell' },
  { value: 'bookmark', label: 'Bookmark', icon: 'Bookmark' },
  { value: 'box', label: 'Box', icon: 'Box' },
  { value: 'check', label: 'Check', icon: 'Check' },
  { value: 'circle', label: 'Circle', icon: 'Circle' },
  { value: 'clock', label: 'Clock', icon: 'Clock' },
  { value: 'code', label: 'Code', icon: 'Code' },
  { value: 'exclamation', label: 'Exclamation', icon: 'AlertTriangle' },
  { value: 'eye', label: 'Eye', icon: 'Eye' },
  { value: 'file', label: 'File', icon: 'File' },
  { value: 'folder', label: 'Folder', icon: 'Folder' },
  { value: 'forward', label: 'Forward', icon: 'Forward' },
  { value: 'hashtag', label: 'Hashtag', icon: 'Hash' },
  { value: 'info', label: 'Info', icon: 'Info' },
  { value: 'lightbulb', label: 'Lightbulb', icon: 'Lightbulb' },
  { value: 'lock', label: 'Lock', icon: 'Lock' },
  { value: 'lock-open', label: 'Lock Open', icon: 'LockOpen' },
  { value: 'map-marker', label: 'Map Marker', icon: 'MapPin' },
  { value: 'minus', label: 'Minus', icon: 'Minus' },
  { value: 'pause', label: 'Pause', icon: 'Pause' },
  { value: 'pen-to-square', label: 'Pen To Square', icon: 'Edit' },
  { value: 'phone', label: 'Phone', icon: 'Phone' },
  { value: 'play', label: 'Play', icon: 'Play' },
  { value: 'plus', label: 'Plus', icon: 'Plus' },
  { value: 'reply', label: 'Reply', icon: 'Reply' },
  { value: 'save', label: 'Save', icon: 'Save' },
  { value: 'search', label: 'Search', icon: 'Search' },
  { value: 'send', label: 'Send', icon: 'Send' },
  { value: 'server', label: 'Server', icon: 'Server' },
  { value: 'share-alt', label: 'Share Alt', icon: 'Share2' },
  { value: 'shield', label: 'Shield', icon: 'Shield' },
  { value: 'shop', label: 'Shop', icon: 'ShoppingBag' },
  { value: 'sign-in', label: 'Sign In', icon: 'LogIn' },
  { value: 'sign-out', label: 'Sign Out', icon: 'LogOut' },
  { value: 'sliders-h', label: 'Sliders Horizontal', icon: 'SlidersHorizontal' },
  { value: 'sort', label: 'Sort', icon: 'ArrowUpDown' },
  { value: 'spinner', label: 'Spinner', icon: 'Loader' },
  { value: 'star', label: 'Star', icon: 'Star' },
  { value: 'stop-circle', label: 'Stop Circle', icon: 'StopCircle' },
  { value: 'stopwatch', label: 'Stopwatch', icon: 'Timer' },
  { value: 'tag', label: 'Tag', icon: 'Tag' },
  { value: 'thumbs-down', label: 'Thumbs Down', icon: 'ThumbsDown' },
  { value: 'thumbs-up', label: 'Thumbs Up', icon: 'ThumbsUp' },
  { value: 'thumbtack', label: 'Thumbtack', icon: 'Pin' },
  { value: 'th-large', label: 'Th Large', icon: 'Grid3x3' },
  { value: 'ticket', label: 'Ticket', icon: 'Ticket' },
  { value: 'times', label: 'Times', icon: 'X' },
  { value: 'times-circle', label: 'Times Circle', icon: 'XCircle' },
  { value: 'trash', label: 'Trash', icon: 'Trash2' },
  { value: 'truck', label: 'Truck', icon: 'Truck' },
  { value: 'undo', label: 'Undo', icon: 'Undo' },
  { value: 'unlock', label: 'Unlock', icon: 'Unlock' },
  { value: 'user', label: 'User', icon: 'User' },
  { value: 'users', label: 'Users', icon: 'Users' },
  { value: 'verified', label: 'Verified', icon: 'BadgeCheck' },
  { value: 'warehouse', label: 'Warehouse', icon: 'Warehouse' },
  { value: 'maximize', label: 'Maximize', icon: 'Maximize' },
  { value: 'minimize', label: 'Minimize', icon: 'Minimize' },
  { value: 'wrench', label: 'Wrench', icon: 'Wrench' },
  { value: 'package', label: 'Package', icon: 'Package' },
]

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7'  // Violet
]

// Helper function to convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = s * Math.min(l, 1 - l) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function CreateStatusModal({ isOpen, onClose, onSubmit }: CreateStatusModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('circle')
  const [color, setColor] = useState('#3B82F6')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showIconDropdown, setShowIconDropdown] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 50, y: 50 })
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  
  // Get the icon component
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName]
    return IconComponent || LucideIcons.Circle
  }
  
  // Filter icons based on search
  const filteredIcons = ICON_OPTIONS.filter(option =>
    option.label.toLowerCase().includes(iconSearch.toLowerCase())
  )
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowIconDropdown(false)
        setIconSearch('')
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }
    
    if (showIconDropdown || showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showIconDropdown, showColorPicker])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Status name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit({
        name: name.trim(),
        icon,
        color,
        description: description.trim() || undefined
      })
      
      // Reset form
      setName('')
      setIcon('circle')
      setColor('#3B82F6')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setIcon('circle')
      setColor('#3B82F6')
      setDescription('')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">
            Create New Status
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-[#B8BCC8] hover:text-[#E8EAF0] transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status Name */}
          <div>
            <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
              Status Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter status name"
              className="w-full px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none"
              disabled={isSubmitting}
              maxLength={50}
            />
          </div>

          {/* Icon Selector */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
              Icon
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconDropdown(!showIconDropdown)}
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] focus:border-[#3A7BD5] focus:outline-none flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const selectedIcon = ICON_OPTIONS.find(o => o.value === icon)
                    const IconComponent = getIconComponent(selectedIcon?.icon || 'Circle')
                    return (
                      <>
                        <IconComponent className="w-4 h-4" />
                        <span>{selectedIcon?.label || 'Select an icon'}</span>
                      </>
                    )
                  })()}
                </div>
                <LucideIcons.ChevronDown className="w-4 h-4" />
              </button>
              
              {showIconDropdown && !isSubmitting && (
                <div className="absolute z-10 w-full mt-1 bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg shadow-lg max-h-64 overflow-hidden">
                  {/* Search Input */}
                  <div className="p-2 border-b border-[rgba(58,123,213,0.2)]">
                    <div className="relative">
                      <LucideIcons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#B8BCC8]" />
                      <input
                        type="text"
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full pl-10 pr-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Icon List */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredIcons.map((option) => {
                      const IconComponent = getIconComponent(option.icon)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setIcon(option.value)
                            setShowIconDropdown(false)
                            setIconSearch('')
                          }}
                          className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-[rgba(58,123,213,0.1)] transition-colors ${
                            icon === option.value ? 'bg-[rgba(58,123,213,0.2)]' : ''
                          }`}
                        >
                          <IconComponent className="w-4 h-4 text-[#E8EAF0]" />
                          <span className="text-[#E8EAF0] text-sm">{option.label}</span>
                        </button>
                      )
                    })}
                    {filteredIcons.length === 0 && (
                      <div className="px-4 py-8 text-center text-[#B8BCC8] text-sm">
                        No icons found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Color Picker */}
          <div className="relative" ref={colorPickerRef}>
            <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
              Color
            </label>
            <div className="flex items-center gap-3">
              {/* Color Preview Button */}
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-lg border-2 border-[rgba(58,123,213,0.3)] hover:border-[rgba(58,123,213,0.5)] transition-all disabled:opacity-50"
                style={{ backgroundColor: color }}
              />
              
              {/* Hex Input */}
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1 px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none font-mono"
                disabled={isSubmitting}
                maxLength={7}
              />
            </div>
            
            {/* Color Picker Dropdown */}
            {showColorPicker && !isSubmitting && (
              <div className="absolute z-10 mt-2 p-4 bg-[#1A1F2E] border border-[rgba(58,123,213,0.3)] rounded-lg shadow-lg">
                {/* Gradient Picker */}
                <div className="mb-4">
                  <div 
                    className="w-64 h-48 rounded-lg cursor-crosshair relative overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${Math.round((PRESET_COLORS.indexOf(color) / PRESET_COLORS.length) * 360)}, 100%, 50%))
                      `
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      const xPercent = (x / rect.width) * 100
                      const yPercent = (y / rect.height) * 100
                      setPickerPosition({ x: xPercent, y: yPercent })
                      
                      const saturation = Math.round(xPercent)
                      const lightness = Math.round(100 - yPercent)
                      // Simple HSL to Hex conversion approximation
                      const hue = Math.round((PRESET_COLORS.indexOf(color) / PRESET_COLORS.length) * 360)
                      const hex = hslToHex(hue, saturation, lightness)
                      setColor(hex)
                    }}
                  >
                    <div className="absolute inset-0 rounded-lg" style={{
                      background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,1))'
                    }} />
                    
                    {/* Color Position Indicator */}
                    <div 
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
                      style={{
                        left: `${pickerPosition.x}%`,
                        top: `${pickerPosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    />
                  </div>
                </div>
                
                {/* Hue Slider */}
                <div className="mb-4">
                  <div 
                    className="w-full h-4 rounded-lg cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const hue = Math.round((x / rect.width) * 360)
                      const hex = hslToHex(hue, 100, 50)
                      setColor(hex)
                    }}
                  />
                </div>
                
                {/* Preset Colors */}
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => {
                        setColor(presetColor)
                        setShowColorPicker(false)
                      }}
                      className={`w-full h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                        color === presetColor 
                          ? 'border-white ring-2 ring-[#3A7BD5]' 
                          : 'border-[rgba(58,123,213,0.3)]'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter status description"
              rows={3}
              className="w-full px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#B8BCC8] focus:border-[#3A7BD5] focus:outline-none resize-none"
              disabled={isSubmitting}
              maxLength={200}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.1)]">
            <p className="text-xs text-[#B8BCC8] mb-2 uppercase tracking-wider">Preview</p>
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
              >
                {(() => {
                  const selectedIcon = ICON_OPTIONS.find(o => o.value === icon)
                  const IconComponent = getIconComponent(selectedIcon?.icon || 'Circle')
                  return <IconComponent className="w-6 h-6" style={{ color }} />
                })()}
              </div>
              <div>
                <p className="text-[#E8EAF0] font-semibold">{name || 'Status Name'}</p>
                {description && (
                  <p className="text-[#B8BCC8] text-sm">{description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-[rgba(37,42,58,0.6)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] hover:bg-[rgba(58,123,213,0.1)] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
