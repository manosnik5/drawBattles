package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "player_friends",
    uniqueConstraints = @UniqueConstraint(columnNames = {"player_id", "friend_id"}),
    indexes = {
        @Index(columnList = "player_id"),
        @Index(columnList = "friend_id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlayerFriend {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne
    @JoinColumn(name = "friend_id", nullable = false)
    private Player friend;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}