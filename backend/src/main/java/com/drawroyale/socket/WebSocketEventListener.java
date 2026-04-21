package com.drawroyale.socket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final SimpMessagingTemplate messaging;
    private final PresenceService presenceService;
    private final RoomSocketHandler roomSocketHandler;

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId    = getUserId(accessor);
        String sessionId = accessor.getSessionId();
        if (userId == null || userId.isBlank()) return;

        log.info("WS connected: session={} userId={}", sessionId, userId);

        presenceService.addUser(userId, sessionId);
        roomSocketHandler.registerSession(userId, sessionId);

        // Broadcast to ALL that this user is now online
        messaging.convertAndSend("/topic/presence",
            Map.of("userId", userId, "online", true)
        );
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = getUserId(accessor);
        if (userId == null || userId.isBlank()) return;

        log.info("WS disconnected: session={} userId={}", accessor.getSessionId(), userId);

        presenceService.removeUser(userId);
        roomSocketHandler.handleDisconnect(userId);

        // Broadcast to ALL that this user is now offline
        messaging.convertAndSend("/topic/presence",
            Map.of("userId", userId, "online", false)
        );
    }

    private String getUserId(StompHeaderAccessor accessor) {
        if (accessor.getSessionAttributes() != null) {
            String uid = (String) accessor.getSessionAttributes().get("userId");
            if (uid != null && !uid.isBlank()) return uid;
        }
        return accessor.getFirstNativeHeader("userId");
    }
}