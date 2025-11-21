import React from 'react'
import { ExternalLink, FileText, Package } from 'lucide-react'

interface ProjectDetailsTabProps {
  project: any
  models: any
  panels: any[]
  formatDate: (date: string) => string
  formatFileSize: (bytes: number) => string
  getStatusConfig: (status: string) => any
  navigate: (path: string) => void
  openViewer: (modelId: string) => void
  onEditClick?: () => void
  onDeleteClick?: () => void
}

export function ProjectDetailsTab({
  project,
  models,
  panels,
  formatDate,
  formatFileSize,
  getStatusConfig,
  navigate,
  openViewer,
  onEditClick,
  onDeleteClick
}: ProjectDetailsTabProps) {
  return (
    <div className="space-y-6">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Project Details</h2>
        <div className="flex items-center justify-end gap-3">
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Edit Project
            </button>
          )}
          {onDeleteClick && (
            <button
              onClick={onDeleteClick}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Project
            </button>
          )}
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="mb-3">
            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              Status
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900 mb-1">{getStatusConfig(project.status).label}</div>
          <div className="text-xs text-slate-500">Current Project Status</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="mb-3">
            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">
              Panels
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{panels.length}</div>
          <div className="text-xs text-slate-500">Total Panels</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="mb-3">
            <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-700">
              Models
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{models?.modelHistory?.length || 0}</div>
          <div className="text-xs text-slate-500">Total Models</div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Project Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Project Information Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 min-h-[400px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">Information</h3>
            </div>
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Description</div>
                <p className="text-sm text-slate-700 leading-relaxed p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-20">
                  {project?.description || 'No description provided'}
                </p>
              </div>
              <div className="space-y-3 flex-1">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Status</div>
                  <div className="text-sm font-semibold text-slate-900">{getStatusConfig(project.status).label}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Created</div>
                  <div className="text-sm font-semibold text-slate-900">{formatDate(project.createdAt)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Updated</div>
                  <div className="text-sm font-semibold text-slate-900">{formatDate(project.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Models & Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Overview */}
          {/* <div className="bg-white rounded-lg border border-slate-200 p-6">
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
                  <div className="text-xs font-medium text-green-700 mb-1 uppercase tracking-wide">Completed</div>
                  <div className="text-2xl font-bold text-green-900">0</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-xs font-medium text-orange-700 mb-1 uppercase tracking-wide">Remaining</div>
                  <div className="text-2xl font-bold text-orange-900">{panels.length}</div>
                </div>
              </div>
            </div>
          </div> */}

          {/* Models Section */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">Uploaded Models</h3>
              {models?.modelHistory && models.modelHistory.length > 0 && (
                <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {models.modelHistory.length} {models.modelHistory.length === 1 ? 'model' : 'models'}
                </span>
              )}
            </div>
            {models?.modelHistory && models.modelHistory.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {models.modelHistory.map((model: any) => (
                  <div key={model.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-100 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-slate-900 truncate">{model.originalFilename}</span>
                          {/* {model.isActive && (
                            <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded flex-shrink-0">
                              Active
                            </span>
                          )} */}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                          <span className="bg-white px-2 py-1 rounded border border-slate-200">{formatFileSize(Number(model.sizeBytes))}</span>
                          <span className="bg-white px-2 py-1 rounded border border-slate-200">{formatDate(model.createdAt)}</span>
                          {model.elementCount !== null && (
                            <span className="bg-white px-2 py-1 rounded border border-slate-200 font-medium">{model.elementCount} Elements</span>
                          )}
                          {/* <span className="px-2 py-1 rounded border border-slate-200 font-medium">
                            {getStatusConfig(model.status).label}
                          </span> */}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* <button
                          onClick={() => navigate(`/models/${model.id}`)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          Details
                        </button> */}
                        <span className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
                          (model.status === 'READY' || model.status === 'ready') 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getStatusConfig(model.status).label}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 text-sm font-medium mb-1">No models uploaded</p>
                <p className="text-slate-500 text-xs">Upload an IFC model to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
