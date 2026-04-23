import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    useMemo
} from 'react'
import type { ReactNode } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

export type Phase = 'lobby' | 'theme_vote' | 'drawing' | 'voting' | 'results'

export interface ConnectedPlayer {
    userId: string
    playerName: string
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

interface Invite {
    id: string
    roomCode: string
    senderName: string
    senderId: string
}

interface SocketContextValue {
    stompClient: Client | null
    isConnected: boolean
    onlineUsers: Set<string>
    isOnline: (userId: string) => boolean
    roomState: RoomState
    currentRoomCode: string | null
    pendingInvites: Invite[]
    hasSubmittedDrawing: boolean
    setHasSubmittedDrawing: (val: boolean) => void
    joinRoom: (roomCode: string, playerName: string) => void
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
    stompClient: null,
    isConnected: false,
    onlineUsers: new Set(),
    isOnline: () => false,
    roomState: defaultRoomState,
    currentRoomCode: null,
    pendingInvites: [],
    hasSubmittedDrawing: false,
    setHasSubmittedDrawing: () => {},
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
    const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0()
    const userId = user?.sub ?? null

    const [stompClient, setStompClient] = useState<Client | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
    const [roomState, setRoomState] = useState<RoomState>(defaultRoomState)
    const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null)
    const [pendingInvites, setPendingInvites] = useState<Invite[]>([])
    const [hasSubmittedDrawing, setHasSubmittedDrawing] = useState(false)

    const currentRoomCodeRef = useRef<string | null>(null)
    const stompClientRef = useRef<Client | null>(null)
    currentRoomCodeRef.current = currentRoomCode

    const updateRoomState = useCallback((partial: Partial<RoomState>) => {
        setRoomState(prev => ({ ...prev, ...partial }))
    }, [])

