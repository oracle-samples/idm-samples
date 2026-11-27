package com.oracle.aiworld.voice.api.websocket;

import com.oracle.aiworld.voice.api.websocket.VoiceProtocolCodec.ClientCommand;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.port.AbisVoicePort.BranchUnavailableException;
import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEvent;
import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEventType;
import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchProcessingException;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

@Component
public final class VoiceWebSocketHandler implements WebSocketHandler {
    private final VoiceSessionService voiceSessions;
    private final SessionRegistry sessions;
    private final SessionCookiePolicy cookiePolicy;
    private final VoiceProtocolCodec codec;
    private final String publicOrigin;
    private final Clock clock;
    private final SecureRandom random;

    public VoiceWebSocketHandler(
            VoiceSessionService voiceSessions,
            SessionRegistry sessions,
            SessionCookiePolicy cookiePolicy,
            VoiceProtocolCodec codec,
            AiWorldProperties properties,
            Clock clock,
            SecureRandom random) {
        this.voiceSessions = voiceSessions;
        this.sessions = sessions;
        this.cookiePolicy = cookiePolicy;
        this.codec = codec;
        this.publicOrigin = properties.publicOrigin();
        this.clock = clock;
        this.random = random;
    }

    @Override
    public Mono<Void> handle(WebSocketSession socket) {
        String origin = socket.getHandshakeInfo().getHeaders().getOrigin();
        HttpCookie cookie = socket.getHandshakeInfo().getCookies().getFirst(cookiePolicy.cookieName());
        SessionView applicationSession = cookie == null ? null : sessions.find(cookie.getValue()).orElse(null);
        if (!publicOrigin.equals(origin) || applicationSession == null) {
            return socket.close(org.springframework.web.reactive.socket.CloseStatus.POLICY_VIOLATION);
        }

        SocketContext context = new SocketContext(
                OpaqueTokens.digest(applicationSession.secretHandle().value()), socket);
        Disposable bindGuard = Mono.delay(Duration.ofSeconds(5)).subscribe(ignored -> {
            if (!context.bound.get()) {
                context.error("FLOW", "SESSION_BIND_TIMEOUT", true);
            }
        });
        Mono<Void> outbound = socket.send(context.outbound.asFlux().map(socket::textMessage));
        Mono<Void> inbound = socket.receive()
                .concatMap(message -> process(context, message))
                .then()
                .doFinally(ignored -> {
                    bindGuard.dispose();
                    context.outbound.tryEmitComplete();
                });
        return Mono.when(outbound, inbound)
                .doFinally(ignored -> {
                    bindGuard.dispose();
                    context.dispose();
                });
    }

    private Mono<Void> process(SocketContext context, WebSocketMessage message) {
        if (message.getType() == WebSocketMessage.Type.TEXT) {
            return processCommand(context, codec.decode(message.getPayloadAsText()));
        }
        if (message.getType() == WebSocketMessage.Type.BINARY) {
            DataBuffer payload = message.getPayload();
            byte[] pcm = new byte[payload.readableByteCount()];
            payload.read(pcm);
            return voiceSessions.acceptAudio(context.owner, context.voiceSessionId, pcm)
                    .doOnNext(ack -> context.emit("audio.ack", "APPLICATION", Map.of(
                            "acceptedThroughAudioSequence", ack.acceptedThroughAudioSequence(),
                            "acceptedFrameCount", ack.acceptedFrameCount(),
                            "credit", credit(ack.acceptedThroughAudioSequence()))))
                    .then()
                    .onErrorResume(BranchProcessingException.class, failure -> Mono.fromRunnable(
                            () -> context.error(stageFor(failure.safeCode()), failure.safeCode(), true)))
                    .onErrorResume(failure -> Mono.fromRunnable(
                            () -> context.error("FLOW", "VOICE_AUDIO_DELIVERY_FAILED", true)));
        }
        return Mono.fromRunnable(() -> context.error("FLOW", "UNSUPPORTED_WEBSOCKET_MESSAGE", true));
    }

