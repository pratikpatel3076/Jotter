import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  url?: string
  data?: ArrayBuffer
  fileName?: string
  className?: string
}

export function PDFViewer({ url, data, fileName, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<unknown>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const pdfjsLib = await import('pdfjs-dist')
        // Use local worker to avoid CORS issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url,
        ).toString()

        let loadingTask
        if (data) {
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) })
        } else if (url) {
          loadingTask = pdfjsLib.getDocument(url)
        } else {
          return
        }

        const pdfDoc = await loadingTask.promise
        if (cancelled) return
        setPdf(pdfDoc)
        setTotalPages(pdfDoc.numPages)
        setPage(1)
      } catch (e) {
        if (!cancelled) setError('Failed to load PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [url, data])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    async function render() {
      try {
        const pdfDoc = pdf as { getPage: (n: number) => Promise<unknown> }
        const pdfPage = await pdfDoc.getPage(page) as {
          getViewport: (o: { scale: number }) => { width: number; height: number }
          render: (ctx: unknown) => { promise: Promise<void> }
        }
        const viewport = pdfPage.getViewport({ scale })
        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')!
        canvas.width = viewport.width
        canvas.height = viewport.height
        if (!cancelled) {
          await pdfPage.render({ canvasContext: context, viewport }).promise
        }
      } catch { }
    }
    render()
    return () => { cancelled = true }
  }, [pdf, page, scale])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center rounded-xl bg-surface-2 p-8', className)}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center rounded-xl bg-red-950/20 p-8 text-sm text-red-400', className)}>
        {error}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col rounded-xl border border-border/60 bg-surface-2 overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setScale((s) => Math.min(3, s + 0.2))} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setScale(1.2)} title="Reset zoom">
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {url && (
          <a href={url} download={fileName ?? 'document.pdf'} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon-sm" title="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
      </div>

      {/* Canvas */}
      <div className="overflow-auto p-3">
        <canvas
          ref={canvasRef}
          className="mx-auto rounded-lg shadow-lg max-w-full"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}
