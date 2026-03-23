import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { roomApi } from "../api/room"
import axios from "axios"

export const roomKeys = {
    all: ["room"] as const,
    data: (roomCode: string) => [...roomKeys.all, roomCode, "data"] as const,
    playerCount: (roomCode: string) => [...roomKeys.all, roomCode, "playerCount"] as const,
}

export const useGetRoom = (roomCode: string) => {
    return useQuery({
        queryKey: roomKeys.data(roomCode),
        queryFn: () => roomApi.getRoomData(roomCode),
        enabled: !!roomCode,
    })
}

export const useGetPlayerCount = (roomCode: string) => {
    return useQuery({
        queryKey: roomKeys.playerCount(roomCode),
        queryFn: () => roomApi.getPlayerCount(roomCode),
        enabled: !!roomCode,
    })
}

export const useCreateRoom = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: roomApi.createRoom,
        onSuccess: (room) => {
            queryClient.setQueryData(roomKeys.data(room.code), room)
            queryClient.invalidateQueries({ queryKey: roomKeys.all })
        },
        onError: (error) => {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                
                console.warn('Room code collision, retry with new code')
            }
        }
    })
}