package com.drawroyale.services;

import com.drawroyale.entities.*;
import com.drawroyale.repositories.*;
import com.drawroyale.socket.RoomSocketHandler;

import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FriendService {

    private final PlayerFriendRepository playerFriendRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final PlayerRepository playerRepository;
    private final RoomRepository roomRepository;
    @Lazy
    private final RoomSocketHandler roomSocketHandler;

    public List<Player> getFriends(String userId) {
        return playerFriendRepository.findByPlayerId(userId).stream()
            .map(PlayerFriend::getFriend)
            .toList();
    }

    public List<Player> searchPlayers(String userId, String query) {
        return playerRepository.searchPlayers(query != null ? query : "", userId);
    }


    // Send friend request
    public FriendRequest sendFriendRequest(String userId, String receiverId) {

        if (receiverId == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "receiverId is required");

        if (receiverId.equals(userId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot send request to yourself");

        Player sender = playerRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sender not found"));

        Player receiver = playerRepository.findById(receiverId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found"));

        // Check if already friends 
        if (playerFriendRepository.findByPlayerIdAndFriendId(userId, receiverId).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already friends");

        // Block if there is a pending request
        boolean pendingExists = friendRequestRepository
            .findBySenderIdAndReceiverIdAndStatus(
                userId,
                receiverId,
                FriendRequest.Status.pending
            )
            .isPresent();

        if (pendingExists)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Friend request already sent");

        return friendRequestRepository.save(
            FriendRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(FriendRequest.Status.pending)
                .build()
        );
    }

    // Accept friend request
    @Transactional
    public void acceptFriendRequest(String userId, String requestId) {

        FriendRequest request = friendRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));

        if (!request.getReceiver().getId().equals(userId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");

        if (request.getStatus() != FriendRequest.Status.pending)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is no longer pending");

        request.setStatus(FriendRequest.Status.accepted);
        friendRequestRepository.save(request);

        Player sender = request.getSender();
        Player receiver = request.getReceiver();

        playerFriendRepository.save(
            PlayerFriend.builder().player(sender).friend(receiver).build()
        );
        playerFriendRepository.save(
            PlayerFriend.builder().player(receiver).friend(sender).build()
        );
    }


    // Reject friend request
    @Transactional
    public void rejectFriendRequest(String userId, String requestId) {

    FriendRequest request = friendRequestRepository.findById(requestId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

    if (!request.getReceiver().getId().equals(userId))
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);

    if (request.getStatus() != FriendRequest.Status.pending)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST);

    friendRequestRepository.delete(request); 
}

    // Get pending friend requests
    public List<FriendRequest> getPendingRequests(String userId) {
        return friendRequestRepository.findByReceiverIdAndStatus(
            userId,
            FriendRequest.Status.pending
        );
    }

    // Remove friend
    @Transactional
    public void removeFriend(String userId, String friendId) {
        playerFriendRepository.deleteBothSides(userId, friendId);
        friendRequestRepository.deleteBothSides(userId, friendId);
    }


    // Room invite
    public Map<String, Object> sendRoomInvite(String userId, String friendId, String roomCode) {

        if (friendId == null || roomCode == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "friendId and roomCode are required");

        playerFriendRepository.findByPlayerIdAndFriendId(userId, friendId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only invite friends"));

        roomRepository.findByCode(roomCode)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        Player sender = playerRepository.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found"));

        // Trigger the socket invite directly
        roomSocketHandler.sendInviteDirectly(userId, friendId, roomCode, sender.getFullName());

        return Map.of("message", "Room invite sent", "roomCode", roomCode, "sender", sender);
        }
}