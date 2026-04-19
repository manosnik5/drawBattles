import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendApi } from '../api/friend'
import type { Player } from '../types'
import { useAuth0 } from "@auth0/auth0-react";

export const friendKeys = {
    all: ['friends'] as const,
    list: () => [...friendKeys.all, 'list'] as const,
    search: (q: string) => [...friendKeys.all, 'search', q] as const,
    pending: () => [...friendKeys.all, 'pending'] as const,
}

export const useGetFriends = (enabled = true) => {
  return useQuery({
    queryKey: friendKeys.list(),
    queryFn: friendApi.getFriends,
    enabled,
  })
}

export const useSearchPlayers = (query: string) => {
    return useQuery<Player[]>({
        queryKey: friendKeys.search(query),
        queryFn: () => friendApi.searchPlayers(query),
        enabled: query.trim().length >= 2,
    })
}

export const useGetPendingRequests = () => {
    return useQuery({
        queryKey: friendKeys.pending(),
        queryFn: friendApi.getPendingRequests,
        initialData: [], 
    })
}

export const useSendFriendRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: friendApi.sendFriendRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.pending() })
        },
    })
}

export const useAcceptFriendRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: friendApi.acceptFriendRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.list() })
            queryClient.invalidateQueries({ queryKey: friendKeys.pending() })
        },
    })
}

export const useRejectFriendRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: friendApi.rejectFriendRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.pending() })
        },
    })
}

export const useRemoveFriend = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: friendApi.removeFriend,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.list() })
        },
    })
}

export const useSendRoomInvite = (options?: any) => {
    return useMutation({
        mutationFn: ({ friendId, roomCode }: { friendId: string; roomCode: string }) => 
            friendApi.sendRoomInvite(friendId, roomCode),
        ...options,
    })
}