import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfessionalGamingCard } from '@/components/gaming/ProfessionalGamingCard'
import { ProfessionalGamingButton } from '@/components/gaming/ProfessionalGamingButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileText, ArrowLeft, Building2, AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [fragFile, setFragFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.toLowerCase().endsWith('.frag')) {
        setFragFile(file)
        setError(null)
      } else {
        setError('Please upload a .frag file')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.name.toLowerCase().endsWith('.frag')) {
        setFragFile(file)
        setError(null)
      } else {
        setError('Please upload a .frag file')
      }
    }
  }

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name')
      return
    }

    if (!fragFile) {
      setError('Please upload a FRAG file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // First create the project
      const projectResponse = await api.createProject({
        name: projectName,
        description: description || undefined,
      })

      // Then upload the FRAG file
      await api.uploadFile(fragFile, projectResponse.project.id)

      // Redirect to the project page
      navigate(`/projects/${projectResponse.project.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
      setError('Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full space-y-6">
      {/* Professional Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#3A7BD5]/20 via-[#00D2FF]/10 to-[#3A7BD5]/20 rounded-xl blur-xl"></div>
        <ProfessionalGamingCard variant="panel" className="relative p-6 border-2 border-[rgba(58,123,213,0.3)] bg-gradient-to-r from-[rgba(26,31,46,0.9)] to-[rgba(37,42,58,0.9)]">
          <div className="flex items-center gap-6">
            <ProfessionalGamingButton 
              onClick={() => navigate('/projects')} 
              variant="secondary" 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              BACK
            </ProfessionalGamingButton>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] rounded-xl blur-md opacity-60"></div>
                <div className="relative p-4 rounded-xl bg-gradient-to-br from-[#3A7BD5] to-[#00D2FF] shadow-2xl">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#E8EAF0] to-[#3A7BD5] uppercase tracking-wider">
                  CREATE PROJECT
                </h1>
                <p className="text-[#B8BCC8] text-base mt-1">Deploy a new 3D construction project</p>
              </div>
            </div>
          </div>
        </ProfessionalGamingCard>
      </div>

      {/* Error Display */}
      {error && (
        <ProfessionalGamingCard variant="panel" className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        </ProfessionalGamingCard>
      )}

      {/* Project Details Form */}
      <ProfessionalGamingCard variant="panel" className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[#E8EAF0] mb-4 uppercase tracking-wider">PROJECT DETAILS</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  PROJECT NAME *
                </label>
                <Input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#B8BCC8] mb-2 uppercase tracking-wider">
                  DESCRIPTION
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter project description..."
                  rows={3}
                  className="bg-[rgba(37,42,58,0.6)] border-[rgba(58,123,213,0.2)] text-[#E8EAF0] placeholder-[#6B7280] focus:border-[#3A7BD5] focus:ring-[#3A7BD5]"
                />
              </div>
            </div>
          </div>
        </div>
      </ProfessionalGamingCard>

      {/* File Upload */}
      <ProfessionalGamingCard variant="panel" className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[#E8EAF0] mb-4 uppercase tracking-wider">3D MODEL FILE</h3>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-[#3A7BD5] bg-[rgba(58,123,213,0.1)]'
                  : 'border-[rgba(58,123,213,0.2)] bg-[rgba(37,42,58,0.3)]'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".frag"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="flex flex-col items-center space-y-4">
                {fragFile ? (
                  <>
                    <FileText className="w-16 h-16 text-green-400 mx-auto" />
                    <div>
                      <p className="text-lg font-semibold text-green-400">
                        {fragFile.name}
                      </p>
                      <p className="text-sm text-[#B8BCC8]">
                        {(fragFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <ProfessionalGamingButton
                      onClick={() => setFragFile(null)}
                      variant="secondary"
                      size="sm"
                    >
                      Remove File
                    </ProfessionalGamingButton>
                  </>
                ) : (
                  <>
                    <Upload className="w-16 h-16 text-[#B8BCC8] mx-auto" />
                    <div>
                      <p className="text-lg font-semibold text-[#E8EAF0] mb-2">
                        Drag & drop your .frag file
                      </p>
                      <p className="text-sm text-[#B8BCC8] mb-4">
                        or click to browse files
                      </p>
                      <ProfessionalGamingButton variant="secondary" size="sm">
                        Browse Files
                      </ProfessionalGamingButton>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[#6B7280] mt-2">
              Supported format: .frag files only. Maximum file size: 100MB
            </p>
          </div>
        </div>
      </ProfessionalGamingCard>

      {/* Action Buttons */}
      <ProfessionalGamingCard variant="panel" className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <ProfessionalGamingButton
            onClick={() => navigate('/projects')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            Cancel
          </ProfessionalGamingButton>
          <ProfessionalGamingButton
            onClick={handleCreateProject}
            disabled={loading || !projectName.trim() || !fragFile}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                CREATING...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4" />
                CREATE PROJECT
              </>
            )}
          </ProfessionalGamingButton>
        </div>
      </ProfessionalGamingCard>
    </div>
  )
}
