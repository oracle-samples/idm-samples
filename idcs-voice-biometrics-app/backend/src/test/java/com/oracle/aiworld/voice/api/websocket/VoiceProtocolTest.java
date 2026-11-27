package com.oracle.aiworld.voice.api.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class VoiceProtocolTest {
    private final VoiceProtocolCodec codec = new VoiceProtocolCodec(new ObjectMapper());

    @Test
    void acceptsTheExactFirstBindEnvelope() {
        var command = codec.decode("""
                {"protocolVersion":"1.0","eventId":"event-1234567890123456","eventType":"session.bind",
                 "voiceSessionId":"voice-1234567890123456","correlationId":"corr-1234567890123456",
                 "clientSequence":1,"occurredAt":"2026-09-02T00:00:00Z",
                 "payload":{"requestedProtocolVersion":"1.0"}}
                """);
        assertThat(command.eventType()).isEqualTo("session.bind");
        assertThat(command.clientSequence()).isEqualTo(1);
        assertThat(command.voiceSessionId()).isEqualTo("voice-1234567890123456");
    }

    @Test
    void rejectsUnknownFieldsAndUnsupportedProtocol() {
        assertThatThrownBy(() -> codec.decode("""
                {"protocolVersion":"2.0","eventId":"event-1234567890123456","eventType":"session.bind",
                 "voiceSessionId":"voice-1234567890123456","correlationId":"corr-1234567890123456",
                 "clientSequence":1,"occurredAt":"2026-09-02T00:00:00Z","unexpected":true,
                 "payload":{"requestedProtocolVersion":"1.0"}}
                """))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsExactPauseAndResumeCommandsAndRejectsUnexpectedPayloads() {
        assertThat(codec.decode(command("capture.pause", "{\"reason\":\"USER_REQUEST\"}"))
                .eventType()).isEqualTo("capture.pause");
        assertThat(codec.decode(command("capture.resume", "{}"))
                .eventType()).isEqualTo("capture.resume");
        assertThatThrownBy(() -> codec.decode(command(
                "capture.pause", "{\"reason\":\"USER_REQUEST\",\"unexpected\":true}")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> codec.decode(command(
                "capture.resume", "{\"unexpected\":true}")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static String command(String eventType, String payload) {
        return """
                {"protocolVersion":"1.0","eventId":"event-1234567890123456","eventType":"%s",
                 "voiceSessionId":"voice-1234567890123456","correlationId":"corr-1234567890123456",
                 "clientSequence":2,"occurredAt":"2026-09-02T00:00:00Z","payload":%s}
                """.formatted(eventType, payload);
    }
}
