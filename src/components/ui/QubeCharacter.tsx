import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import './QubeCharacter.css'

export type QubeMood = 'idle' | 'walk' | 'happy' | 'sad' | 'cute'

const POSE: Record<QubeMood, string> = {
  idle: '/qube/idle.png',
  walk: '/qube/walk.png',
  happy: '/qube/happy.png',
  sad: '/qube/sad.png',
  cute: '/qube/cute.png',
}

const CYCLE: { mood: QubeMood; ms: number }[] = [
  { mood: 'walk', ms: 2600 },
  { mood: 'happy', ms: 1400 },
  { mood: 'walk', ms: 1800 },
  { mood: 'cute', ms: 1500 },
  { mood: 'walk', ms: 2000 },
  { mood: 'sad', ms: 1200 },
]

export const QUBE_LINES: Record<QubeMood, string> = {
  walk: 'Walking the drawings over',
  happy: 'Found the floor plan',
  cute: 'Holding your corner',
  sad: 'This one is heavy',
  idle: 'Waiting with the plan',
}

function useQubeMoment(enabled: boolean): QubeMood {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => {
      setIndex((n) => (n + 1) % CYCLE.length)
    }, CYCLE[index].ms)
    return () => window.clearTimeout(timer)
  }, [enabled, index])

  return enabled ? CYCLE[index].mood : 'idle'
}

interface QubeCharacterProps {
  mood?: QubeMood
  /** Cycle walking, happy, cute, and a short sad beat. */
  moment?: 'auto'
  size?: number
  caption?: boolean
  className?: string
}

export function QubeCharacter({
  mood: moodProp = 'idle',
  moment,
  size = 140,
  caption = false,
  className,
}: QubeCharacterProps) {
  const autoMood = useQubeMoment(moment === 'auto')
  const mood = moment === 'auto' ? autoMood : moodProp

  useEffect(() => {
    for (const src of Object.values(POSE)) {
      const image = new Image()
      image.src = src
    }
  }, [])

  return (
    <div
      className={cn('qube-wrap', className)}
      style={{ ['--qube-size' as string]: `${size}px` }}
    >
      <div className="qube" role="img" aria-label={`Qube is ${mood}`}>
        <img key={mood} src={POSE[mood]} alt="" />
      </div>
      {caption && <p className="qube-caption">{QUBE_LINES[mood]}</p>}
    </div>
  )
}
