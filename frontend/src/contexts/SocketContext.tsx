import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { io, Socket } from 'socket.io-client'

export type Phase = 'lobby' | 'theme_vote' | 'drawing' | 'voting' | 'results'

export interface ConnectedPlayer {
    userId: string
    playerName: string
    avatarColor: string
    imageUrl?: string
}

export interface VotingDrawing {
    drawingId: string
    playerId: string
    playerName: string
    strokes: any[]
    current: number
    total: number
}

export interface VotingUpdate {
    drawingId: string
    reactions: Record<string, number>
    totalVotes: number
}

export interface VotingResult {
    drawingId: string
    reactions: Record<string, number>
    totalVotes: number
}

export interface ResultEntry {
    playerId: string
    playerName: string
    drawingId: string
    strokes: any[]
    reactions: Record<string, number>
    totalVotes: number
    score: number
}

export interface RoomState {
    phase: Phase
    connectedPlayers: ConnectedPlayer[]
    selectedTheme: string
    timeLeft: number
    themeOptions: string[]
    themeVotes: Record<string, number>
    votingDrawing: VotingDrawing | null
    votingTimeLeft: number
    votingVotes: Record<string, { reactions: Record<string, number>; totalVotes: number }>
    votingResult: VotingResult | null
    results: ResultEntry[]
}

const defaultRoomState: RoomState = {
    phase: 'lobby',
    connectedPlayers: [],
    selectedTheme: '',
    timeLeft: 0,
    themeOptions: [],
    themeVotes: {},
    votingDrawing: null,
    votingTimeLeft: 10,
    votingVotes: {},
    votingResult: null,
    results: [],
}

interface SocketContextValue {
    socket: Socket | null
    isConnected: boolean
    onlineUsers: Set<string>
    isOnline: (userId: string) => boolean
    roomState: RoomState
    currentRoomCode: string | null
    pendingInvites: Array<{
        id: string
        roomCode: string
        senderName: string
        senderId: string
    }>
    joinRoom: (roomCode: string, playerName: string, avatarColor: string) => void
    leaveRoom: (roomCode: string) => void
    startGame: (roomCode: string) => void
    submitThemeOptions: (roomCode: string, themes: string[]) => void
    voteTheme: (roomCode: string, theme: string) => void
    broadcastStroke: (roomCode: string, stroke: any) => void
    submitDrawing: (roomCode: string, playerName: string, strokes: any[]) => void
    castVote: (roomCode: string, drawingId: string, reaction: string) => void
    acceptRoomInvite: (inviteId: string) => void
    rejectRoomInvite: (inviteId: string) => void
}

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    isConnected: false,
    onlineUsers: new Set(),
    isOnline: () => false,
    roomState: defaultRoomState,
    currentRoomCode: null,
    pendingInvites: [],
    joinRoom: () => {},
    leaveRoom: () => {},
    startGame: () => {},
    submitThemeOptions: () => {},
    voteTheme: () => {},
    broadcastStroke: () => {},
    submitDrawing: () => {},
    castVote: () => {},
    acceptRoomInvite: () => {},
    rejectRoomInvite: () => {},
})

