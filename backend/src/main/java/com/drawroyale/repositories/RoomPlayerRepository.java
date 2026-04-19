package com.drawroyale.repositories;

import com.drawroyale.entities.RoomPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RoomPlayerRepository extends JpaRepository<RoomPlayer, String> {

    // Count how many players are currently inside a room
    @Query("SELECT COUNT(rp) FROM RoomPlayer rp WHERE rp.room.code = :roomCode")
    long countByRoomCode(String roomCode);
}