package com.drawroyale.controllers;

import com.drawroyale.dto.CreateRoomRequest;
import com.drawroyale.dto.RoomResponse;
import com.drawroyale.dto.RoomPlayerResponse;
import com.drawroyale.entities.Room;
import com.drawroyale.services.RoomService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    // Handles room-related business logic
    private final RoomService roomService;

    @GetMapping("/{roomCode}")
    public ResponseEntity<?> getRoom(@PathVariable String roomCode) {
        // Fetch room by its unique code
        Room room = roomService.getRoom(roomCode);

        // Convert entity to DTO before returning
        return ResponseEntity.ok(Map.of("room", toResponse(room)));
    }

    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody CreateRoomRequest req, Authentication authentication) { 
        
        // Basic validation 
        if (req.getCode() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "code is required"));
        }

        // Extract authenticated user ID from JWT
        String userId = ((Jwt) authentication.getPrincipal()).getSubject();

        // Create new room with current user as host
        Room room = roomService.createRoom(userId, req.getCode());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("room", toResponse(room)));
    }

    @GetMapping("/{roomCode}/player-count")
    public ResponseEntity<?> getPlayerCount(@PathVariable String roomCode) {
        // Return current number of players in the room
        return ResponseEntity.ok(Map.of(
            "roomCode", roomCode,
            "totalPlayers", roomService.getPlayerCount(roomCode)
        ));
    }

    // Maps Room entity to RoomResponse DTO
    private RoomResponse toResponse(Room room) {
        return RoomResponse.builder()
            .id(room.getId())
            .code(room.getCode())
            .hostId(room.getHostId())
            .phase(room.getPhase())
            .theme(room.getTheme())
            .drawTimeSeconds(room.getDrawTimeSeconds())
            .createdAt(room.getCreatedAt().toString())

            // Safely map players 
            .roomPlayers(room.getRoomPlayers() == null ? java.util.List.of() :
                room.getRoomPlayers().stream().map(rp -> RoomPlayerResponse.builder()
                    .id(rp.getId())
                    .playerId(rp.getPlayer().getId())
                    .fullName(rp.getPlayer().getFullName())
                    .imageUrl(rp.getPlayer().getImageUrl())
                    .isHost(rp.isHost())
                    .joinedAt(rp.getJoinedAt().toString())
                    .build()
                ).toList()
            )
            .build();
    }
}