export const useSocketContext = () => useContext(SocketContext)

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const { userId, isLoaded } = useAuth()
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
    const [roomState, setRoomState] = useState<RoomState>(defaultRoomState)
    const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null)
    const [pendingInvites, setPendingInvites] = useState<Array<{
        id: string
        roomCode: string
        senderName: string
        senderId: string
    }>>([])

    const updateRoomState = (partial: Partial<RoomState>) => {
        setRoomState(prev => ({ ...prev, ...partial }))
    }

    useEffect(() => {
        if (!isLoaded || !userId) return

        console.log('connecting to:', import.meta.env.VITE_API_URL)

        const s = io(import.meta.env.VITE_API_URL, {
            auth: { userId },
            withCredentials: true,
        })

        setSocket(s)

        s.on('connect', () => {
            console.log('socket connected:', s.id)
            setIsConnected(true)
            s.emit('presence:get_online_users')
        })

        s.on('disconnect', () => {
            console.log('socket disconnected')
            setIsConnected(false)
        })

        s.on('connect_error', (err) => {
            console.error('socket connect_error:', err.message)
            setIsConnected(false)
        })

        s.on('presence:online_users', (users: string[]) => {
            setOnlineUsers(new Set(users))
        })

        s.on('presence:update', ({ userId: uid, online }: { userId: string; online: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev)
                online ? next.add(uid) : next.delete(uid)
                return next
            })
        })

        s.on('room:state', ({ phase, connectedPlayers }: { phase: Phase; connectedPlayers: ConnectedPlayer[] }) => {
            updateRoomState({ phase, connectedPlayers })
        })

        s.on('room:playerJoined', ({ connectedPlayers }: { connectedPlayers: ConnectedPlayer[] }) => {
            updateRoomState({ connectedPlayers })
        })

        s.on('room:playerLeft', ({ connectedPlayers }: { connectedPlayers: ConnectedPlayer[] }) => {
            updateRoomState({ connectedPlayers })
        })

        s.on('room:error', ({ message }: { message: string }) => {
            console.error('room error:', message)
        })

        s.on('phase:changed', ({ phase }: { phase: Phase }) => {
            console.log('Phase changed to:', phase)
            updateRoomState({
                phase,
                votingDrawing: null,
                votingResult: null,
                votingVotes: {},
                votingTimeLeft: 10,
            })
        })

        s.on('theme:options', ({ themes }: { themes: string[] }) => {
            updateRoomState({ themeOptions: themes })
        })

        s.on('theme:vote_update', ({ votes }: { votes: Record<string, number> }) => {
            updateRoomState({ themeVotes: votes })
        })

        s.on('theme:final', ({ theme }: { theme: string }) => {
            updateRoomState({ selectedTheme: theme })
        })

        s.on('room:theme_selected', ({ theme }: { theme: string }) => {
            updateRoomState({ selectedTheme: theme })
        })

        s.on('timer:tick', ({ timeLeft }: { timeLeft: number }) => {
            updateRoomState({ timeLeft })
        })

        s.on('drawing:submitted', ({ totalSubmitted, totalPlayers }: { totalSubmitted: number; totalPlayers: number }) => {
            console.log(`drawings: ${totalSubmitted}/${totalPlayers}`)
        })
        s.on('voting:drawing', (data: VotingDrawing) => {
            console.log('Received voting:drawing', data)
            updateRoomState({
                votingDrawing: data,
                votingResult: null,
                votingVotes: {},
                votingTimeLeft: 10,
            })
        })

        s.on('voting:tick', ({ timeLeft }: { timeLeft: number }) => {
            updateRoomState({ votingTimeLeft: timeLeft })
        })

        s.on('voting:update', ({ drawingId, reactions, totalVotes }: VotingUpdate) => {
            setRoomState(prev => ({
                ...prev,
                votingVotes: {
                    ...prev.votingVotes,
                    [drawingId]: { reactions, totalVotes },
                },
            }))
        })

        s.on('voting:result', (data: VotingResult) => {
            updateRoomState({ votingResult: data })
        })

        s.on('results:data', (results: ResultEntry[]) => {
            updateRoomState({ results })
        })

        s.on('room:invite', (data: { roomCode: string; senderName: string; senderId: string }) => {
            const inviteId = `${data.senderId}_${data.roomCode}_${Date.now()}`
            setPendingInvites(prev => [...prev, {
                id: inviteId,
                roomCode: data.roomCode,
                senderName: data.senderName,
                senderId: data.senderId
            }])
        })

        return () => {
            s.off('connect')
            s.off('disconnect')
            s.off('connect_error')
            s.off('presence:online_users')
            s.off('presence:update')
            s.off('room:state')
            s.off('room:playerJoined')
            s.off('room:playerLeft')
            s.off('room:error')
            s.off('phase:changed')
            s.off('theme:options')
            s.off('theme:vote_update')
            s.off('theme:final')
            s.off('room:theme_selected')
            s.off('timer:tick')
            s.off('drawing:submitted')
            s.off('voting:drawing')
            s.off('voting:tick')
            s.off('voting:update')
            s.off('voting:result')
            s.off('results:data')
            s.off('room:invite')
            s.disconnect()
            setSocket(null)
            setIsConnected(false)
            setOnlineUsers(new Set())
            setRoomState(defaultRoomState)
        }
    }, [userId, isLoaded])


    const joinRoom = useCallback((roomCode: string, playerName: string, avatarColor: string) => {
        socket?.emit('room:join', { roomCode, playerName, avatarColor })
        setCurrentRoomCode(roomCode)
    }, [socket])

    const leaveRoom = useCallback((roomCode: string) => {
        socket?.emit('room:leave', { roomCode })
        setRoomState(defaultRoomState)
        setCurrentRoomCode(null)
    }, [socket])

    const startGame = useCallback((roomCode: string) => {
        socket?.emit('room:startGame', { roomCode })
    }, [socket])

    const submitThemeOptions = useCallback((roomCode: string, themes: string[]) => {
        socket?.emit('theme:options', { roomCode, themes })
    }, [socket])

    const voteTheme = useCallback((roomCode: string, theme: string) => {
        socket?.emit('theme:vote', { roomCode, theme })
    }, [socket])

    const broadcastStroke = useCallback((roomCode: string, stroke: any) => {
        socket?.emit('drawing:stroke', { roomCode, stroke })
    }, [socket])

    const submitDrawing = useCallback((roomCode: string, playerName: string, strokes: any[]) => {
        socket?.emit('drawing:submit', { roomCode, playerName, strokes })
    }, [socket])

    const castVote = useCallback((roomCode: string, drawingId: string, reaction: string) => {
        socket?.emit('voting:vote', { roomCode, drawingId, reaction })
    }, [socket])

    const acceptRoomInvite = useCallback((inviteId: string) => {
        setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId))

    }, [])

    const rejectRoomInvite = useCallback((inviteId: string) => {
        setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId))
    }, [])

    const isOnline = useCallback((uid: string) => onlineUsers.has(uid), [onlineUsers])

    return (
        <SocketContext.Provider value={{
            socket,
            isConnected,
            onlineUsers,
            isOnline,
            roomState,
            currentRoomCode,
            pendingInvites,
            joinRoom,
            leaveRoom,
            startGame,
            submitThemeOptions,
            voteTheme,
            broadcastStroke,
            submitDrawing,
            castVote,
            acceptRoomInvite,
            rejectRoomInvite,
        }}>
            {children}
        </SocketContext.Provider>
    )
}