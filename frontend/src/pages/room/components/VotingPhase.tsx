import { useEffect, useRef, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import type { ConnectedPlayer } from '../../../contexts/SocketContext'
import { renderStrokes, CANVAS_BG } from '../../../utils/canvasUtils'

interface Props {
  roomCode: string
  connectedPlayers: ConnectedPlayer[]
  userId: string
}

const REACTIONS = [
  { key: 'What is this?', emoji: '💀', label: 'What is this?', color: 'hover:border-red-500/50 hover:bg-red-500/10' },
  { key: 'Meh',           emoji: '😐', label: 'Meh',           color: 'hover:border-gray-500/50 hover:bg-gray-500/10' },
  { key: 'Nice',          emoji: '👍', label: 'Nice',          color: 'hover:border-yellow-500/50 hover:bg-yellow-500/10' },
  { key: 'Awesome',       emoji: '😄', label: 'Awesome',       color: 'hover:border-pink-500/50 hover:bg-pink-500/10' },
  { key: 'Legendary',     emoji: '🔥', label: 'Legendary',     color: 'hover:border-orange-500/50 hover:bg-orange-500/10' },
]

const VotingPhase = ({ roomCode, connectedPlayers, userId }: Props) => {
  const { roomState, castVote } = useSocketContext()
  const { votingDrawing, votingTimeLeft, votingVotes, votingResult } = roomState
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [voted, setVoted] = useState<string | null>(null)
  const [loadingTimeout] = useState(false)

  const current = votingDrawing
  const isOwnDrawing = current?.playerId === userId
  const currentVotes = current
    ? (votingVotes[current.drawingId] ?? { reactions: {}, totalVotes: 0 })
    : { reactions: {}, totalVotes: 0 }
  const showResult = !!votingResult && votingResult.drawingId === current?.drawingId
  const timeWarning = votingTimeLeft <= 3

  useEffect(() => { setVoted(null) }, [current?.drawingId])


  useEffect(() => {
  if (!canvasRef.current || !current?.strokes) return


  let strokes = current.strokes
  if (typeof strokes === 'string') {
    try {
      strokes = JSON.parse(strokes)
    } catch {
      return
    }
  }

  if (!Array.isArray(strokes) || strokes.length === 0) {
    const ctx = canvasRef.current.getContext('2d')
    if (ctx) {
      ctx.fillStyle = CANVAS_BG
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    return
  }

  renderStrokes(canvasRef.current, strokes)
}, [current?.drawingId, current?.strokes]) 

  const handleVote = (reaction: string) => {
    if (voted || isOwnDrawing || !current || showResult) return
    setVoted(reaction)
    castVote(roomCode, current.drawingId, reaction)
  }

  if (!current) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">
        {loadingTimeout ? 'Failed to load drawings. Please refresh.' : 'Loading drawings...'}
      </p>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-300/70 mb-1">
            Drawing {current.current} of {current.total}
          </p>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {(() => {
              const player = connectedPlayers.find(p => p.userId === current.playerId)
              return player?.imageUrl ? (
                <img
                referrerPolicy="no-referrer"
                src={player.imageUrl}
                alt={current.playerName}
                className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  
                >
                  {current.playerName[0]}
                </div>
              )
            })()}
            {current.playerName}
            {isOwnDrawing && <span className="text-xs text-indigo-400 font-normal">(your drawing)</span>}
          </h2>
        </div>

        <div className={`font-mono font-bold text-3xl w-14 h-14 rounded-xl border flex items-center justify-center transition-all ${
          timeWarning
            ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse'
            : 'text-white border-white/10 bg-slate-900/60'
        }`}>
          {votingTimeLeft}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: current.total }).map((_, i) => (
          <div key={i} className={`rounded-full transition-all duration-300 ${
            i + 1 < current.current  ? 'w-2 h-2 bg-indigo-500' :
            i + 1 === current.current ? 'w-3 h-3 bg-indigo-400' :
            'w-2 h-2 bg-slate-700'
          }`} />
        ))}
      </div>

      <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas ref={canvasRef} width={800} height={480} className="w-full block" />
      </div>

      {!isOwnDrawing ? (
        <div className="w-full grid grid-cols-5 gap-3">
          {REACTIONS.map(({ key, emoji, label, color }) => {
            const count = currentVotes.reactions[key] ?? 0
            const isVoted = voted === key
            return (
              <button
                key={key}
                onClick={() => handleVote(key)}
                disabled={!!voted || showResult}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95 ${
                  isVoted
                    ? 'border-indigo-500 bg-indigo-500/20 scale-105'
                    : voted || showResult
                    ? 'border-white/10 bg-slate-900/40 opacity-50 cursor-default'
                    : `border-white/10 bg-slate-900/60 ${color} cursor-pointer`
                }`}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span className={`text-lg font-bold ${isVoted ? 'text-indigo-400' : 'text-white'}`}>{count}</span>
                <span className="text-[10px] text-slate-500">{label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="w-full py-5 rounded-2xl border border-white/10 bg-slate-900/40 flex flex-col items-center gap-3">
          <p className="text-slate-400 text-sm">This is your drawing</p>
          <div className="flex items-center gap-4">
            {REACTIONS.map(({ key, emoji }) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <span className="text-xl">{emoji}</span>
                <span className="text-sm font-bold text-white">{currentVotes.reactions[key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResult && (
        <div className="w-full py-3 rounded-xl text-center text-sm font-semibold border bg-slate-800/60 border-white/10 text-slate-300">
          {(() => {
            const topReaction = Object.entries(votingResult?.reactions ?? {}).sort((a, b) => b[1] - a[1])[0]
            const top = REACTIONS.find(r => r.key === topReaction?.[0])
            return top ? `${top.emoji} Most voted: ${top.label}` : 'No votes'
          })()}
          <span className="ml-2 text-xs opacity-70">Next drawing in a moment...</span>
        </div>
      )}
    </div>
  )
}

export default VotingPhase