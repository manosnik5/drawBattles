package com.drawroyale.repositories;

import com.drawroyale.entities.Drawing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DrawingRepository extends JpaRepository<Drawing, String> {

    // Fetch all drawings for a specific room, ordered by submission time 
    @Query("SELECT d FROM Drawing d WHERE d.room.code = :roomCode ORDER BY d.submittedAt ASC")
    List<Drawing> findByRoomCode(String roomCode);

    // Get all drawings created by a specific player
    List<Drawing> findByPlayerId(String playerId);
}