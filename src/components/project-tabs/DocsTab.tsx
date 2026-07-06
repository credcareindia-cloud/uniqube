'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
  Loader2,
  Image as ImageIcon,
  FileType2,
  File,
} from 'lucide-react'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { API_BASE_URL, getApiUrl } from '@/config/api'
import { toast } from '@/components/ui/use-toast'

export type DocumentCategory = 'DRAWINGS' | 'LOGISTICS' | 'CNC'

interface ProjectDocument {
  id: string
  name: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  category: DocumentCategory
  createdAt: string
  uploader?: { id: string; name: string; email: string } | null
}

export interface ProjectDocumentsTabProps {
  projectId: number
  category: DocumentCategory
  title: string
  description: string
  namePlaceholder: string
  /** Omit or pass empty string to show all files/folders in the OS picker (validation still runs on select). */
  accept?: string
  allowedExtensions: string[]
  emptyTitle: string
  emptyDescription: string
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const fileIconFor = (mime: string, filename: string) => {
  const lower = (mime || '').toLowerCase()
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (lower.startsWith('image/')) return ImageIcon
  if (lower.includes('pdf') || ext === 'pdf') return FileType2
  if (['dwg', 'dxf', 'dwf', 'rvt', 'skp', 'nc', 'cnc', 'tap', 'gcode'].includes(ext)) return FileText
  return File
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : ''
}

export function ProjectDocumentsTab({
  projectId,
  category,
  title,
  description,
  namePlaceholder,
  accept,
  allowedExtensions,
  emptyTitle,
  emptyDescription,
}: ProjectDocumentsTabProps) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [actioningId, setActioningId] = useState<string | null>(null)

  useEffect(() => {
    void loadDocs()
  }, [projectId, category])

  const loadDocs = async () => {
    try {
      setLoading(true)
      const res = await authenticatedFetch(
        getApiUrl(`documents/${projectId}?category=${category}`)
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDocs(data.documents || [])
    } catch (err) {
      console.error('Failed to load documents', err)
      toast({
        title: 'Failed to load files',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePickFile = (file: File | null) => {
    if (!file) {
      setUploadFile(null)
      return
    }
    const ext = getExtension(file.name)
    if (!allowedExtensions.includes(ext)) {
      toast({
        title: 'Unsupported file type',
        description: `Allowed: ${allowedExtensions.join(', ')}`,
        variant: 'destructive',
      })
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploadFile(file)
    if (!uploadName.trim()) {
      const dot = file.name.lastIndexOf('.')
      const base = dot > 0 ? file.name.slice(0, dot) : file.name
      setUploadName(base)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      toast({ title: 'Choose a file', variant: 'destructive' })
      return
    }
    if (!uploadName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }

    try {
      setUploading(true)

      const form = new FormData()
      form.append('name', uploadName.trim())
      form.append('category', category)
      form.append('file', uploadFile)

      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/documents/${projectId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Upload failed (${res.status})`)
      }

      const data = await res.json()
      setDocs(prev => [data.document, ...prev])
      setUploadName('')
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast({ title: 'File uploaded', description: data.document.name })
    } catch (err) {
      console.error('Upload failed', err)
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      setActioningId(doc.id)
      const res = await authenticatedFetch(getApiUrl(`documents/${projectId}/${doc.id}/download`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Download failed', err)
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setActioningId(null)
    }
  }

  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    try {
      setActioningId(doc.id)
      const res = await authenticatedFetch(getApiUrl(`documents/${projectId}/${doc.id}`), {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Delete failed (${res.status})`)
      }
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      toast({ title: 'File deleted', description: doc.name })
    } catch (err) {
      console.error('Delete failed', err)
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setActioningId(null)
    }
  }

  const startRename = (doc: ProjectDocument) => {
    setRenamingId(doc.id)
    setRenamingValue(doc.name)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenamingValue('')
  }

  const saveRename = async (doc: ProjectDocument) => {
    const newName = renamingValue.trim()
    if (!newName) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    if (newName === doc.name) {
      cancelRename()
      return
    }
    try {
      setActioningId(doc.id)
      const res = await authenticatedFetch(getApiUrl(`documents/${projectId}/${doc.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Rename failed (${res.status})`)
      }
      setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, name: newName } : d)))
      cancelRename()
      toast({ title: 'Renamed', description: newName })
    } catch (err) {
      console.error('Rename failed', err)
      toast({
        title: 'Rename failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder={namePlaceholder}
              maxLength={255}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
              disabled={uploading}
              {...(accept ? { accept } : {})}
            />
            {allowedExtensions.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Allowed: {allowedExtensions.map(e => `.${e}`).join(', ')}
              </p>
            )}
            {uploadFile && (
              <p className="text-xs text-slate-500 mt-1">
                {uploadFile.name} • {formatBytes(uploadFile.size)}
              </p>
            )}
          </div>

          <div className="md:pt-5">
            <button
              type="submit"
              disabled={uploading || !uploadFile || !uploadName.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">File</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">Size</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">Uploaded by</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
                    </div>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-1">{emptyTitle}</p>
                      <p className="text-sm text-slate-500">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map(doc => {
                  const Icon = fileIconFor(doc.mimeType, doc.originalFilename)
                  const isRenaming = renamingId === doc.id
                  const isBusy = actioningId === doc.id
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        {isRenaming ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renamingValue}
                              autoFocus
                              disabled={isBusy}
                              onChange={(e) => setRenamingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); saveRename(doc) }
                                else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                              }}
                              maxLength={255}
                              className="flex-1 min-w-0 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button type="button" onClick={() => saveRename(doc)} disabled={isBusy} className="p-1 rounded hover:bg-green-100 text-green-600 disabled:opacity-50" title="Save">
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={cancelRename} disabled={isBusy} className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50" title="Cancel">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="group flex items-start gap-2">
                            <Icon className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate" title={doc.name}>{doc.name}</p>
                              <p className="text-xs text-slate-500 truncate" title={doc.originalFilename}>{doc.originalFilename}</p>
                            </div>
                            <button type="button" onClick={() => startRename(doc)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Rename">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {(doc.originalFilename.split('.').pop() || '').toUpperCase() || doc.mimeType}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{formatBytes(doc.sizeBytes)}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {doc.uploader?.name || doc.uploader?.email || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{formatDate(doc.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => handleDownload(doc)} disabled={isBusy} className="p-2 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50" title="Download / open">
                            {isBusy && actioningId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                          <button type="button" onClick={() => handleDelete(doc)} disabled={isBusy} className="p-2 rounded text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Backward-compatible alias
export const DocsTab = ProjectDocumentsTab
