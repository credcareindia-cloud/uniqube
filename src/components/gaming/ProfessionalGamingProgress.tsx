import React from 'react'
import { cn } from '@/lib/utils'

interface ProfessionalGamingProgressProps {
  value: number
  max?: number
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  animated?: boolean
}

export function ProfessionalGamingProgress({ 
  value, 
  max = 100,
  className, 
  variant = 'default',
  size = 'md',
  showValue = false,
  animated = true
}: ProfessionalGamingProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  
  const baseStyles = "relative overflow-hidden rounded-full bg-[#252A3A]"
  
  const sizeStyles = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4"
  }
  
  const variantStyles = {
    default: "from-[#3A7BD5] to-[#2E5F9F]",
    success: "from-[#4A9B6B] to-[#3D7F56]", 
    warning: "from-[#D4A574] to-[#B8935F]",
    error: "from-[#C85A5A] to-[#A84848]"
  }
  
  return (
    <div className={cn("w-full", className)}>
      <div className={cn(baseStyles, sizeStyles[size])}>
        {/* Progress bar */}
        <div 
          className={cn(
            "h-full bg-gradient-to-r transition-all duration-500 ease-out rounded-full relative",
            variantStyles[variant]
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse" />
          )}
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full shadow-[0_0_6px_rgba(58,123,213,0.3)]" />
        </div>
        
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] bg-[length:20px_100%]" />
        </div>
      </div>
      
      {/* Value display */}
      {showValue && (
        <div className="flex justify-between items-center mt-1 text-xs">
          <span className="text-[#B8BCC8]">{value}</span>
          <span className="text-[#6B7280]">{max}</span>
        </div>
      )}
    </div>
  )
}
