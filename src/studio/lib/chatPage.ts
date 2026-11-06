export type ChatPageRef = {
  fileId: string
  fileName: string
  pageNumber: number
}

export type ChatLinePin = {
  tag: string
  system: string
  widthMm: number
  heightMm: number
  type: string
  quantity: number
  unit: string
  unitPrice: number
  notes: string
  pageRef?: number
}

/** Hide the page pin from the bubble, and keep the instruction in the text the model reads. */
export function encodePageMessage(ref: ChatPageRef, question: string) {
  const pin = JSON.stringify({
    fileId: ref.fileId,
    pageNumber: ref.pageNumber,
    fileName: ref.fileName,
  })
  const note = `Read page ${ref.pageNumber} of this file with readPage before you answer. fileId: ${ref.fileId}. fileName: ${ref.fileName}.`
  return `@page ${pin}\n${note}\n\n${question.trim()}`
}

export function decodePageMessage(text: string): { ref: ChatPageRef; question: string } | null {
  const pin = decodeChatPin(text)
  if (!pin?.page) return null
  return { ref: pin.page, question: pin.question }
}

export function encodeChatPin(
  pin: { page?: ChatPageRef | null; lines?: ChatLinePin[] },
  question: string,
) {
  const head: string[] = []
  const notes: string[] = []
  if (pin.page) {
    head.push(
      `@page ${JSON.stringify({ fileId: pin.page.fileId, pageNumber: pin.page.pageNumber, fileName: pin.page.fileName })}`,
    )
    notes.push(
      `Read page ${pin.page.pageNumber} of this file with readPage before you answer. fileId: ${pin.page.fileId}. fileName: ${pin.page.fileName}.`,
    )
  }
  if (pin.lines?.length) {
    head.push(`@lines ${JSON.stringify(pin.lines)}`)
    notes.push(
      'Answer about these canvas lines. Use their tags, sizes, quantities, and rates. If a line has pageRef, call readPage for that page.',
    )
  }
  if (!head.length) return question.trim()
  return `${head.join('\n')}\n${notes.join(' ')}\n\n${question.trim()}`
}

export function decodeChatPin(text: string): { page: ChatPageRef | null; lines: ChatLinePin[]; question: string } | null {
  if (!text.startsWith('@page ') && !text.startsWith('@lines ')) return null
  const blank = text.indexOf('\n\n')
  if (blank < 0) return null
  let page: ChatPageRef | null = null
  let lines: ChatLinePin[] = []
  for (const line of text.slice(0, blank).split('\n')) {
    if (line.startsWith('@page ')) {
      try {
        const raw = JSON.parse(line.slice(6)) as Partial<ChatPageRef>
        if (typeof raw.fileId === 'string' && typeof raw.fileName === 'string' && typeof raw.pageNumber === 'number') {
          page = { fileId: raw.fileId, fileName: raw.fileName, pageNumber: raw.pageNumber }
        }
      } catch {
        /* ignore a bad pin */
      }
    }
    if (line.startsWith('@lines ')) {
      try {
        const raw = JSON.parse(line.slice(7)) as unknown
        if (Array.isArray(raw)) {
          lines = raw.flatMap((item) => {
            if (!item || typeof item !== 'object') return []
            const row = item as Partial<ChatLinePin>
            if (typeof row.tag !== 'string') return []
            return [
              {
                tag: row.tag,
                system: typeof row.system === 'string' ? row.system : '',
                widthMm: typeof row.widthMm === 'number' ? row.widthMm : 0,
                heightMm: typeof row.heightMm === 'number' ? row.heightMm : 0,
                type: typeof row.type === 'string' ? row.type : '',
                quantity: typeof row.quantity === 'number' ? row.quantity : 0,
                unit: typeof row.unit === 'string' ? row.unit : '',
                unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : 0,
                notes: typeof row.notes === 'string' ? row.notes : '',
                pageRef: typeof row.pageRef === 'number' ? row.pageRef : undefined,
              },
            ]
          })
        }
      } catch {
        /* ignore a bad pin */
      }
    }
  }
  if (!page && lines.length === 0) return null
  return { page, lines, question: text.slice(blank + 2).trim() }
}
