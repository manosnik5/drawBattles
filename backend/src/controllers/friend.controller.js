import { prisma } from '../lib/prisma.js'

export const sendFriendRequest = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { receiverId } = req.body

        if (!receiverId) {
            return res.status(400).json({ error: 'receiverId is required' })
        }

        if (receiverId === userId) {
            return res.status(400).json({ error: 'You cannot send a friend request to yourself' })
        }

        const receiver = await prisma.player.findUnique({ where: { id: receiverId } })
        if (!receiver) {
            return res.status(404).json({ error: 'Player not found' })
        }

        const alreadyFriends = await prisma.playerFriend.findUnique({
            where: { playerId_friendId: { playerId: userId, friendId: receiverId } }
        })
        if (alreadyFriends) {
            return res.status(409).json({ error: 'Already friends' })
        }

        const existingRequest = await prisma.friendRequest.findUnique({
            where: { senderId_receiverId: { senderId: userId, receiverId } }
        })
        if (existingRequest) {
            return res.status(409).json({ error: 'Friend request already sent' })
        }

        const request = await prisma.friendRequest.create({
            data: { senderId: userId, receiverId },
            include: {
                sender: { select: { id: true, fullName: true, imageUrl: true } }
            }
        })

        return res.status(201).json({ request })
    } catch (error) {
        next(error)
    }
}

export const acceptFriendRequest = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { requestId } = req.params

        const request = await prisma.friendRequest.findUnique({
            where: { id: requestId }
        })

        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' })
        }

        if (request.receiverId !== userId) {
            return res.status(403).json({ error: 'Not authorized to accept this request' })
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' })
        }


        await prisma.$transaction([
            prisma.friendRequest.update({
                where: { id: requestId },
                data: { status: 'accepted' }
            }),
            prisma.playerFriend.createMany({
                data: [
                    { playerId: request.senderId, friendId: request.receiverId },
                    { playerId: request.receiverId, friendId: request.senderId },
                ],
                skipDuplicates: true,
            })
        ])

        return res.json({ message: 'Friend request accepted' })
    } catch (error) {
        next(error)
    }
}

export const rejectFriendRequest = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { requestId } = req.params

        const request = await prisma.friendRequest.findUnique({
            where: { id: requestId }
        })

        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' })
        }

        if (request.receiverId !== userId) {
            return res.status(403).json({ error: 'Not authorized to reject this request' })
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' })
        }

        await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: 'rejected' }
        })

        return res.json({ message: 'Friend request rejected' })
    } catch (error) {
        next(error)
    }
}

export const getPendingRequests = async (req, res, next) => {
    try {
        const { userId } = req.auth()

        const requests = await prisma.friendRequest.findMany({
            where: {
                receiverId: userId,
                status: 'pending',
            },
            include: {
                sender: {
                    select: { id: true, fullName: true, imageUrl: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return res.json({ requests })
    } catch (error) {
        next(error)
    }
}

export const removeFriend = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { friendId } = req.params

        await prisma.$transaction([
            prisma.playerFriend.deleteMany({
                where: {
                    OR: [
                        { playerId: userId, friendId },
                        { playerId: friendId, friendId: userId },
                    ]
                }
            }),
            prisma.friendRequest.deleteMany({
                where: {
                    OR: [
                        { senderId: userId, receiverId: friendId },
                        { senderId: friendId, receiverId: userId },
                    ]
                }
            })
        ])

        return res.json({ message: 'Friend removed' })
    } catch (error) {
        next(error)
    }
}

export const getFriends = async (req, res, next) => {
    try {
        const { userId } = req.auth()

        const friends = await prisma.playerFriend.findMany({
            where: { playerId: userId },
            include: {
                friend: {
                    select: {
                        id: true,
                        fullName: true,
                        imageUrl: true,
                        clerkId: true, 
                    }
                }
            }
        })

        return res.json({ friends: friends.map(f => f.friend) })
    } catch (error) {
        next(error)
    }
}

export const searchPlayers = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { query } = req.query

        const players = await prisma.player.findMany({
            where: {
                AND: [
                    { clerkId: { not: userId } },
                    query ? {
                        fullName: {
                            contains: query,
                            mode: 'insensitive',
                        }
                    } : {},
                ]
            },
            select: { id: true, fullName: true, imageUrl: true, clerkId: true },
            take: 20,
        })

        return res.status(200).json(players)
    } catch (error) {
        next(error)
    }
}

export const sendRoomInvite = async (req, res, next) => {
    try {
        const { userId } = req.auth()
        const { friendId, roomCode } = req.body

        if (!friendId || !roomCode) {
            return res.status(400).json({ error: 'friendId and roomCode are required' })
        }

        // Check if they are friends
        const friendship = await prisma.playerFriend.findUnique({
            where: { playerId_friendId: { playerId: userId, friendId } }
        })

        if (!friendship) {
            return res.status(403).json({ error: 'You can only invite friends' })
        }

        // Check if room exists
        const room = await prisma.room.findUnique({
            where: { code: roomCode }
        })

        if (!room) {
            return res.status(404).json({ error: 'Room not found' })
        }

        // Get sender info
        const sender = await prisma.player.findUnique({
            where: { id: userId },
            select: { fullName: true, imageUrl: true }
        })

        // Here you could emit a socket event to notify the friend
        // For now, we'll just return success
        // In a real implementation, you'd want to send a notification

        return res.status(200).json({ 
            message: 'Room invite sent',
            roomCode,
            sender: sender
        })
    } catch (error) {
        next(error)
    }
}