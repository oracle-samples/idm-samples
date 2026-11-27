package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.application.streaming.VoiceSessionService;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.VoiceSessionView;
import com.oracle.aiworld.voice.auth.SessionAuthenticator;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/voice-session")
public class VoiceSessionController {
    public record CapturePreflight(
            @AssertTrue boolean originMicrophoneCapable,
            @NotBlank @Pattern(regexp = "GRANTED") String microphonePermission,
            @AssertTrue boolean audioProfileSupported) {
    }

    public record CreateVoiceSessionRequest(
            @NotBlank @Pattern(regexp = "ENROLLMENT|VERIFICATION") String purpose,
            @Size(max = 128) String enrollmentAttemptId,
            @NotNull @Valid CapturePreflight capturePreflight,
            @NotNull AudioProfile audioProfile) {
        @AssertTrue(message = "enrollmentAttemptId is required only for enrollment")
        public boolean isPurposeConsistent() {
            return "VERIFICATION".equals(purpose)
                    ? enrollmentAttemptId == null || enrollmentAttemptId.isBlank()
                    : enrollmentAttemptId != null && !enrollmentAttemptId.isBlank();
        }
    }

    private final SessionAuthenticator authenticator;
    private final SessionCookiePolicy cookiePolicy;
    private final SessionRegistry sessions;
    private final VoiceSessionService voiceSessions;

    public VoiceSessionController(
            SessionAuthenticator authenticator,
            SessionCookiePolicy cookiePolicy,
            SessionRegistry sessions,
            VoiceSessionService voiceSessions) {
        this.authenticator = authenticator;
        this.cookiePolicy = cookiePolicy;
        this.sessions = sessions;
        this.voiceSessions = voiceSessions;
    }

    @PostMapping
    public Mono<ResponseEntity<VoiceSessionView>> create(
            @Valid @RequestBody CreateVoiceSessionRequest request,
            ServerWebExchange exchange) {
        SessionView session = requireCsrf(exchange);
        String correlationId = exchange.getAttributeOrDefault(
                CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "unknown-correlation");
        Mono<VoiceSessionView> created = "VERIFICATION".equals(request.purpose())
                ? voiceSessions.createVerification(
                        sessionKey(session), session.identity().userGuid(),
                        request.audioProfile(), correlationId)
                : voiceSessions.createEnrollment(
                        sessionKey(session), request.enrollmentAttemptId(),
                        request.audioProfile(), correlationId);
        return created
                .map(value -> ResponseEntity.status(HttpStatus.CREATED).body(value));
    }

    private SessionView requireCsrf(ServerWebExchange exchange) {
        SessionView session = authenticator.require(exchange);
        var cookie = cookiePolicy.read(exchange);
        String token = exchange.getRequest().getHeaders().getFirst("X-CSRF-Token");
        if (!sessions.verifyCsrf(cookie == null ? null : cookie.getValue(), token)) {
            throw ApiException.forbidden("CSRF_TOKEN_REJECTED");
        }
        return session;
    }

    private static String sessionKey(SessionView session) {
        return OpaqueTokens.digest(session.secretHandle().value());
    }
}
