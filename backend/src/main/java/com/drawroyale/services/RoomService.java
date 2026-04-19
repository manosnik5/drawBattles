package com.drawroyale.services;

import com.drawroyale.entities.*;
import com.drawroyale.repositories.*;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomPlayerRepository roomPlayerRepository;
    private final PlayerRepository playerRepository;

    // Fetch a room by its unique code or fail if it doesn't exist
    public Room getRoom(String roomCode) {
        return roomRepository.findByCode(roomCode)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));
    }

    // Create a new room and assign the creator as host + first player
    @Transactional
    public Room createRoom(String userId, String code) {

        // Prevent duplicate room codes
        if (roomRepository.findByCode(code).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Room with code " + code + " already exists");

        // Ensure the creator exists
        Player player = playerRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Player not found"));

        // Create and persist the room
        Room room = roomRepository.save(
            Room.builder()
                .code(code)
                .hostId(userId)
                .phase(Room.Phase.lobby)
                .drawTimeSeconds(90)
                .build()
        );

        // Add creator as first room participant and mark them as host
        roomPlayerRepository.save(
            RoomPlayer.builder()
                .room(room)
                .player(player)
                .isHost(true)
                .build()
        );

        // Re-fetch room 
        return roomRepository.findByCode(code).get();
    }

    // Get current number of players in a room
    public long getPlayerCount(String roomCode) {

        // Validate room exists before counting
        roomRepository.findByCode(roomCode)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        return roomPlayerRepository.countByRoomCode(roomCode);
    }
}