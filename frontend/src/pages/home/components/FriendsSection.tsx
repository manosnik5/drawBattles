import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetFriends, useRemoveFriend, useSendRoomInvite } from '../../../hooks/useFriends'
import { UserPlus, X, Loader, Users, Search } from 'lucide-react'
import { useSocketContext } from '../../../contexts/SocketContext'
import { useAuth0 } from '@auth0/auth0-react'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const FriendsSection = () => {
  
  const { isOnline, onlineUsers, currentRoomCode, pendingInvites, acceptRoomInvite, rejectRoomInvite } = useSocketContext()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { user, isAuthenticated } = useAuth0()
  const userId = user?.sub

  const { data: friends = [], isLoading } = useGetFriends(
    isAuthenticated && !!userId
  )

  const removeFriend = useRemoveFriend()

  // Invite goes through REST API — backend triggers socket event
  const sendRoomInvite = useSendRoomInvite()

  const filtered = friends.filter(f =>
    f.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const onlineCount = friends.filter(f => isOnline(f.id)).length

  if (!isAuthenticated || !userId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
        <Users className="size-10 text-slate-700" />
        <p className="text-slate-400 text-sm font-medium">You're not signed in</p>
        <p className="text-slate-600 text-xs">
          Connect your account to add friends and see who's online.
        </p>
      </div>
    )
  }
console.log('onlineUsers:', [...onlineUsers])
console.log('friend ids:', friends.map(f => f.id))
  return (
    <div className="flex flex-col h-full">

      {pendingInvites.length > 0 && (
        <div className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
          <h3 className="text-sm font-semibold text-white mb-3">Room Invites</h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg"
              >
                <p className="text-sm text-white font-medium">
                  {invite.senderName} invited you to room{' '}
                  <span className="font-mono">{invite.roomCode}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      acceptRoomInvite(invite.id)
                      navigate(`/room/${invite.roomCode}`)
                    }}
                    className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => rejectRoomInvite(invite.id)}
                    className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Friends</h2>
          <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            {onlineCount} online
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => navigate('/friends/add')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-indigo-400"
          >
            <UserPlus className="size-3.5" />
            Add Friend
          </button>
          <button
            onClick={() => navigate('/friends/requests')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-400"
          >
            Requests
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="w-full bg-slate-800/60 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader className="size-5 text-indigo-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Users className="size-8 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">
              {search ? 'No friends found' : 'No friends yet'}
            </p>
          </div>
        ) : (
          <div className="px-3 py-3 space-y-1">
            {filtered.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between px-2 py-2 rounded-xl hover:bg-slate-800/60 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {friend.imageUrl ? (
                      <img
                        src={friend.imageUrl}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                        {getInitials(friend.fullName)}
                      </div>
                    )}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                      isOnline(friend.id) ? 'bg-emerald-500' : 'bg-slate-600'
                    }`} />
                  </div>

                  <div className="min-w-0">
                    <span className="text-sm text-slate-200 truncate block">{friend.fullName}</span>
                    <span className={`text-[10px] ${isOnline(friend.id) ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {isOnline(friend.id) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100">
                  {currentRoomCode && (
                    <button
                      onClick={() => sendRoomInvite.mutate({
                        friendId: friend.id,
                        roomCode: currentRoomCode,
                      })}
                      disabled={sendRoomInvite.isPending}
                      className="text-[14px] text-indigo-400 disabled:opacity-50"
                    >
                      {sendRoomInvite.isPending ? 'Inviting...' : 'Invite'}
                    </button>
                  )}
                  <button
                    onClick={() => removeFriend.mutate(friend.id)}
                    disabled={removeFriend.isPending}
                    className="text-slate-600 hover:text-red-400 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FriendsSection