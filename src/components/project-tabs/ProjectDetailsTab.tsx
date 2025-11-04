import React from 'react'
import { ExternalLink, Calendar, Activity, FileText, Package } from 'lucide-react'

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
    <div className="space-y-6">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              {getStatusConfig(project.status).label}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">Active</div>
          <div className="text-xs text-slate-500">Project Status</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{panels.length}</div>
          <div className="text-xs text-slate-500">Total Panels</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{formatDate(project.createdAt)}</div>
          <div className="text-xs text-slate-500">Created Date</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Project Information */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">Project Information</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Description</div>
                <div className="text-sm text-slate-700 leading-relaxed p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {project?.description || 'No description provided'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 mb-1">Status</div>
                  <div className="text-sm font-semibold text-slate-900">{getStatusConfig(project.status).label}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 mb-1">Created</div>
                  <div className="text-sm font-semibold text-slate-900">{formatDate(project.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Progress Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-slate-600">Overall Progress</span>
                <span className="text-3xl font-bold text-slate-900">0%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: '0%' }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xs font-medium text-green-700 mb-1">Completed</div>
                  <div className="text-2xl font-bold text-green-900">0</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-xs font-medium text-orange-700 mb-1">Remaining</div>
                  <div className="text-2xl font-bold text-orange-900">{panels.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Model & Versions */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Model & Versions</h3>
            {models?.currentModel ? (
              <div className="space-y-3">
                {/* Current Model */}
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-slate-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-slate-900">{models.currentModel.originalFilename}</span>
                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                          v{models.currentModel.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">{formatFileSize(Number(models.currentModel.sizeBytes))}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded uppercase">
                          {getStatusConfig(models.currentModel.status).label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/models/${models.currentModel!.id}`)}
                      className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </button>
                    {(models.currentModel.status === 'READY' || models.currentModel.status === 'ready') && (
                      <button
                        onClick={() => openViewer(models.currentModel!.id)}
                        className="px-3 py-2 text-xs font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Previous Versions */}
                {models?.modelHistory?.filter((model: any) => !model.isActive).length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-medium text-slate-500 mb-2">Previous Versions</div>
                    <div className="space-y-2">
                      {models.modelHistory.filter((model: any) => !model.isActive).slice(0, 2).map((model: any) => (
                        <div key={model.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-slate-700">{model.originalFilename}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">v{model.version}</span>
                            </div>
                            <div className="text-xs text-slate-500">{formatFileSize(Number(model.sizeBytes))}</div>
                          </div>
                          <span className="text-xs text-slate-400">Archived</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 text-sm font-medium mb-1">No model uploaded yet</p>
                <p className="text-slate-500 text-xs">Upload an IFC model to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
