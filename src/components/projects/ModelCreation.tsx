import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, AlertTriangle, X, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApiUrl } from '@/config/api'
import { useNotifications } from '@/hooks/useNotifications'

interface ModelCreationProps {
  onProjectCreated?: (project: any) => void
  onClose?: () => void
}

interface SelectedFile {
  id: string
  file: File
  category: 'structure' | 'mep' | 'electrical' | 'other'
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  message?: string
  progress?: number
  project?: any
}

interface ProcessingStatus {
  id?: string
  jobId?: string
  status: 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  projectData?: any
  error?: string
}

const FILE_CATEGORIES = {
  structure: { label: 'Structure', color: 'bg-blue-100 text-blue-800', icon: '🏗️' },
  mep: { label: 'MEP (Plumbing)', color: 'bg-green-100 text-green-800', icon: '🔧' },
  electrical: { label: 'Electrical', color: 'bg-yellow-100 text-yellow-800', icon: '⚡' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800', icon: '📁' }
}

export function ModelCreation({ onProjectCreated, onClose }: ModelCreationProps) {
  const { refetch } = useNotifications()
  const [formData, setFormData] = useState({
    projectName: '',
    projectDescription: '',
    projectStatus: 'ACTIVE' as const
  })
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' })
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const [processingInBackground, setProcessingInBackground] = useState(false)
  
  const isProcessing = uploadStatus.status === 'uploading'

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

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (processingStatus && processingStatus.status === 'processing') {
      console.log('🔄 Starting background polling for multi-file processing status...', processingStatus.jobId)
      console.log('🔍 Processing status object:', processingStatus)
      interval = setInterval(async () => {
        try {
          const response = await fetch(getApiUrl(`multi-file-status/${processingStatus.jobId || processingStatus.id}`), {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          })
          
          console.log('🔍 Polling status for jobId:', processingStatus.jobId, 'Response status:', response.status)
          
          if (response.ok) {
            const status = await response.json()
            console.log('📊 Processing status update:', status)
            console.log('🔍 Job status:', status.status, 'Progress:', status.progress, 'Message:', status.message)
            
            console.log('🔄 Updating processing status:', status)
            setProcessingStatus(status)
            
            if (status.status === 'completed') {
              console.log('✅ Processing completed! Project created successfully')
              
              setUploadStatus({
                status: 'success',
                message: 'Multi-component project created successfully!',
                project: status.projectData
              })
              
              // Backend automatically creates success notification
              // Refetch notifications immediately to show the new notification
              refetch().catch(err => console.error('Failed to refetch notifications:', err))
              
              if (!processingInBackground) {
                console.log('🔄 Redirecting to project page (user stayed on modal)...')
                if (onProjectCreated && status.projectData) {
                  onProjectCreated(status.projectData)
                }
              } else {
                console.log('📱 No redirect (user chose to continue in background)')
                console.log('🔔 Notification will appear in navbar/sidebar from backend')
              }
              
              setProcessingInBackground(false)
              
              clearInterval(interval)
            } else if (status.status === 'failed') {
              setUploadStatus({
                status: 'error',
                message: status.error || 'Processing failed'
              })
              setShowProcessingModal(false)
              setProcessingInBackground(false)
              
              // Backend automatically creates failure notification
              // Refetch notifications immediately to show the failure notification
              refetch().catch(err => console.error('Failed to refetch notifications:', err))
              
              clearInterval(interval)
            }
          } else {
            console.error('❌ Failed to fetch processing status:', response.status, response.statusText)
            const errorText = await response.text()
            console.error('❌ Error response:', errorText)
            
            if (response.status === 404) {
              console.warn('⚠️ Job not found - it may have been completed and cleaned up')
              clearInterval(interval)
            }
          }
        } catch (err) {
          console.error('Failed to check processing status:', err)
        }
      }, 1000)
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping polling interval')
        clearInterval(interval)
      }
    }
  }, [processingStatus?.jobId, processingStatus?.id, processingStatus?.status])

  const detectFileCategory = (filename: string): SelectedFile['category'] => {
    const name = filename.toLowerCase()
    if (name.includes('mep') || name.includes('plumb') || name.includes('hvac') || name.includes('pipe')) {
      return 'mep'
    }
    if (name.includes('elect') || name.includes('power') || name.includes('light')) {
      return 'electrical'
    }
    if (name.includes('struct') || name.includes('frame') || name.includes('beam') || name.includes('column')) {
      return 'structure'
    }
    return 'other'
  }

  const handleFileChange = (files: FileList) => {
    const newFiles: SelectedFile[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      category: detectFileCategory(file.name)
    }))
    
    setSelectedFiles(prev => [...prev, ...newFiles])
    
    if (!formData.projectName && newFiles.length > 0) {
      const baseName = newFiles[0].file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      const capitalizedName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
      setFormData(prev => ({ ...prev, projectName: capitalizedName }))
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files)
    }
  }

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const updateFileCategory = (fileId: string, category: SelectedFile['category']) => {
    setSelectedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, category } : f
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.projectName.trim() || selectedFiles.length === 0) {
      alert('Please provide a project name and select at least one IFC file')
      return
    }

    try {
      setUploadStatus({ status: 'uploading', progress: 0 })
      
      const formDataToSend = new FormData()
      formDataToSend.append('projectName', formData.projectName.trim())
      formDataToSend.append('projectDescription', formData.projectDescription.trim())
      formDataToSend.append('projectStatus', formData.projectStatus)
      
      selectedFiles.forEach((selectedFile, index) => {
        formDataToSend.append(`file_${index}`, selectedFile.file)
        formDataToSend.append(`category_${index}`, selectedFile.category)
      })

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        let lastProgressUpdate = 0
        xhr.upload.addEventListener('progress', (e) => {
          const totalSize = selectedFiles.reduce((sum, f) => sum + f.file.size, 0)
          const total = (e.total && e.total > 0) ? e.total : totalSize
          const loaded = e.loaded || 0
          const percentComplete = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)))
          
          const now = Date.now()
          if (percentComplete !== lastProgressUpdate && (percentComplete % 1 === 0 || now - lastProgressUpdate > 100)) {
            console.log(`📤 Upload progress: ${percentComplete}% (${loaded}/${total} bytes)`)
            lastProgressUpdate = percentComplete
            
            setUploadProgress(percentComplete)
            setUploadStatus({ 
              status: 'uploading', 
              message: `Uploading files... ${percentComplete}%`, 
              progress: percentComplete 
            })
            
            setTimeout(() => {
              const progressBars = document.querySelectorAll('[style*="width:"]')
              progressBars.forEach(bar => {
                if (bar.parentElement?.classList.contains('bg-slate-100')) {
                  (bar as HTMLElement).style.width = `${percentComplete}%`
                }
              })
            }, 0)
          }
        })
        
        xhr.addEventListener('load', () => {
          console.log('📥 Upload complete! Status:', xhr.status)
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100)
            setUploadStatus({ status: 'uploading', message: 'Uploading files...', progress: 100 })
            console.log('📊 Response received:', xhr.response)
            resolve(xhr.response)
          } else {
            console.error('❌ Upload failed with status:', xhr.status)
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        
        xhr.addEventListener('error', () => {
          console.error('❌ Network error during upload')
          reject(new Error('Upload failed'))
        })
        xhr.addEventListener('abort', () => {
          console.warn('⏹️ Upload aborted by user')
          reject(new Error('Upload aborted'))
        })
        
        xhr.open('POST', getApiUrl('multi-file-upload'))
        xhr.responseType = 'json'
        
        const token = localStorage.getItem('auth_token')
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        
        xhr.send(formDataToSend)
      })
      console.log('✅ Multi-file upload started:', result)
      
      if (result.jobId) {
        console.log('🔄 Starting processing with jobId:', result.jobId)
        console.log('📊 Initial job status:', result.status, 'progress:', result.progress)
        console.log('📊 Full result object:', result)
        
        setProcessingStatus({
          jobId: result.jobId,
          status: 'processing',
          progress: result.progress || 10,
          message: result.message || 'Processing files...'
        })
        
        setShowProcessingModal(true)
        setUploadStatus({ 
          status: 'processing', 
          message: 'Processing files...',
          progress: result.progress || 0
        })
      } else {
        console.error('❌ No jobId returned from multi-file upload:', result)
        throw new Error('No job ID returned from server')
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
    setSelectedFiles([])
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
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  IFC Model Files *
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
                    dragActive
                      ? 'border-slate-500 bg-slate-100'
                      : selectedFiles.length > 0
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
                    multiple
                    onChange={(e) => e.target.files && handleFileChange(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  <div className="text-center">
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-3">
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                        <div className="text-slate-900 font-semibold text-lg">
                          {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                        </div>
                        <div className="text-slate-600">
                          {selectedFiles.reduce((total, f) => total + f.file.size, 0) > 0 && 
                            formatFileSize(selectedFiles.reduce((total, f) => total + f.file.size, 0))
                          }
                        </div>
                        <Badge variant="success">Ready for Upload</Badge>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                        <div className="text-slate-900 font-semibold text-lg">Drop your IFC files here</div>
                        <div className="text-slate-600">or click to browse</div>
                        <Badge variant="secondary">Accepted: .IFC Files Only</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">Selected Files</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedFiles.map((selectedFile) => (
                      <div key={selectedFile.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          <FileText className="h-5 w-5 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {selectedFile.file.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(selectedFile.file.size)}
                            </p>
                          </div>
                          <select
                            value={selectedFile.category}
                            onChange={(e) => updateFileCategory(selectedFile.id, e.target.value as SelectedFile['category'])}
                            className="text-xs px-2 py-1 border border-slate-300 rounded"
                          >
                            {Object.entries(FILE_CATEGORIES).map(([key, cat]) => (
                              <option key={key} value={key}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(selectedFile.id)}
                          className="ml-2 text-slate-400 hover:text-slate-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  type="submit"
                  disabled={!formData.projectName.trim() || selectedFiles.length === 0}
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

          {uploadStatus.status === 'uploading' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3 p-4 bg-slate-50 rounded-lg">
                <Loader2 className="h-6 w-6 text-slate-600 animate-spin" />
                <span className="text-slate-900 font-medium">Uploading model...</span>
              </div>

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
                {selectedFiles.length > 0 && (
                  <div className="text-center text-slate-500 text-xs">
                    {selectedFiles.length} files selected
                  </div>
                )}
              </div>
            </div>
          )}


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

  const processingModal = showProcessingModal && processingStatus && (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4 bg-white border border-slate-200 shadow-xl">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center mb-2 relative">
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
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">
                {processingStatus.status === 'processing' && (
                  selectedFiles.length === 1 
                    ? 'Processing Your Model' 
                    : `Processing ${selectedFiles.length} Models`
                )}
                {processingStatus.status === 'completed' && 'Project Created'}
                {processingStatus.status === 'failed' && 'Processing Failed'}
              </h3>
              
              {processingStatus.status === 'processing' && (
                <p className="text-slate-600 text-sm">
                  {selectedFiles.length === 1 
                    ? 'Analyzing your IFC file and preparing your project. This usually takes a few minutes.'
                    : `Analyzing ${selectedFiles.length} IFC files and preparing your project. This may take a few minutes.`
                  }
                </p>
              )}
              
              {processingStatus.status === 'completed' && (
                <p className="text-slate-600 text-sm">
                  {selectedFiles.length === 1 
                    ? 'Your project is ready to explore.'
                    : `Your project with ${selectedFiles.length} models is ready to explore.`
                  }
                </p>
              )}
              
              {processingStatus.status === 'failed' && (
                <p className="text-slate-600 text-sm">
                  {processingStatus.error || 'Something went wrong during processing.'}
                </p>
              )}
            </div>

            {(processingStatus.status === 'processing' || processingStatus.status === 'completed') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Progress</span>
                  <span className="text-slate-900 font-medium">{processingStatus.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div 
                    className="h-full bg-slate-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${processingStatus.progress}%` }}
                    data-progress={processingStatus.progress}
                  />
                </div>
                <div className="text-center text-xs text-slate-500">
                  {processingStatus.message || 'Processing...'}
                </div>
              </div>
            )}

            {processingStatus.status === 'completed' && (
              <div className="text-slate-500 text-xs">
                Redirecting to projects page...
              </div>
            )}

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

            {processingStatus.status === 'processing' && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowProcessingModal(false)
                  setProcessingInBackground(true)
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
      {!showProcessingModal && !processingInBackground && modalContent}
      {processingModal}
    </>,
    document.body
  )
}
