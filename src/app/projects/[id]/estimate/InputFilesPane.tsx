import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload,
  Loader2,
  ArrowLeft,
  ExternalLink,
  FileText,
  FileImage,
  FileQuestion,
  Trash2,
} from 'lucide-react'
import { API_BASE_URL } from '@/config/api'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { toast } from '@/components/ui/use-toast'

interface InputFile {
  id: string
  name: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploader?: { name: string; email: string } | null
}

interface InputFilesPaneProps {
  projectId: number
  canManage: boolean
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

/**
 * How a file can be shown. Only formats the browser renders natively are previewable;
 * CAD needs a conversion step we do not have, so it is offered as a download.
 */
type Previewable = 'pdf' | 'image' | 'none'

const previewKind = (file: InputFile): Previewable => {
  const ext = extensionOf(file.originalFilename)
  if (file.mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (file.mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return 'image'
  }
  return 'none'
}

const iconFor = (file: InputFile) => {
  const kind = previewKind(file)
  if (kind === 'pdf') return FileText
  if (kind === 'image') return FileImage
  return FileQuestion
}

export function InputFilesPane({ projectId, canManage }: InputFilesPaneProps) {
  const [files, setFiles] = useState<InputFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<InputFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`documents/${projectId}?category=DRAWINGS`)
      if (!res.ok) throw new Error(`Failed to load files (${res.status})`)
      const data = await res.json()
      setFiles(data.documents || [])
    } catch (err) {
      toast({
        title: 'Could not load input files',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  // Presigned URLs are short-lived, so one is fetched per selection rather than
  // held for the whole session.
  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewUrl(null)
    authenticatedFetch(`documents/${projectId}/${selected.id}/download`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!cancelled) setPreviewUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: 'Could not open that file', variant: 'destructive' })
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, projectId])

  const upload = async (picked: FileList | null) => {
    if (!picked?.length) return
    setUploading(true)
    const token = localStorage.getItem('auth_token')
    let added = 0

    for (const file of Array.from(picked)) {
      const form = new FormData()
      const dot = file.name.lastIndexOf('.')
      form.append('name', dot > 0 ? file.name.slice(0, dot) : file.name)
      form.append('category', 'DRAWINGS')
      form.append('file', file)

      try {
        // Plain fetch: authenticatedFetch forces a JSON content type, which strips
        // the multipart boundary.
        const res = await fetch(`${API_BASE_URL}/documents/${projectId}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setFiles((prev) => [data.document, ...prev])
        added++
      } catch (err) {
        toast({
          title: `Could not upload ${file.name}`,
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    }

    if (added) toast({ title: `${added} file${added > 1 ? 's' : ''} uploaded` })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = async (file: InputFile) => {
    if (!window.confirm(`Delete "${file.name}"?`)) return
    try {
      const res = await authenticatedFetch(`documents/${projectId}/${file.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      if (selected?.id === file.id) setSelected(null)
      toast({ title: 'File deleted' })
    } catch {
      toast({ title: 'Could not delete that file', variant: 'destructive' })
    }
  }

  if (selected) {
    const kind = previewKind(selected)
    return (
      <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            title="Back to file list"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{selected.name}</p>
            <p className="text-xs text-slate-500 truncate">
              {selected.originalFilename} · {formatBytes(selected.sizeBytes)}
            </p>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              title="Open in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="flex-1 min-h-0 bg-slate-50">
          {previewLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !previewUrl ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              Could not load this file.
            </div>
          ) : kind === 'pdf' ? (
            <iframe src={previewUrl} title={selected.name} className="w-full h-full border-0" />
          ) : kind === 'image' ? (
            <div className="h-full overflow-auto p-3">
              <img src={previewUrl} alt={selected.name} className="max-w-full mx-auto" />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <FileQuestion className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-600">
                <span className="font-semibold uppercase">
                  {extensionOf(selected.originalFilename) || 'This format'}
                </span>{' '}
                cannot be previewed in the browser.
              </p>
              <a
                href={previewUrl}
                download={selected.originalFilename}
                className="uq-btn inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
              >
                Download to open
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Client inputs</h2>
          <p className="text-xs text-slate-500">Drawings and documents this estimate is priced from</p>
        </div>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="uq-btn inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </button>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Upload className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No input files yet</p>
            <p className="text-xs text-slate-500">
              Upload the client's PDF or CAD drawings to price against them.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => {
              const Icon = iconFor(file)
              return (
                <li key={file.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setSelected(file)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </span>
                      <span className="block text-xs text-slate-500 truncate">
                        {(extensionOf(file.originalFilename) || 'file').toUpperCase()} ·{' '}
                        {formatBytes(file.sizeBytes)}
                        {previewKind(file) === 'none' && ' · download only'}
                      </span>
                    </span>
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(file)}
                      className="p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 shrink-0"
                      title={`Delete ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
