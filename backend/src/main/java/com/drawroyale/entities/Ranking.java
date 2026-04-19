package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rankings",
    uniqueConstraints = @UniqueConstraint(columnNames = {"voter_id", "drawing_id"}),
    indexes = {
        @Index(columnList = "room_id"),
        @Index(columnList = "drawing_id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Ranking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne
    @JoinColumn(name = "voter_id", nullable = false)
    private Player voter;

    @ManyToOne
    @JoinColumn(name = "drawing_id", nullable = false)
    private Drawing drawing;

    @Column(nullable = false)
    private int rank;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}