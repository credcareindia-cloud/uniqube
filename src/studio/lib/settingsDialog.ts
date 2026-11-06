import { useEffect, useState } from 'react'

export const SETTINGS_STEPS = ['Project', 'Building', 'Systems', 'Required inputs', 'Rates'] as const

const STEP_FIELDS: string[][] = [
  ['name', 'type', 'client', 'location', 'currency', 'unit', 'validity'],
  ['levels', 'gfa'],
  ['systems'],
  ['doorHeight', 'windowHeight', 'plinth', 'soil', 'lineLoad', 'cooling'],
  ['margin', 'external', 'internal'],
]

type Listener = (open: boolean, field: string | null) => void

let open = false
let field: string | null = null
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(open, field))
}

export function stepForField(id: string | null) {
  if (!id) return 0
  const index = STEP_FIELDS.findIndex((group) => group.includes(id))
  return index < 0 ? 0 : index
}

/** Which Settings field a missing-value message is asking for. */
export function settingsFieldFor(text: string): string | null {
  const value = text.toLowerCase()
  if (value.includes('door height')) return 'doorHeight'
  if (value.includes('window height')) return 'windowHeight'
  if (value.includes('plinth')) return 'plinth'
  if (value.includes('soil bearing') || value.includes('soil')) return 'soil'
  if (value.includes('line load')) return 'lineLoad'
  if (value.includes('cooling') || value.includes('w/m²') || value.includes('w/m2')) return 'cooling'
  if (value.includes('number of levels') || value.includes('storey') || value.includes('storeys')) return 'levels'
  if (value.includes('client')) return 'client'
  if (value.includes('location')) return 'location'
  if (value.includes('currency')) return 'currency'
  if (value.includes('gross floor') || value.includes('gfa') || value.includes('floor area')) return 'gfa'
  if (value.includes('margin')) return 'margin'
  return null
}

export function openSettings(nextField?: string | null) {
  field = nextField ?? null
  open = true
  emit()
}

export function closeSettings() {
  open = false
  field = null
  emit()
}

export function useSettingsDialog() {
  const [state, setState] = useState({ open, field })
  useEffect(() => {
    const listener: Listener = (isOpen, nextField) => setState({ open: isOpen, field: nextField })
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return state
}
