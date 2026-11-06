import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '@/config/api'
import { FilePicker } from '@/components/FilePicker'

export default function QuotePage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickerKey, setPickerKey] = useState(0)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = event.currentTarget
    try {
      const response = await fetch(getApiUrl('quotes'), { method: 'POST', body: new FormData(form) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.message || data.error || 'Could not send the request')
        return
      }
      setSent(true)
      form.reset()
      setPickerKey((key) => key + 1)
    } catch {
      setError('Could not reach Uniqube. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto bg-white text-slate-900">
      <header className="flex items-center justify-between px-5 sm:px-8 h-16 bg-white border-b border-slate-200">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-wide text-slate-900">
          <img src="/UniQube_Logo.png" alt="UNIQUBE" className="h-11 w-auto object-contain" />
        </Link>
        <Link to="/login" className="text-sm text-slate-700">Login</Link>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 grid lg:grid-cols-[1fr_1.1fr] gap-10 items-start">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500">Estimate within 24 hours</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-slate-950">Upload your floor plans for an accurate estimate.</h1>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Send the project name, a note, and the drawings. Include an IFC model if one is available. UniQube will return an estimate within 24 hours.
          </p>
          <img src="/os/steel.jpg" alt="Light-gauge steel frame" className="mt-8 h-64 w-full object-cover rounded-3xl hidden lg:block" />
        </div>

        <form onSubmit={submit} className="bg-white rounded-3xl border border-black/5 p-6 sm:p-8 space-y-4 shadow-sm">
          {sent && (
            <p className="rounded-xl bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
              Received. You will have an estimate within 24 hours.
            </p>
          )}
          {error && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>}

          <Field label="Your name" name="name" required placeholder="Your name" />
          <Field label="Email" name="email" type="email" required placeholder="you@studio.com" />
          <Field label="Project name" name="projectName" required placeholder="Project name" />
          <label className="block text-sm font-medium">
            Note
            <textarea name="note" required rows={4} placeholder="Location, size, and what you would like priced." className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <FilePicker
            key={`drawing-${pickerKey}`}
            label="Drawing"
            name="drawing"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf"
            required
            title="Drop a drawing here"
            hint="PDF, image, DWG, or DXF"
          />
          <FilePicker
            key={`model-${pickerKey}`}
            label="3D model"
            name="model"
            accept=".ifc"
            title="Drop an IFC model here"
            hint="Optional, if you already have the model"
          />
          <button type="submit" disabled={busy} className="w-full rounded-full bg-[#010127] text-white py-3 font-semibold disabled:opacity-60">
            {busy ? 'Sending…' : 'Request an estimate'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
    </label>
  )
}
