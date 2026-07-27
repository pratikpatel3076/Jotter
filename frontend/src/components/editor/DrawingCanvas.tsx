import { useRef, useEffect, useState, useCallback } from 'react'
import { Pen, Eraser, Minus, Plus, Trash2, Undo2, Download, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  content: string
  onChange: (dataUrl: string) => void
  readOnly?: boolean
}

type Tool = 'pen' | 'eraser'

const COLORS = ['#f0f0f4', '#6366f1', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#eab308', '#ec4899', '#14b8a6', '#000000']

interface Point { x: number; y: number }
interface Stroke { tool: Tool; color: string; size: number; points: Point[] }

export function DrawingCanvas({ content, onChange, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f0f0f4')
  const [size, setSize] = useState(3)
  const [showColors, setShowColors] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [undone, setUndone] = useState<Stroke[]>([])
  const currentStroke = useRef<Stroke | null>(null)
  const isDrawing = useRef(false)

  // Load existing content
  useEffect(() => {
    if (!canvasRef.current || !content) return
    const img = new window.Image()
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.drawImage(img, 0, 0)
      }
    }
    img.src = content
  }, []) // Only on mount

  // Resize canvas to container
  useEffect(() => {
    function resize() {
      if (!canvasRef.current || !containerRef.current) return
      const { width } = containerRef.current.getBoundingClientRect()
      const height = Math.max(400, window.innerHeight * 0.5)
      // Save current drawing
      const imageData = canvasRef.current.toDataURL()
      canvasRef.current.width = width
      canvasRef.current.height = height
      // Restore
      if (imageData && imageData !== 'data:,') {
        const img = new window.Image()
        img.onload = () => {
          canvasRef.current?.getContext('2d')?.drawImage(img, 0, 0)
        }
        img.src = imageData
      }
      // Set white background for light theme
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-2').trim() || '#1c1c22'
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function redraw(strokeList: Stroke[]) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-2').trim() || '#1c1c22'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (const stroke of strokeList) {
      if (stroke.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.strokeStyle = stroke.tool === 'eraser' ? (bg || '#1c1c22') : stroke.color
      ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 4 : stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    isDrawing.current = true
    const pos = getPos(e)
    currentStroke.current = { tool, color, size, points: [pos] }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }, [tool, color, size, readOnly])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentStroke.current || readOnly) return
    const pos = getPos(e)
    currentStroke.current.points.push(pos)

    // Draw incrementally
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pts = currentStroke.current.points
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-2').trim() || '#1c1c22'

    ctx.beginPath()
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.strokeStyle = tool === 'eraser' ? (bg || '#1c1c22') : color
    ctx.lineWidth = tool === 'eraser' ? size * 4 : size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [tool, color, size, readOnly])

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current || !currentStroke.current) return
    isDrawing.current = false
    const newStrokes = [...strokes, currentStroke.current]
    setStrokes(newStrokes)
    setUndone([])
    currentStroke.current = null
    // Save
    if (canvasRef.current) onChange(canvasRef.current.toDataURL())
  }, [strokes, onChange])

  function handleUndo() {
    if (!strokes.length) return
    const newStrokes = strokes.slice(0, -1)
    const undone_stroke = strokes[strokes.length - 1]
    setStrokes(newStrokes)
    setUndone((u) => [...u, undone_stroke])
    redraw(newStrokes)
    if (canvasRef.current) onChange(canvasRef.current.toDataURL())
  }

  function handleRedo() {
    if (!undone.length) return
    const stroke = undone[undone.length - 1]
    const newStrokes = [...strokes, stroke]
    setStrokes(newStrokes)
    setUndone((u) => u.slice(0, -1))
    redraw(newStrokes)
    if (canvasRef.current) onChange(canvasRef.current.toDataURL())
  }

  function handleClear() {
    setStrokes([])
    setUndone([])
    redraw([])
    if (canvasRef.current) onChange(canvasRef.current.toDataURL())
  }

  function handleDownload() {
    if (!canvasRef.current) return
    const a = document.createElement('a')
    a.href = canvasRef.current.toDataURL('image/png')
    a.download = 'drawing.png'
    a.click()
  }

  const cursorDiameter = Math.min(48, Math.max(6, tool === 'eraser' ? size * 4 : size * 2))
  const cursorColor = tool === 'eraser' ? '#f97316' : color
  const cursorSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorDiameter}" height="${cursorDiameter}" viewBox="0 0 ${cursorDiameter} ${cursorDiameter}"><circle cx="${cursorDiameter / 2}" cy="${cursorDiameter / 2}" r="${cursorDiameter / 2 - 1}" fill="none" stroke="${cursorColor}" stroke-width="2"/></svg>`,
  )
  const canvasCursor = readOnly
    ? undefined
    : `url("data:image/svg+xml,${cursorSvg}") ${cursorDiameter / 2} ${cursorDiameter / 2}, crosshair`

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-surface-2 p-2">
          {/* Tools */}
          <button
            onClick={() => setTool('pen')}
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', tool === 'pen' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-surface-3')}
            title="Pen"
          >
            <Pen className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', tool === 'eraser' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-surface-3')}
            title="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-border/60" />

          {/* Color */}
          <div className="relative">
            <button
              onClick={() => setShowColors(!showColors)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 hover:border-primary/60 transition-colors"
              title="Color"
            >
              <div className="h-4 w-4 rounded-full" style={{ background: color }} />
            </button>
            {showColors && (
              <div className="absolute left-0 top-full mt-1 z-50 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-surface-1 p-2 shadow-xl w-32">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setShowColors(false) }}
                    className={cn('h-6 w-6 rounded-full transition-transform hover:scale-110', color === c && 'ring-2 ring-white ring-offset-1 ring-offset-surface-1')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-border/60" />

          {/* Size */}
          <button onClick={() => setSize((s) => Math.max(1, s - 1))} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 text-center text-xs font-medium">{size}</span>
          <button onClick={() => setSize((s) => Math.min(20, s + 1))} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div className="h-5 w-px bg-border/60" />

          {/* Actions */}
          <button onClick={handleUndo} disabled={!strokes.length} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={handleClear} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={handleDownload} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={containerRef} className="rounded-xl overflow-hidden border border-border/60">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ display: 'block', cursor: canvasCursor }}
        />
      </div>
    </div>
  )
}
