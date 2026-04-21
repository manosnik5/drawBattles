package com.drawroyale.socket;

import com.drawroyale.entities.Drawing;
import com.drawroyale.entities.Room;
import com.drawroyale.repositories.DrawingRepository;
import com.drawroyale.repositories.PlayerRepository;
import com.drawroyale.repositories.RankingRepository;
import com.drawroyale.repositories.RoomRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomSocketHandler {

    private final SimpMessagingTemplate messaging;
    private final RoomRepository roomRepository;
    private final DrawingRepository drawingRepository;
    private final RankingRepository rankingRepository;
    private final PlayerRepository playerRepository;
    private final ObjectMapper objectMapper;

    private final Map<String, ScheduledFuture<?>> roomTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler         = Executors.newScheduledThreadPool(4);
    private final Map<String, RoomState>    roomStates       = new ConcurrentHashMap<>();
    private final Map<String, VotingState>  votingStates     = new ConcurrentHashMap<>();

    // userId -> sessionId for direct messaging
    private final Map<String, String> userSessions = new ConcurrentHashMap<>();

    public static final List<String> VOTE_OPTIONS =
        List.of("What is this?", "Meh", "Nice", "Awesome", "Legendary");

    private static final Map<String, Integer> SCORE_WEIGHTS = Map.of(
        "What is this?", 1,
        "Meh",           2,
        "Nice",          3,
        "Awesome",       4,
        "Legendary",     5
    );

    // ─── State Classes ────────────────────────────────────────────────────────

    static class ConnectedPlayer {
        String userId, playerName, avatarColor, imageUrl, sessionId;
    }

    static class RoomState {
        String phase, roomId;
        Map<String, ConnectedPlayer> connectedPlayers = new ConcurrentHashMap<>();
        Map<String, Object>          drawingStatus    = new ConcurrentHashMap<>();
        Map<String, Integer>         themeVotes       = new ConcurrentHashMap<>();
        List<String>                 themeOptions     = new ArrayList<>();
        Set<String>                  votedPlayers     = ConcurrentHashMap.newKeySet();
    }

    static class VoteEntry {
        Map<String, Integer> reactions = new ConcurrentHashMap<>();
        Set<String>          voters    = ConcurrentHashMap.newKeySet();
    }

    static class VotingState {
        List<Drawing>          drawings     = new ArrayList<>();
        int                    currentIndex = 0;
        Map<String, VoteEntry> votes        = new ConcurrentHashMap<>();
    }

    // ─── Called by WebSocketEventListener ────────────────────────────────────

    public void registerSession(String userId, String sessionId) {
        userSessions.put(userId, sessionId);
    }

    public void handleDisconnect(String userId) {
        userSessions.remove(userId);
        for (String roomCode : roomStates.keySet()) {
            RoomState state = roomStates.get(roomCode);
            if (state != null && state.connectedPlayers.containsKey(userId)) {
                removePlayer(roomCode, userId);
            }
        }
    }

    public void sendInviteDirectly(String senderId, String friendId, String roomCode, String senderName) {
    String friendSession = userSessions.get(friendId);
    if (friendSession != null) {
        sendToUser(friendSession, "room/invite", Map.of(
            "roomCode",   roomCode,
            "senderName", senderName,
            "senderId",   senderId
        ));
        log.info("invite sent from {} to {} for room {}", senderId, friendId, roomCode);
    } else {
        log.warn("invite target {} not in userSessions", friendId);
    }
}

    // ─── room:join ────────────────────────────────────────────────────────────

    @MessageMapping("/room/join")
    public void joinRoom(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId     = getUserId(accessor);
        String roomCode   = (String) data.get("roomCode");
        String playerName = (String) data.get("playerName");
        String avatarColor = (String) data.get("avatarColor");
        if (userId == null || roomCode == null) return;

        userSessions.put(userId, accessor.getSessionId());

        try {
            Room room = roomRepository.findByCode(roomCode).orElse(null);
            if (room == null) {
                sendToUser(accessor.getSessionId(), "room/error", Map.of("message", "Room not found"));
                return;
            }

            var userPlayer = playerRepository.findById(userId).orElse(null);

            roomStates.computeIfAbsent(roomCode, k -> {
                RoomState s = new RoomState();
                s.phase  = room.getPhase().name();
                s.roomId = room.getId();
                return s;
            });

            RoomState state = roomStates.get(roomCode);

            ConnectedPlayer cp = new ConnectedPlayer();
            cp.userId      = userId;
            cp.playerName  = userPlayer != null ? userPlayer.getFullName() : playerName;
            cp.avatarColor = avatarColor;
            cp.imageUrl    = userPlayer != null ? userPlayer.getImageUrl() : null;
            cp.sessionId   = accessor.getSessionId();
            state.connectedPlayers.put(userId, cp);

            List<Map<String, Object>> players = connectedPlayersList(state);

            sendToRoom(roomCode, "room/playerJoined", Map.of(
                "userId",           userId,
                "playerName",       cp.playerName  != null ? cp.playerName  : "",
                "avatarColor",      avatarColor    != null ? avatarColor    : "",
                "imageUrl",         cp.imageUrl    != null ? cp.imageUrl    : "",
                "connectedPlayers", players
            ));

            sendToUser(accessor.getSessionId(), "room/state", Map.of(
                "room",             roomToMap(room),
                "phase",            state.phase,
                "connectedPlayers", players
            ));

        } catch (Exception e) {
            log.error("room:join error", e);
            sendToUser(accessor.getSessionId(), "room/error", Map.of("message", "Failed to join room"));
        }
    }

    // ─── room:leave ───────────────────────────────────────────────────────────

    @MessageMapping("/room/leave")
    public void leaveRoom(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId   = getUserId(accessor);
        String roomCode = (String) data.get("roomCode");
        if (userId == null || roomCode == null) return;
        removePlayer(roomCode, userId);
    }

    // ─── room:startGame ───────────────────────────────────────────────────────

    @MessageMapping("/room/startGame")
    public void startGame(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId   = getUserId(accessor);
        String roomCode = (String) data.get("roomCode");
        if (userId == null || roomCode == null) return;

        try {
            RoomState state = roomStates.get(roomCode);
            if (state == null) return;

            Room room = roomRepository.findByCode(roomCode).orElse(null);
            if (room == null) return;

            if (!room.getHostId().equals(userId)) {
                sendToUser(accessor.getSessionId(), "room/error", Map.of("message", "Only the host can start the game"));
                return;
            }

            if (state.connectedPlayers.size() < 2) {
                sendToUser(accessor.getSessionId(), "room/error", Map.of("message", "Need at least 2 players to start"));
                return;
            }

            drawingRepository.deleteAll(drawingRepository.findByRoomCode(roomCode));
            rankingRepository.deleteAll(rankingRepository.findByRoomCode(roomCode));

            transitionPhase(roomCode, "theme_vote", null);

        } catch (Exception e) {
            log.error("room:startGame error", e);
        }
    }

    // ─── theme:options ────────────────────────────────────────────────────────

    @MessageMapping("/theme/options")
    public void themeOptions(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId   = getUserId(accessor);
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

            sendToRoom(roomCode, "theme/options", Map.of("themes", themes));

        } catch (Exception e) {
            log.error("theme:options error", e);
        }
    }

    // ─── theme:vote ───────────────────────────────────────────────────────────

    @MessageMapping("/theme/vote")
    public void themeVote(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId   = getUserId(accessor);
        String roomCode = (String) data.get("roomCode");
        String theme    = (String) data.get("theme");
        if (userId == null || roomCode == null || theme == null) return;

        try {
            RoomState state = roomStates.get(roomCode);
            if (state == null || state.votedPlayers.contains(userId)) return;

            state.votedPlayers.add(userId);
            state.themeVotes.merge(theme, 1, Integer::sum);

            sendToRoom(roomCode, "theme/vote_update", Map.of("votes", new HashMap<>(state.themeVotes)));

            int totalVotes = state.themeVotes.values().stream().mapToInt(i -> i).sum();
            if (totalVotes >= state.connectedPlayers.size()) {
                String winner = state.themeVotes.entrySet().stream()
                    .max(Comparator.comparingInt(Map.Entry::getValue))
                    .map(Map.Entry::getKey)
                    .orElse(theme);

                Room room = roomRepository.findByCode(roomCode).orElseThrow();
                room.setTheme(winner);
                roomRepository.save(room);

                sendToRoom(roomCode, "theme/final",         Map.of("theme", winner));
                sendToRoom(roomCode, "room/theme_selected", Map.of("theme", winner));

                int drawSeconds = room.getDrawTimeSeconds();
                scheduler.schedule(() -> transitionPhase(roomCode, "drawing", drawSeconds), 2, TimeUnit.SECONDS);
            }

        } catch (Exception e) {
            log.error("theme:vote error", e);
        }
    }

    // ─── drawing:stroke ───────────────────────────────────────────────────────

    @MessageMapping("/drawing/stroke")
    public void drawingStroke(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId   = getUserId(accessor);
        String roomCode = (String) data.get("roomCode");
        Object stroke   = data.get("stroke");
        if (roomCode == null || stroke == null) return;

        sendToRoom(roomCode, "drawing/stroke", Map.of(
            "userId", userId != null ? userId : "",
            "stroke", stroke
        ));
    }

    // ─── drawing:submit ───────────────────────────────────────────────────────

    @MessageMapping("/drawing/submit")
    public void drawingSubmit(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId     = getUserId(accessor);
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

            sendToRoom(roomCode, "drawing/submitted", Map.of(
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
            sendToUser(accessor.getSessionId(), "room/error", Map.of("message", "Failed to submit drawing"));
        }
    }

    // ─── voting:vote ──────────────────────────────────────────────────────────

    @MessageMapping("/voting/vote")
    public void votingVote(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId    = getUserId(accessor);
        String roomCode  = (String) data.get("roomCode");
        String drawingId = (String) data.get("drawingId");
        String reaction  = (String) data.get("reaction");
        if (userId == null || roomCode == null || drawingId == null || reaction == null) return;

        VotingState vs = votingStates.get(roomCode);
        if (vs == null) return;

        VoteEntry entry = vs.votes.get(drawingId);
        if (entry == null || entry.voters.contains(userId)) return;

        entry.voters.add(userId);

        if (VOTE_OPTIONS.contains(reaction)) {
            entry.reactions.merge(reaction, 1, Integer::sum);
            log.info("vote recorded: {} → {} ({})", userId, reaction, drawingId);
        } else {
            log.warn("unknown reaction key: '{}'", reaction);
        }

        sendToRoom(roomCode, "voting/update", Map.of(
            "drawingId",  drawingId,
            "reactions",  new HashMap<>(entry.reactions),
            "totalVotes", entry.voters.size()
        ));
    }

    // ─── room:invite ──────────────────────────────────────────────────────────

    @MessageMapping("/room/invite")
    public void roomInvite(@Payload Map<String, Object> data, SimpMessageHeaderAccessor accessor) {
        String userId     = getUserId(accessor);
        String friendId   = (String) data.get("friendId");
        String roomCode   = (String) data.get("roomCode");
        String senderName = (String) data.get("senderName");
        if (friendId == null || roomCode == null) return;

        log.info("room:invite from {} to {} for room {}", userId, friendId, roomCode);

        String friendSession = userSessions.get(friendId);
        if (friendSession != null) {
            log.info("sending invite to friendSession={}", friendSession);
            sendToUser(friendSession, "room/invite", Map.of(
                "roomCode",   roomCode,
                "senderName", senderName != null ? senderName : "Someone",
                "senderId",   userId     != null ? userId     : ""
            ));
        } else {
            log.warn("friend {} not found in userSessions — they may be offline", friendId);
        }
    }

    // ─── Phase Transitions ────────────────────────────────────────────────────

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
            log.error("DB phase update failed: {}", e.getMessage());
        }

        state.phase = phase;

        if ("drawing".equals(phase))    state.drawingStatus = new ConcurrentHashMap<>();
        if ("theme_vote".equals(phase)) state.votedPlayers  = ConcurrentHashMap.newKeySet();

        sendToRoom(roomCode, "phase/changed", Map.of("phase", phase));

        if ("drawing".equals(phase) && drawSeconds != null) startDrawTimer(roomCode, drawSeconds);
        if ("voting".equals(phase))  startVotingRound(roomCode);
        if ("results".equals(phase)) sendResults(roomCode);
    }

    // ─── Draw Timer ───────────────────────────────────────────────────────────

    private void startDrawTimer(String roomCode, int seconds) {
        clearRoomTimer(roomCode);
        int[] timeLeft    = { seconds };
        boolean[] expired = { false };

        sendToRoom(roomCode, "timer/tick", Map.of("timeLeft", timeLeft[0]));

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            if (expired[0]) return;
            timeLeft[0]--;
            sendToRoom(roomCode, "timer/tick", Map.of("timeLeft", timeLeft[0]));

            if (timeLeft[0] <= 0) {
                expired[0] = true;
                clearRoomTimer(roomCode);
                RoomState state = roomStates.get(roomCode);
                if (state != null && "drawing".equals(state.phase)) {
                    transitionPhase(roomCode, "voting", null);
                }
            }
        }, 1, 1, TimeUnit.SECONDS);

        roomTimers.put(roomCode, future);
    }

    // ─── Voting Round ─────────────────────────────────────────────────────────

    private void startVotingRound(String roomCode) {
        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        List<Drawing> drawings = drawingRepository.findByRoomCode(roomCode);

        Map<String, Drawing> seen = new LinkedHashMap<>();
        for (Drawing d : drawings) seen.putIfAbsent(d.getPlayer().getId(), d);
        List<Drawing> unique = new ArrayList<>(seen.values());

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
            transitionPhase(roomCode, "results", null);
            return;
        }

        Drawing drawing = vs.drawings.get(vs.currentIndex);

        Object strokesObj;
        try {
            strokesObj = objectMapper.readValue(drawing.getStrokes(), Object.class);
        } catch (Exception e) {
            strokesObj = List.of();
        }

        sendToRoom(roomCode, "voting/drawing", Map.of(
            "drawingId",  drawing.getId(),
            "playerId",   drawing.getPlayer().getId(),
            "playerName", drawing.getPlayerName(),
            "strokes",    strokesObj,
            "current",    vs.currentIndex + 1,
            "total",      vs.drawings.size()
        ));

        int[] timeLeft    = { 10 };
        boolean[] expired = { false };
        String timerKey   = roomCode + "_voting";

        sendToRoom(roomCode, "voting/tick", Map.of("timeLeft", timeLeft[0]));
        clearRoomTimer(timerKey);

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            if (expired[0]) return;
            timeLeft[0]--;
            sendToRoom(roomCode, "voting/tick", Map.of("timeLeft", timeLeft[0]));

            if (timeLeft[0] <= 0) {
                expired[0] = true;
                clearRoomTimer(timerKey);

                VoteEntry vote = vs.votes.get(drawing.getId());
                sendToRoom(roomCode, "voting/result", Map.of(
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

    // ─── Results ──────────────────────────────────────────────────────────────

    private void sendResults(String roomCode) {
        VotingState vs = votingStates.get(roomCode);

        List<Drawing> drawings = drawingRepository.findByRoomCode(roomCode);
        Map<String, Drawing> seen = new LinkedHashMap<>();
        for (Drawing d : drawings) seen.putIfAbsent(d.getPlayer().getId(), d);

        List<Map<String, Object>> results = new ArrayList<>();
        for (Drawing d : new ArrayList<>(seen.values())) {
            VoteEntry vote = vs != null ? vs.votes.get(d.getId()) : null;

            Map<String, Integer> reactions = new HashMap<>();
            for (String r : VOTE_OPTIONS) reactions.put(r, 0);
            if (vote != null) reactions.putAll(vote.reactions);

            int score = reactions.entrySet().stream()
                .mapToInt(e -> SCORE_WEIGHTS.getOrDefault(e.getKey(), 0) * e.getValue())
                .sum();

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
        votingStates.remove(roomCode);
        sendToRoom(roomCode, "results/data", results);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void removePlayer(String roomCode, String userId) {
        RoomState state = roomStates.get(roomCode);
        if (state == null) return;

        state.connectedPlayers.remove(userId);
        sendToRoom(roomCode, "room/playerLeft", Map.of(
            "userId",           userId,
            "connectedPlayers", connectedPlayersList(state)
        ));

        if (state.connectedPlayers.isEmpty()) {
            clearRoomTimer(roomCode);
            clearRoomTimer(roomCode + "_voting");
            votingStates.remove(roomCode);
            roomStates.remove(roomCode);
        }
    }

    private void sendToRoom(String roomCode, String event, Object payload) {
        messaging.convertAndSend("/topic/room/" + roomCode + "/" + event, payload);
    }

    private void sendToUser(String sessionId, String event, Object payload) {
        org.springframework.messaging.simp.SimpMessageHeaderAccessor ha =
            org.springframework.messaging.simp.SimpMessageHeaderAccessor
                .create(org.springframework.messaging.simp.SimpMessageType.MESSAGE);
        ha.setSessionId(sessionId);
        ha.setLeaveMutable(true);
        messaging.convertAndSendToUser(sessionId, "/queue/" + event, payload, ha.getMessageHeaders());
    }

    private void clearRoomTimer(String key) {
        ScheduledFuture<?> f = roomTimers.remove(key);
        if (f != null) f.cancel(false);
    }

    private String getUserId(SimpMessageHeaderAccessor accessor) {
        if (accessor.getSessionAttributes() == null) return null;
        return (String) accessor.getSessionAttributes().get("userId");
    }

    private List<Map<String, Object>> connectedPlayersList(RoomState state) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (ConnectedPlayer cp : state.connectedPlayers.values()) {
            Map<String, Object> m = new HashMap<>();
            m.put("userId",      cp.userId);
            m.put("playerName",  cp.playerName  != null ? cp.playerName  : "");
            m.put("avatarColor", cp.avatarColor != null ? cp.avatarColor : "");
            m.put("imageUrl",    cp.imageUrl    != null ? cp.imageUrl    : "");
            list.add(m);
        }
        return list;
    }

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