import { useCallback, useState } from 'react'
import { FileUp } from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../store'

export function DropZone({ compact }: { compact?: boolean }) {
  const ingestFile = useAppStore((s) => s.ingestFile)
  const status = useAppStore((s) => s.status)
  const [over, setOver] = useState(false)

  const onFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0]
      if (f) void ingestFile(f)
    },
    [ingestFile],
  )

  return (
    <label
      className={clsx('dropzone', compact && 'dropzone--compact', over && 'dropzone--over')}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles(e.dataTransfer.files)
      }}
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        hidden
        disabled={status === 'analyzing'}
        onChange={(e) => onFiles(e.target.files)}
      />
      <FileUp size={compact ? 18 : 28} strokeWidth={1.5} />
      <div>
        <strong>Drop client drawing PDF</strong>
        <span>Elevations, plans, redlines — quality is classified automatically</span>
      </div>
    </label>
  )
}
