import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import { getApiUrl } from '@/config/api'

interface ModelCreationProps {
  onProjectCreated?: (project: any) => void
  onClose?: () => void
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  message?: string
  progress?: number
  project?: any
  model?: any
}

export function ModelCreation({ onProjectCreated, onClose }: ModelCreationProps) {
  const [formData, setFormData] = useState({
    projectName: '',
    projectDescription: '',
    projectStatus: 'ACTIVE' as const
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' })
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const isProcessing = uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'

  // Prevent page navigation during upload/processing
  useEffect(() => {
    if (isProcessing) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = 'Upload in progress. Are you sure you want to leave?'
        return e.returnValue
      }
      
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isProcessing])

  const handleFileChange = (file: File) => {
    const fileName = file.name.toLowerCase();
    const isValidFile = fileName.endsWith('.frag') || fileName.endsWith('.ifc');
    
    if (file && isValidFile) {
      setSelectedFile(file)
      setUploadStatus({ status: 'idle' })
      
      // Auto-generate project name from filename if empty
      if (!formData.projectName) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        const capitalizedName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
        setFormData(prev => ({ ...prev, projectName: capitalizedName }))
      }
    } else {
      alert('Please select a valid .ifc or .frag file')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile || !formData.projectName.trim()) {
      alert('Please provide a project name and select an IFC file')
      return
    }

    try {
      // Step 1: Show uploading state
      const fileType = selectedFile.name.toLowerCase().endsWith('.ifc') ? 'IFC' : 'FRAG';
      setUploadStatus({ status: 'uploading', message: 'Uploading model...', progress: 0 })
      setUploadProgress(0)
      
      console.log(`📤 Uploading ${fileType} file...`)

      const formDataToSend = new FormData()
      formDataToSend.append('fragFile', selectedFile)
      formDataToSend.append('projectName', formData.projectName.trim())
      formDataToSend.append('projectDescription', formData.projectDescription.trim())
      formDataToSend.append('projectStatus', formData.projectStatus)

      console.log('📤 Uploading to backend...')
      
      // Use XMLHttpRequest for upload progress tracking
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percentComplete)
            setUploadStatus({ 
              status: 'uploading', 
              message: 'Uploading model...', 
              progress: percentComplete 
            })
            
            // When upload reaches 100%, immediately show processing state
            if (percentComplete === 100) {
              console.log('📤 Upload 100% complete! Waiting for backend processing...')
              setTimeout(() => {
                setUploadStatus({ 
                  status: 'processing', 
                  message: 'Analyzing 3D elements and extracting metadata...', 
                  progress: 100 
                })
              }, 100) // Small delay to ensure UI updates
            }
          }
        })
        
        xhr.addEventListener('load', () => {
          console.log('📥 Upload complete! Status:', xhr.status)
          if (xhr.status >= 200 && xhr.status < 300) {
            // Upload complete - show processing state
            console.log('✅ Setting processing state...')
            setUploadStatus({ status: 'processing', message: 'Analyzing 3D elements and extracting metadata...', progress: 100 })
            console.log('📊 Response received:', xhr.response)
            resolve(xhr.response)
          } else {
            console.error('❌ Upload failed with status:', xhr.status)
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
        
        xhr.open('POST', getApiUrl('create-project-with-model'))
        xhr.responseType = 'json'
        
        // Add authentication token to request
        const token = localStorage.getItem('auth_token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        xhr.send(formDataToSend)
      })

      if (result.success) {
        console.log('✅ Project created successfully:', result.metadata)
        
        const storeysCount = result.metadata?.spatialStructure?.length || 0;
        
        setUploadStatus({
          status: 'success',
          message: `Project created successfully! Processed ${result.metadata.panelsCount} panels from ${storeysCount} storeys.`,
          project: result.project,
          model: result.model
        })

        // Call callback after successful creation
        if (onProjectCreated) {
          onProjectCreated(result.project)
        }

      } else {
        throw new Error(result.message || 'Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      setUploadStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      projectName: '',
      projectDescription: '',
      projectStatus: 'ACTIVE'
    })
    setSelectedFile(null)
    setUploadStatus({ status: 'idle' })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto border-slate-200 bg-white shadow-2xl">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Create Project with Model
              </h2>
              <p className="text-slate-600 mt-2">
                Upload an IFC model to automatically create a new project.
              </p>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isProcessing}
                className="flex items-center gap-2"
                title={isProcessing ? 'Cannot close during upload/processing' : 'Close'}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {uploadStatus.status === 'idle' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.projectDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectDescription: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all resize-none"
                    placeholder="Enter project description (optional)"
                    rows={3}
                  />
                </div>

                {/* Status field removed - projects default to ACTIVE */}
                {/* <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.projectStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectStatus: e.target.value as any }))}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                  </select>
                </div> */}
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  IFC Model File *
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
                    dragActive
                      ? 'border-slate-500 bg-slate-100'
                      : selectedFile
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".frag,.ifc"
                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  <div className="text-center">
                    {selectedFile ? (
                      <div className="space-y-3">
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                        <div className="text-slate-900 font-semibold text-lg">{selectedFile.name}</div>
                        <div className="text-slate-600">{formatFileSize(selectedFile.size)}</div>
                        <Badge variant="success">IFC File Selected</Badge>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                        <div className="text-slate-900 font-semibold text-lg">Drop your IFC file here</div>
                        <div className="text-slate-600">or click to browse</div>
                        <Badge variant="secondary">Only .IFC files accepted</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  type="submit"
                  disabled={!selectedFile || !formData.projectName.trim()}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Create Project with Model
                </Button>
                
                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}

          {/* Warning Message During Processing */}
          {isProcessing && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-900 font-medium text-sm">
                  Upload in progress - Do not close, refresh or navigate away from this page
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Your project is being created. This process may take a few minutes.
                </p>
              </div>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus.status !== 'idle' && (
            <div className="space-y-6">
              {/* Loading Screen with Progress */}
              {(uploadStatus.status === 'uploading' || uploadStatus.status === 'processing') && (
                <div className="space-y-6">
                  {/* Status Header */}
                  <div className="flex items-center justify-center space-x-4 p-6 bg-slate-50 rounded-lg border border-slate-200">
                    <Loader2 className="h-8 w-8 text-slate-700 animate-spin" />
                    <span className="text-slate-900 font-semibold text-xl">{uploadStatus.message}</span>
                  </div>

                  {/* Progress Bar - Only show during upload */}
                  {uploadStatus.status === 'uploading' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Upload Progress</span>
                        <span className="text-slate-900 font-bold">{uploadStatus.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-slate-600 to-slate-800 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadStatus.progress || 0}%` }}
                        >
                          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                        </div>
                      </div>
                      <div className="text-center text-slate-600 text-sm">
                        {selectedFile && (
                          <span>Uploading {selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processing Animation - Show after upload completes */}
                  {uploadStatus.status === 'processing' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center space-x-2 text-slate-600">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-slate-700 font-medium">Processing 3D Model</p>
                        {/* <p className="text-slate-500 text-sm">Extracting elements, storeys, and metadata...</p> */}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Success/Error States */}
              {uploadStatus.status === 'success' && (
                <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-green-900 font-medium text-lg">{uploadStatus.message}</span>
                </div>
              )}
              
              {uploadStatus.status === 'error' && (
                <div className="flex items-center space-x-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                  <span className="text-red-900 font-medium text-lg">{uploadStatus.message}</span>
                </div>
              )}

              {uploadStatus.project && (
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <h3 className="text-slate-900 font-bold text-lg mb-3">Project Created</h3>
                    <div className="text-slate-600 space-y-2">
                      <p><span className="font-medium text-slate-900">Name:</span> {uploadStatus.project.name}</p>
                      <p><span className="font-medium text-slate-900">ID:</span> {uploadStatus.project.id}</p>
                      <p><span className="font-medium text-slate-900">Status:</span> {uploadStatus.project.status}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {uploadStatus.status === 'success' && (
                <div className="flex space-x-3">
                  <Button
                    onClick={() => window.location.href = `/projects/${uploadStatus.project?.id}`}
                    className="flex-1"
                  >
                    View Project
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={resetForm}
                  >
                    Create Another
                  </Button>
                </div>
              )}

              {uploadStatus.status === 'error' && (
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return createPortal(modalContent, document.body)
}
