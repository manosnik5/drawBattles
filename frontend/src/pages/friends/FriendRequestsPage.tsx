import {
  useGetPendingRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest
} from "../../hooks/useFriends"

import { UserPlus, Check, X, Loader, Clock } from "lucide-react"
import Navbar from "../home/components/Navbar"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const FriendRequestsPage = () => {
  const { data: requests, isLoading } = useGetPendingRequests()
  const acceptRequest = useAcceptFriendRequest()
  const rejectRequest = useRejectFriendRequest()

  // only show pending requests
  const pendingRequests = (requests ?? []).filter(
    (r) => r.status === "pending"
  )

  console.log("requests raw:", requests)
  console.log("pending only:", pendingRequests)

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Friend Requests</h1>
            <p className="text-xs text-slate-500">
              {pendingRequests.length} pending{" "}
              {pendingRequests.length === 1 ? "request" : "requests"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : pendingRequests.length > 0 ? (
          <div className="space-y-2">
            {pendingRequests.map((request, _) => (
              <div
                key={request.id}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-900/60 border border-white/10 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {request.sender.imageUrl ? (
                    <img
                      referrerPolicy="no-referrer"
                      src={request.sender.imageUrl}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full 
                      flex items-center justify-center text-sm font-bold text-white"
                    >
                      {getInitials(request.sender.fullName)}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-white">
                      {request.sender.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => acceptRequest.mutate(request.id)}
                    disabled={acceptRequest.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </button>

                  <button
                    onClick={() => rejectRequest.mutate(request.id)}
                    disabled={rejectRequest.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserPlus className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              No pending requests
            </p>
            <p className="text-slate-600 text-xs mt-1">You're all caught up!</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default FriendRequestsPage