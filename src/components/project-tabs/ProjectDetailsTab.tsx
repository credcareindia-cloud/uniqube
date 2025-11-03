import React from 'react'
import { ExternalLink } from 'lucide-react'

interface ProjectDetailsTabProps {
  project: any
  models: any
  panels: any[]
  formatDate: (date: string) => string
  formatFileSize: (bytes: number) => string
  getStatusConfig: (status: string) => any
  navigate: (path: string) => void
  openViewer: (modelId: string) => void
}

export function ProjectDetailsTab({
  project,
  models,
  panels,
  formatDate,
  formatFileSize,
  getStatusConfig,
  navigate,
  openViewer
}: ProjectDetailsTabProps) {
  return (
    <div className="space-y-4 max-w-2xl">
      {/* Project Information */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-medium text-slate-500 mb-4">Project Information</h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500">Description</div>
            <div className="text-sm text-slate-900 mt-1">{project?.description || 'No description provided'}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm text-slate-900 mt-1">{getStatusConfig(project.status).label}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Created</div>
              <div className="text-sm text-slate-900 mt-1">{formatDate(project.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-medium text-slate-500 mb-4">Progress Overview</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-slate-500">Overall Progress</span>
            <span className="text-2xl font-semibold text-slate-900">0%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-slate-900 h-2 rounded-full transition-all duration-300" style={{ width: '0%' }}></div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-xs text-slate-500">Completed: </span>
              <span className="text-slate-900 font-medium">0</span>
            </div>
            <div>
              <span className="text-xs text-slate-500">Remaining: </span>
              <span className="text-slate-900 font-medium">{panels.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Model & Versions */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-medium text-slate-500 mb-4">Model & Versions</h3>
        {models?.currentModel ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">{models.currentModel.originalFilename}</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">v{models.currentModel.version} (Current)</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded uppercase">{getStatusConfig(models.currentModel.status).label}</span>
                </div>
                <div className="text-xs text-slate-500">{formatFileSize(Number(models.currentModel.sizeBytes))}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/models/${models.currentModel!.id}`)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Details
                </button>
                {(models.currentModel.status === 'READY' || models.currentModel.status === 'ready') && (
                  <button
                    onClick={() => openViewer(models.currentModel!.id)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Previous Versions */}
            {models?.modelHistory?.filter((model: any) => !model.isActive).slice(0, 2).map((model: any) => (
              <div key={model.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-600">{model.originalFilename}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">v{model.version}</span>
                  </div>
                  <div className="text-xs text-slate-500">{formatFileSize(Number(model.sizeBytes))}</div>
                </div>
                <span className="text-xs text-slate-500">Previous</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 text-center py-4">No model uploaded yet</p>
        )}
      </div>
    </div>
  )
}
