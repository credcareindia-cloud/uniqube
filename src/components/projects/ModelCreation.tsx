import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, AlertTriangle, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApiUrl } from '@/config/api'
import { notificationService } from '@/services/notifications'

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

interface ProcessingStatus {
  id: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  projectData?: any
  error?: string
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
  
  // NEW: Processing status for process-first workflow
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [processingInBackground, setProcessingInBackground] = useState(false)
  
  // Only block navigation during the actual file upload; backend processing is background-safe
  const isProcessing = uploadStatus.status === 'uploading'

  // Prevent page navigation during upload only
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

  // NEW: Poll for processing status in the new workflow
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (processingStatus && processingStatus.status === 'processing') {
      console.log('🔄 Starting background polling for processing status...')
      interval = setInterval(async () => {
        try {
          const response = await fetch(getApiUrl(`processing-status/${processingStatus.id}`), {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          })
          
          if (response.ok) {
            const status = await response.json()
            console.log('📊 Processing status update:', status)
            setProcessingStatus(status)
            
            if (status.status === 'completed') {
              console.log('✅ Processing completed! Project created successfully')
              
              // Project created successfully!
              setUploadStatus({
                status: 'success',
                message: 'Project created successfully!',
                project: status.projectData?.project,
                model: status.projectData?.model
              })
              
              // ALWAYS add success notification (regardless of background state)
              console.log('🔔 Adding success notification...')
              notificationService.addProjectCreatedNotification(
                formData.projectName.trim(),
                status.projectData?.project?.id
              )
              
              // Conditional redirect based on user choice
              if (!processingInBackground) {
                // User didn't click "Continue in Background" - redirect to project
                console.log('🔄 Redirecting to project page (user stayed on modal)...')
                if (onProjectCreated && status.projectData?.project) {
                  onProjectCreated(status.projectData.project)
                }
              } else {
                // User clicked "Continue in Background" - no redirect, just notification
                console.log('📱 No redirect (user chose to continue in background)')
                console.log('🔔 Notification should appear in navbar/sidebar')
              }
              
              // Reset background processing state
              setProcessingInBackground(false)
              
              // Stop polling since processing is complete
              clearInterval(interval)
            } else if (status.status === 'failed') {
              setUploadStatus({
                status: 'error',
                message: status.error || 'Processing failed'
              })
              setShowProcessingModal(false)
              setProcessingInBackground(false)
              
              // Add failure notification
              notificationService.addProjectProcessingFailedNotification(
                formData.projectName.trim(),
                status.error
              )
            }
          }
        } catch (err) {
          console.error('Failed to check processing status:', err)
        }
      }, 2000) // Poll every 2 seconds
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping polling interval')
        clearInterval(interval)
      }
    }
  }, [processingStatus?.id, processingStatus?.status]) // Only depend on ID and status, not the whole object

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
      alert('Please select a valid .ifc file')
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
      alert('Please provide a project name and select an IFC or FRAG file')
      return
    }

    try {
      // NEW WORKFLOW: Upload and process first, create project only after success
      const fileType = selectedFile.name.toLowerCase().endsWith('.ifc') ? 'IFC' : 'FRAG';
      setUploadStatus({ status: 'uploading', message: 'Uploading model...', progress: 0 })
      setUploadProgress(0)
      
      console.log(`🚀 Starting process-first workflow for ${fileType} file...`)

      const formDataToSend = new FormData()
      formDataToSend.append('fragFile', selectedFile)
      formDataToSend.append('projectName', formData.projectName.trim())
      formDataToSend.append('projectDescription', formData.projectDescription.trim())
      formDataToSend.append('projectStatus', formData.projectStatus)

      console.log('📤 Uploading to new process-first endpoint...')
      
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
          }
        })
        
        xhr.addEventListener('load', () => {
          console.log('📥 Upload complete! Status:', xhr.status)
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('📊 Response received:', xhr.response)
            resolve(xhr.response)
          } else {
            console.error('❌ Upload failed with status:', xhr.status)
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
        
        // NEW: Use the process-first endpoint
        xhr.open('POST', getApiUrl('upload-and-process'))
        xhr.responseType = 'json'
        
        // Add authentication token to request
        const token = localStorage.getItem('auth_token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        xhr.send(formDataToSend)
      })

      if (result.success) {
        console.log('✅ File uploaded successfully, processing started...')

        // NEW: Show processing modal and start polling
        setProcessingStatus({
          id: result.processingId,
          status: 'processing',
          progress: result.progress || 20,
          message: result.message || 'Processing started...'
        })
        
        setShowProcessingModal(true)
        setUploadStatus({ status: 'processing', message: 'Processing file...', progress: 20 })
        
        // Add notification for processing started
        notificationService.addProjectProcessingNotification(formData.projectName.trim())
        
        console.log(`🔄 Started polling for processing ID: ${result.processingId}`)
        
        // The useEffect polling will handle the rest

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
                        <Badge variant="success">{selectedFile.name.toLowerCase().endsWith('.ifc') ? 'IFC' : 'FRAG'} File Selected</Badge>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                        <div className="text-slate-900 font-semibold text-lg">Drop your IFC file here</div>
                        <div className="text-slate-600">or click to browse</div>
                        <Badge variant="secondary">Accepted: .IFC Files Only</Badge>
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

          {/* Minimal Upload Status */}
          {uploadStatus.status === 'uploading' && (
            <div className="space-y-4">
              {/* Clean Status Header */}
              <div className="flex items-center justify-center space-x-3 p-4 bg-slate-50 rounded-lg">
                <Loader2 className="h-6 w-6 text-slate-600 animate-spin" />
                <span className="text-slate-900 font-medium">Uploading model...</span>
              </div>

              {/* Minimal Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Progress</span>
                  <span className="text-slate-900 font-medium">{uploadStatus.progress || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="h-full bg-slate-600 rounded-full transition-all duration-300"
                    style={{ width: `${uploadStatus.progress || 0}%` }}
                  />
                </div>
                {selectedFile && (
                  <div className="text-center text-slate-500 text-xs">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success/Error States */}
          {uploadStatus.status === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-slate-600" />
                <span className="text-slate-900 font-medium">{uploadStatus.message}</span>
              </div>
              
              {uploadStatus.project && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-slate-900 font-medium mb-2">Project Created</h3>
                  <div className="text-slate-600 text-sm space-y-1">
                    <p><span className="font-medium">Name:</span> {uploadStatus.project.name}</p>
                    <p><span className="font-medium">ID:</span> {uploadStatus.project.id}</p>
                  </div>
                </div>
              )}

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
            </div>
          )}
          
          {uploadStatus.status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                <AlertCircle className="h-6 w-6 text-slate-600" />
                <span className="text-slate-900 font-medium">{uploadStatus.message}</span>
              </div>
              
              <Button
                variant="outline"
                onClick={resetForm}
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  // NEW: Processing Modal for real-time status updates
  const processingModal = showProcessingModal && processingStatus && (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 bg-white border border-slate-200 shadow-xl">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {/* Minimal Icon */}
            <div className="flex items-center justify-center mb-2">
              {processingStatus.status === 'processing' && (
                <div className="bg-slate-50 rounded-full p-3">
                  <Loader2 className="h-8 w-8 text-slate-600 animate-spin" />
                </div>
              )}
              {processingStatus.status === 'completed' && (
                <div className="bg-slate-50 rounded-full p-3">
                  <CheckCircle className="h-8 w-8 text-slate-600" />
                </div>
              )}
              {processingStatus.status === 'failed' && (
                <div className="bg-slate-50 rounded-full p-3">
                  <AlertCircle className="h-8 w-8 text-slate-600" />
                </div>
              )}
            </div>
            
            {/* Clean Messaging */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">
                {processingStatus.status === 'processing' && 'Processing Your Model'}
                {processingStatus.status === 'completed' && 'Project Created'}
                {processingStatus.status === 'failed' && 'Processing Failed'}
              </h3>
              
              {processingStatus.status === 'processing' && (
                <p className="text-slate-600 text-sm">
                  Analyzing your IFC file and preparing your project. This usually takes 1-3 minutes.
                </p>
              )}
              
              {processingStatus.status === 'completed' && (
                <p className="text-slate-600 text-sm">
                  Your project is ready to explore.
                </p>
              )}
              
              {processingStatus.status === 'failed' && (
                <p className="text-slate-600 text-sm">
                  {processingStatus.error || 'Something went wrong during processing.'}
                </p>
              )}
            </div>

            {/* Minimal Progress Bar */}
            {processingStatus.status === 'processing' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Progress</span>
                  <span className="text-slate-900 font-medium">{processingStatus.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="h-full bg-slate-600 rounded-full transition-all duration-500"
                    style={{ width: `${processingStatus.progress}%` }}
                  />
                </div>
                
                {/* Minimal Steps */}
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${processingStatus.progress > 10 ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                    <span>Upload</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${processingStatus.progress > 40 ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                    <span>Analyze</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${processingStatus.progress > 70 ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                    <span>Convert</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${processingStatus.progress > 90 ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                    <span>Create</span>
                  </div>
                </div>
              </div>
            )}

            {/* Success state */}
            {processingStatus.status === 'completed' && (
              <div className="text-slate-500 text-xs">
                Redirecting to projects page...
              </div>
            )}

            {/* Error state */}
            {processingStatus.status === 'failed' && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowProcessingModal(false)
                  setProcessingStatus(null)
                  resetForm()
                }}
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Try Again
              </Button>
            )}

            {/* Background option */}
            {processingStatus.status === 'processing' && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowProcessingModal(false)
                  setProcessingInBackground(true)
                  // Keep processing in background
                }}
                className="w-full border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Continue in Background
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return createPortal(
    <>
      {/* Only show the old modal if processing modal is not active and not processing in background */}
      {!showProcessingModal && !processingInBackground && modalContent}
      {processingModal}
    </>,
    document.body
  )
}
