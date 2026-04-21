import { useEffect, useState } from 'react'
import { useSocketContext } from '../../../contexts/SocketContext'
import type { ConnectedPlayer } from '../../../contexts/SocketContext'
import { Palette, Check, Users } from 'lucide-react'
import { pickRandomThemes } from '../../../utils/themeSelector'

interface Props {
  roomCode: string
  isHost: boolean
  connectedPlayers: ConnectedPlayer[]
  themeOptions: string[]
  themeVotes: Record<string, number>
}

const ThemeVotePhase = ({ roomCode, isHost, connectedPlayers, themeOptions, themeVotes }: Props) => {
  const { submitThemeOptions, voteTheme } = useSocketContext()
  const [voted, setVoted] = useState<string | null>(null)
  const [finalTheme, setFinalTheme] = useState<string | null>(null)
  const { roomState } = useSocketContext()

  useEffect(() => {
    if (!isHost) return
    const themes = pickRandomThemes(3)
    submitThemeOptions(roomCode, themes)
  }, [isHost, roomCode])

  useEffect(() => {
    if (roomState.selectedTheme) {
      setFinalTheme(roomState.selectedTheme)
    }
  }, [roomState.selectedTheme])

  const handleVote = (theme: string) => {
    if (voted) return
    setVoted(theme)
    voteTheme(roomCode, theme)
  }

  const totalVotes = Object.values(themeVotes).reduce((a, b) => a + b, 0)
  const themes = themeOptions.length > 0 ? themeOptions : []

  if (finalTheme) return (
    <div className="flex flex-col items-center gap-6 text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
        <Palette className="w-8 h-8 text-indigo-400" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-300/70 mb-3">Theme selected</p>
        <h2 className="text-4xl font-bold text-white">{finalTheme}</h2>
        <p className="text-slate-400 text-sm mt-3 animate-pulse">Get ready to draw...</p>
      </div>
    </div>
  )

  if (themes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
      <p className="text-slate-400 text-sm">Waiting for theme options...</p>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-8">

      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
          <Palette className="w-6 h-6 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Vote for a Theme</h2>
        <p className="text-slate-400 text-sm">
          {voted ? 'Waiting for others to vote...' : 'Pick the theme you want to draw'}
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {themes.map((theme) => {
          const voteCount = themeVotes[theme] ?? 0
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
          const isVoted = voted === theme

          return (
            <button
              key={theme}
              onClick={() => handleVote(theme)}
              disabled={!!voted}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all relative overflow-hidden disabled:cursor-default ${
                isVoted
                  ? 'border-indigo-500 bg-indigo-500/20'
                  : voted
                  ? 'border-white/10 bg-slate-900/40'
                  : 'border-white/10 bg-slate-900/60 hover:border-indigo-500/50 hover:bg-slate-800/60'
              }`}
            >
              {voted && (
                <div
                  className="absolute inset-y-0 left-0 bg-indigo-500/10 transition-all duration-700 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative flex items-center justify-between">
                <span className={`font-semibold text-sm ${isVoted ? 'text-white' : 'text-slate-200'}`}>
                  {theme}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {voted && (
                    <span className="text-xs text-slate-400">
                      {voteCount} vote{voteCount !== 1 ? 's' : ''} · {percentage}%
                    </span>
                  )}
                  {isVoted && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Users className="w-3.5 h-3.5" />
        <span>{totalVotes} / {connectedPlayers.length} voted</span>
      </div>
    </div>
  )
}

export default ThemeVotePhase