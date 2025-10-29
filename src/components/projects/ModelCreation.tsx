import React, { useState } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react'
import { ProfessionalGamingButton } from '../gaming/ProfessionalGamingButton'
import { ProfessionalGamingBadge } from '../gaming/ProfessionalGamingBadge'
import { ProfessionalGamingCard } from '../gaming/ProfessionalGamingCard'

interface ModelCreationProps {
  onProjectCreated?: (project: any) => void
  onClose?: () => void
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  message?: string
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

  const handleFileChange = (file: File) => {
    if (file && file.name.toLowerCase().endsWith('.frag')) {
      setSelectedFile(file)
      setUploadStatus({ status: 'idle' })
      
      // Auto-generate project name from filename if empty
      if (!formData.projectName) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        const capitalizedName = baseName.charAt(0).toUpperCase() + baseName.slice(1)
        setFormData(prev => ({ ...prev, projectName: capitalizedName }))
      }
    } else {
      alert('Please select a valid .frag file')
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
      alert('Please provide a project name and select a FRAG file')
      return
    }

    setUploadStatus({ status: 'uploading', message: 'Uploading model...' })

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('fragFile', selectedFile)
      formDataToSend.append('projectName', formData.projectName.trim())
      formDataToSend.append('projectDescription', formData.projectDescription.trim())
      formDataToSend.append('projectStatus', formData.projectStatus)

      // Update status to processing while backend processes the FRAG file
      setUploadStatus({ status: 'processing', message: 'Processing FRAG file and extracting metadata...' })

      const response = await fetch('http://localhost:4000/api/create-project-with-model', {
        method: 'POST',
        body: formDataToSend,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Backend has completed processing and returned metadata
        console.log('✅ Project created with metadata:', result.metadata)
        
        setUploadStatus({
          status: 'success',
          message: `Project created successfully! Processed ${result.metadata.panelsCount} panels and ${result.metadata.groupsCount} groups.`,
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <ProfessionalGamingCard variant="panel" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#E8EAF0] uppercase tracking-wider">
                CREATE PROJECT WITH MODEL
              </h2>
              <p className="text-[#B8BCC8] mt-2">
                Upload a FRAG model to automatically create a new project. Projects can only be created with a valid model.
              </p>
            </div>
            {onClose && (
              <ProfessionalGamingButton
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
              </ProfessionalGamingButton>
            )}
          </div>

          {uploadStatus.status === 'idle' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                    className="w-full px-4 py-3 bg-[rgba(37,42,58,0.8)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent transition-all"
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={formData.projectDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectDescription: e.target.value }))}
                    className="w-full px-4 py-3 bg-[rgba(37,42,58,0.8)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent transition-all resize-none"
                    placeholder="Enter project description (optional)"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={formData.projectStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectStatus: e.target.value as any }))}
                    className="w-full px-4 py-3 bg-[rgba(37,42,58,0.8)] border border-[rgba(58,123,213,0.2)] rounded-lg text-[#E8EAF0] focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent transition-all"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                  </select>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  FRAG Model File *
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
                    dragActive
                      ? 'border-[#3A7BD5] bg-[rgba(58,123,213,0.1)]'
                      : selectedFile
                      ? 'border-[#10B981] bg-[rgba(16,185,129,0.1)]'
                      : 'border-[rgba(58,123,213,0.3)] bg-[rgba(37,42,58,0.3)]'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".frag"
                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  <div className="text-center">
                    {selectedFile ? (
                      <div className="space-y-3">
                        <CheckCircle className="h-12 w-12 text-[#10B981] mx-auto" />
                        <div className="text-[#E8EAF0] font-semibold text-lg">{selectedFile.name}</div>
                        <div className="text-[#B8BCC8]">{formatFileSize(selectedFile.size)}</div>
                        <ProfessionalGamingBadge variant="completed">FRAG FILE SELECTED</ProfessionalGamingBadge>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-12 w-12 text-[#6B7280] mx-auto" />
                        <div className="text-[#E8EAF0] font-semibold text-lg">Drop your FRAG file here</div>
                        <div className="text-[#B8BCC8]">or click to browse</div>
                        <ProfessionalGamingBadge variant="neutral">ONLY .FRAG FILES ACCEPTED</ProfessionalGamingBadge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={!selectedFile || !formData.projectName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#3A7BD5] to-[#00D2FF] text-white rounded-lg hover:from-[#357ABD] hover:to-[#00B8E6] transition-all duration-300 font-medium uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-4 w-4" />
                  CREATE PROJECT WITH MODEL
                </button>
                
                {onClose && (
                  <ProfessionalGamingButton
                    variant="secondary"
                    onClick={onClose}
                  >
                    CANCEL
                  </ProfessionalGamingButton>
                )}
              </div>
            </form>
          )}

          {/* Upload Status */}
          {uploadStatus.status !== 'idle' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 bg-[rgba(37,42,58,0.6)] rounded-lg border border-[rgba(58,123,213,0.2)]">
                {uploadStatus.status === 'uploading' && (
                  <Loader2 className="h-6 w-6 text-[#3A7BD5] animate-spin" />
                )}
                {uploadStatus.status === 'processing' && (
                  <Loader2 className="h-6 w-6 text-[#F59E0B] animate-spin" />
                )}
                {uploadStatus.status === 'success' && (
                  <CheckCircle className="h-6 w-6 text-[#10B981]" />
                )}
                {uploadStatus.status === 'error' && (
                  <AlertCircle className="h-6 w-6 text-[#EF4444]" />
                )}
                
                <span className="text-[#E8EAF0] font-medium text-lg">{uploadStatus.message}</span>
              </div>

              {uploadStatus.project && (
                <ProfessionalGamingCard variant="panel" className="p-4">
                  <h3 className="text-[#E8EAF0] font-bold text-lg mb-3 uppercase tracking-wider">PROJECT CREATED</h3>
                  <div className="text-[#B8BCC8] space-y-2">
                    <p><span className="font-medium text-[#E8EAF0]">Name:</span> {uploadStatus.project.name}</p>
                    <p><span className="font-medium text-[#E8EAF0]">ID:</span> {uploadStatus.project.id}</p>
                    <p><span className="font-medium text-[#E8EAF0]">Status:</span> {uploadStatus.project.status}</p>
                  </div>
                </ProfessionalGamingCard>
              )}

              {uploadStatus.status === 'success' && (
                <div className="flex space-x-3">
                  <ProfessionalGamingButton
                    variant="primary"
                    onClick={() => window.location.href = `/projects/${uploadStatus.project?.id}`}
                    className="flex-1"
                  >
                    VIEW PROJECT
                  </ProfessionalGamingButton>
                  
                  <ProfessionalGamingButton
                    variant="secondary"
                    onClick={resetForm}
                  >
                    CREATE ANOTHER
                  </ProfessionalGamingButton>
                </div>
              )}

              {uploadStatus.status === 'error' && (
                <ProfessionalGamingButton
                  variant="secondary"
                  onClick={resetForm}
                  className="w-full"
                >
                  TRY AGAIN
                </ProfessionalGamingButton>
              )}
            </div>
          )}
        </div>
      </ProfessionalGamingCard>
    </div>
  )
}
