package com.reagan.planner.auth;

public record AuthResponse(
        Long userId,
        String email,
        String token
) {
}