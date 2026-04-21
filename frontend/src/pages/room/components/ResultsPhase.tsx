import { useEffect, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import type { ConnectedPlayer } from '../../../contexts/SocketContext'
import { Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { renderToDataUrl } from '../../../utils/canvasUtils'

const REACTIONS = [
  { key: 'What is this?', emoji: '💀' },
  { key: 'Meh',           emoji: '😐' },
  { key: 'Nice',          emoji: '👍' },
  { key: 'Awesome',       emoji: '😄' },
  { key: 'Legendary',     emoji: '🔥' },
]

interface ResultEntry {
  playerId: string
  playerName: string
  drawingId: string
  strokes: any[]
  reactions: Record<string, number>
  totalVotes: number
  score: number
}

interface Props {
  connectedPlayers: ConnectedPlayer[]
}

const PLACE_STYLES = [
  { label: '1st', icon: '🥇', border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-400'  },
  { label: '2nd', icon: '🥈', border: 'border-slate-400/30',   bg: 'bg-slate-400/10',   text: 'text-slate-300'  },
  { label: '3rd', icon: '🥉', border: 'border-orange-600/30',  bg: 'bg-orange-700/10',  text: 'text-orange-400' },
]

const ResultsPhase = ({ connectedPlayers }: Props) => {
  const { roomState } = useSocketContext()
  const navigate = useNavigate()
  const [rendered, setRendered] = useState<(ResultEntry & { dataUrl: string })[]>([])
  const [loading, setLoading] = useState(true)

 useEffect(() => {
  const results = roomState.results
  if (!results || results.length === 0) return

  const withImages = results.map(r => {
    let strokes = r.strokes
    
    if (typeof strokes === 'string') {
      try { strokes = JSON.parse(strokes) } catch { strokes = [] }
    }
    return {
      ...r,
      dataUrl: renderToDataUrl(Array.isArray(strokes) ? strokes : []),
    }
  })

  setRendered(withImages)
  setLoading(false)
}, [roomState.results])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Calculating results...</p>
    </div>
  )

  const winner = rendered[0]

  return (
    <div className="flex flex-col items-center gap-8">
      {winner && (
        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-xs uppercase tracking-widest text-amber-300/70 mb-2">Winner</p>
          <h2 className="text-3xl font-bold text-white">{winner.playerName}</h2>
          <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
            {REACTIONS.map(({ key, emoji }) => (
              <span key={key} className="text-sm text-slate-300">
                {emoji} {winner.reactions[key] ?? 0}
              </span>
            ))}
            <span className="text-slate-400 text-sm">Score: {winner.score > 0 ? '+' : ''}{winner.score}</span>
          </div>
        </div>
      )}


      <div className="w-full max-w-2xl space-y-3">
        {rendered.map((result, i) => {
          const style = PLACE_STYLES[i] ?? {
            label: `#${i + 1}`, icon: '',
            border: 'border-white/10', bg: 'bg-slate-900/40', text: 'text-slate-500'
          }
          const player = connectedPlayers.find(p => p.userId === result.playerId)

          return (
            <div
              key={result.playerId}
              className={`flex items-center gap-4 px-4 py-4 rounded-xl border ${style.border} ${style.bg}`}
            >

              <div className="text-2xl shrink-0 w-8 text-center">
                {style.icon
                  ? style.icon
                  : <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
                }
              </div>

              {result.dataUrl && (
                <div className="w-20 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <img src={result.dataUrl} className="w-full h-full object-contain bg-[#0f172a]" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {player?.imageUrl ? (
                    <img
                      referrerPolicy="no-referrer"
                      src={player.imageUrl}
                      alt={result.playerName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      
                    >
                      {result.playerName[0]}
                    </div>
                  )}
                  <span className={`font-semibold text-sm ${i === 0 ? 'text-white' : 'text-slate-200'}`}>
                    {result.playerName}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {REACTIONS.map(({ key, emoji }) => (
                    result.reactions[key] > 0 && (
                      <span key={key} className="text-xs text-slate-400">
                        {emoji} {result.reactions[key]}
                      </span>
                    )
                  ))}
                </div>
              </div>

              <span className={`font-bold text-sm shrink-0 ${
                result.score > 0 ? 'text-emerald-400' :
                result.score < 0 ? 'text-red-400' :
                'text-slate-500'
              }`}>
                {result.score > 0 ? '+' : ''}{result.score}
              </span>
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