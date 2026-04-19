package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "room_players",
    uniqueConstraints = @UniqueConstraint(columnNames = {"room_id", "player_id"}),
    indexes = {
        @Index(columnList = "room_id"),
        @Index(columnList = "player_id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RoomPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    @JsonIgnoreProperties("roomPlayers")  // 👈 breaks the cycle
    private Room room;

    @ManyToOne
    @JoinColumn(name = "player_id", nullable = false)
    @JsonIgnoreProperties("roomPlayers")
    private Player player;

    @Column(nullable = false)
    @Builder.Default
    private boolean isHost = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }
}