package com.drawroyale.socket;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.SocketIOClient;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class PresenceHandler {

    private final SocketIOServer server;

    // userId -> socketId
    private final Map<String, String> onlineUsers = new ConcurrentHashMap<>();

    @PostConstruct
    public void registerHandlers() {
        server.addConnectListener(this::onConnect);
        server.addDisconnectListener(this::onDisconnect);
        server.addEventListener("presence:get_online_users", Object.class, this::onGetOnlineUsers);
    }

    private void onConnect(SocketIOClient client) {
        String userId = client.getHandshakeData().getSingleUrlParam("userId");
        log.info("registerPresenceHandlers - userId: {}", userId);

        if (userId == null || userId.isBlank()) {
            log.info("no userId in handshake, skipping");
            return;
        }

        onlineUsers.put(userId, client.getSessionId().toString());

        // Broadcast to everyone except sender
        server.getBroadcastOperations().sendEvent("presence:update",
            client,
            Map.of("userId", userId, "online", true)
        );
    }

    private void onDisconnect(SocketIOClient client) {
        String userId = client.getHandshakeData().getSingleUrlParam("userId");
        if (userId == null || userId.isBlank()) return;

        onlineUsers.remove(userId);

        // Broadcast to everyone including sender (io.emit equivalent)
        server.getBroadcastOperations().sendEvent("presence:update",
            Map.of("userId", userId, "online", false)
        );
    }

    private void onGetOnlineUsers(SocketIOClient client, Object data, com.corundumstudio.socketio.AckRequest ack) {
        String userId = client.getHandshakeData().getSingleUrlParam("userId");
        List<String> userIds = new ArrayList<>(onlineUsers.keySet());
        log.info("sending online users to: {} {}", userId, userIds);
        client.sendEvent("presence:online_users", userIds);
    }

    public List<String> getOnlineUsers() {
        return new ArrayList<>(onlineUsers.keySet());
    }
}