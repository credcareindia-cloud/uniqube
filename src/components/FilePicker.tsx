import { useId, useRef, useState } from 'react'

export function FilePicker({
  label,
  name,
  accept,
  required,
  title,
  hint,
}: {
  label: string
  name: string
  accept: string
  required?: boolean
  title: string
  hint: string
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const [reject, setReject] = useState('')

  const allowed = (next: File) => accept.split(',').some((ext) => next.name.toLowerCase().endsWith(ext.trim().toLowerCase()))

  const take = (next: File | null) => {
    const input = inputRef.current
    if (!input) return
    if (next && !allowed(next)) {
      setReject(hint)
      return
    }
    if (next) {
      const transfer = new DataTransfer()
      transfer.items.add(next)
      input.files = transfer.files
    } else {
      input.value = ''
    }
    setReject('')
    setFile(next)
  }

  return (
    <div className="block text-sm font-medium">
      <span className="text-slate-900">{label}</span>
      <div
        className={`relative mt-1 rounded-2xl border border-dashed px-4 py-3.5 transition ${
          over ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-slate-50/60'
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer.files?.[0] ?? null)
        }}
      >
        <input
          id={id}
          ref={inputRef}
          name={name}
          type="file"
          required={required}
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null
            if (next && !allowed(next)) {
              event.target.value = ''
              setFile(null)
              setReject(hint)
              return
            }
            setReject('')
            setFile(next)
          }}
        />
        {file ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <FileMark />
            <div className="min-w-0 flex-1 basis-40">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs font-normal text-slate-500">{formatSize(file.size)}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-semibold text-slate-700 hover:text-slate-950">
                Replace
              </button>
              <button type="button" onClick={() => take(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor={id} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
              <UploadMark />
            </span>
            <span className="min-w-0 flex-1 basis-40">
              <span className="block text-sm font-medium text-slate-900">{title}</span>
              <span className="block text-xs font-normal text-slate-500">{hint}</span>
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-[#010127] px-3.5 py-2 text-xs font-semibold text-white">
              Choose file
            </span>
          </label>
        )}
      </div>
      {reject && <p className="mt-1 text-xs font-normal text-red-600">That file type is not accepted. {reject}</p>}
    </div>
  )
}

function UploadMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V5m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FileMark() {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 3.8V8h4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
