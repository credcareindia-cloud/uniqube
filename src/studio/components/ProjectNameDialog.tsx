import { useEffect, useRef, useState } from 'react'

export function ProjectNameDialog({
  busy,
  error,
  onCancel,
  onSave,
}: {
  busy: boolean
  error: string | null
  onCancel: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={() => {
        if (!busy) onCancel()
      }}
    >
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || busy) return
          onSave(name)
        }}
      >
        <h2>New project</h2>
        <label className="modal__field">
          Project name
          <input
            ref={inputRef}
            value={name}
            placeholder="Tower A — curtain wall"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && <p className="modal__error">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="modal__save" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
