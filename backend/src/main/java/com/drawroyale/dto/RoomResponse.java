package com.drawroyale.dto;

import com.drawroyale.entities.Room;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class RoomResponse {
    private String id;
    private String code;
    private String hostId;
    private Room.Phase phase;
    private String theme;
    private int drawTimeSeconds;
    private String createdAt;
    private List<RoomPlayerResponse> roomPlayers;
}