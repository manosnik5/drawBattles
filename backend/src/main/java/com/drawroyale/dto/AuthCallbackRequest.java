package com.drawroyale.dto;

import lombok.Data;

@Data
public class AuthCallbackRequest {
    private String id;
    private String firstName;
    private String lastName;
    private String imageUrl;
}