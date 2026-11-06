import { cn } from '@/lib/utils'
import './QubeCharacter.css'

export type QubeMood = 'idle' | 'walk' | 'happy' | 'sad' | 'cute'

const QUBE_ANIM = '/qube/qube.webp'
const QUBE_GIF = '/qube/qube.gif'
const QUBE_STILL = '/qube/qube-still.webp'

export const QUBE_LINES: Record<QubeMood, string> = {
  walk: 'Walking the drawings over',
  happy: 'Found the floor plan',
  cute: 'Holding your corner',
  sad: 'This one is heavy',
  idle: 'Loading…',
}

interface QubeCharacterProps {
  mood?: QubeMood
  /** Same character, used on loading screens. */
  moment?: 'auto'
  size?: number
  caption?: boolean
  className?: string
}

export function QubeCharacter({
  mood = 'idle',
  moment,
  size = 140,
  caption = false,
  className,
}: QubeCharacterProps) {
  const lineMood = moment === 'auto' ? 'idle' : mood

  return (
    <div
      className={cn('qube-wrap', className)}
      style={{ ['--qube-size' as string]: `${size}px` }}
    >
      <div className="qube" role="img" aria-label="Qube">
        <picture>
          <source srcSet={QUBE_STILL} type="image/webp" media="(prefers-reduced-motion: reduce)" />
          <source srcSet={QUBE_ANIM} type="image/webp" />
          <img
            className="qube-pose"
            src={QUBE_GIF}
            alt=""
            width={size}
            height={size}
            decoding="async"
            draggable={false}
          />
        </picture>
      </div>
      {caption && <p className="qube-caption">{QUBE_LINES[lineMood]}</p>}
    </div>
  )
}
