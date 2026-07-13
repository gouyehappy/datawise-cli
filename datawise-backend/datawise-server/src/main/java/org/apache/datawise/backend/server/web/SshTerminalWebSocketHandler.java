package org.apache.datawise.backend.server.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.connector.ssh.SshConnectionException;
import org.apache.datawise.backend.connector.ssh.SshShellEntityResolver;
import org.apache.datawise.backend.connector.ssh.SshShellSession;
import org.apache.datawise.backend.connector.ssh.SshShellSessionManager;
import org.apache.datawise.backend.database.context.ConnectionExecutionContext;
import org.apache.datawise.backend.service.TeamService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SshTerminalWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SshTerminalWebSocketHandler.class);

    private final SshShellSessionManager sessionManager;
    private final ConnectionExecutionContext connectionContext;
    private final TeamService teamService;
    private final ObjectMapper objectMapper;
    private final Map<String, String> shellSessionBySocket = new ConcurrentHashMap<>();

    public SshTerminalWebSocketHandler(
            SshShellSessionManager sessionManager,
            ConnectionExecutionContext connectionContext,
            TeamService teamService,
            ObjectMapper objectMapper
    ) {
        this.sessionManager = sessionManager;
        this.connectionContext = connectionContext;
        this.teamService = teamService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode payload = objectMapper.readTree(message.getPayload());
        String type = payload.path("type").asText("");
        String sessionId = payload.path("sessionId").asText("");
        if (sessionId.isBlank()) {
            return;
        }

        switch (type) {
            case "create" -> handleCreate(session, sessionId, payload);
            case "write" -> handleWrite(session, sessionId, payload.path("data").asText(""));
            case "resize" -> handleResize(
                    session,
                    sessionId,
                    payload.path("cols").asInt(80),
                    payload.path("rows").asInt(24)
            );
            case "destroy" -> handleDestroy(session, sessionId);
            default -> log.debug("Ignoring unknown SSH terminal WS message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = shellSessionBySocket.remove(session.getId());
        if (sessionId != null) {
            Long userId = userId(session);
            destroySession(session, sessionId, userId, "ssh.shell.disconnect");
        }
    }

    private void handleCreate(WebSocketSession socketSession, String sessionId, JsonNode payload) throws IOException {
        Long userId = userId(socketSession);
        String connectionId = connectionId(socketSession);
        int cols = payload.path("cols").asInt(80);
        int rows = payload.path("rows").asInt(24);
        if (userId == null || connectionId == null || connectionId.isBlank()) {
            send(socketSession, message("created", sessionId)
                    .put("ok", false)
                    .put("error", "SSH terminal session is not authenticated"));
            return;
        }
        try {
            var resolved = connectionContext.requireAvailableConnectionForUser(
                    userId,
                    connectionId,
                    "Connection not found: " + connectionId
            );
            if (!SshShellEntityResolver.supportsInteractiveShell(resolved.entity())) {
                send(socketSession, message("created", sessionId)
                        .put("ok", false)
                        .put("error", "Connection does not support SSH shell"));
                return;
            }
            var shellEntity = SshShellEntityResolver.resolveForShell(resolved.entity());
            SshShellSession shellSession = sessionManager.create(
                    sessionId,
                    userId,
                    shellEntity,
                    cols,
                    rows
            );
            shellSessionBySocket.put(socketSession.getId(), sessionId);
            shellSession.pumpOutput(
                    data -> send(socketSession, message("output", sessionId).put("data", data)),
                    code -> {
                        send(socketSession, message("exit", sessionId).put("code", code));
                        destroySession(
                                socketSession,
                                sessionId,
                                userId,
                                "ssh.shell.exit",
                                "exitCode=" + code + "; connectionId=" + connectionId
                        );
                    }
            );
            teamService.recordTerminalAudit(
                    userId,
                    "ssh.shell.open",
                    "sessionId=" + sessionId
                            + "; connectionId=" + connectionId
                            + "; cols=" + cols
                            + "; rows=" + rows
            );
            send(socketSession, message("created", sessionId).put("ok", true));
        } catch (SshConnectionException ex) {
            ExceptionLogging.warn(log, "ssh.shell.create sessionId=" + sessionId, ex);
            send(socketSession, message("created", sessionId).put("ok", false).put("error", ex.getMessage()));
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "ssh.shell.create sessionId=" + sessionId, ex);
            send(socketSession, message("created", sessionId).put("ok", false).put("error", userMessage(ex)));
        }
    }

    private void handleWrite(WebSocketSession socketSession, String sessionId, String data) throws IOException {
        if (!requireOwner(socketSession, sessionId)) {
            return;
        }
        SshShellSession shellSession = sessionManager.get(sessionId);
        if (shellSession == null) {
            return;
        }
        sessionManager.touch(sessionId);
        shellSession.write(data);
    }

    private void handleResize(WebSocketSession socketSession, String sessionId, int cols, int rows) {
        if (!requireOwner(socketSession, sessionId)) {
            return;
        }
        SshShellSession shellSession = sessionManager.get(sessionId);
        if (shellSession == null) {
            return;
        }
        sessionManager.touch(sessionId);
        shellSession.resize(cols, rows);
    }

    private void handleDestroy(WebSocketSession socketSession, String sessionId) {
        if (!requireOwner(socketSession, sessionId)) {
            return;
        }
        destroySession(socketSession, sessionId, userId(socketSession), "ssh.shell.close");
    }

    private void destroySession(WebSocketSession socketSession, String sessionId, Long userId, String action) {
        destroySession(socketSession, sessionId, userId, action, null);
    }

    private void destroySession(
            WebSocketSession socketSession,
            String sessionId,
            Long userId,
            String action,
            String extraDetail
    ) {
        String connectionId = sessionManager.getConnectionId(sessionId);
        sessionManager.destroy(sessionId);
        shellSessionBySocket.remove(socketSession.getId());
        String detail = "sessionId=" + sessionId;
        if (connectionId != null && !connectionId.isBlank()) {
            detail = detail + "; connectionId=" + connectionId;
        }
        if (extraDetail != null && !extraDetail.isBlank()) {
            detail = detail + "; " + extraDetail;
        }
        teamService.recordTerminalAudit(userId, action, detail);
    }

    private boolean requireOwner(WebSocketSession socketSession, String sessionId) {
        Long userId = userId(socketSession);
        if (sessionManager.isOwner(sessionId, userId)) {
            return true;
        }
        log.warn("Rejected SSH terminal WS action for session {} by user {}", sessionId, userId);
        sendForbidden(socketSession, sessionId);
        return false;
    }

    private void sendForbidden(WebSocketSession socketSession, String sessionId) {
        send(socketSession, message("error", sessionId)
                .put("code", TerminalClientIpSupport.ERROR_CODE_FORBIDDEN)
                .put("message", "SSH terminal session access denied"));
    }

    private Long userId(WebSocketSession socketSession) {
        return (Long) socketSession.getAttributes().get(SshTerminalSessionHandshakeInterceptor.ATTR_USER_ID);
    }

    private String connectionId(WebSocketSession socketSession) {
        return (String) socketSession.getAttributes().get(SshTerminalSessionHandshakeInterceptor.ATTR_CONNECTION_ID);
    }

    private ObjectNode message(String type, String sessionId) {
        return objectMapper.createObjectNode()
                .put("type", type)
                .put("sessionId", sessionId);
    }

    private void send(WebSocketSession session, ObjectNode node) {
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(node)));
        } catch (IOException ex) {
            log.debug("Failed to send SSH terminal WS message", ex);
        }
    }

    private static String userMessage(Exception ex) {
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            return ex.getMessage();
        }
        return "SSH shell failed";
    }
}
