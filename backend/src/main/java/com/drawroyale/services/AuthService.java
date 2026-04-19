package com.drawroyale.services;

import com.drawroyale.dto.AuthCallbackRequest;
import com.drawroyale.entities.Player;
import com.drawroyale.repositories.PlayerRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final PlayerRepository playerRepository;

    public Player authCallback(AuthCallbackRequest req) {

        // Build full name safely from OAuth/provider data
        String fullName = (
            (req.getFirstName() != null ? req.getFirstName() : "") + " " +
            (req.getLastName()  != null ? req.getLastName()  : "")
        ).trim();

        // Fallback if both first and last name are missing
        if (fullName.isEmpty()) fullName = "Anonymous";

        final String name = fullName;

        // Check if player already exists
        return playerRepository.findById(req.getId()).map(existing -> {

            // Update existing player info on login
            existing.setFullName(name);
            existing.setImageUrl(req.getImageUrl() != null ? req.getImageUrl() : "");

            return playerRepository.save(existing);

        }).orElseGet(() ->

            // Create new player if first login
            playerRepository.save(
                Player.builder()
                    .id(req.getId())
                    .fullName(name)
                    .imageUrl(req.getImageUrl() != null ? req.getImageUrl() : "")
                    .build()
            )
        );
    }
}