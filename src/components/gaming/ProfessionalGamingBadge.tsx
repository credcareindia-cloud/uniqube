import React from 'react'
import { cn } from '@/lib/utils'

interface ProfessionalGamingBadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'active' | 'completed' | 'warning' | 'error' | 'info' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function ProfessionalGamingBadge({ 
  children, 
  className, 
  variant = 'info',
  size = 'md',
  icon
}: ProfessionalGamingBadgeProps) {
  const baseStyles = "inline-flex items-center gap-1.5 font-medium border rounded-md transition-all duration-200"
  
  const variantStyles = {
    active: "bg-[rgba(80,200,120,0.15)] border-[rgba(80,200,120,0.3)] text-[#50C878]",
    completed: "bg-[rgba(74,144,226,0.15)] border-[rgba(74,144,226,0.3)] text-[#4A90E2]",
    warning: "bg-[rgba(255,179,71,0.15)] border-[rgba(255,179,71,0.3)] text-[#FFB347]",
    error: "bg-[rgba(255,107,107,0.15)] border-[rgba(255,107,107,0.3)] text-[#FF6B6B]",
    info: "bg-[rgba(74,144,226,0.15)] border-[rgba(74,144,226,0.3)] text-[#4A90E2]",
    neutral: "bg-[rgba(184,188,200,0.15)] border-[rgba(184,188,200,0.3)] text-[#B8BCC8]"
  }
  
  const sizeStyles = {
    sm: "px-2 py-1 text-xs",
    md: "px-2.5 py-1.5 text-xs",
    lg: "px-3 py-2 text-sm"
  }
  
  return (
    <span
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        "uppercase tracking-wider font-semibold",
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