    private Mono<Void> processCommand(SocketContext context, ClientCommand command) {
        if (!context.bound.get()) {
            if (!"session.bind".equals(command.eventType()) || command.clientSequence() != 1) {
                context.error("FLOW", "SESSION_BIND_REQUIRED", true);
                return Mono.empty();
            }
            context.voiceSessionId = command.voiceSessionId();
            context.correlationId = command.correlationId();
            return voiceSessions.bind(context.owner, command.voiceSessionId())
                    .doOnNext(view -> {
                        context.bound.set(true);
                        context.purpose = view.purpose();
                        context.subscribeToProviderEvents();
                        context.emit("session.bound", "APPLICATION", Map.of(
                                "purpose", view.purpose(),
                                "state", "READY",
                                "audioProfile", view.audioProfile(),
                                "credit", credit(0),
                                "operationalLimits", view.operationalLimits(),
                                "maxCaptureSeconds", view.maxCaptureSeconds(),
                                "drainDeadlineSeconds", view.drainDeadlineSeconds(),
                                "dependencies", view.dependencies()));
                    })
                    .onErrorResume(BranchUnavailableException.class, failure -> {
                        context.emit("dependency.state", "ABIS", Map.of(
                                "dependency", "ABIS", "state", "FAILED", "retryable", true,
                                "safeCode", failure.safeCode()));
                        context.error("ABIS", failure.safeCode(), true);
                        return Mono.empty();
                    })
                    .onErrorResume(
                            com.oracle.aiworld.voice.port.SpeechTranscriptionPort.BranchUnavailableException.class,
                            failure -> {
                                context.emit("dependency.state", "SPEECH", Map.of(
                                        "dependency", "SPEECH", "state", "FAILED", "retryable", true,
                                        "safeCode", failure.safeCode()));
                                context.error("SPEECH", failure.safeCode(), true);
                                return Mono.empty();
                            })
                    .onErrorResume(failure -> {
                        context.emit("dependency.state", "ABIS", Map.of(
                                "dependency", "ABIS", "state", "FAILED", "retryable", true,
                                "safeCode", "ABIS_ADAPTER_NOT_READY"));
                        context.emit("dependency.state", "SPEECH", Map.of(
                                "dependency", "SPEECH", "state", "FAILED", "retryable", true,
                                "safeCode", "SPEECH_ADAPTER_NOT_READY"));
                        context.error("FLOW", "VOICE_DEPENDENCIES_UNAVAILABLE", true);
                        return Mono.empty();
                    })
                    .then();
        }
        if (!command.voiceSessionId().equals(context.voiceSessionId)
                || !command.correlationId().equals(context.correlationId)) {
            context.error("FLOW", "SESSION_CORRELATION_REJECTED", true);
            return Mono.empty();
        }
        return switch (command.eventType()) {
            case "capture.start" -> voiceSessions.startCapture(context.owner, context.voiceSessionId)
                    .doOnNext(ignored -> context.emit(
                            "capture.state", "APPLICATION", Map.of("state", "CAPTURING")))
                    .then();
            case "capture.pause" -> voiceSessions.pauseCapture(context.owner, context.voiceSessionId)
                    .doOnNext(ignored -> context.emit(
                            "capture.state", "APPLICATION", Map.of("state", "MUTED")))
                    .then()
                    .onErrorResume(failure -> Mono.fromRunnable(
                            () -> context.error("FLOW", "CAPTURE_PAUSE_FAILED", false)));
            case "capture.resume" -> voiceSessions.resumeCapture(context.owner, context.voiceSessionId)
                    .doOnNext(ignored -> context.emit(
                            "capture.state", "APPLICATION", Map.of("state", "CAPTURING")))
                    .then()
                    .onErrorResume(failure -> Mono.fromRunnable(
                            () -> context.error("FLOW", "CAPTURE_RESUME_FAILED", false)));
            case "capture.end" -> voiceSessions.complete(context.owner, context.voiceSessionId)
                    .doOnNext(view -> {
                        context.emit("capture.state", "APPLICATION", Map.of("state", "COMPLETED"));
                        context.completeSuccessfully(view.purpose());
                    })
                    .then()
                    .onErrorResume(BranchProcessingException.class, failure -> Mono.fromRunnable(
                            () -> context.error(stageFor(failure.safeCode()), failure.safeCode(), true)))
                    .onErrorResume(failure -> Mono.fromRunnable(
                            () -> context.error("FLOW", "VOICE_SESSION_COMPLETION_FAILED", true)));
            case "session.cancel" -> Mono.fromRunnable(context::dispose);
            case "client.heartbeat" -> Mono.empty();
            default -> Mono.fromRunnable(() -> context.error(
                    "FLOW", "UNSUPPORTED_CLIENT_COMMAND", true));
        };
    }

