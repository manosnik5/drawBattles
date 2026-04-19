package com.drawroyale.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "friend_requests",
    uniqueConstraints = @UniqueConstraint(columnNames = {"sender_id", "receiver_id"}),
    indexes = {
        @Index(columnList = "receiver_id"),
        @Index(columnList = "sender_id")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FriendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne
    @JoinColumn(name = "sender_id", nullable = false)
    private Player sender;

    @ManyToOne
    @JoinColumn(name = "receiver_id", nullable = false)
    private Player receiver;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.pending;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Status { pending, accepted, rejected }
}