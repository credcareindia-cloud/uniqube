'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, FileText, Loader2, AlertTriangle } from 'lucide-react'
import QRCode from 'qrcode'
import { getApiUrl } from '@/config/api'
import { authenticatedFetch } from '@/utils/authenticatedFetch'

interface QRModalProps {
  isOpen: boolean
  onClose: () => void
  panelId: string
  panelName: string
  projectId: string | number
}

export function QRModal({ isOpen, onClose, panelId, panelName, projectId }: QRModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  
  const [includeName, setIncludeName] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isOpen && panelId && projectId) {
      generateQRCode()
    } else {
      setQrUrl(null)
      setError(null)
    }
  }, [isOpen, panelId, projectId])

  const generateQRCode = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await authenticatedFetch(getApiUrl('qr-codes/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          panelId: panelId.toString(),
          projectId: typeof projectId === 'string' ? parseInt(projectId) : projectId
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to generate QR code: ${response.statusText}`)
      }

      const data = await response.json()
      
      const baseUrl = window.location.origin
      const url = `${baseUrl}/qr/${data.qrCode.id}`
      setQrUrl(url)

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
      }
    } catch (err: any) {
      console.error('Error generating QR code:', err)
      setError(err.message || 'Please try again later')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadStickerJPG = async () => {
    if (!qrUrl) return

    try {
      const DPI = 300
      const stickerWidth = 3 * DPI
      const stickerHeight = 1.5 * DPI
      const qrSize = 1.2 * DPI

      const stickerCanvas = document.createElement('canvas')
      stickerCanvas.width = stickerWidth
      stickerCanvas.height = stickerHeight
      const ctx = stickerCanvas.getContext('2d')

      if (!ctx) throw new Error('Could not get canvas context')

      // Fill background
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, stickerWidth, stickerHeight)

      // Generate QR
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, qrUrl, {
        width: qrSize,
        margin: 0,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      })

      const qrX = 60
      const qrY = (stickerHeight - qrSize) / 2
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

      // LOGO RENDERING
      let logoY = 20
      let logoHeight = 0

      try {
        const logo = new Image()
        logo.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve()
          logo.onerror = () => reject(new Error('Failed to load logo'))
          logo.src = '/Uniqube_QR_logo.jpg'
        })

        const rightAreaX = qrX + qrSize + 40
        const rightAreaWidth = stickerWidth - rightAreaX - 30
        const maxLogoHeight = 200

        let logoWidth = logo.width
        logoHeight = logo.height

        const scaleWidth = rightAreaWidth / logoWidth
        const scaleHeight = maxLogoHeight / logoHeight
        const scale = Math.min(scaleWidth, scaleHeight, 1)

        logoWidth = logoWidth * scale
        logoHeight = logoHeight * scale

        const logoX = stickerWidth - logoWidth - 30
        logoY = 20

        if (includeLogo) {
          ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
        }
      } catch (err) {
        console.warn('Could not load logo for layout calculation', err)
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

          if (splitIndex === -1) {
            splitIndex = mid
          } else {
            splitIndex += 1
          }

          lines = [
            panelName.substring(0, splitIndex),
            panelName.substring(splitIndex)
          ]

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

      stickerCanvas.toBlob((blob) => {
        if (!blob) throw new Error('Failed to generate sticker image')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${panelName.replace(/[^a-z0-9]/gi, '_')}_sticker.jpg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 'image/jpeg', 0.95)

    } catch (err) {
      console.error('Error generating sticker:', err)
      alert('Failed to generate sticker. Please try again.')
    }
  }

  const downloadStickerPDF = async () => {
    if (!qrUrl) return

    try {
      const DPI = 300
      const stickerWidth = 3 * DPI
      const stickerHeight = 1.5 * DPI
      const qrSize = 1.2 * DPI

      const stickerCanvas = document.createElement('canvas')
      stickerCanvas.width = stickerWidth
      stickerCanvas.height = stickerHeight
      const ctx = stickerCanvas.getContext('2d')

      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, stickerWidth, stickerHeight)

      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, qrUrl, {
        width: qrSize,
        margin: 0,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      })

      const qrX = 60
      const qrY = (stickerHeight - qrSize) / 2
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

      // LOGO RENDERING
      let logoY = 20
      let logoHeight = 0

      try {
        const logo = new Image()
        logo.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve()
          logo.onerror = () => reject(new Error('Failed to load logo'))
          logo.src = '/Uniqube_QR_logo.jpg'
        })

        const rightAreaX = qrX + qrSize + 40
        const rightAreaWidth = stickerWidth - rightAreaX - 30
        const maxLogoHeight = 200

        let logoWidth = logo.width
        logoHeight = logo.height

        const scaleWidth = rightAreaWidth / logoWidth
        const scaleHeight = maxLogoHeight / logoHeight
        const scale = Math.min(scaleWidth, scaleHeight, 1)

        logoWidth = logoWidth * scale
        logoHeight = logoHeight * scale

        const logoX = stickerWidth - logoWidth - 30
        logoY = 20

        if (includeLogo) {
          ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
        }
      } catch (err) {
        console.warn('Could not load logo for layout calculation', err)
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

          if (splitIndex === -1) {
            splitIndex = mid
          } else {
            splitIndex += 1
          }

          lines = [
            panelName.substring(0, splitIndex),
            panelName.substring(splitIndex)
          ]

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

      const imageDataUrl = stickerCanvas.toDataURL('image/jpeg', 0.95)

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Failed to open print window. Please allow popups.')
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code Sticker - ${panelName}</title>
            <style>
              @page { size: landscape; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body {
                width: 100%; height: 100%; margin: 0; padding: 0;
                display: flex; align-items: center; justify-content: center;
                background: white;
              }
              img {
                max-width: 90%; max-height: 90%;
                width: auto; height: auto; display: block; object-fit: contain;
              }
              @media print {
                html, body {
                  width: 100%; height: 100%;
                  display: flex; align-items: center; justify-content: center;
                }
                img { max-width: 90%; max-height: 90%; }
              }
            </style>
          </head>
          <body>
            <img src="${imageDataUrl}" alt="QR Code Sticker" />
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 100);
                }, 500);
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()

    } catch (err) {
      console.error('Error generating PDF sticker:', err)
      alert('Failed to generate PDF sticker. Please try again.')
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-300">
          <h2 className="text-xl font-bold text-slate-900">Element QR Code</h2>
          <button onClick={onClose} className="p-2 text-slate-600 hover:text-slate-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {isLoading && (
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="h-10 w-10 text-slate-500 animate-spin" />
              <p className="mt-4 text-slate-500">Generating QR code...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-red-500">
              <AlertTriangle className="h-12 w-12 mb-4" />
              <p className="text-base font-semibold">Failed to generate QR code</p>
              <p className="mt-2 text-sm text-center max-w-[80%]">{error}</p>
            </div>
          )}

          <div
            className={`flex flex-col items-center w-full ${(isLoading || error) ? 'hidden' : 'block'}`}
          >
            <div className="flex justify-center mb-6">
              <canvas ref={canvasRef} id="qr-canvas"></canvas>
            </div>

            <div className="w-full">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-slate-700 mb-2">{panelName}</h4>
                <p className="text-sm text-slate-500">
                  Scan this QR code to view element details and submit reports
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="print-with-name"
                  checked={includeName}
                  onChange={(e) => setIncludeName(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-600 cursor-pointer accent-slate-600"
                />
                <label htmlFor="print-with-name" className="text-sm text-slate-600 cursor-pointer select-none">
                  Include panel name on QR code
                </label>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <input
                  type="checkbox"
                  id="print-with-logo"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-600 cursor-pointer accent-slate-600"
                />
                <label htmlFor="print-with-logo" className="text-sm text-slate-600 cursor-pointer select-none">
                  Include company logo on QR code
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={downloadStickerJPG}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  JPG
                </button>
                <button
                  onClick={downloadStickerPDF}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
