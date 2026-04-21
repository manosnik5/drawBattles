package com.drawroyale.socket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

@Slf4j
@Controller
@RequiredArgsConstructor
public class PresenceController {

    private final SimpMessagingTemplate messaging;
    private final PresenceService presenceService;

    @MessageMapping("/presence/online")
    public void getOnlineUsers(SimpMessageHeaderAccessor accessor) {
        String userId    = getUserId(accessor);
        String sessionId = accessor.getSessionId();
        if (userId == null || sessionId == null) return;

        List<String> users = presenceService.getOnlineUsers();
        log.info("presence:get_online_users from {} — {} online", userId, users.size());

        // Send full list back to the requesting user
        messaging.convertAndSendToUser(
            sessionId,
            "/queue/presence/online_users",
            users,
            buildHeaders(sessionId)
        );

        // Broadcast to ALL connected users that this user is online
        // This ensures already-connected users learn about the new user
        messaging.convertAndSend("/topic/presence",
            Map.of("userId", userId, "online", true)
        );
    }

    private String getUserId(SimpMessageHeaderAccessor accessor) {
        if (accessor.getSessionAttributes() != null) {
            String uid = (String) accessor.getSessionAttributes().get("userId");
            if (uid != null && !uid.isBlank()) return uid;
        }
        return accessor.getFirstNativeHeader("userId");
    }

    private org.springframework.messaging.MessageHeaders buildHeaders(String sessionId) {
        SimpMessageHeaderAccessor ha = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        ha.setSessionId(sessionId);
        ha.setLeaveMutable(true);
        return ha.getMessageHeaders();
    }
}