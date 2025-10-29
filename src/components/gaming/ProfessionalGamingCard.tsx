import React from 'react'
import { cn } from '@/lib/utils'

interface ProfessionalGamingCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'monitor' | 'stat' | 'panel'
  glowEffect?: boolean
}

export function ProfessionalGamingCard({ 
  children, 
  className, 
  variant = 'default',
  glowEffect = false 
}: ProfessionalGamingCardProps) {
  const baseStyles = "relative overflow-hidden transition-all duration-300 ease-out"
  
  const variantStyles = {
    default: "bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg backdrop-blur-sm",
    monitor: "bg-[rgba(15,20,25,0.95)] border border-[rgba(74,144,226,0.2)] rounded-xl backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
    stat: "bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg text-center",
    panel: "bg-[rgba(15,20,25,0.95)] border border-[rgba(184,188,200,0.1)] rounded-xl backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
  }
  
  const hoverStyles = {
    default: "hover:border-[rgba(74,144,226,0.2)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.3)] hover:-translate-y-0.5",
    monitor: "hover:border-[rgba(74,144,226,0.4)] hover:shadow-[0_0_20px_rgba(74,144,226,0.3)]",
    stat: "hover:border-[rgba(74,144,226,0.2)] hover:bg-[rgba(37,42,58,1)]",
    panel: "hover:border-[rgba(74,144,226,0.2)] hover:shadow-[0_0_20px_rgba(74,144,226,0.3)]"
  }
  
  return (
    <div 
      className={cn(
        baseStyles,
        variantStyles[variant],
        hoverStyles[variant],
        glowEffect && "shadow-[0_0_20px_rgba(74,144,226,0.3)]",
        className
      )}
    >
      {/* Subtle corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#4A90E2] opacity-60" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#4A90E2] opacity-60" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#4A90E2] opacity-60" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#4A90E2] opacity-60" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
