import { prisma } from '../lib/prisma.js'

export const getRoom = async (req, res, next) => {
  try {
    const { roomCode } = req.params
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        roomPlayers: {
          include: {
            player: {
              select: { id: true, fullName: true, imageUrl: true }
            }
          }
        },
        drawings: true,
        rankings: true,
      },
    })

    if (!room) return res.status(404).json({ error: 'Room not found' })
    return res.json({ room })
  } catch (error) {
    next(error)
  }
}

export const createRoom = async (req, res, next) => {
  try {
    const { userId } = req.auth()
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'code is required' })
    }

    const existing = await prisma.room.findUnique({ where: { code } })
    if (existing) {
      return res.status(409).json({ error: `Room with code ${code} already exists` })
    }

    const room = await prisma.room.create({
      data: {
        code,
        hostId: userId,
        theme: '',
        roomPlayers: {
          create: {
            playerId: userId,
            isHost: true,
          }
        }
      },
      include: {
        roomPlayers: {
          include: {
            player: {
              select: { id: true, fullName: true, imageUrl: true }
            }
          }
        }
      }
    })

    return res.status(201).json({ room })
  } catch (error) {
    console.error('createRoom error:', error)
    return res.status(500).json({ error: error?.message || 'Internal Server Error' })
  }
}

export const getPlayerCount = async (req, res, next) => {
  try {
    const { roomCode } = req.params
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      select: { _count: { select: { roomPlayers: true } } }
    })

    if (!room) return res.status(404).json({ error: 'Room not found' })
    return res.json({ roomCode, totalPlayers: room._count.roomPlayers })
  } catch (error) {
    next(error)
  }
}