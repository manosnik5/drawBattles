package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "rooms",
    indexes = {
        @Index(columnList = "code"),
        @Index(columnList = "hostId")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false, length = 6, columnDefinition = "CHAR(6)")
    private String code;

    @Column(nullable = false)
    private String hostId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Phase phase = Phase.lobby;

    private String theme;

    @Column(nullable = false)
    @Builder.Default
    private int drawTimeSeconds = 90;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "room")
    @JsonIgnore
    private List<RoomPlayer> roomPlayers;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL)
    @JsonIgnoreProperties("room")
    private List<Drawing> drawings;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL)
    @JsonIgnoreProperties("room")
    private List<Ranking> rankings;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Phase {
        lobby, theme_vote, drawing, voting, results
    }
}