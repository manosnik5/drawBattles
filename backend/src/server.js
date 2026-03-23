import 'dotenv/config'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { clerkMiddleware } from '@clerk/express'
import { registerPresenceHandlers,  } from './socket/onlineSocket.js'
import { registerRoomHandlers } from './socket/roomSocket.js'

import authRoutes from './routes/auth.route.js'
import roomRoutes from './routes/room.route.js'
import friendRoutes from './routes/friend.route.js'
import adminRoutes from './routes/admin.route.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    }
})

app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
}))

app.use(express.json())
app.use(clerkMiddleware())

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/admin', adminRoutes)

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err?.message || err)
    res.status(500).json({ error: err?.message || 'Internal Server Error' })
})

io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId
    console.log(`Socket connected: ${socket.id} userId: ${userId}`)

    registerPresenceHandlers(io, socket)
    registerRoomHandlers(io, socket)

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
    })
})

httpServer.listen(process.env.PORT || 5000, () => {
    console.log('Server running on port', process.env.PORT || 5000)
})