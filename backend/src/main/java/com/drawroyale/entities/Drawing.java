package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "drawings",
    indexes = {
        @Index(columnList = "room_id"),
        @Index(columnList = "player_id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Drawing {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Column(nullable = false)
    private String playerName;

    @Column(nullable = false, columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String strokes = "[]";

    @Column(nullable = false, updatable = false)
    private LocalDateTime submittedAt;

    @OneToMany(mappedBy = "drawing", cascade = CascadeType.ALL)
    private List<Ranking> rankings;

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
    }
}