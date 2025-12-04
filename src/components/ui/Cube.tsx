import React from 'react'

interface CubeProps {
    size?: number
    color?: 'slate' | 'blue'
    className?: string
}

export const Cube = ({ size = 64, color = 'slate', className = '' }: CubeProps) => {
    const halfSize = size / 2

    const colors = {
        slate: {
            bg: 'bg-slate-500/20',
            border: 'border-slate-400/80',
            core: 'bg-slate-400/80',
            shadow: 'rgba(148,163,184,0.5)'
        },
        blue: {
            bg: 'bg-blue-500/20',
            border: 'border-blue-400/80',
            core: 'bg-blue-400/80',
            shadow: 'rgba(59,130,246,0.5)'
        }
    }

    const theme = colors[color]

    // Dynamic styles for transforms
    const getFaceStyle = (transform: string) => ({
        transform: `${transform} translateZ(${halfSize}px)`,
        width: `${size}px`,
        height: `${size}px`,
        boxShadow: `0 0 15px ${theme.shadow}`
    })

    return (
        <div className={`relative perspective-1000 ${className}`} style={{ width: size, height: size }}>
            <div className="absolute w-full h-full transform-style-3d animate-spin-3d">
                {/* Front */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('')}></div>
                {/* Back */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('rotateY(180deg)')}></div>
                {/* Right */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('rotateY(90deg)')}></div>
                {/* Left */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('rotateY(-90deg)')}></div>
                {/* Top */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('rotateX(90deg)')}></div>
                {/* Bottom */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.bg} ${theme.border}`}
                    style={getFaceStyle('rotateX(-90deg)')}></div>

                {/* Inner Cube (Core) */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${theme.core} animate-pulse`}
                    style={{
                        width: size / 2,
                        height: size / 2,
                        boxShadow: `0 0 20px ${theme.shadow}`
                    }}></div>
            </div>

            <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        @keyframes spin-3d {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        .animate-spin-3d { animation: spin-3d 3s infinite linear; }
      `}</style>
        </div>
    )
}
