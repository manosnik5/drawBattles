package com.drawroyale.dto;

import lombok.Data;

@Data
public class SendRoomInviteDto {
    private String friendId;
    private String roomCode;
}