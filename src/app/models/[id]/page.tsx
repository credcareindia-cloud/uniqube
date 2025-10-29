import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft,
  Package,
  Download,
  ExternalLink,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  Settings
} from 'lucide-react'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { ProfessionalGamingStat } from '@/components/gaming/ProfessionalGamingStat'
import { ProfessionalGamingBadge } from '@/components/gaming/ProfessionalGamingBadge'

interface Model {
  id: string
  originalFilename: string
  type: string
  status: string
  sizeBytes: number
  processingProgress: number
  errorMessage?: string
  downloadUrl?: string
  spatialStructure?: any
  elementCount?: number
  version: number
  isActive: boolean
  project: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
}

// Status configuration for badges
const statusConfig = {
  'UPLOADED': { label: 'Uploaded', variant: 'neutral' as const, icon: Package, color: '#8B5CF6' },
  'PROCESSING': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'READY': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'FAILED': { label: 'Failed', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  'ready': { label: 'Ready', variant: 'completed' as const, icon: CheckCircle, color: '#10B981' },
  'processing': { label: 'Processing', variant: 'warning' as const, icon: Clock, color: '#F59E0B' },
  'error': { label: 'Error', variant: 'warning' as const, icon: AlertCircle, color: '#EF4444' },
  'uploaded': { label: 'Uploaded', variant: 'neutral' as const, icon: Package, color: '#8B5CF6' }
}

const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || statusConfig['error']
}

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const modelId = id as string
  
  const [model, setModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  useEffect(() => {
    if (modelId) {
      loadModel()
    }
  }, [modelId])

  const loadModel = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`http://localhost:4000/api/models/${modelId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.statusText}`)
      }
      
      const data = await response.json()
      setModel(data.model)
    } catch (err) {
      console.error('Error loading model:', err)
      setError(err instanceof Error ? err.message : 'Failed to load model')
    } finally {
      setLoading(false)
    }
  }

  const openViewer = () => {
    if (model) {
      const viewerUrl = `http://localhost:3001/?model=${model.id}`
      window.open(viewerUrl, '_blank')
    }
  }

  const openEmbeddedViewer = () => {
    if (model) {
      const embeddedUrl = `http://localhost:3001/?model=${model.id}&embed=true`
      setViewerUrl(embeddedUrl)
    }
  }

  const downloadModel = () => {
    if (model?.downloadUrl) {
      const link = document.createElement('a')
      link.href = model.downloadUrl
      link.download = model.originalFilename
      link.click()
    }
  }

  const copyViewerUrl = () => {
    if (model) {
      const url = `http://localhost:3001/?model=${model.id}`
      navigator.clipboard.writeText(url)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#3A7BD5] mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-[#E8EAF0]">Loading 3D Model...</h2>
          <p className="text-[#B8BCC8] mt-2">Fetching model details</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full">
        <ProfessionalGamingCard variant="panel" className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div>
              <h2 className="text-xl font-bold text-[#E8EAF0] mb-2">ERROR LOADING MODEL</h2>
              <p className="text-[#B8BCC8] mb-4">{error}</p>
              <ProfessionalGamingButton 
                onClick={() => navigate('/projects')} 
                variant="primary"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO PROJECTS
              </ProfessionalGamingButton>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="w-full h-full">
        <ProfessionalGamingCard variant="panel" className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <Package className="h-12 w-12 text-[#B8BCC8]" />
            <div>
              <h2 className="text-xl font-bold text-[#E8EAF0] mb-2">MODEL NOT FOUND</h2>
              <p className="text-[#B8BCC8] mb-4">The requested model could not be found.</p>
              <ProfessionalGamingButton 
                onClick={() => navigate('/projects')} 
                variant="primary"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                BACK TO PROJECTS
              </ProfessionalGamingButton>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Professional Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
        <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
          <div className="flex items-center gap-6 mb-4">
            <ProfessionalGamingButton 
              onClick={() => navigate(`/projects/${model.project.id}`)} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              BACK TO PROJECT
            </ProfessionalGamingButton>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] rounded-xl blur-md opacity-60"></div>
                <div className="relative p-4 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-2xl">
                  <Package className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E8EAF0] to-[#3A7BD5] uppercase tracking-wider">
                  {model.originalFilename}
                </h1>
                <p className="text-[#B8BCC8] text-base mt-1">
                  Model ID: <span className="font-mono text-sm">{model.id}</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <ProfessionalGamingBadge variant={getStatusConfig(model.status).variant}>
                {getStatusConfig(model.status).label.toUpperCase()}
              </ProfessionalGamingBadge>
              <div className="text-sm text-[#B8BCC8]">
                Project: {model.project.name}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(model.status === 'READY' || model.status === 'ready') && (
                <>
                  <ProfessionalGamingButton 
                    variant="primary" 
                    onClick={openViewer}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    LAUNCH 3D VIEWER
                  </ProfessionalGamingButton>
                  <ProfessionalGamingButton 
                    variant="secondary" 
                    onClick={openEmbeddedViewer}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    EMBED VIEWER
                  </ProfessionalGamingButton>
                </>
              )}
              <ProfessionalGamingButton variant="secondary" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                SETTINGS
              </ProfessionalGamingButton>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Model Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ProfessionalGamingStat
          label="File Type"
          value={model.type.toUpperCase()}
          variant="primary"
          icon={<FileText className="h-5 w-5" />}
        />
        <ProfessionalGamingStat
          label="File Size"
          value={formatFileSize(model.sizeBytes)}
          variant="primary"
          icon={<Package className="h-5 w-5" />}
        />
        <ProfessionalGamingStat
          label="Status"
          value={getStatusConfig(model.status).label}
          variant={model.status === 'READY' || model.status === 'ready' ? 'success' : 'warning'}
          icon={React.createElement(getStatusConfig(model.status).icon, { className: "h-5 w-5" })}
        />
        <ProfessionalGamingStat
          label="Progress"
          value={`${model.processingProgress}%`}
          variant={model.processingProgress === 100 ? 'success' : 'warning'}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Embedded Viewer */}
      {viewerUrl && (
        <ProfessionalGamingCard variant="panel" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#E8EAF0] flex items-center gap-2 uppercase tracking-wider">
              <Eye className="h-6 w-6 text-[#3A7BD5]" />
              3D MODEL VIEWER
            </h2>
            <ProfessionalGamingButton
              onClick={() => setViewerUrl(null)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              ✕ CLOSE
            </ProfessionalGamingButton>
          </div>
          <div className="bg-[rgba(26,31,46,0.8)] rounded-lg overflow-hidden border border-[rgba(58,123,213,0.2)]">
            <iframe
              src={viewerUrl}
              className="w-full h-[600px] border-0"
              title="3D Model Viewer"
              allow="fullscreen"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <ProfessionalGamingButton
              onClick={() => window.open(viewerUrl, '_blank')}
              size="sm"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              OPEN IN NEW TAB
            </ProfessionalGamingButton>
            <ProfessionalGamingButton
              onClick={() => navigator.clipboard.writeText(viewerUrl)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              COPY URL
            </ProfessionalGamingButton>
          </div>
        </ProfessionalGamingCard>
      )}

      {/* Model Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfessionalGamingCard variant="panel" className="p-6">
          <h2 className="text-xl font-bold text-[#E8EAF0] mb-4 flex items-center gap-2 uppercase tracking-wider">
            <FileText className="h-5 w-5 text-[#3A7BD5]" />
            MODEL INFORMATION
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Original Filename</label>
              <p className="text-[#E8EAF0] font-semibold">{model.originalFilename}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Project</label>
              <p className="text-[#E8EAF0]">{model.project.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">File Type</label>
              <p className="text-[#E8EAF0]">{model.type.toUpperCase()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">File Size</label>
              <p className="text-[#E8EAF0]">{formatFileSize(model.sizeBytes)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Version</label>
              <p className="text-[#E8EAF0]">v{model.version} {model.isActive && '(Current)'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Created</label>
              <p className="text-[#E8EAF0]">{formatDate(model.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Last Updated</label>
              <p className="text-[#E8EAF0]">{formatDate(model.updatedAt)}</p>
            </div>
          </div>
        </ProfessionalGamingCard>

        <ProfessionalGamingCard variant="panel" className="p-6">
          <h2 className="text-xl font-bold text-[#E8EAF0] mb-4 flex items-center gap-2 uppercase tracking-wider">
            <Settings className="h-5 w-5 text-[#3A7BD5]" />
            PROCESSING STATUS
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Current Status</label>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  model.status === 'READY' || model.status === 'ready' ? 'bg-green-400' :
                  model.status === 'PROCESSING' || model.status === 'processing' ? 'bg-yellow-400' :
                  model.status === 'FAILED' || model.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`}></div>
                <ProfessionalGamingBadge variant={getStatusConfig(model.status).variant}>
                  {getStatusConfig(model.status).label.toUpperCase()}
                </ProfessionalGamingBadge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Processing Progress</label>
              <div className="mt-2">
                <div className="w-full bg-[rgba(37,42,58,0.6)] rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${model.processingProgress}%` }}
                  ></div>
                </div>
                <p className="text-[#E8EAF0] text-sm mt-1">{model.processingProgress}% Complete</p>
              </div>
            </div>
            {model.elementCount && (
              <div>
                <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Element Count</label>
                <p className="text-[#E8EAF0] font-semibold">{model.elementCount.toLocaleString()} elements</p>
              </div>
            )}
            {model.errorMessage && (
              <div>
                <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Error Message</label>
                <p className="text-red-400 text-sm mt-1 p-2 bg-[rgba(239,68,68,0.1)] rounded border border-red-400/20">
                  {model.errorMessage}
                </p>
              </div>
            )}
            {model.spatialStructure && (
              <div>
                <label className="text-sm font-medium text-[#B8BCC8] uppercase tracking-wider">Spatial Structure</label>
                <div className="mt-1 p-3 bg-[rgba(37,42,58,0.6)] rounded border border-[rgba(58,123,213,0.1)] max-h-32 overflow-y-auto">
                  <pre className="text-[#E8EAF0] text-xs whitespace-pre-wrap">
                    {typeof model.spatialStructure === 'object' 
                      ? JSON.stringify(model.spatialStructure, null, 2)
                      : model.spatialStructure
                    }
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Actions */}
      <ProfessionalGamingCard variant="panel" className="p-6">
        <h2 className="text-xl font-bold text-[#E8EAF0] mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Building2 className="h-5 w-5 text-[#3A7BD5]" />
          ACTIONS
        </h2>
        <div className="flex flex-wrap gap-3">
          <ProfessionalGamingButton
            onClick={openViewer}
            disabled={!(model.status === 'READY' || model.status === 'ready')}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            OPEN 3D VIEWER
          </ProfessionalGamingButton>
          <ProfessionalGamingButton
            onClick={downloadModel}
            disabled={!model.downloadUrl}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            DOWNLOAD FILE
          </ProfessionalGamingButton>
          <ProfessionalGamingButton
            onClick={() => navigate(`/projects/${model.project.id}`)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            VIEW PROJECT
          </ProfessionalGamingButton>
          <ProfessionalGamingButton
            onClick={copyViewerUrl}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            COPY VIEWER URL
          </ProfessionalGamingButton>
        </div>
      </ProfessionalGamingCard>
    </div>
  )
}
