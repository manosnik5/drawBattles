package com.drawroyale.repositories;

import com.drawroyale.entities.FriendRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, String> {

    // Find a specific friend request between two users with a given status
    Optional<FriendRequest> findBySenderIdAndReceiverIdAndStatus(
        String senderId,
        String receiverId,
        FriendRequest.Status status
    );

    // Get all friend requests sent to a user with a specific status 
    List<FriendRequest> findByReceiverIdAndStatus(
        String receiverId,
        FriendRequest.Status status
    );

    // Custom query to fetch all requests for a receiver ordered by newest first
    @Query("""
        SELECT fr FROM FriendRequest fr
        WHERE fr.receiver.id = :receiverId
        ORDER BY fr.createdAt DESC
    """)
    List<FriendRequest> findAllByReceiverId(String receiverId);

    // Deletes any friend request between two users for both users
    @Modifying
    @Query("""
        DELETE FROM FriendRequest fr
        WHERE (fr.sender.id = :userId AND fr.receiver.id = :friendId)
           OR (fr.sender.id = :friendId AND fr.receiver.id = :userId)
    """)
    void deleteBothSides(String userId, String friendId);
}