    private static Map<String, Object> credit(long acceptedSequence) {
        return Map.of(
                "windowVersion", acceptedSequence,
                "availableFrames", 50,
                "availableBytes", 32000,
                "maxOutstandingFrames", 50,
                "maxOutstandingBytes", 32000,
                "maxFrameBytes", 640,
                "reason", acceptedSequence == 0 ? "INITIAL" : "ACKNOWLEDGED");
    }

    private static String stageFor(String safeCode) {
        return safeCode != null && safeCode.startsWith("SPEECH_") ? "SPEECH" : "ABIS";
    }

    private final class SocketContext {
        private final String owner;
        private final WebSocketSession socket;
        private final Sinks.Many<String> outbound = Sinks.many().unicast().onBackpressureBuffer();
        private final AtomicBoolean bound = new AtomicBoolean();
        private final AtomicBoolean completionEmitted = new AtomicBoolean();
        private final AtomicLong eventSequence = new AtomicLong();
        private Disposable providerEventSubscription;
        private String voiceSessionId = "unbound-session";
        private String correlationId = "unbound-correlation";
        private String purpose = "UNKNOWN";

        private SocketContext(String owner, WebSocketSession socket) {
            this.owner = owner;
            this.socket = socket;
        }

        private void emit(String eventType, String source, Object payload) {
            emit(eventType, source, null, payload);
        }

        private void emit(String eventType, String source, String utteranceId, Object payload) {
            Instant now = clock.instant();
            Map<String, Object> envelope = new java.util.LinkedHashMap<>();
            envelope.put("protocolVersion", "1.0");
            envelope.put("eventId", OpaqueTokens.random(random));
            envelope.put("eventType", eventType);
            envelope.put("source", source);
            envelope.put("voiceSessionId", voiceSessionId);
            envelope.put("correlationId", correlationId);
            envelope.put("eventSequence", eventSequence.incrementAndGet());
            envelope.put("occurredAt", now.toString());
            envelope.put("emittedAt", now.toString());
            if (utteranceId != null) envelope.put("utteranceId", utteranceId);
            envelope.put("payload", payload);
            outbound.tryEmitNext(codec.encode(envelope));
        }

        private void error(String stage, String code, boolean terminal) {
            emit("error", "APPLICATION", Map.of(
                    "stage", stage,
                    "failureKind", "DEPENDENCY",
                    "code", code,
                    "processingState", "FAILED",
                    "retryable", true,
                    "terminal", terminal));
        }

        private void subscribeToProviderEvents() {
            providerEventSubscription = voiceSessions.events(owner, voiceSessionId)
                    .subscribe(this::providerEvent);
        }

