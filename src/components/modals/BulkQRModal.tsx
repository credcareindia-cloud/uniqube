'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/utils/authenticatedFetch'

interface Panel {
  id: string
  name: string
  tag?: string
}

interface BulkQRModalProps {
  isOpen: boolean
  onClose: () => void
  panels: Panel[] // Fallback for panels we already have
  selectedPanelIds: string[] // ALl selected IDs, even across pages
  projectId: string | number
}

interface GeneratedQR {
  panel: Panel
  qrUrl: string
}

export function BulkQRModal({ isOpen, onClose, panels, selectedPanelIds, projectId }: BulkQRModalProps) {
  const [isGeneratingServer, setIsGeneratingServer] = useState(false)
  const [isProcessingDownload, setIsProcessingDownload] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([])
  
  const [includeName, setIncludeName] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(true)

  useEffect(() => {
    if (isOpen && selectedPanelIds.length > 0 && projectId) {
      generateAllQRCodes()
    } else {
      setGeneratedQRs([])
      setError(null)
      setProgress(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId])

  const generateAllQRCodes = async () => {
    setIsGeneratingServer(true)
    setError(null)
    setGeneratedQRs([])
    setProgress(0)
    
    // Safety check for massive downloads
    if (selectedPanelIds.length >= 1000) {
        setError('Cannot generate more than 1000 QR codes at once. Please select fewer panels.')
        setIsGeneratingServer(false)
        return
    }
    
    const results: GeneratedQR[] = []
    const baseUrl = window.location.origin
    const knownPanelsMap = new Map<string, Panel>(panels.map(p => [String(p.id), p]))

    try {
      // Chunk requests to avoid overwhelming the server, or run sequentially
      for (let i = 0; i < selectedPanelIds.length; i++) {
        const panelId = selectedPanelIds[i]
        
        // Fallback panel obj if not currently loaded on page
        const panelObj = knownPanelsMap.get(String(panelId)) || { id: String(panelId), name: `Panel ${panelId}` }
        
        try {
          const response = await authenticatedFetch(getApiUrl('qr-codes/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              panelId: panelId.toString(),
              projectId: typeof projectId === 'string' ? parseInt(projectId) : projectId
            })
          })

          if (!response.ok) {
            console.warn(`Failed to generate QR for panel ${panelId}`)
            continue
          }

          const data = await response.json()
          
          // Use real panel name if backend returns it
          const finalPanel = data.qrCode?.panel ? {
              id: String(panelId),
              name: data.qrCode.panel.name || panelObj.name,
              tag: data.qrCode.panel.tag || panelObj.tag
          } : panelObj

          results.push({
            panel: finalPanel,
            qrUrl: `${baseUrl}/qr/${data.qrCode.id}`
          })
        } catch (err) {
          console.error(`Error with panel ${panelId}`, err)
        }
        
        // Update progress
        setProgress(Math.round(((i + 1) / selectedPanelIds.length) * 100))
      }

      setGeneratedQRs(results)
      if (results.length === 0 && selectedPanelIds.length > 0) {
        setError('Failed to generate any QR codes.')
      } else if (results.length < selectedPanelIds.length && selectedPanelIds.length > 0) {
        setError(`Only generated ${results.length} out of ${selectedPanelIds.length} QR codes successfully.`)
      }
    } catch (err: any) {
      console.error('Error generating QR codes:', err)
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsGeneratingServer(false)
    }
  }

  // Pre-load logo to avoid loading it 500 times
  const loadLogo = async (): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const logo = new Image()
      logo.crossOrigin = 'anonymous'
      logo.onload = () => resolve(logo)
      logo.onerror = () => reject(new Error('Failed to load logo'))
      logo.src = '/Uniqube_QR_logo.jpg'
    })
  }

  const createStickerCanvas = async (qrData: GeneratedQR, logoImg: HTMLImageElement | null) => {
    const DPI = 300
    const stickerWidth = 3 * DPI
    const stickerHeight = 1.5 * DPI
    const qrSize = 1.2 * DPI
    const panelName = qrData.panel.name || qrData.panel.tag || 'Unknown Panel'

    const stickerCanvas = document.createElement('canvas')
    stickerCanvas.width = stickerWidth
    stickerCanvas.height = stickerHeight
    const ctx = stickerCanvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    // Fill background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, stickerWidth, stickerHeight)

    // Generate QR
    const qrCanvas = document.createElement('canvas')
    await QRCode.toCanvas(qrCanvas, qrData.qrUrl, {
      width: qrSize,
      margin: 0,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    })

    const qrX = 60
    const qrY = (stickerHeight - qrSize) / 2
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    // Logo
    let logoY = 20
    let logoHeight = 0
    let logoWidth = 0
    const logoX_start = stickerWidth - 30

    if (logoImg) {
      const rightAreaX = qrX + qrSize + 40
      const rightAreaWidth = stickerWidth - rightAreaX - 30
      const maxLogoHeight = 200

      logoWidth = logoImg.width
      logoHeight = logoImg.height

      const scaleWidth = rightAreaWidth / logoWidth
      const scaleHeight = maxLogoHeight / logoHeight
      const scale = Math.min(scaleWidth, scaleHeight, 1)

      logoWidth = logoWidth * scale
      logoHeight = logoHeight * scale

      const logoX = stickerWidth - logoWidth - 30
      logoY = 20

      if (includeLogo) {
        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight)
      }
    }

    if (includeName && panelName) {
      const minPaddingFromQR = 20
      const preferredPaddingFromEdge = 100
      const minPaddingFromEdge = 50

      const textAreaStartX = qrX + qrSize + minPaddingFromQR

      ctx.fillStyle = '#000000'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      let fontSize = 72
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`

      let textAreaEndX = stickerWidth - preferredPaddingFromEdge
      let textAreaWidth = textAreaEndX - textAreaStartX
      let textWidth = ctx.measureText(panelName).width

      if (textWidth > textAreaWidth) {
        textAreaEndX = stickerWidth - minPaddingFromEdge
        textAreaWidth = textAreaEndX - textAreaStartX
      }

      let lines = [panelName]
      let isMultiLine = false

      let tempFontSize = fontSize
      while (ctx.measureText(panelName).width > textAreaWidth && tempFontSize > 40) {
        tempFontSize -= 2
        ctx.font = `700 ${tempFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
      }

      if (ctx.measureText(panelName).width > textAreaWidth) {
        isMultiLine = true
        const mid = Math.floor(panelName.length / 2)
        const separators = ['_', '-', ' ']
        let splitIndex = -1
        let minDistance = panelName.length

        for (let i = 0; i < panelName.length; i++) {
          if (separators.includes(panelName[i])) {
            const distance = Math.abs(i - mid)
            if (distance < minDistance) {
              minDistance = distance
              splitIndex = i
            }
          }
        }

        splitIndex = splitIndex === -1 ? mid : splitIndex + 1
        lines = [panelName.substring(0, splitIndex), panelName.substring(splitIndex)]
        fontSize = 72
        ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
      }

      let maxLineWidth = 0
      lines.forEach(line => {
        const width = ctx.measureText(line).width
        if (width > maxLineWidth) maxLineWidth = width
      })

      while (maxLineWidth > textAreaWidth && fontSize > 24) {
        fontSize -= 2
        ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
        maxLineWidth = 0
        lines.forEach(line => {
          const width = ctx.measureText(line).width
          if (width > maxLineWidth) maxLineWidth = width
        })
      }

      const logoBottom = logoY + logoHeight + 10
      const stickerBottom = stickerHeight - 10
      const availableVerticalSpace = stickerBottom - logoBottom
      const verticalCenter = logoBottom + (availableVerticalSpace / 2)
      const lineHeight = fontSize * 1.1

      if (isMultiLine) {
        const line1Y = verticalCenter - (lineHeight / 2) + (fontSize * 0.1)
        const line2Y = verticalCenter + (lineHeight / 2) + (fontSize * 0.1)
        const textX = textAreaEndX

        const width1 = ctx.measureText(lines[0]).width
        const width2 = ctx.measureText(lines[1]).width

        if (width1 < width2) {
          const bottomLineStart = textX - width2
          const bottomLineCenter = bottomLineStart + (width2 / 2)
          const topLineStart = bottomLineCenter - (width1 / 2)

          ctx.textAlign = 'left'
          ctx.fillText(lines[0], topLineStart, line1Y)
          ctx.textAlign = 'right'
          ctx.fillText(lines[1], textX, line2Y)
        } else {
          ctx.fillText(lines[0], textX, line1Y, textAreaWidth)
          ctx.fillText(lines[1], textX, line2Y, textAreaWidth)
        }
      } else {
        const textY = verticalCenter + (fontSize * 0.1)
        const textX = textAreaEndX
        ctx.fillText(panelName, textX, textY, textAreaWidth)
      }
    }
    
    return stickerCanvas
  }

  const downloadStickersJPGZip = async () => {
    if (generatedQRs.length === 0) return
    setIsProcessingDownload(true)
    setProgress(0)

    try {
      const zip = new JSZip()
      
      let logoImg: HTMLImageElement | null = null
      try {
        logoImg = await loadLogo()
      } catch (e) {
        console.warn('Could not load logo for bulk JPG layout', e)
      }

      for (let i = 0; i < generatedQRs.length; i++) {
        const qrData = generatedQRs[i]
        const canvas = await createStickerCanvas(qrData, logoImg)
        const panelName = qrData.panel.name || qrData.panel.tag || `Panel_${qrData.panel.id}`
        const safeName = panelName.replace(/[^a-z0-9]/gi, '_')

        // Convert canvas to blob and add to zip
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
        if (blob) {
          zip.file(`${safeName}_sticker.jpg`, blob)
        }

        setProgress(Math.round(((i + 1) / generatedQRs.length) * 100))
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Uniqube_QRCodes_${new Date().getTime()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Error generating bulk ZIP:', err)
      alert('Failed to generate ZIP file. Please try again.')
    } finally {
      setIsProcessingDownload(false)
      setProgress(0)
    }
  }

  const downloadStickersPDF = async () => {
    if (generatedQRs.length === 0) return
    setIsProcessingDownload(true)
    setProgress(0)

    try {
      let logoImg: HTMLImageElement | null = null
      try {
        logoImg = await loadLogo()
      } catch (e) {
        console.warn('Could not load logo for bulk PDF layout', e)
      }

      const imageDataUrls: string[] = []

      for (let i = 0; i < generatedQRs.length; i++) {
        const qrData = generatedQRs[i]
        const canvas = await createStickerCanvas(qrData, logoImg)
        imageDataUrls.push(canvas.toDataURL('image/jpeg', 0.95))
        setProgress(Math.round(((i + 1) / generatedQRs.length) * 100))
      }

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Failed to open print window. Please allow popups.')
      }

      // Generate HTML with grid of images
      const imagesHtml = imageDataUrls.map(url => `
        <div class="sticker-container">
          <img src="${url}" alt="QR Code Sticker" />
        </div>
      `).join('')

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code Stickers</title>
            <style>
              @page { size: portrait; margin: 10mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                background: white;
                font-family: sans-serif;
              }
              .grid {
                display: flex;
                flex-wrap: wrap;
                gap: 5mm;
                justify-content: center;
              }
              .sticker-container {
                width: calc(50% - 5mm); /* Two columns */
                aspect-ratio: 2 / 1;
                border: 1px dotted #ccc;
                padding: 1mm;
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                margin-bottom: 5mm;
              }
              img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
              @media print {
                .sticker-container {
                  border: none; /* remove borders for actual printing */
                }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${imagesHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 100);
                }, 1000);
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()

    } catch (err) {
      console.error('Error generating bulk PDF:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsProcessingDownload(false)
      setProgress(0)
    }
  }

  if (!isOpen) return null

  const isBusy = isGeneratingServer || isProcessingDownload

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={!isBusy ? onClose : undefined}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-300">
          <h2 className="text-xl font-bold text-slate-900">Download QR Codes</h2>
          {!isBusy && (
            <button onClick={onClose} className="p-2 text-slate-600 hover:text-slate-900 transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col">
          {isBusy && (
            <div className="flex flex-col items-center justify-center min-h-[250px] py-8">
              <Loader2 className="h-12 w-12 text-slate-800 animate-spin mb-6" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {isGeneratingServer ? 'Generating QR Codes...' : 'Generating Layouts...'}
              </h3>
              <div className="w-full max-w-sm bg-slate-200 rounded-full h-2.5 mb-2">
                <div className="bg-slate-800 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-sm text-slate-500">{progress}% Completed</p>
            </div>
          )}

          {!isBusy && generatedQRs.length > 0 && (
            <div className="flex flex-col">
              <div className="flex items-center justify-center mb-8 gap-3 bg-slate-100 text-slate-800 p-4 rounded-lg border border-slate-300">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <p className="font-semibold text-sm">Successfully generated {generatedQRs.length} QR codes</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-sm flex gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 mb-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Sticker Layout Options</h4>
                
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeName}
                      onChange={(e) => setIncludeName(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-800 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">Include panel name on stickers</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={includeLogo}
                      onChange={(e) => setIncludeLogo(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-800 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">Include company logo on stickers</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadStickersJPGZip}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download ZIP (JPGs)
                </button>
                <button
                  onClick={downloadStickersPDF}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Print / Save as PDF
                </button>
              </div>
            </div>
          )}

          {!isBusy && generatedQRs.length === 0 && error && (
            <div className="flex flex-col items-center justify-center min-h-[250px] text-red-500">
              <AlertTriangle className="h-12 w-12 mb-4" />
              <p className="text-base font-semibold">Failed to fetch QR codes</p>
              <p className="mt-2 text-sm text-center max-w-[80%]">{error}</p>
              <button
                onClick={generateAllQRCodes}
                className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
