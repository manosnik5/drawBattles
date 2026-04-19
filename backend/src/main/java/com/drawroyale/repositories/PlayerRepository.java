package com.drawroyale.repositories;

import com.drawroyale.entities.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PlayerRepository extends JpaRepository<Player, String> {

    // Search players by name (excludes the current user from results)
    @Query("""
        SELECT p FROM Player p
        WHERE LOWER(p.fullName) LIKE LOWER(CONCAT('%', :name, '%'))
        AND p.id <> :userId
    """)
    List<Player> searchPlayers(String name, String userId);
}