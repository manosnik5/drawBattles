package com.drawroyale.socket;

import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.drawroyale.entities.Drawing;
import com.drawroyale.entities.Room;
import com.drawroyale.repositories.DrawingRepository;
import com.drawroyale.repositories.PlayerRepository;
import com.drawroyale.repositories.RankingRepository;
import com.drawroyale.repositories.RoomRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSocketHandler {

    private final SocketIOServer server;
    private final RoomRepository roomRepository;
    private final DrawingRepository drawingRepository;
    private final RankingRepository rankingRepository;
    private final PlayerRepository playerRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, ScheduledFuture<?>> roomTimers  = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler          = Executors.newScheduledThreadPool(4);
    private final Map<String, RoomState>     roomStates       = new ConcurrentHashMap<>();
    private final Map<String, VotingState>   votingStates     = new ConcurrentHashMap<>();
    private final Map<String, SocketIOClient> userSockets     = new ConcurrentHashMap<>();

    public static final List<String> VOTE_OPTIONS =
        List.of("What is this?", "Meh", "Nice", "Awesome", "Legendary");

    // Weight used to calculate final score from reactions
    private static final Map<String, Integer> SCORE_WEIGHTS = Map.of(
        "What is this?", 1,
        "Meh",           2,
        "Nice",          3,
        "Awesome",       4,
        "Legendary",     5
    );

    // In-memory state models
    static class ConnectedPlayer {
        String userId, playerName, avatarColor, imageUrl, socketId;
    }

    static class RoomState {
        String phase;
        String roomId;
        // Active players in the room
        Map<String, ConnectedPlayer> connectedPlayers = new ConcurrentHashMap<>();

        // Tracks drawing submission status per user
        Map<String, Object>          drawingStatus    = new ConcurrentHashMap<>();

        // Theme voting state
        Map<String, Integer>         themeVotes       = new ConcurrentHashMap<>();
        List<String>                 themeOptions     = new ArrayList<>();
        Set<String>                  votedPlayers     = ConcurrentHashMap.newKeySet();
    }

    static class VoteEntry {
        Map<String, Integer> reactions = new ConcurrentHashMap<>();
        Set<String>          voters    = ConcurrentHashMap.newKeySet();
    }

    static class VotingState {
        List<Drawing>        drawings     = new ArrayList<>();
        int                  currentIndex = 0;

        // drawingId → votes
        Map<String, VoteEntry> votes      = new ConcurrentHashMap<>();
    }

    // Socket event registration
    @PostConstruct
    public void registerHandlers() {
        server.addConnectListener(this::onConnect);
        server.addDisconnectListener(this::onDisconnecting);

        // Room lifecycle events
        server.addEventListener("room:join",      Map.class, this::onRoomJoin);
        server.addEventListener("room:leave",     Map.class, this::onRoomLeave);
        server.addEventListener("room:startGame", Map.class, this::onStartGame);
        
        // Gameplay events
        server.addEventListener("theme:options",  Map.class, this::onThemeOptions);
        server.addEventListener("theme:vote",     Map.class, this::onThemeVote);
        server.addEventListener("drawing:stroke", Map.class, this::onDrawingStroke);
        server.addEventListener("drawing:submit", Map.class, this::onDrawingSubmit);
        server.addEventListener("voting:vote",    Map.class, this::onVotingVote);

        // Social event
        server.addEventListener("room:invite",    Map.class, this::onRoomInvite);
    }

    // Connection handling 
    private void onConnect(SocketIOClient client) {
        String userId = getUserId(client);
        if (userId == null) return;

        // Track active socket for direct messaging / invites
        userSockets.put(userId, client);
    }

    private void onDisconnecting(SocketIOClient client) {
        String userId = getUserId(client);
        if (userId == null) return;

        userSockets.remove(userId);

        // Remove user from all rooms they were part of
        for (String roomCode : client.getAllRooms()) {
            if (roomCode.equals(client.getSessionId().toString())) continue;
            removePlayer(roomCode, userId);
        }
    }

    // room:join 
    private void onRoomJoin(SocketIOClient client, Map data, AckRequest ack) {
        String userId     = getUserId(client);
        String roomCode   = (String) data.get("roomCode");
        String playerName = (String) data.get("playerName");
        String avatarColor = (String) data.get("avatarColor");
        if (userId == null || roomCode == null) return;

        try {
            Room room = roomRepository.findByCode(roomCode).orElse(null);
            if (room == null) {
                client.sendEvent("room:error", Map.of("message", "Room not found"));
                return;
            }

            client.joinRoom(roomCode);

            var userPlayer = playerRepository.findById(userId).orElse(null);

            // Ensure room state exists in memory
            roomStates.computeIfAbsent(roomCode, k -> {
                RoomState s = new RoomState();
                s.phase  = room.getPhase().name();
                s.roomId = room.getId();
                return s;
            });

            RoomState state = roomStates.get(roomCode);

            // Register connected player in memory state
            ConnectedPlayer cp = new ConnectedPlayer();
            cp.userId      = userId;
            cp.playerName  = userPlayer != null ? userPlayer.getFullName() : playerName;
            cp.avatarColor = avatarColor;
            cp.imageUrl    = userPlayer != null ? userPlayer.getImageUrl() : null;
            cp.socketId    = client.getSessionId().toString();
            state.connectedPlayers.put(userId, cp);

            List<Map<String, Object>> players = connectedPlayersList(state);

            // Broadcast updated player list
            server.getRoomOperations(roomCode).sendEvent("room:playerJoined", Map.of(
                "userId",           userId,
                "playerName",       cp.playerName != null ? cp.playerName : "",
                "avatarColor",      avatarColor  != null ? avatarColor   : "",
                "imageUrl",         cp.imageUrl  != null ? cp.imageUrl   : "",
                "connectedPlayers", players
            ));

            client.sendEvent("room:state", Map.of(
                "room",             roomToMap(room),
                "phase",            state.phase,
                "connectedPlayers", players
            ));

        } catch (Exception e) {
            log.error("room:join error", e);
            client.sendEvent("room:error", Map.of("message", "Failed to join room"));
        }
    }

    // room:leave 
    private void onRoomLeave(SocketIOClient client, Map data, AckRequest ack) {
        String userId   = getUserId(client);
        String roomCode = (String) data.get("roomCode");
        if (userId == null || roomCode == null) return;

        client.leaveRoom(roomCode);
        removePlayer(roomCode, userId);
    }

    // room:startGame 
    private void onStartGame(SocketIOClient client, Map data, AckRequest ack) {
        String userId   = getUserId(client);
        String roomCode = (String) data.get("roomCode");
        if (userId == null || roomCode == null) return;

        try {
            RoomState state = roomStates.get(roomCode);
            if (state == null) return;

            Room room = roomRepository.findByCode(roomCode).orElse(null);
            if (room == null) return;

            // Only host can start the game
            if (!room.getHostId().equals(userId)) {
                client.sendEvent("room:error", Map.of("message", "Only the host can start the game"));
                return;
            }

            // Require minimum players
            if (state.connectedPlayers.size() < 2) {
                client.sendEvent("room:error", Map.of("message", "Need at least 2 players to start"));
                return;
            }

            // Reset game data
            drawingRepository.deleteAll(drawingRepository.findByRoomCode(roomCode));
            rankingRepository.deleteAll(rankingRepository.findByRoomCode(roomCode));

            // Start theme selection phase
            transitionPhase(roomCode, "theme_vote", null);

        } catch (Exception e) {
            log.error("room:startGame error", e);
            client.sendEvent("room:error", Map.of("message", "Failed to start game"));
        }
    }

    // theme:options 
    private void onThemeOptions(SocketIOClient client, Map data, AckRequest ack) {
        String userId   = getUserId(client);
        String roomCode = (String) data.get("roomCode");
        if (userId == null || roomCode == null) return;

        try {
            Room room = roomRepository.findByCode(roomCode).orElse(null);
            if (room == null || !room.getHostId().equals(userId)) return;

            RoomState state = roomStates.get(roomCode);
            if (state == null) return;

            @SuppressWarnings("unchecked")
            List<String> themes = (List<String>) data.get("themes");
            state.themeOptions = themes;
            state.themeVotes   = new ConcurrentHashMap<>();
            state.votedPlayers = ConcurrentHashMap.newKeySet();
            for (String t : themes) state.themeVotes.put(t, 0);

            server.getRoomOperations(roomCode).sendEvent("theme:options", Map.of("themes", themes));

        } catch (Exception e) {
            log.error("theme:options error", e);
        }
    }

    // theme:vote 
    private void onThemeVote(SocketIOClient client, Map data, AckRequest ack) {
        String userId   = getUserId(client);
        String roomCode = (String) data.get("roomCode");
        String theme    = (String) data.get("theme");
        if (userId == null || roomCode == null || theme == null) return;

        try {
            RoomState state = roomStates.get(roomCode);
            if (state == null) return;
            if (state.votedPlayers.contains(userId)) return;

            state.votedPlayers.add(userId);
            state.themeVotes.merge(theme, 1, Integer::sum);

            server.getRoomOperations(roomCode).sendEvent("theme:vote_update",
                Map.of("votes", new HashMap<>(state.themeVotes))
            );

            // If all players voted end theme
            int totalVotes = state.themeVotes.values().stream().mapToInt(i -> i).sum();

            if (totalVotes >= state.connectedPlayers.size()) {
                String winner = state.themeVotes.entrySet().stream()
                    .max(Comparator.comparingInt(Map.Entry::getValue))
                    .map(Map.Entry::getKey)
                    .orElse(theme);

                Room room = roomRepository.findByCode(roomCode).orElseThrow();
                room.setTheme(winner);
                roomRepository.save(room);

                server.getRoomOperations(roomCode).sendEvent("theme:final",         Map.of("theme", winner));
                server.getRoomOperations(roomCode).sendEvent("room:theme_selected", Map.of("theme", winner));

                int drawSeconds = room.getDrawTimeSeconds();
                scheduler.schedule(() ->
                    transitionPhase(roomCode, "drawing", drawSeconds),
                    2, TimeUnit.SECONDS
                );
            }

        } catch (Exception e) {
            log.error("theme:vote error", e);
        }
    }

    // drawing:stroke 
    private void onDrawingStroke(SocketIOClient client, Map data, AckRequest ack) {
        String userId   = getUserId(client);
        String roomCode = (String) data.get("roomCode");
        Object stroke   = data.get("stroke");
        if (roomCode == null || stroke == null) return;

        server.getRoomOperations(roomCode).sendEvent("drawing:stroke",
            client,
            Map.of("userId", userId != null ? userId : "", "stroke", stroke)
        );
    }

    // drawing:submit 
    private void onDrawingSubmit(SocketIOClient client, Map data, AckRequest ack) {
        String userId     = getUserId(client);
        String roomCode   = (String) data.get("roomCode");
        String playerName = (String) data.get("playerName");
        Object strokes    = data.get("strokes");
        if (userId == null || roomCode == null) return;

        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        if (!"drawing".equals(state.phase)) {
            log.info("drawing:submit ignored — phase is {}", state.phase);
            return;
        }

        if (state.drawingStatus.containsKey(userId)) {
            log.info("drawing:submit ignored — {} already submitted", userId);
            return;
        }

        state.drawingStatus.put(userId, "pending");

        try {
            Room room = roomRepository.findByCode(roomCode).orElseThrow();

            String strokesJson;
            try {
                strokesJson = strokes != null ? objectMapper.writeValueAsString(strokes) : "[]";
            } catch (Exception e) {
                strokesJson = "[]";
            }

            Drawing drawing = new Drawing();
            drawing.setRoom(room);
            drawing.setPlayer(playerRepository.findById(userId).orElseThrow());
            drawing.setPlayerName(playerName != null ? playerName : "Unknown");
            drawing.setStrokes(strokesJson);
            drawing = drawingRepository.save(drawing);

            state.drawingStatus.put(userId, drawing.getId());

            log.info("drawing:submit — {}/{}", state.drawingStatus.size(), state.connectedPlayers.size());

            server.getRoomOperations(roomCode).sendEvent("drawing:submitted", Map.of(
                "userId",         userId,
                "drawingId",      drawing.getId(),
                "totalSubmitted", state.drawingStatus.size(),
                "totalPlayers",   state.connectedPlayers.size()
            ));

            if (state.drawingStatus.size() >= state.connectedPlayers.size()) {
                log.info("all drawings submitted → voting");
                clearRoomTimer(roomCode);
                transitionPhase(roomCode, "voting", null);
            }

        } catch (Exception e) {
            state.drawingStatus.remove(userId);
            log.error("drawing:submit error", e);
            client.sendEvent("room:error", Map.of("message", "Failed to submit drawing"));
        }
    }

    // voting:vote 

    private void onVotingVote(SocketIOClient client, Map data, AckRequest ack) {
        String userId    = getUserId(client);
        String roomCode  = (String) data.get("roomCode");
        String drawingId = (String) data.get("drawingId");
        String reaction  = (String) data.get("reaction");
        if (userId == null || roomCode == null || drawingId == null || reaction == null) return;

        VotingState vs = votingStates.get(roomCode);
        if (vs == null) return;

        VoteEntry entry = vs.votes.get(drawingId);
        if (entry == null) return;
        if (entry.voters.contains(userId)) return;

        entry.voters.add(userId);

        if (VOTE_OPTIONS.contains(reaction)) {
            entry.reactions.merge(reaction, 1, Integer::sum);
            log.info("vote recorded: {} → {} ({})", userId, reaction, drawingId);
        } else {
            log.warn("unknown reaction key: '{}'", reaction);
        }

        server.getRoomOperations(roomCode).sendEvent("voting:update", Map.of(
            "drawingId",  drawingId,
            "reactions",  new HashMap<>(entry.reactions),
            "totalVotes", entry.voters.size()
        ));
    }

    // room:invite 

    private void onRoomInvite(SocketIOClient client, Map data, AckRequest ack) {
        String userId     = getUserId(client);
        String friendId   = (String) data.get("friendId");
        String roomCode   = (String) data.get("roomCode");
        String senderName = (String) data.get("senderName");
        if (friendId == null || roomCode == null) return;

        SocketIOClient friendClient = userSockets.get(friendId);
        if (friendClient != null) {
            friendClient.sendEvent("room:invite", Map.of(
                "roomCode",   roomCode,
                "senderName", senderName != null ? senderName : "Someone",
                "senderId",   userId     != null ? userId     : ""
            ));
        }
    }

    //  Phase Transitions 
    private void transitionPhase(String roomCode, String phase, Integer drawSeconds) {
        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        if (state.phase.equals(phase)) {
            log.info("transitionPhase: already in {}, skipping", phase);
            return;
        }

        log.info("transitionPhase: {} → {}", state.phase, phase);

        if ("voting".equals(phase)) clearRoomTimer(roomCode);

        try {
            Room room = roomRepository.findByCode(roomCode).orElseThrow();
            room.setPhase(Room.Phase.valueOf(phase));
            roomRepository.save(room);
        } catch (Exception e) {
            log.error("DB phase update failed for \"{}\": {}", phase, e.getMessage());
        }

        state.phase = phase;

        if ("drawing".equals(phase))   state.drawingStatus = new ConcurrentHashMap<>();
        if ("theme_vote".equals(phase)) state.votedPlayers  = ConcurrentHashMap.newKeySet();

        server.getRoomOperations(roomCode).sendEvent("phase:changed", Map.of("phase", phase));

        if ("drawing".equals(phase) && drawSeconds != null) startDrawTimer(roomCode, drawSeconds);
        if ("voting".equals(phase))  startVotingRound(roomCode);
        if ("results".equals(phase)) sendResults(roomCode);
    }

    // Draw Timer 
    private void startDrawTimer(String roomCode, int seconds) {
        clearRoomTimer(roomCode);
        int[] timeLeft    = { seconds };
        boolean[] expired = { false };

        server.getRoomOperations(roomCode).sendEvent("timer:tick", Map.of("timeLeft", timeLeft[0]));

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            if (expired[0]) return;

            timeLeft[0]--;
            server.getRoomOperations(roomCode).sendEvent("timer:tick", Map.of("timeLeft", timeLeft[0]));

            if (timeLeft[0] <= 0) {
                expired[0] = true;
                clearRoomTimer(roomCode);
                RoomState state = roomStates.get(roomCode);
                if (state != null && "drawing".equals(state.phase)) {
                    log.info("timer expired → voting ({}/{} submitted)",
                        state.drawingStatus.size(), state.connectedPlayers.size());
                    transitionPhase(roomCode, "voting", null);
                }
            }
        }, 1, 1, TimeUnit.SECONDS);

        roomTimers.put(roomCode, future);
    }

    //  Voting Round
    private void startVotingRound(String roomCode) {
        log.info("startVotingRound called for {}", roomCode);
        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        List<Drawing> drawings = drawingRepository.findByRoomCode(roomCode);

        Map<String, Drawing> seen = new LinkedHashMap<>();
        for (Drawing d : drawings) seen.putIfAbsent(d.getPlayer().getId(), d);
        List<Drawing> unique = new ArrayList<>(seen.values());

        log.info("startVotingRound — {} unique drawings", unique.size());

        if (unique.isEmpty()) {
            transitionPhase(roomCode, "results", null);
            return;
        }

        VotingState vs = new VotingState();
        vs.drawings = unique;
        for (Drawing d : unique) {
            VoteEntry entry = new VoteEntry();
            for (String r : VOTE_OPTIONS) entry.reactions.put(r, 0);
            vs.votes.put(d.getId(), entry);
        }
        votingStates.put(roomCode, vs);

        showNextDrawing(roomCode);
    }

    private void showNextDrawing(String roomCode) {
        VotingState vs = votingStates.get(roomCode);
        if (vs == null) return;

        if (vs.currentIndex >= vs.drawings.size()) {
            log.info("showNextDrawing — all drawings shown for {}", roomCode);
            transitionPhase(roomCode, "results", null);
            return;
        }

        Drawing drawing = vs.drawings.get(vs.currentIndex);
        log.info("showNextDrawing — drawing {}/{} for {}",
            vs.currentIndex + 1, vs.drawings.size(), roomCode);

        // Parse strokes back to object so frontend receives an array, not a string
        Object strokesObj;
        try {
            strokesObj = objectMapper.readValue(drawing.getStrokes(), Object.class);
        } catch (Exception e) {
            strokesObj = List.of();
        }

        server.getRoomOperations(roomCode).sendEvent("voting:drawing", Map.of(
            "drawingId",  drawing.getId(),
            "playerId",   drawing.getPlayer().getId(),
            "playerName", drawing.getPlayerName(),
            "strokes",    strokesObj,
            "current",    vs.currentIndex + 1,
            "total",      vs.drawings.size()
        ));

        int[] timeLeft    = { 10 };
        boolean[] expired = { false };

        server.getRoomOperations(roomCode).sendEvent("voting:tick", Map.of("timeLeft", timeLeft[0]));

        String timerKey = roomCode + "_voting";
        clearRoomTimer(timerKey);

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            if (expired[0]) return;

            timeLeft[0]--;
            server.getRoomOperations(roomCode).sendEvent("voting:tick", Map.of("timeLeft", timeLeft[0]));

            if (timeLeft[0] <= 0) {
                expired[0] = true;
                clearRoomTimer(timerKey);

                VoteEntry vote = vs.votes.get(drawing.getId());
                server.getRoomOperations(roomCode).sendEvent("voting:result", Map.of(
                    "drawingId",  drawing.getId(),
                    "reactions",  vote != null ? new HashMap<>(vote.reactions) : Map.of(),
                    "totalVotes", vote != null ? vote.voters.size() : 0
                ));

                scheduler.schedule(() -> {
                    vs.currentIndex++;
                    showNextDrawing(roomCode);
                }, 2, TimeUnit.SECONDS);
            }
        }, 1, 1, TimeUnit.SECONDS);

        roomTimers.put(timerKey, future);
    }

    // Results 
    private void sendResults(String roomCode) {
        RoomState state  = roomStates.get(roomCode);
        VotingState vs   = votingStates.get(roomCode);
        if (state == null) return;

        List<Drawing> drawings = drawingRepository.findByRoomCode(roomCode);

        // Keep only the first drawing per player, same as voting round
        Map<String, Drawing> seen = new LinkedHashMap<>();
        for (Drawing d : drawings) seen.putIfAbsent(d.getPlayer().getId(), d);
        List<Drawing> unique = new ArrayList<>(seen.values());

        List<Map<String, Object>> results = new ArrayList<>();

        for (Drawing d : unique) {
            VoteEntry vote = vs != null ? vs.votes.get(d.getId()) : null;

            Map<String, Integer> reactions = new HashMap<>();
            for (String r : VOTE_OPTIONS) reactions.put(r, 0);
            if (vote != null) reactions.putAll(vote.reactions);

            int score = reactions.entrySet().stream()
                .mapToInt(e -> SCORE_WEIGHTS.getOrDefault(e.getKey(), 0) * e.getValue())
                .sum();

            // Parse strokes to object
            Object strokesObj;
            try {
                strokesObj = objectMapper.readValue(d.getStrokes(), Object.class);
            } catch (Exception e) {
                strokesObj = List.of();
            }

            results.add(Map.of(
                "playerId",   d.getPlayer().getId(),
                "playerName", d.getPlayerName(),
                "drawingId",  d.getId(),
                "strokes",    strokesObj,
                "reactions",  reactions,
                "totalVotes", vote != null ? vote.voters.size() : 0,
                "score",      score
            ));
        }

        results.sort(Comparator.comparingInt(r -> -((int) r.get("score"))));

        log.info("sendResults — {} results for {}", results.size(), roomCode);
        for (Map<String, Object> r : results) {
            log.info("  {} → reactions={} score={}", r.get("playerName"), r.get("reactions"), r.get("score"));
        }

        votingStates.remove(roomCode);
        server.getRoomOperations(roomCode).sendEvent("results:data", results);
    }

  

    // Remove a player from in-memory state 
    private void removePlayer(String roomCode, String userId) {
        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        state.connectedPlayers.remove(userId);

        server.getRoomOperations(roomCode).sendEvent("room:playerLeft", Map.of(
            "userId",           userId,
            "connectedPlayers", connectedPlayersList(state)
        ));

        // If no players left clean everything up
        if (state.connectedPlayers.isEmpty()) {
            clearRoomTimer(roomCode);
            clearRoomTimer(roomCode + "_voting");
            votingStates.remove(roomCode);
            roomStates.remove(roomCode);
        }
    }

    // userId comes in as a URL query param when the socket connects
    private void clearRoomTimer(String key) {
        ScheduledFuture<?> future = roomTimers.remove(key);
        if (future != null) future.cancel(false);
    }

    // userId comes in as a URL query param when the socket connects
    private String getUserId(SocketIOClient client) {
        return client.getHandshakeData().getSingleUrlParam("userId");
    }

    // Flatten connected players to plain maps so Jackson can serialise them
    private List<Map<String, Object>> connectedPlayersList(RoomState state) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (ConnectedPlayer cp : state.connectedPlayers.values()) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId",      cp.userId);
            m.put("playerName",  cp.playerName  != null ? cp.playerName  : "");
            m.put("avatarColor", cp.avatarColor != null ? cp.avatarColor : "");
            m.put("imageUrl",    cp.imageUrl    != null ? cp.imageUrl    : "");
            m.put("socketId",    cp.socketId);
            list.add(m);
        }
        return list;
    }

    // Lightweight room snapshot with fields only frontend actually needs
    private Map<String, Object> roomToMap(Room room) {
        Map<String, Object> m = new HashMap<>();
        m.put("id",              room.getId());
        m.put("code",            room.getCode());
        m.put("hostId",          room.getHostId());
        m.put("phase",           room.getPhase().name());
        m.put("theme",           room.getTheme() != null ? room.getTheme() : "");
        m.put("drawTimeSeconds", room.getDrawTimeSeconds());
        return m;
    }
}