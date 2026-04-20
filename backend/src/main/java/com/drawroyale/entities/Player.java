package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "players",
    indexes = {
        @Index(columnList = "id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Player {

    @Id
    private String id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String imageUrl;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "player")
    @JsonIgnore
    private List<Drawing> drawings;

    @JsonIgnore
    @OneToMany(mappedBy = "sender")
    private List<FriendRequest> sentRequests;

    @JsonIgnore
    @OneToMany(mappedBy = "receiver")
    private List<FriendRequest> receivedRequests;

    @JsonIgnore
    @OneToMany(mappedBy = "player")
    private List<PlayerFriend> friends;

    @JsonIgnore
    @OneToMany(mappedBy = "friend")
    private List<PlayerFriend> friendOf;

    @OneToMany(mappedBy = "voter")
    private List<Ranking> rankings;

    @OneToMany(mappedBy = "player")
    @JsonIgnoreProperties("player")
    private List<RoomPlayer> roomPlayers;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}