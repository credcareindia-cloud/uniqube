import React from 'react'
import { cn } from '@/lib/utils'

interface ProfessionalGamingButtonProps {
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
}

export function ProfessionalGamingButton({ 
  children, 
  className, 
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false
}: ProfessionalGamingButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-medium transition-all duration-200 ease-out cursor-pointer border focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:ring-opacity-50"
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-[#3A7BD5] to-[#2E5F9F] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] hover:from-[#2E5F9F] hover:to-[#3A7BD5] hover:shadow-[0_0_15px_rgba(58,123,213,0.25)]",
    secondary: "bg-[#252A3A] border-[rgba(184,188,200,0.1)] text-[#B8BCC8] hover:bg-[#1A1F2E] hover:border-[rgba(58,123,213,0.2)] hover:text-[#E8EAF0]",
    accent: "bg-gradient-to-r from-[#4A9B6B] to-[#3D7F56] border-[rgba(74,155,107,0.2)] text-[#E8EAF0] hover:shadow-[0_0_15px_rgba(74,155,107,0.25)]",
    danger: "bg-gradient-to-r from-[#C85A5A] to-[#A84848] border-[rgba(200,90,90,0.2)] text-[#E8EAF0] hover:shadow-[0_0_15px_rgba(200,90,90,0.25)]"
  }
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm rounded-md",
    md: "px-4 py-2 text-sm rounded-lg",
    lg: "px-6 py-3 text-base rounded-lg"
  }
  
  const disabledStyles = "opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none"
  
  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabled && disabledStyles,
        !disabled && "hover:-translate-y-0.5 active:translate-y-0",
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {/* Subtle glow effect */}
      {!disabled && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-10 transition-opacity duration-200" />
      )}
      
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </button>
  )
}
