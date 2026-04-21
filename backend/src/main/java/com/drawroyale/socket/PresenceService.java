package com.drawroyale.socket;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final Map<String, String> onlineUsers = new ConcurrentHashMap<>();

    public void addUser(String userId, String sessionId) {
        onlineUsers.put(userId, sessionId);
    }

    public void removeUser(String userId) {
        onlineUsers.remove(userId);
    }

    public List<String> getOnlineUsers() {
        return new ArrayList<>(onlineUsers.keySet());
    }

    public boolean isOnline(String userId) {
        return onlineUsers.containsKey(userId);
    }
}