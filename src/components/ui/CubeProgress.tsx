import React from 'react'

interface CubeProgressProps {
    size?: number
    duration?: number
}

export const CubeProgress = ({ size = 64, duration = 3 }: CubeProgressProps) => {
    const halfSize = size / 2

    // Slate theme colors
    const theme = {
        border: 'border-slate-400/30',
        liquid: 'bg-slate-500/80',
        liquidTop: 'bg-slate-400/90',
        shadow: 'rgba(148,163,184,0.5)'
    }

    // Dynamic styles for transforms
    const getFaceStyle = (transform: string, isBorder = true) => ({
        transform: `${transform} translateZ(${halfSize}px)`,
        width: `${size}px`,
        height: `${size}px`,
        boxShadow: isBorder ? `0 0 15px ${theme.shadow}` : 'none'
    })

    return (
        <div className="relative perspective-1000" style={{ width: size, height: size }}>
            <div className="absolute w-full h-full transform-style-3d animate-spin-slow">
                {/* Outer Wireframe Cube */}
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('')}></div>
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('rotateY(180deg)')}></div>
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('rotateY(90deg)')}></div>
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('rotateY(-90deg)')}></div>
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('rotateX(90deg)')}></div>
                <div className={`absolute border-2 backdrop-blur-sm ${theme.border}`} style={getFaceStyle('rotateX(-90deg)')}></div>

                {/* Inner Filling Liquid */}
                {/* We use a container that rotates with the cube, but the liquid inside scales */}
                <div className="absolute inset-0 transform-style-3d">
                    {/* The liquid container needs to be anchored at the bottom of the cube */}
                    {/* Cube center is (0,0,0). Bottom is at y = halfSize. */}
                    {/* We want to scale up from there. */}

                    <div className="absolute w-full h-full transform-style-3d animate-fill-up"
                        style={{
                            transformOrigin: 'bottom center',
                            // Move to bottom of cube? 
                            // Actually, since the outer cube faces are centered, the "bottom" face is at rotateX(-90deg) translateZ(halfSize).
                            // Which corresponds to Y = +halfSize in the cube's local space.
                            // So we should position this liquid block such that its bottom aligns with Y = halfSize.
                        }}>

                        {/* We construct a solid cube that represents the liquid */}
                        {/* Front */}
                        <div className={`absolute ${theme.liquid}`} style={{ ...getFaceStyle(''), border: 'none', boxShadow: 'none' }}></div>
                        {/* Back */}
                        <div className={`absolute ${theme.liquid}`} style={{ ...getFaceStyle('rotateY(180deg)'), border: 'none', boxShadow: 'none' }}></div>
                        {/* Right */}
                        <div className={`absolute ${theme.liquid}`} style={{ ...getFaceStyle('rotateY(90deg)'), border: 'none', boxShadow: 'none' }}></div>
                        {/* Left */}
                        <div className={`absolute ${theme.liquid}`} style={{ ...getFaceStyle('rotateY(-90deg)'), border: 'none', boxShadow: 'none' }}></div>
                        {/* Top - This is the surface */}
                        <div className={`absolute ${theme.liquidTop}`} style={{ ...getFaceStyle('rotateX(90deg)'), border: 'none', boxShadow: 'none' }}></div>
                        {/* Bottom */}
                        <div className={`absolute ${theme.liquid}`} style={{ ...getFaceStyle('rotateX(-90deg)'), border: 'none', boxShadow: 'none' }}></div>
                    </div>
                </div>
            </div>

            {/* Drops / Particles */}
            {/* We can add some drops falling into the cube */}
            <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
                <div className="absolute top-0 left-1/2 w-1 h-3 bg-slate-400 rounded-full animate-drop delay-0"></div>
                <div className="absolute top-[-10px] left-1/3 w-1 h-2 bg-slate-400 rounded-full animate-drop delay-700"></div>
                <div className="absolute top-[-20px] left-2/3 w-1 h-3 bg-slate-400 rounded-full animate-drop delay-300"></div>
            </div>

            <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        
        @keyframes spin-slow {
          0% { transform: rotateX(-15deg) rotateY(0deg); }
          100% { transform: rotateX(-15deg) rotateY(360deg); }
        }
        .animate-spin-slow { animation: spin-slow ${duration * 2}s infinite linear; }

        @keyframes fill-up {
          0% { transform: scaleY(0); }
          50% { transform: scaleY(1); }
          100% { transform: scaleY(0); }
        }
        .animate-fill-up { animation: fill-up ${duration}s infinite ease-in-out; }

        @keyframes drop {
            0% { transform: translateY(0); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(${size}px); opacity: 0; }
        }
        .animate-drop { animation: drop 1.5s infinite ease-in; }
        .delay-0 { animation-delay: 0ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-700 { animation-delay: 700ms; }
      `}</style>
        </div>
    )
}
