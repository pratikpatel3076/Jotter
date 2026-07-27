export async function extractSearchText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file)
  }
  if (file.type.startsWith('image/')) {
    return extractImageText(file)
  }
  if (file.type.startsWith('text/') || /\.(md|markdown|txt|csv|json)$/i.test(file.name)) {
    return file.text()
  }
  return ''
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjsLib.getDocument({ data }).promise
  const chunks: string[] = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const text = await page.getTextContent()
    chunks.push(
      text.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' '),
    )
  }
  return chunks.join('\n').trim()
}

async function extractImageText(file: File): Promise<string> {
  const Tesseract = await import('tesseract.js')
  const result = await Tesseract.recognize(file, 'eng')
  return result.data.text.trim()
}

export function fileKind(file: File): 'photo' | 'pdf' | 'file' {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'file'
}
