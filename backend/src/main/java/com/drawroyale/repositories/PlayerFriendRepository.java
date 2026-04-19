package com.drawroyale.repositories;

import com.drawroyale.entities.PlayerFriend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PlayerFriendRepository extends JpaRepository<PlayerFriend, String> {

    // Find a specific friendship relation between two users 
    @Query("SELECT pf FROM PlayerFriend pf WHERE pf.player.id = :playerId AND pf.friend.id = :friendId")
    Optional<PlayerFriend> findByPlayerIdAndFriendId(String playerId, String friendId);

    // Get all friends for a given player 
    @Query("SELECT pf FROM PlayerFriend pf WHERE pf.player.id = :playerId")
    List<PlayerFriend> findByPlayerId(String playerId);

    // Delete friendship in both users 
    @Modifying
    @Query("DELETE FROM PlayerFriend pf WHERE (pf.player.id = :userId AND pf.friend.id = :friendId) OR (pf.player.id = :friendId AND pf.friend.id = :userId)")
    void deleteBothSides(String userId, String friendId);
}