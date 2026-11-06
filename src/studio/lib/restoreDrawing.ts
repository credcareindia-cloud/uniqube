import { studioAuthHeaders } from './api'
import { useAppStore } from '../store'

/** Put the request PDF back onto a document whose bytes were never saved. */
export async function restoreMissingDrawings(studioId: string) {
  const projectNumber = Number(/^p(\d+)$/.exec(studioId)?.[1])
  if (!projectNumber) return
  const headers = studioAuthHeaders()
  const listRes = await fetch('/api/quotes', { headers })
  if (!listRes.ok) return
  const rows = (await listRes.json()) as Array<{
    id: string
    projectId: number | null
    drawingName: string | null
    hasDrawing: boolean
  }>
  const quote = rows.find((row) => row.projectId === projectNumber && row.hasDrawing && row.drawingName)
  const name = quote?.drawingName
  if (!quote || !name || !name.toLowerCase().endsWith('.pdf')) return
  const docs = useAppStore.getState().documents
  const same = (doc: (typeof docs)[number]) => doc.name === name || doc.sourceName === name || doc.file?.name === name
  const match = docs.find(same)
  if (match && match.file.size > 0) return
  const fileRes = await fetch(`/api/quotes/${quote.id}/files/drawing`, { headers })
  if (!fileRes.ok) return
  const file = new File([await fileRes.blob()], name, { type: 'application/pdf' })
  if (match) useAppStore.getState().replaceDocumentFile(match.id, file)
  else await useAppStore.getState().addClientFiles([file], [{ name, category: 'drawing' }])
}
