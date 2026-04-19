package com.drawroyale.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class RoomPlayerResponse {
    private String id;
    private String playerId;
    private String fullName;
    private String imageUrl;
    private boolean isHost;
    private String joinedAt;
}