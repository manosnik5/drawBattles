package com.drawroyale.repositories;

import com.drawroyale.entities.Ranking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RankingRepository extends JpaRepository<Ranking, String> {

    // Fetch all rankings for a specific room
    @Query("SELECT r FROM Ranking r WHERE r.room.code = :roomCode")
    List<Ranking> findByRoomCode(String roomCode);

    // Check if a player has already voted on a specific drawing
    Optional<Ranking> findByVoterIdAndDrawingId(String voterId, String drawingId);
}