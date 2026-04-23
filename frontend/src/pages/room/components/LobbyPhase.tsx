import { useSocketContext } from '../../../contexts/SocketContext'
import type { ConnectedPlayer } from '../../../contexts/SocketContext'
import { Users, Crown, Copy, Check, Play, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  roomCode: string
  room: any
  connectedPlayers: ConnectedPlayer[]
  isHost: boolean
}

const MIN_PLAYERS = 2
const MAX_PLAYERS = 10

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const LobbyPhase = ({ roomCode, room, connectedPlayers, isHost }: Props) => {
  const { startGame, leaveRoom } = useSocketContext()
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const canStart = connectedPlayers.length >= MIN_PLAYERS && connectedPlayers.length <= MAX_PLAYERS

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full max-w-md flex items-center justify-between">
        <button
          onClick={() => { leaveRoom(roomCode); navigate('/') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave
        </button>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-indigo-300/70 mb-2">Room Code</p>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-4xl text-white tracking-widest">{roomCode}</span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-slate-800/60 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">Share this code with friends</p>
        </div>

        <div className="w-18" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Players</span>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
            connectedPlayers.length >= MIN_PLAYERS
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-700/60 border-white/10 text-slate-400'
          }`}>
            {connectedPlayers.length} / {MAX_PLAYERS}
          </span>
        </div>

        <div className="space-y-2">
          {connectedPlayers.map((player) => (
            <div
              key={player.userId}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10"
            >
              <div className="shrink-0">
                {player.imageUrl ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={player.imageUrl}
                    alt={player.playerName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                    {getInitials(player.playerName)}
                  </div>
                )}
              </div>

              <span className="text-sm text-slate-200 flex-1">{player.playerName}</span>

              {player.userId === room.hostId && (
                <div className="flex items-center gap-1 text-amber-400">
                  <Crown className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Host</span>
                </div>
              )}
            </div>
          ))}

          {Array.from({ length: Math.max(0, MIN_PLAYERS - connectedPlayers.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800/60 shrink-0" />
              <span className="text-sm text-slate-600">Waiting for player...</span>
            </div>
          ))}
        </div>

        {connectedPlayers.length < MIN_PLAYERS && (
          <p className="text-xs text-slate-500 text-center mt-4">
            Need at least {MIN_PLAYERS} players to start
          </p>
        )}
      </div>

      {isHost ? (
        <button
          onClick={() => startGame(roomCode)}
          disabled={!canStart}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/50 active:scale-[0.98]"
        >
          <Play className="w-4 h-4" />
          Start Game
        </button>
      ) : (
        <p className="text-slate-500 text-sm">Waiting for host to start the game...</p>
      )}
    </div>
  )
}

export default LobbyPhase