    const subscribeToRoom = useCallback((client: Client, roomCode: string) => {
        const subs = [
            client.subscribe(`/topic/room/${roomCode}/room/playerJoined`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ connectedPlayers: d.connectedPlayers })
            }),
            client.subscribe(`/topic/room/${roomCode}/room/playerLeft`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ connectedPlayers: d.connectedPlayers })
            }),
            client.subscribe(`/topic/room/${roomCode}/phase/changed`, msg => {
                const d = JSON.parse(msg.body)
                // Reset drawing submission when phase changes to drawing
                if (d.phase === 'drawing') setHasSubmittedDrawing(false)
                updateRoomState({
                    phase: d.phase,
                    // Don't clear selectedTheme, keep it so DrawingPhase can read it after remount
                    votingDrawing: null,
                    votingResult: null,
                    votingVotes: {},
                    votingTimeLeft: 10,
                })
            }),
            client.subscribe(`/topic/room/${roomCode}/theme/options`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ themeOptions: d.themes })
            }),
            client.subscribe(`/topic/room/${roomCode}/theme/vote_update`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ themeVotes: d.votes })
            }),
            client.subscribe(`/topic/room/${roomCode}/theme/final`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ selectedTheme: d.theme })
            }),
            client.subscribe(`/topic/room/${roomCode}/room/theme_selected`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ selectedTheme: d.theme })
            }),
            client.subscribe(`/topic/room/${roomCode}/timer/tick`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ timeLeft: d.timeLeft })
            }),
            client.subscribe(`/topic/room/${roomCode}/drawing/stroke`, () => {}),
            client.subscribe(`/topic/room/${roomCode}/drawing/submitted`, () => {}),
            client.subscribe(`/topic/room/${roomCode}/voting/drawing`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({
                    votingDrawing: d,
                    votingResult: null,
                    votingVotes: {},
                    votingTimeLeft: 10,
                })
            }),
            client.subscribe(`/topic/room/${roomCode}/voting/tick`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ votingTimeLeft: d.timeLeft })
            }),
            client.subscribe(`/topic/room/${roomCode}/voting/update`, msg => {
                const d = JSON.parse(msg.body)
                setRoomState(prev => ({
                    ...prev,
                    votingVotes: {
                        ...prev.votingVotes,
                        [d.drawingId]: { reactions: d.reactions, totalVotes: d.totalVotes },
                    },
                }))
            }),
            client.subscribe(`/topic/room/${roomCode}/voting/result`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ votingResult: d })
            }),
            client.subscribe(`/topic/room/${roomCode}/results/data`, msg => {
                const d = JSON.parse(msg.body)
                updateRoomState({ results: d })
            }),
            client.subscribe(`/topic/room/${roomCode}/room/error`, msg => {
                const d = JSON.parse(msg.body)
                console.error('room error:', d.message)
            }),
        ]
        return subs
    }, [updateRoomState])

    // Request fresh state from server when tab becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (
                document.visibilityState === 'visible' &&
                stompClientRef.current?.connected &&
                currentRoomCodeRef.current
            ) {
                stompClientRef.current.publish({
                    destination: '/app/room/requestState',
                    body: JSON.stringify({ roomCode: currentRoomCodeRef.current }),
                })
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

   useEffect(() => {
    if (isLoading || !isAuthenticated || !userId) return

    let client: Client
    let roomSubs: any[] = []

    const connect = async () => {
        const token = await getAccessTokenSilently()

        client = new Client({
            webSocketFactory: () => new SockJS(
                `${import.meta.env.VITE_API_URL}/ws?userId=${encodeURIComponent(userId)}`
            ),
            connectHeaders: {
                userId,
                Authorization: `Bearer ${token}`,
            },
            reconnectDelay: 5000,

            onConnect: () => {
                setIsConnected(true)

                client.subscribe('/user/queue/presence/online_users', msg => {
                    const users: string[] = JSON.parse(msg.body)
                    setOnlineUsers(new Set(users))
                })

                client.subscribe('/topic/presence', msg => {
                    const d = JSON.parse(msg.body)
                    setOnlineUsers(prev => {
                        const next = new Set(prev)
                        d.online ? next.add(d.userId) : next.delete(d.userId)
                        return next
                    })
                })

                client.subscribe('/user/queue/room/state', msg => {
                    const d = JSON.parse(msg.body)
                    updateRoomState({
                        phase: d.phase,
                        connectedPlayers: d.connectedPlayers,
                        selectedTheme: d.selectedTheme ?? '',
                    })
                })

                client.subscribe('/user/queue/theme/options', msg => {
                    const d = JSON.parse(msg.body)
                    updateRoomState({ themeOptions: d.themes })
                })

                client.subscribe('/user/queue/theme/vote_update', msg => {
                    const d = JSON.parse(msg.body)
                    updateRoomState({ themeVotes: d.votes })
                })

                client.subscribe('/user/queue/theme/final', msg => {
                    const d = JSON.parse(msg.body)
                    updateRoomState({ selectedTheme: d.theme })
                })

                client.subscribe('/user/queue/voting/drawing', msg => {
                    const d = JSON.parse(msg.body)
                    updateRoomState({
                        votingDrawing: d,
                        votingResult: null,
                        votingVotes: {},
                        votingTimeLeft: 10,
                    })
                })

                client.subscribe('/user/queue/room/invite', msg => {
                    const d = JSON.parse(msg.body)
                    setPendingInvites(prev => [...prev, { id: crypto.randomUUID(), ...d }])
                })

                client.subscribe('/user/queue/room/error', msg => {
                    const d = JSON.parse(msg.body)
                    console.error('room error:', d.message)
                })

                if (currentRoomCodeRef.current) {
                    roomSubs = subscribeToRoom(client, currentRoomCodeRef.current)
                    client.publish({
                        destination: '/app/room/requestState',
                        body: JSON.stringify({ roomCode: currentRoomCodeRef.current }),
                    })
                }

                client.publish({
                    destination: '/app/presence/online',
                    body: JSON.stringify({ userId }),
                })
            },

            onDisconnect: () => {
                setIsConnected(false)
                // 👈 DO NOT reset roomState or currentRoomCode here
                // State is preserved so UI doesn't flicker on reconnect
            },
            onStompError: frame => console.error('STOMP error:', frame),
            })

            client.activate()
            setStompClient(client)
            stompClientRef.current = client
        }

        connect()

        return () => {
            roomSubs.forEach(s => s?.unsubscribe())
            client?.deactivate()
            stompClientRef.current = null
            setStompClient(null)
            setIsConnected(false)
            // 👈 Only reset state when the entire auth session ends (user logs out)
            // NOT on every reconnect
            setOnlineUsers(new Set())
            // Don't reset roomState or currentRoomCode here
        }
    }, [isLoading, isAuthenticated, userId, getAccessTokenSilently, updateRoomState, subscribeToRoom])

    const joinRoom = useCallback((roomCode: string, playerName: string) => {
        if (!stompClient?.connected) return
        setCurrentRoomCode(roomCode)
        currentRoomCodeRef.current = roomCode

        subscribeToRoom(stompClient, roomCode)

        stompClient.publish({
            destination: '/app/room/join',
            body: JSON.stringify({ roomCode, playerName }),
        })
    }, [stompClient, subscribeToRoom])

    const leaveRoom = useCallback((roomCode: string) => {
        stompClient?.publish({
            destination: '/app/room/leave',
            body: JSON.stringify({ roomCode }),
        })
        // Only reset here — when user explicitly leaves
        setCurrentRoomCode(null)
        currentRoomCodeRef.current = null
        setRoomState(defaultRoomState)
        setHasSubmittedDrawing(false)
    }, [stompClient])

    const startGame = useCallback((roomCode: string) => {
        stompClient?.publish({
            destination: '/app/room/startGame',
            body: JSON.stringify({ roomCode }),
        })
    }, [stompClient])

    const submitThemeOptions = useCallback((roomCode: string, themes: string[]) => {
        stompClient?.publish({
            destination: '/app/theme/options',
            body: JSON.stringify({ roomCode, themes }),
        })
    }, [stompClient])

    const voteTheme = useCallback((roomCode: string, theme: string) => {
        stompClient?.publish({
            destination: '/app/theme/vote',
            body: JSON.stringify({ roomCode, theme }),
        })
    }, [stompClient])

    const broadcastStroke = useCallback((roomCode: string, stroke: any) => {
        stompClient?.publish({
            destination: '/app/drawing/stroke',
            body: JSON.stringify({ roomCode, stroke }),
        })
    }, [stompClient])

    const submitDrawing = useCallback((roomCode: string, playerName: string, strokes: any[]) => {
        stompClient?.publish({
            destination: '/app/drawing/submit',
            body: JSON.stringify({ roomCode, playerName, strokes }),
        })
    }, [stompClient])

    const castVote = useCallback((roomCode: string, drawingId: string, reaction: string) => {
        stompClient?.publish({
            destination: '/app/voting/vote',
            body: JSON.stringify({ roomCode, drawingId, reaction }),
        })
    }, [stompClient])

    const acceptRoomInvite = useCallback((inviteId: string) => {
        const invite = pendingInvites.find(i => i.id === inviteId)
        if (invite && stompClient?.connected) {
            joinRoom(invite.roomCode, user?.name || 'Player')
        }
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    }, [pendingInvites, stompClient, user, joinRoom])

    const rejectRoomInvite = useCallback((inviteId: string) => {
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    }, [])

    const isOnline = useCallback((uid: string) => onlineUsers.has(uid), [onlineUsers])

    const value = useMemo(() => ({
        stompClient,
        isConnected,
        onlineUsers,
        isOnline,
        roomState,
        currentRoomCode,
        pendingInvites,
        hasSubmittedDrawing,
        setHasSubmittedDrawing,
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
    }), [
        stompClient, isConnected, onlineUsers, isOnline, roomState,
        currentRoomCode, pendingInvites, hasSubmittedDrawing,
        joinRoom, leaveRoom, startGame, submitThemeOptions, voteTheme,
        broadcastStroke, submitDrawing, castVote, acceptRoomInvite, rejectRoomInvite,
    ])

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    )
}