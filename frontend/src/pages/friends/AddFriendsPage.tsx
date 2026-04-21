import { useState, useEffect } from "react"
import { useSearchPlayers, useSendFriendRequest } from "../../hooks/useFriends"
import { Search, UserPlus, Loader } from "lucide-react"
import Navbar from "../home/components/Navbar"
import type { Player } from "../../types"

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AddFriendsPage = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useSearchPlayers(debouncedQuery)
  const sendRequest = useSendFriendRequest()

  // normalize backend response safely
  const users: Player[] = Array.isArray(data)
    ? data
    : (data as any)?.users || (data as any)?.data || []

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSendRequest = (userId: string) => {
    sendRequest.mutate(userId, {
      onSuccess: () => {
        setSentIds(prev => new Set(prev).add(userId))
      }
    })
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 py-12">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Add Friends</h1>
            <p className="text-xs text-slate-500">Search for players by name</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-slate-800/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />

          {isLoading && (
            <Loader className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
          )}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>

          ) : users.length > 0 ? (
            users.map((user, _) => {
              const sent = sentIds.has(user.id)

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {user.imageUrl ? (
                      <img
                        referrerPolicy="no-referrer"
                        src={user.imageUrl}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white">
                        {getInitials(user.fullName)}
                      </div>
                    )}

                    <p className="text-sm font-medium text-white">
                      {user.fullName}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSendRequest(user.id)}
                    disabled={sendRequest.isPending || sent}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:cursor-not-allowed ${
                      sent
                        ? 'bg-slate-700/60 text-slate-400 border border-white/10'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/40 active:scale-95'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {sent ? 'Sent' : 'Add'}
                  </button>
                </div>
              )
            })

          ) : debouncedQuery.length >= 2 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm font-medium">
                No players found
              </p>
              <p className="text-slate-600 text-xs mt-1">
                Try a different name
              </p>
            </div>

          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserPlus className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm font-medium">
                Find players to add
              </p>
              <p className="text-slate-600 text-xs mt-1">
                Type at least 2 characters to search
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AddFriendsPage