import { axiosInstance } from '../lib/axios'
import type { Player } from '../types'
import type{ FriendRequest } from '../types'



export const friendApi = {
    getFriends: async (): Promise<Player[]> => {
        const response = await axiosInstance.get('/friends')
        return response.data.friends
    },
    
    searchPlayers: async (query: string): Promise<Player[]> => {
        const response = await axiosInstance.get('/friends/search', { params: { query } })
        return response.data
    },

    getPendingRequests: async (): Promise<FriendRequest[]> => {
        const response = await axiosInstance.get('/friends/requests/pending')
        return response.data.requests
    },

    sendFriendRequest: async (receiverId: string): Promise<FriendRequest> => {
        const response = await axiosInstance.post('/friends/request', { receiverId })
        return response.data.request
    },

    acceptFriendRequest: async (requestId: string): Promise<void> => {
        await axiosInstance.post(`/friends/request/${requestId}/accept`)
    },

    rejectFriendRequest: async (requestId: string): Promise<void> => {
        await axiosInstance.post(`/friends/request/${requestId}/reject`)
    },

    removeFriend: async (friendId: string): Promise<void> => {
        await axiosInstance.delete(`/friends/${friendId}`)
    },

    sendRoomInvite: async (friendId: string, roomCode: string): Promise<{ message: string }> => {
        const response = await axiosInstance.post('/friends/invite', { friendId, roomCode })
        return response.data
    },
}