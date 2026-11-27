package com.oracle.aiworld.voice.api.websocket;

import java.time.Instant;
import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public final class VoiceProtocolCodec {
    public record ClientCommand(
            String eventId,
            String eventType,
            String voiceSessionId,
            String correlationId,
            long clientSequence,
            Instant occurredAt,
            JsonNode payload) {
    }

    private static final Set<String> ENVELOPE_FIELDS = Set.of(
            "protocolVersion", "eventId", "eventType", "voiceSessionId", "correlationId",
            "clientSequence", "occurredAt", "payload");
    private static final Pattern OPAQUE = Pattern.compile("^[A-Za-z0-9_-]{16,128}$");
    private final ObjectMapper mapper;

    public VoiceProtocolCodec(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ClientCommand decode(String json) {
        try {
            JsonNode root = mapper.readTree(json);
            if (root == null || !root.isObject() || !hasExactFields(root, ENVELOPE_FIELDS)
                    || !"1.0".equals(text(root, "protocolVersion"))) {
                throw new IllegalArgumentException("Invalid voice protocol envelope");
            }
            String eventId = opaque(root, "eventId");
            String eventType = text(root, "eventType");
            String voiceSessionId = opaque(root, "voiceSessionId");
            String correlationId = opaque(root, "correlationId");
            long clientSequence = root.path("clientSequence").asLong(-1);
            Instant occurredAt = Instant.parse(text(root, "occurredAt"));
            JsonNode payload = root.get("payload");
            if (eventType == null || eventType.isBlank() || eventType.length() > 128
                    || clientSequence < 1 || payload == null || !payload.isObject()) {
                throw new IllegalArgumentException("Invalid voice protocol command");
            }
            validatePayload(eventType, clientSequence, payload);
            return new ClientCommand(eventId, eventType, voiceSessionId, correlationId,
                    clientSequence, occurredAt, payload);
        } catch (IllegalArgumentException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalArgumentException("Invalid voice protocol command", failure);
        }
    }

    public String encode(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception failure) {
            throw new IllegalStateException("Cannot encode voice protocol event", failure);
        }
    }

    private static void validatePayload(String type, long sequence, JsonNode payload) {
        if ("session.bind".equals(type)) {
            if (sequence != 1
                    || !hasExactFields(payload, Set.of("requestedProtocolVersion"))
                    || !"1.0".equals(text(payload, "requestedProtocolVersion"))) {
                throw new IllegalArgumentException("Invalid session.bind command");
            }
            return;
        }
        if (!Set.of("capture.start", "capture.pause", "capture.resume", "capture.end",
                "session.cancel", "client.heartbeat")
                .contains(type)) {
            throw new IllegalArgumentException("Unsupported voice protocol command");
        }
        if ("capture.pause".equals(type)
                && (!hasExactFields(payload, Set.of("reason"))
                || !"USER_REQUEST".equals(text(payload, "reason")))) {
            throw new IllegalArgumentException("Invalid capture.pause command");
        }
        if ("capture.resume".equals(type) && !hasExactFields(payload, Set.of())) {
            throw new IllegalArgumentException("Invalid capture.resume command");
        }
    }

    private static String opaque(JsonNode root, String name) {
        String value = text(root, name);
        if (value == null || !OPAQUE.matcher(value).matches()) {
            throw new IllegalArgumentException("Invalid opaque identifier");
        }
        return value;
    }

    private static String text(JsonNode root, String name) {
        JsonNode node = root.get(name);
        return node != null && node.isTextual() ? node.asText() : null;
    }

    private static boolean hasExactFields(JsonNode node, Set<String> expected) {
        java.util.HashSet<String> actual = new java.util.HashSet<>();
        actual.addAll(node.propertyNames());
        return actual.equals(expected);
    }
}
