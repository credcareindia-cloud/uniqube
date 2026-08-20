'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (groupData: {
    name: string
    description: string
    type: string
    color: string
  }) => Promise<void>
}

const GROUP_TYPES = [
  { value: 'CUSTOM', label: 'Custom Group' },
  { value: 'STOREY', label: 'Storey/Floor' },
  { value: 'SYSTEM', label: 'System Group' },
  { value: 'ZONE', label: 'Zone/Area' },
  { value: 'PHASE', label: 'Construction Phase' }
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

// Helper function to convert Hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function CreateGroupModal({ isOpen, onClose, onSubmit }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('CUSTOM')
  const [color, setColor] = useState('#3B82F6')
  const [currentHue, setCurrentHue] = useState(217)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ x: 50, y: 50 })
  const [isDraggingPicker, setIsDraggingPicker] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const gradientRef = useRef<HTMLDivElement>(null)
  const hueSliderRef = useRef<HTMLDivElement>(null)

  // Update hue when color changes
  useEffect(() => {
    if (color && color.match(/^#[0-9A-F]{6}$/i)) {
      const hsl = hexToHSL(color)
      setCurrentHue(hsl.h)
      setPickerPosition({ x: hsl.s, y: 100 - hsl.l })
    }
  }, [color])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Group name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        type,
        color
      })

      // Reset form
      setName('')
      setDescription('')
      setType('CUSTOM')
      setColor('#3B82F6')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setDescription('')
      setType('CUSTOM')
      setColor('#3B82F6')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={handleClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Create New Group
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2 ">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
              disabled={isSubmitting}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2 ">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter group description"
              rows={3}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none resize-none"
              disabled={isSubmitting}
              maxLength={500}
            />
          </div>

          {/* Color Picker */}
          <div className="relative" ref={colorPickerRef}>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Color
            </label>
            <div className="flex items-center gap-3">
              {/* Color Preview Button */}
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-lg border-2 border-slate-300 hover:border-slate-400 transition-all disabled:opacity-50"
                style={{ backgroundColor: color }}
              />

              {/* Hex Input */}
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none font-mono"
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
                    ref={gradientRef}
                    className="w-64 h-48 rounded-lg cursor-crosshair relative overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(to bottom, transparent, black),
                        linear-gradient(to right, white, hsl(${currentHue}, 100%, 50%))
                      `
                    }}
                    onMouseDown={(e) => {
                      setIsDraggingPicker(true)
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100))
                      const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100))
                      setPickerPosition({ x: xPercent, y: yPercent })
                      const saturation = Math.round(xPercent)
                      const lightness = Math.round(100 - yPercent)
                      const hex = hslToHex(currentHue, saturation, lightness)
                      setColor(hex)
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingPicker) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100))
                      const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100))
                      setPickerPosition({ x: xPercent, y: yPercent })
                      const saturation = Math.round(xPercent)
                      const lightness = Math.round(100 - yPercent)
                      const hex = hslToHex(currentHue, saturation, lightness)
                      setColor(hex)
                    }}
                    onMouseUp={() => setIsDraggingPicker(false)}
                    onMouseLeave={() => setIsDraggingPicker(false)}
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
                    ref={hueSliderRef}
                    className="w-full h-4 rounded-lg cursor-pointer relative"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                    }}
                    onMouseDown={(e) => {
                      setIsDraggingHue(true)
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const hue = Math.round((x / rect.width) * 360)
                      setCurrentHue(hue)
                      const hsl = hexToHSL(color)
                      const hex = hslToHex(hue, hsl.s, hsl.l)
                      setColor(hex)
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingHue) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const hue = Math.max(0, Math.min(360, Math.round((x / rect.width) * 360)))
                      setCurrentHue(hue)
                      const hsl = hexToHSL(color)
                      const hex = hslToHex(hue, hsl.s, hsl.l)
                      setColor(hex)
                    }}
                    onMouseUp={() => setIsDraggingHue(false)}
                    onMouseLeave={() => setIsDraggingHue(false)}
                  >
                    {/* Hue indicator */}
                    <div
                      className="absolute w-1 h-full bg-white border border-slate-800 pointer-events-none"
                      style={{
                        left: `${(currentHue / 360) * 100}%`,
                        transform: 'translateX(-50%)'
                      }}
                    />
                  </div>
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
                      className={`w-full h-8 rounded-lg border-2 transition-all hover:scale-110 ${color === presetColor
                          ? 'border-white ring-2 ring-slate-700'
                          : 'border-[rgba(58,123,213,0.3)]'
                        }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preview
          <div className="p-4 bg-white rounded-lg border border-[rgba(58,123,213,0.1)]">
            <p className="text-xs text-slate-600 mb-2 ">Preview</p>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-50 border border-[rgba(58,123,213,0.3)]">
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-slate-900 font-semibold">{name || 'Group Name'}</p>
                {description && (
                  <p className="text-slate-600 text-sm">{description}</p>
                )}
                <p className="text-slate-600 text-xs mt-1">
                  {GROUP_TYPES.find(t => t.value === type)?.label}
                </p>
              </div>
            </div>
          </div> */}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2 uq-btn rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
