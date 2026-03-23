import { axiosInstance } from "../lib/axios";
import type { Room } from "../types";

export const roomApi = {
    getRoomData: async (roomCode: string): Promise<Room> => {
        const response = await axiosInstance.get(`/rooms/${roomCode}`)
        return response.data.room
    },

    createRoom: async (data: { code: string }): Promise<Room> => {
    const response = await axiosInstance.post(`/rooms`, data)
    return response.data.room
},

    getPlayerCount: async (roomCode: string): Promise<number> => {
        const response = await axiosInstance.get(`/rooms/${roomCode}/player-count`)
        return response.data.totalPlayers
    },
}