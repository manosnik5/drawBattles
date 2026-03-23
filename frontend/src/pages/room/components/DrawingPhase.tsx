import { useEffect, useRef, useCallback, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import { getStroke } from 'perfect-freehand'
import { Eraser, Trash2, Send, Pencil } from 'lucide-react'
import type { ConnectedPlayer } from '../RoomPage'

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

const COLORS = [
  '#ffffff', '#f87171', '#fb923c', '#facc15',
  '#4ade80', '#60a5fa', '#a78bfa', '#f472b6',
  '#94a3b8', '#1e293b',
]

const BRUSH_SIZES = [
  { label: 'S', value: 3 },
  { label: 'M', value: 6 },
  { label: 'L', value: 12 },
  { label: 'XL', value: 20 },
]

function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce((acc: (string | number)[], [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length]
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    return acc
  }, ['M', ...stroke[0], 'Q'])
  return d.join(' ')
}

const CANVAS_BG = '#0f172a'

const DrawingPhase = ({ roomCode, theme, userId, timeLeft, connectedPlayers }: Props) => {
  const { submitDrawing, broadcastStroke } = useSocketContext()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const currentPoints = useRef<[number, number, number][]>([])
  const strokes = useRef<Stroke[]>([])
  const submittedRef = useRef(false)  
  const timerStartedRef = useRef(false) 

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(6)
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


  useEffect(() => {
    timerStartedRef.current = false
  }, [])


  useEffect(() => {
    if (timeLeft > 0 && !timerStartedRef.current) {
      timerStartedRef.current = true
    }
  }, [timeLeft])

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
    for (const stroke of strokes.current) {
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
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
      e.pressure || 0.5
    ]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submittedRef.current) return
    isDrawing.current = true
    currentPoints.current = [getPoint(e)]
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || submittedRef.current) return
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
    if (!isDrawing.current) return
    isDrawing.current = false
    const newStroke: Stroke = {
      points: [...currentPoints.current],
      color,
      size,
      tool,
    }
    strokes.current = [...strokes.current, newStroke]
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
    submitDrawing(roomCode, playerName, strokes.current)
  }, [roomCode, userId, connectedPlayers, submitDrawing])

  const handleClear = () => {
    strokes.current = []
    redraw()
  }

  const handleUndo = () => {
    strokes.current = strokes.current.slice(0, -1)
    redraw()
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-4">

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

      <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className={`w-full touch-none block ${showSubmitted ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>

      {!showSubmitted ? (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/10">
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
          </div>

          <div className="w-px h-6 bg-white/10" />

          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool('pen') }}
                className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: c,
                  borderColor: color === c && tool === 'pen' ? '#6366f1' : 'rgba(255,255,255,0.15)',
                  boxShadow: color === c && tool === 'pen' ? '0 0 0 2px #6366f1' : 'none',
                }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/10" />

          <div className="flex gap-1">
            {BRUSH_SIZES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSize(value)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                  size === value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={strokes.current.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↩ Undo
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-900/50 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
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