        private void providerEvent(BranchEvent event) {
            if (event.type() == BranchEventType.ACKNOWLEDGED
                    && "ENROLLMENT".equals(purpose)
                    && "ABIS_AUDIO_PROGRESS".equals(event.safeCode())) {
                emit("enrollment.progress", event.source(), event.payload());
            } else if (event.type() == BranchEventType.WAITING) {
                if ("ENROLLMENT".equals(purpose)) {
                    emit("enrollment.state", event.source(), Map.of(
                            "state", "WAITING",
                            "action", event.action(),
                            "safeCode", event.safeCode()));
                }
            } else if (event.type() == BranchEventType.CAPTURE_QUALITY) {
                emit("capture.quality", "APPLICATION", event.payload());
            } else if (event.type() == BranchEventType.TRANSCRIPT_PARTIAL
                    || event.type() == BranchEventType.TRANSCRIPT_FINAL) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>(event.payload());
                Object utterance = payload.remove("utteranceId");
                if (utterance instanceof String utteranceId && !utteranceId.isBlank()) {
                    emit(
                            event.type() == BranchEventType.TRANSCRIPT_FINAL
                                    ? "transcript.final" : "transcript.partial",
                            "SPEECH",
                            utteranceId,
                            payload);
                }
            } else if (event.type() == BranchEventType.UTTERANCE_STARTED
                    || event.type() == BranchEventType.UTTERANCE_DISCARDED
                    || event.type() == BranchEventType.UTTERANCE_SEALED) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>(event.payload());
                Object utterance = payload.remove("utteranceId");
                if (utterance instanceof String utteranceId && !utteranceId.isBlank()) {
                    emit(
                            event.type() == BranchEventType.UTTERANCE_STARTED
                                    ? "utterance.started"
                                    : event.type() == BranchEventType.UTTERANCE_DISCARDED
                                    ? "utterance.discarded" : "utterance.sealed",
                            "APPLICATION",
                            utteranceId,
                            payload);
                }
            } else if (event.type() == BranchEventType.TRANSCRIPT_FAILED) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>(event.payload());
                Object utterance = payload.remove("utteranceId");
                if (utterance instanceof String utteranceId && !utteranceId.isBlank()) {
                    payload.put("processingState", "FAILED");
                    payload.put("stage", "TRANSCRIPTION");
                    payload.put("failureKind", "CORRELATION");
                    payload.put("code", event.safeCode());
                    payload.put("retryable", false);
                    payload.put("terminal", false);
                    payload.put("affectedDependency", "SPEECH");
                    emit("transcript.failed", event.source(), utteranceId, payload);
                }
            } else if (event.type() == BranchEventType.ASSURANCE_RESULT) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>(event.payload());
                Object utterance = payload.remove("utteranceId");
                if (utterance instanceof String utteranceId && !utteranceId.isBlank()) {
                    payload.put("completedAt", clock.instant().toString());
                    emit("assurance.result", "ABIS", utteranceId, payload);
                }
            } else if (event.type() == BranchEventType.ASSURANCE_FAILED) {
                Map<String, Object> payload = new java.util.LinkedHashMap<>(event.payload());
                Object utterance = payload.remove("utteranceId");
                if (utterance instanceof String utteranceId && !utteranceId.isBlank()) {
                    payload.put("processingState", "FAILED");
                    payload.put("stage", "ABIS");
                    payload.put("failureKind", "QUALITY");
                    payload.put("code", event.safeCode());
                    payload.put("retryable", true);
                    payload.put("terminal", false);
                    payload.put("affectedDependency", "ABIS");
                    emit("assurance.failed", "ABIS", utteranceId, payload);
                }
            } else if (event.type() == BranchEventType.SUCCEEDED) {
                emit("capture.state", event.source(), Map.of("state", "COMPLETED"));
                completeSuccessfully(purpose);
            } else if (event.type() == BranchEventType.FAILED) {
                error(event.source(), event.safeCode(), true);
            }
        }

        private void completeSuccessfully(String purpose) {
            if (!completionEmitted.compareAndSet(false, true)) return;
            emit("session.completed", "APPLICATION", Map.of(
                    "state", "COMPLETED",
                    "purpose", purpose));
        }

        private void dispose() {
            if (providerEventSubscription != null) providerEventSubscription.dispose();
            if (bound.get() && voiceSessionId != null) {
                try {
                    voiceSessions.cancel(owner, voiceSessionId);
                } catch (RuntimeException ignored) {
                    // Session is already terminal or gone.
                }
            }
            outbound.tryEmitComplete();
        }
    }
}
