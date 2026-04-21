import { useEffect, useRef, useCallback, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import { getStroke } from 'perfect-freehand'
import { Eraser, Trash2, Send, Pencil, PaintBucket } from 'lucide-react'
import type { ConnectedPlayer } from '../../../contexts/SocketContext'
import { getSvgPath, floodFill, CANVAS_BG } from '../../../utils/canvasUtils'

interface Props {
  roomCode: string
  theme: string
  userId: string
  timeLeft: number
  connectedPlayers: ConnectedPlayer[]
}

interface Stroke {
  points: [number, number, number][]
  color: string
  size: number
  tool: 'pen' | 'eraser'
}

interface FillAction {
  type: 'fill'
  x: number
  y: number
  color: string
}

type DrawAction = Stroke | FillAction

const COLORS = [
  '#ffffff', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#000000',
  '#fecaca', '#f87171', '#ef4444', '#dc2626', '#991b1b',
  '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#9a3412',
  '#fef08a', '#facc15', '#eab308', '#ca8a04', '#854d0e',
  '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#166534',
  '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488', '#115e59',
  '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb', '#1e40af',
  '#c7d2fe', '#818cf8', '#6366f1', '#4f46e5', '#3730a3',
  '#e9d5ff', '#c084fc', '#a855f7', '#9333ea', '#6b21a8',
  '#fbcfe8', '#f472b6', '#ec4899', '#db2777', '#9d174d',
  '#fde68a', '#d97706', '#b45309', '#92400e', '#78350f',
]

const BRUSH_SIZES = [
  { label: 'XS', value: 2 },
  { label: 'S',  value: 4 },
  { label: 'M',  value: 8 },
  { label: 'L',  value: 16 },
  { label: 'XL', value: 28 },
]

const DrawingPhase = ({ roomCode, theme, userId, timeLeft, connectedPlayers }: Props) => {
  const { submitDrawing, broadcastStroke } = useSocketContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const currentPoints = useRef<[number, number, number][]>([])
  const actions = useRef<DrawAction[]>([])
  const submittedRef = useRef(false)
  const timerStartedRef = useRef(false)

  const [tool, setTool] = useState<'pen' | 'eraser' | 'fill'>('pen')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(8)
  const [showSubmitted, setShowSubmitted] = useState(false)

  const timeWarning = timeLeft <= 30 && timeLeft > 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Track timer started
  useEffect(() => {
    if (timeLeft > 0 && !timerStartedRef.current) {
      timerStartedRef.current = true
    }
  }, [timeLeft])

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && timerStartedRef.current) {
      handleSubmit()
    }
  }, [timeLeft])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (const action of actions.current) {
      if ('type' in action && action.type === 'fill') {
        floodFill(ctx, action.x, action.y, action.color)
      } else {
        const stroke = action as Stroke
        const outline = getStroke(stroke.points, {
          size: stroke.size,
          thinning: 0.5,
          smoothing: 0.5,
          simulatePressure: true,
        })
        const path = new Path2D(getSvgPath(outline))
        ctx.fillStyle = stroke.tool === 'eraser' ? CANVAS_BG : stroke.color
        ctx.fill(path)
      }
    }
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
      e.pressure || 0.5,
    ]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submittedRef.current) return

    if (tool === 'fill') {
      const rect = canvasRef.current!.getBoundingClientRect()
      const scaleX = canvasRef.current!.width / rect.width
      const scaleY = canvasRef.current!.height / rect.height
      const x = Math.floor((e.clientX - rect.left) * scaleX)
      const y = Math.floor((e.clientY - rect.top) * scaleY)

      const ctx = canvasRef.current!.getContext('2d')!
      floodFill(ctx, x, y, color)

      const fillAction: FillAction = { type: 'fill', x, y, color }
      actions.current = [...actions.current, fillAction]
      broadcastStroke(roomCode, fillAction as any)
      return
    }

    isDrawing.current = true
    currentPoints.current = [getPoint(e)]
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || submittedRef.current || tool === 'fill') return
    currentPoints.current = [...currentPoints.current, getPoint(e)]

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    redraw()

    const outline = getStroke(currentPoints.current, {
      size,
      thinning: 0.5,
      smoothing: 0.5,
      simulatePressure: true,
      last: false,
    })
    const path = new Path2D(getSvgPath(outline))
    ctx.fillStyle = tool === 'eraser' ? CANVAS_BG : color
    ctx.fill(path)
  }

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current || tool === 'fill') return
    isDrawing.current = false

    const newStroke: Stroke = {
      points: [...currentPoints.current],
      color,
      size,
      tool,
    }
    actions.current = [...actions.current, newStroke]
    broadcastStroke(roomCode, newStroke)
    currentPoints.current = []
    redraw()
  }, [color, size, tool, roomCode, broadcastStroke, redraw])

  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    setShowSubmitted(true)

    const currentPlayer = connectedPlayers.find(p => p.userId === userId)
    const playerName = currentPlayer?.playerName || userId
    submitDrawing(roomCode, playerName, actions.current as any)
  }, [roomCode, userId, connectedPlayers, submitDrawing])

  const handleClear = () => {
    actions.current = []
    redraw()
  }

  const handleUndo = () => {
    actions.current = actions.current.slice(0, -1)
    redraw()
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-300/70 mb-1">Draw this</p>
          <h2 className="text-2xl font-bold text-white">{theme || 'Loading theme...'}</h2>
        </div>
        <div className={`font-mono font-bold text-2xl px-4 py-2 rounded-xl border transition-all ${
          timeWarning
            ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse'
            : 'text-white border-white/10 bg-slate-900/60'
        }`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Canvas */}
      <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className={`w-full touch-none block ${
            submittedRef.current ? 'cursor-default' :
            tool === 'fill'      ? 'cursor-cell' :
            'cursor-crosshair'
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>

      {/* Toolbar or submitted state */}
      {!showSubmitted ? (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div className="flex flex-wrap items-center gap-3">

            {/* Tool selector */}
            <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg">
              <button
                onClick={() => setTool('pen')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" /> Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  tool === 'eraser' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" /> Eraser
              </button>
              <button
                onClick={() => setTool('fill')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  tool === 'fill' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <PaintBucket className="w-3.5 h-3.5" /> Fill
              </button>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* Brush sizes */}
            {tool !== 'fill' && (
              <div className="flex gap-1">
                {BRUSH_SIZES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setSize(value)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                      size === value
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {tool === 'fill' && (
              <p className="text-xs text-amber-400/70">Click any area to fill it</p>
            )}

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={actions.current.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ↩ Undo
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-900/50 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" /> Submit
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Color palette */}
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c)
                  if (tool === 'eraser') setTool('pen')
                }}
                title={c}
                className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95 shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: color === c && tool !== 'eraser' ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  boxShadow: color === c && tool !== 'eraser' ? '0 0 0 2px #6366f1' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 rounded-xl bg-slate-900/60 border border-white/10">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Send className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-white font-semibold">Drawing submitted!</p>
          <p className="text-slate-400 text-sm">Waiting for everyone to finish...</p>
        </div>
      )}
    </div>
  )
}

export default DrawingPhase