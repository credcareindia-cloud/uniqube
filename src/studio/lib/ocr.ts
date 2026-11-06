type RecognizeFn = (
  image: string,
  lang: string,
  opts?: { logger?: (m: { status: string; progress: number }) => void },
) => Promise<{ data: { text: string } }>

export async function runOcr(
  imageDataUrl: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const mod = (await import('tesseract.js')) as {
    recognize?: RecognizeFn
    default?: { recognize?: RecognizeFn }
  }

  const recognize = mod.recognize ?? mod.default?.recognize
  if (!recognize) {
    throw new Error('tesseract.js recognize() not available')
  }

  const result = await recognize(imageDataUrl, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress)
      }
    },
  })
  return result.data.text ?? ''
}
