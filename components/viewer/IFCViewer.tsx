'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { RotateCcw, ZoomIn, ZoomOut, Home, Upload, Maximize2, Settings } from 'lucide-react'

// Professional IFC Viewer using That Open Engine
function ProfessionalIFCViewer({ modelUrl, projectId }: { modelUrl?: string; projectId?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Communication with the viewer iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      const { type, data } = event.data
      
      switch (type) {
        case 'VIEWER_LOADING':
          setIsLoading(true)
          setLoadingProgress(data.progress || 0)
          break
        case 'VIEWER_LOADED':
          setIsLoading(false)
          setLoadingProgress(100)
          setError(null)
          break
        case 'VIEWER_ERROR':
          setIsLoading(false)
          setError(data.message || 'Failed to load model')
          break
        case 'ELEMENT_SELECTED':
          // Handle element selection from viewer
          console.log('Element selected:', data)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const sendMessageToViewer = (type: string, data?: any) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type, data }, window.location.origin)
    }
  }

  const handleLoadModel = () => {
    if (modelUrl) {
      sendMessageToViewer('LOAD_MODEL', { url: modelUrl, projectId })
    }
  }

  const handleResetView = () => {
    sendMessageToViewer('RESET_VIEW')
  }

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!modelUrl) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-gray-100 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-lg flex items-center justify-center">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Professional 3D IFC Viewer</h3>
          <p className="text-gray-500 mb-4">
            Upload an IFC file to view your 3D model with advanced BIM features
          </p>
          <div className="text-sm text-gray-400 space-y-1">
            <div>✅ Supports files up to 5GB</div>
            <div>✅ Fragment-based loading</div>
            <div>✅ Model tree navigation</div>
            <div>✅ Element status tracking</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'}`}>
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Loading 3D Model</h3>
            <Progress value={loadingProgress} className="mb-2" />
            <p className="text-sm text-gray-600">{loadingProgress}% complete</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Alert className="max-w-md mx-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Viewer Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleResetView}
          className="bg-white/90 hover:bg-white"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleToggleFullscreen}
          className="bg-white/90 hover:bg-white"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Professional IFC Viewer Iframe */}
      <iframe
        ref={iframeRef}
        src="/viewer/index.html"
        className="w-full h-full border-0"
        title="3D IFC Model Viewer"
        onLoad={handleLoadModel}
      />
    </div>
  )
}

interface IFCViewerProps {
  modelUrl?: string
  projectId?: string
  className?: string
  onElementSelect?: (elementId: string) => void
  onModelLoad?: () => void
  onError?: (error: string) => void
}

export default function IFCViewer({ 
  modelUrl, 
  projectId,
  className = '',
  onElementSelect,
  onModelLoad,
  onError 
}: IFCViewerProps) {
  // Use the professional IFC viewer with That Open Engine integration
  return (
    <div className={className}>
      <ProfessionalIFCViewer 
        modelUrl={modelUrl} 
        projectId={projectId}
      />
    </div>
  )
}
