package com.drawroyale.controllers;

import com.drawroyale.dto.SendFriendRequestDto;
import com.drawroyale.dto.SendRoomInviteDto;
import com.drawroyale.entities.FriendRequest;
import com.drawroyale.repositories.FriendRequestRepository;
import com.drawroyale.services.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    // Handles all friend-related business logic
    private final FriendService friendService;

    // Helper to extract user ID from JWT
    private String userId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new RuntimeException("Unauthenticated request");
        }

        String id = ((Jwt) auth.getPrincipal()).getSubject();

        return id;
    }

    @GetMapping
    public ResponseEntity<?> getFriends(Authentication auth) {
        // Return list of current user's friends
        return ResponseEntity.ok(
            Map.of("friends", friendService.getFriends(userId(auth)))
        );
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchPlayers(
            @RequestParam(required = false) String query,
            Authentication auth
    ) {
        // Search players 
        return ResponseEntity.ok(
            Map.of("users", friendService.searchPlayers(userId(auth), query))
        );
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(Authentication auth) {
        String id = userId(auth);

        // Fetch all incoming friend requests 
        return ResponseEntity.ok(
            Map.of("requests", friendService.getPendingRequests(id))
        );
    }

    @PostMapping("/request")
    public ResponseEntity<?> sendFriendRequest(
            @RequestBody SendFriendRequestDto dto,
            Authentication auth
    ) {
        // Create and send a new friend request
        FriendRequest request = friendService.sendFriendRequest(
            userId(auth),
            dto.getReceiverId()
        );

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("request", request));
    }

    @PostMapping("/request/{requestId}/accept")
    public ResponseEntity<?> acceptRequest(
            @PathVariable String requestId,
            Authentication auth
    ) {
        // Accept friend request
        friendService.acceptFriendRequest(userId(auth), requestId);

        return ResponseEntity.ok(
            Map.of("message", "Friend request accepted")
        );
    }

    @PostMapping("/request/{requestId}/reject")
    public ResponseEntity<?> rejectRequest(
            @PathVariable String requestId,
            Authentication auth
    ) {
        // Reject friend request
        friendService.rejectFriendRequest(userId(auth), requestId);

        return ResponseEntity.ok(
            Map.of("message", "Friend request rejected")
        );
    }

    @PostMapping("/invite")
    public ResponseEntity<?> sendRoomInvite(
            @RequestBody SendRoomInviteDto dto,
            Authentication auth
    ) {
        // Send a room invite to a friend
        return ResponseEntity.ok(
            friendService.sendRoomInvite(
                userId(auth),
                dto.getFriendId(),
                dto.getRoomCode()
            )
        );
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<?> removeFriend(
            @PathVariable String friendId,
            Authentication auth
    ) {
        // Remove friend relationship
        friendService.removeFriend(userId(auth), friendId);

        return ResponseEntity.ok(
            Map.of("message", "Friend removed")
        );
    }
}