package com.drawroyale.controllers;

import com.drawroyale.dto.AuthCallbackRequest;
import com.drawroyale.services.AuthService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    // Handles authentication logic 
    private final AuthService authService;

    @PostMapping("/callback")
    public ResponseEntity<?> authCallback(@RequestBody AuthCallbackRequest req) {

        // Basic validation 
        if (req.getId() == null)
            return ResponseEntity.badRequest().body(Map.of("error", "id is required"));

        return ResponseEntity.ok(Map.of("player", authService.authCallback(req)));
    }
}