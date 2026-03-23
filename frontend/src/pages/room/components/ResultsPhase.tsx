import { useEffect, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import type { ConnectedPlayer } from '../RoomPage'
import { ThumbsUp, ThumbsDown, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getStroke } from 'perfect-freehand'

interface Result {
  playerId: string
  playerName: string
  drawingId: string
  strokes: any[]
  upvotes: number
  downvotes: number
  score: number
}

interface Props {
  connectedPlayers: ConnectedPlayer[]
}

const CANVAS_BG = '#0f172a'

function getSvgPath(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce((acc: (string | number)[], [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length]
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
    return acc
  }, ['M', ...stroke[0], 'Q'])
  return d.join(' ')
}

function renderToDataUrl(strokes: any[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 480
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = CANVAS_BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const stroke of strokes) {
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
  return canvas.toDataURL('image/png')
}

const PLACE_STYLES = [
  { label: '1st', icon: '🥇', border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  { label: '2nd', icon: '🥈', border: 'border-slate-400/30', bg: 'bg-slate-400/10', text: 'text-slate-300' },
  { label: '3rd', icon: '🥉', border: 'border-orange-600/30', bg: 'bg-orange-700/10', text: 'text-orange-400' },
]

const ResultsPhase = ({ connectedPlayers }: Props) => {
  const { socket } = useSocketContext()
  const navigate = useNavigate()
  const [results, setResults] = useState<(Result & { dataUrl: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!socket) return

    socket.on('results:data', (data: Result[]) => {
      const withImages = data.map(r => ({
        ...r,
        dataUrl: renderToDataUrl(r.strokes),
      }))
      setResults(withImages)
      setLoading(false)
    })

    return () => { socket.off('results:data') }
  }, [socket])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Calculating results...</p>
    </div>
  )

  const winner = results[0]

  return (
    <div className="flex flex-col items-center gap-8">

      {winner && (
        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-xs uppercase tracking-widest text-amber-300/70 mb-2">Winner</p>
          <h2 className="text-3xl font-bold text-white">{winner.playerName}</h2>
          <div className="flex items-center justify-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1 text-emerald-400">
              <ThumbsUp className="w-4 h-4" /> {winner.upvotes}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <ThumbsDown className="w-4 h-4" /> {winner.downvotes}
            </span>
            <span className="text-slate-400">Score: {winner.score > 0 ? '+' : ''}{winner.score}</span>
          </div>
        </div>
      )}


      <div className="w-full max-w-2xl space-y-3">
        {results.map((result, i) => {
          const style = PLACE_STYLES[i] ?? { label: `#${i + 1}`, icon: '', border: 'border-white/10', bg: 'bg-slate-900/40', text: 'text-slate-500' }
          const player = connectedPlayers.find(p => p.userId === result.playerId)

          return (
            <div
              key={result.playerId}
              className={`flex items-center gap-4 px-4 py-4 rounded-xl border ${style.border} ${style.bg} transition-all`}
            >
              <div className="text-2xl flex-shrink-0 w-8 text-center">
                {style.icon || <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>}
              </div>

              {result.dataUrl && (
                <div className="w-20 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                  <img src={result.dataUrl} className="w-full h-full object-contain bg-[#0f172a]" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {player?.imageUrl ? (
                    <img
                      src={player.imageUrl}
                      alt={result.playerName}
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: player?.avatarColor ?? '#6366f1' }}
                    >
                      {result.playerName[0]}
                    </div>
                  )}
                  <span className={`font-semibold text-sm ${i === 0 ? 'text-white' : 'text-slate-200'}`}>
                    {result.playerName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm shrink-0">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ThumbsUp className="w-3.5 h-3.5" /> {result.upvotes}
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <ThumbsDown className="w-3.5 h-3.5" /> {result.downvotes}
                </span>
                <span className={`font-bold ${result.score > 0 ? 'text-emerald-400' : result.score < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {result.score > 0 ? '+' : ''}{result.score}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/60 text-slate-300 hover:text-white text-sm font-semibold transition-all"
      >
        <Home className="w-4 h-4" />
        Back to Home
      </button>
    </div>
  )
}

export default ResultsPhase