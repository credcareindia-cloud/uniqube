import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authenticatedFetch } from '@/utils/authenticatedFetch'
import { CheckCircle, ArrowLeft } from 'lucide-react'

interface Status {
  id: string
  name: string
  color: string
  icon: string
}

interface Panel {
  id: string
  name: string
  tag: string
  objectType: string
  localId: number
  statuses: Array<{ status: Status }>
}

export default function ElementReportPage() {
  const params = useParams()
  const navigate = useNavigate()
  const projectId = params.id as string
  const elementId = params.elementId as string

  const [panel, setPanel] = useState<Panel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [note, setNote] = useState('')
  const [reporterName, setReporterName] = useState('')

  // Load panel data
  useEffect(() => {
    const loadPanelData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('📊 Loading panel data for project:', projectId, 'element:', elementId)

        // Try to fetch from API first
        try {
          const response = await authenticatedFetch(`/panels/${projectId}/all`)
          const data = await response.json()

          console.log('📦 Received panels from API:', data.panels?.length)

          // Find panel by localId (IFC element ID)
          const foundPanel = data.panels?.find((p: any) => 
            p.metadata?.ifcElementId === elementId || 
            p.localId?.toString() === elementId
          )

          if (foundPanel) {
            console.log('✅ Found panel from API:', foundPanel.name)
            setPanel(foundPanel)
            // Pre-select first status if available
            if (foundPanel.statuses && foundPanel.statuses.length > 0) {
              setSelectedStatusId(foundPanel.statuses[0].status.id)
            }
            setLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('⚠️ API not available, falling back to localStorage:', apiError)
        }

        // Fallback to localStorage (for development/demo)
        console.log('📦 Loading from localStorage...')
        const connections = JSON.parse(localStorage.getItem('bim-element-connections') || '[]')
        const statuses = JSON.parse(localStorage.getItem('bim-statuses') || '[]')
        
        const elementConn = connections.find((c: any) => c.elementId === parseInt(elementId))
        
        if (elementConn) {
          // Create a mock panel object from localStorage data
          const mockPanel: Panel = {
            id: elementId,
            name: `Element ${elementId}`,
            tag: elementId,
            objectType: 'IfcDoor',
            localId: parseInt(elementId),
            statuses: elementConn.statusIds?.map((statusId: string) => {
              const status = statuses.find((s: any) => s.id === statusId)
              return status ? { status } : null
            }).filter(Boolean) || []
          }
          
          console.log('✅ Found panel from localStorage:', mockPanel.name)
          setPanel(mockPanel)
          
          if (mockPanel.statuses.length > 0) {
            setSelectedStatusId(mockPanel.statuses[0].status.id)
          }
        } else {
          console.warn('❌ Panel not found for element:', elementId)
          setError('Element not found')
        }
      } catch (err) {
        console.error('❌ Error loading panel data:', err)
        setError('Failed to load element data')
      } finally {
        setLoading(false)
      }
    }

    if (elementId && projectId) {
      loadPanelData()
    }
  }, [elementId, projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStatusId || !note || !reporterName) {
      alert('Please fill in all fields')
      return
    }

    try {
      setSubmitting(true)

      const submission = {
        panelId: panel?.id,
        elementId: parseInt(elementId),
        statusId: selectedStatusId,
        note: note,
        reporter: reporterName,
        timestamp: new Date().toISOString()
      }

      // TODO: Replace with actual API call
      // For now, save to localStorage (matching old behavior)
      const submissions = JSON.parse(localStorage.getItem('bim-element-submissions') || '[]')
      submissions.push({
        id: Date.now().toString(),
        ...submission
      })
      localStorage.setItem('bim-element-submissions', JSON.stringify(submissions))

      // Show success
      setSuccess(true)
      setNote('')
      setReporterName('')

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)

    } catch (err) {
      console.error('Error submitting report:', err)
      alert('Failed to submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !panel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error || 'Element not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="inline w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/95 border-b border-slate-700 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-center">
            <span className="text-white">Element</span>{' '}
            <span className="text-primary">Report</span>
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Element Information Card */}
        <div className="bg-slate-800/95 border border-slate-700 rounded-lg p-6 mb-6 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-primary mb-4 pb-3 border-b border-slate-700">
            Element Information
          </h2>
          
          <div className="space-y-3">
            <div className="flex py-2 border-b border-slate-700/50">
              <div className="w-32 text-primary font-semibold">Name:</div>
              <div className="flex-1 text-slate-200">{panel.name || panel.tag || 'Unnamed'}</div>
            </div>
            <div className="flex py-2 border-b border-slate-700/50">
              <div className="w-32 text-primary font-semibold">ID:</div>
              <div className="flex-1 text-slate-200">{elementId}</div>
            </div>
            <div className="flex py-2 border-b border-slate-700/50">
              <div className="w-32 text-primary font-semibold">Type:</div>
              <div className="flex-1 text-slate-200">{panel.objectType || 'Unknown'}</div>
            </div>
            <div className="flex py-2">
              <div className="w-32 text-primary font-semibold">Statuses:</div>
              <div className="flex-1">
                {panel.statuses && panel.statuses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {panel.statuses.map((ps) => (
                      <span
                        key={ps.status.id}
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${ps.status.color}20`,
                          borderColor: `${ps.status.color}60`,
                          color: ps.status.color,
                          border: '1px solid'
                        }}
                      >
                        {ps.status.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">No statuses assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Form Card */}
        <div className="bg-slate-800/95 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-primary mb-4 pb-3 border-b border-slate-700">
            Submit Report
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Status Selection */}
            <div>
              <label className="block text-primary font-semibold mb-2 text-sm">
                Select Status
              </label>
              <select
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                <option value="">Choose a status...</option>
                {panel.statuses && panel.statuses.map((ps) => (
                  <option key={ps.status.id} value={ps.status.id}>
                    {ps.status.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-primary font-semibold mb-2 text-sm">
                Quick Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                placeholder="Enter your note..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
              />
            </div>

            {/* Reporter Name */}
            <div>
              <label className="block text-primary font-semibold mb-2 text-sm">
                Reporter Name
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                required
                placeholder="Enter your name..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-primary/50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Submit Report
                </span>
              )}
            </button>
          </form>

          {/* Success Message */}
          {success && (
            <div className="mt-6 p-4 bg-green-500/20 border border-green-500/40 rounded-lg text-center text-green-400 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="inline w-5 h-5 mr-2" />
              Report submitted successfully!
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-primary transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Viewer
          </button>
        </div>
      </div>
    </div>
  )
}
