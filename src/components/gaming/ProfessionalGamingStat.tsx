import React from 'react'
import { cn } from '@/lib/utils'

interface ProfessionalGamingStatProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  className?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function ProfessionalGamingStat({ 
  label, 
  value, 
  icon,
  className, 
  variant = 'default',
  size = 'md',
  trend,
  trendValue
}: ProfessionalGamingStatProps) {
  const baseStyles = "relative flex flex-col items-center text-center p-4 bg-[rgba(26,31,46,0.8)] border border-[rgba(184,188,200,0.1)] rounded-lg transition-all duration-200 hover:border-[rgba(74,144,226,0.2)] hover:bg-[rgba(37,42,58,1)]"
  
  const variantStyles = {
    default: "text-[#E8EAF0]",
    primary: "text-[#4A90E2]",
    success: "text-[#50C878]",
    warning: "text-[#FFB347]",
    error: "text-[#FF6B6B]"
  }
  
  const sizeStyles = {
    sm: {
      value: "text-lg font-bold",
      label: "text-xs",
      icon: "text-lg mb-1"
    },
    md: {
      value: "text-2xl font-bold",
      label: "text-xs",
      icon: "text-xl mb-2"
    },
    lg: {
      value: "text-3xl font-bold", 
      label: "text-sm",
      icon: "text-2xl mb-2"
    }
  }
  
  const trendStyles = {
    up: "text-[#50C878]",
    down: "text-[#FF6B6B]",
    neutral: "text-[#B8BCC8]"
  }
  
  return (
    <div className={cn(baseStyles, className)}>
      {/* Icon */}
      {icon && (
        <div className={cn(
          "flex items-center justify-center",
          sizeStyles[size].icon,
          variantStyles[variant]
        )}>
          {icon}
        </div>
      )}
      
      {/* Value */}
      <div className={cn(
        sizeStyles[size].value,
        variantStyles[variant],
        "mb-1"
      )}>
        {value}
      </div>
      
      {/* Label */}
      <div className={cn(
        sizeStyles[size].label,
        "text-[#6B7280] uppercase tracking-wider font-medium"
      )}>
        {label}
      </div>
      
      {/* Trend indicator */}
      {trend && trendValue && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-xs font-medium",
          trendStyles[trend]
        )}>
          {trend === 'up' && <span>↗</span>}
          {trend === 'down' && <span>↘</span>}
          {trend === 'neutral' && <span>→</span>}
          <span>{trendValue}</span>
        </div>
      )}
      
      {/* Subtle corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#4A90E2] opacity-40" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#4A90E2] opacity-40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#4A90E2] opacity-40" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#4A90E2] opacity-40" />
    </div>
  )
}
