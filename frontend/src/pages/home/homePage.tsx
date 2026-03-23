import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateRoom } from '../../hooks/useRoom'
import Navbar from './components/Navbar'
import { pickRandomThemes } from '../../utils/themeSelector'
import { generateRoomCode } from '../../utils/generateCode'
import { Clipboard, RefreshCw } from 'lucide-react'
import FriendsSection from './components/FriendsSection'


const HomePage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [roomCode, setRoomCode] = useState(generateRoomCode)
  const [theme, setTheme] = useState<string[]>(() => pickRandomThemes(3))
  const [copied, setCopied] = useState(false)

  const createRoom = useCreateRoom()

  const handleRegenerateCode = useCallback(() => {
    setRoomCode(generateRoomCode())
  }, [])


  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [roomCode])

  const handleCreateRoom = useCallback(() => {
   
    createRoom.mutate(
      { code: roomCode },
      {
        onSuccess: (room) => navigate(`/room/${room.code}`),
        onError: (error: any) => {
          if (error?.response?.status === 409) {
            const newCode = generateRoomCode()
            setRoomCode(newCode)
            createRoom.mutate(
              { code: newCode},
              { onSuccess: (room) => navigate(`/room/${room.code}`) }
            )
          }
        }
      }
    )
  }, [roomCode, theme, createRoom, navigate])

  const handleJoinRoom = () => {
    if (!joinCode.trim()) { setJoinError('Enter a room code'); return }
    if (joinCode.length !== 6) { setJoinError('Room code must be 6 characters'); return }
    setJoinError('')
    navigate(`/room/${joinCode.toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-indigo-950 to-slate-900 text-slate-100">   
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onToggleOpenSidebar={() => setSidebarOpen(prev => !prev)}/>
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 overflow-y-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-indigo-400 leading-[1.1] mb-4">
                Draw<span className="text-white"> Royale</span>
              </h1>
            </div>

            

            <div className="w-full max-w-sm">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl backdrop-blur overflow-hidden">

                <div className="flex border-b border-white/10">
                  {(['create', 'join'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 py-3.5 text-sm font-semibold transition-colors cursor-pointer ${
                        tab === t
                          ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/10'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t === 'create' ? 'Create Room' : 'Join Room'}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {tab === 'create' ? (
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Room Code
                        </label>
                        <div className="flex items-center justify-between bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3">
                          <span className="font-mono font-bold text-lg text-white tracking-widest">
                            {roomCode}
                          </span>
                          <div className="flex items-center gap-4">
                            <button onClick={handleRegenerateCode} title="Generate new code" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                              <RefreshCw className="size-4" />
                            </button>
                            <button onClick={handleCopyCode} className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
                              {copied ? '✓' : <Clipboard className="size-4" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 pl-1">Share this code with friends</p>
                      </div>

                      <button
                        onClick={handleCreateRoom}
                        disabled={createRoom.isPending}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/50 active:scale-[0.98]"
                      >
                        {createRoom.isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                            </svg>
                            Creating...
                          </span>
                        ) : 'Create Room'}
                      </button>

                      {createRoom.isError && (
                        <p className="text-xs text-red-400 text-center">
                          {(createRoom.error as Error)?.message ?? 'Failed to create room'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Room Code
                        </label>
                        <input
                          value={joinCode}
                          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                          placeholder="e.g. AB12CD"
                          maxLength={6}
                          className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono font-bold tracking-widest text-white placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
                        />
                        {joinError && <p className="text-xs text-red-400 mt-1.5 pl-1">{joinError}</p>}
                      </div>
                      <button
                        onClick={handleJoinRoom}
                        disabled={!joinCode.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/50 active:scale-[0.98]"
                      >
                        Join Room
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-center text-xs text-slate-600 mt-4">
                {tab === 'create'
                  ? "You'll be the host — start the game when everyone joins."
                  : 'Ask the host for the 6-character room code.'}
              </p>
            </div>
          </main>
        </div>
        <aside className={`
          fixed inset-y-0 right-0 z-40 w-72 border-white/10 bg-slate-900/95 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0 md:flex md:flex-col`}>
          <FriendsSection />
        </aside>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

export default HomePage