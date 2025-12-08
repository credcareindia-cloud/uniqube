import React from 'react'
import { Cube } from './Cube'

interface CubeLoaderProps {
  text?: string
}

export const CubeLoader = ({ text = 'LOADING PROJECTS' }: CubeLoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[600px]">
      <Cube size={64} color="slate" />

      <div className="mt-12 text-center">
        <h3 className="text-xl font-bold text-slate-700 tracking-wider">{text}</h3>
        <div className="flex gap-1 justify-center mt-2">
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-0"></div>
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
        </div>
      </div>
      <style>{`
        .delay-0 { animation-delay: 0ms; }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  )
}
