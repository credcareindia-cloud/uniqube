import React, { useEffect, useRef } from 'react'

export function GamingBackground() {
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const createParticle = () => {
      if (!particlesRef.current) return

      const particle = document.createElement('div')
      particle.className = 'particle'
      
      // Random starting position
      particle.style.left = Math.random() * 100 + '%'
      particle.style.animationDelay = Math.random() * 6 + 's'
      particle.style.animationDuration = (6 + Math.random() * 4) + 's'
      
      // Random color
      const colors = ['#00ffff', '#bf00ff', '#00ff41', '#0080ff', '#ff8000']
      particle.style.background = colors[Math.floor(Math.random() * colors.length)]
      
      particlesRef.current.appendChild(particle)
      
      // Remove particle after animation
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle)
        }
      }, 10000)
    }

    // Create initial particles
    for (let i = 0; i < 20; i++) {
      setTimeout(() => createParticle(), i * 300)
    }

    // Continue creating particles
    const interval = setInterval(createParticle, 800)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="gaming-bg" />
      <div ref={particlesRef} className="particles" />
    </>
  )
}

export function GamingCard({ 
  children, 
  className = '', 
  glow = false 
}: { 
  children: React.ReactNode
  className?: string
  glow?: boolean 
}) {
  return (
    <div className={`gaming-card ${glow ? 'glow' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function GamingButton({ 
  children, 
  onClick, 
  variant = 'primary',
  className = '',
  disabled = false
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  className?: string
  disabled?: boolean
}) {
  const getVariantClass = () => {
    switch (variant) {
      case 'secondary': return 'secondary'
      case 'success': return 'success'
      case 'warning': return 'warning'
      case 'danger': return 'danger'
      default: return ''
    }
  }

  return (
    <button 
      className={`gaming-btn ${getVariantClass()} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function GamingProgress({ 
  value, 
  max = 100, 
  className = '' 
}: { 
  value: number
  max?: number
  className?: string 
}) {
  const percentage = Math.min((value / max) * 100, 100)
  
  return (
    <div className={`gaming-progress ${className}`}>
      <div 
        className="gaming-progress-fill"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function GamingStat({ 
  value, 
  label, 
  color = 'cyan',
  className = '' 
}: {
  value: string | number
  label: string
  color?: 'cyan' | 'purple' | 'green' | 'orange' | 'pink'
  className?: string
}) {
  const getColorClass = () => {
    switch (color) {
      case 'purple': return 'text-purple-400'
      case 'green': return 'text-green-400'
      case 'orange': return 'text-orange-400'
      case 'pink': return 'text-pink-400'
      default: return 'text-cyan-400'
    }
  }

  return (
    <div className={`gaming-stat ${className}`}>
      <div className={`gaming-stat-value ${getColorClass()}`}>
        {value}
      </div>
      <div className="gaming-stat-label">
        {label}
      </div>
    </div>
  )
}

export function GamingBadge({ 
  children, 
  variant = 'active',
  className = '' 
}: {
  children: React.ReactNode
  variant?: 'active' | 'warning' | 'danger' | 'info'
  className?: string
}) {
  return (
    <span className={`gaming-badge ${variant} ${className}`}>
      {children}
    </span>
  )
}
