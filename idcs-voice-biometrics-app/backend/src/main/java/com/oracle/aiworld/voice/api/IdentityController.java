package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.auth.SessionAuthenticator;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.domain.AllowedAction;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1")
public class IdentityController {
    public enum EnrollmentStatusLookupState {
        AVAILABLE,
        TEMPORARILY_UNAVAILABLE
    }

    public record CurrentUser(
            String protocolVersion,
            String correlationId,
            String username,
            String displayName,
            String organization,
            EnrollmentStatus enrollmentStatus,
            EnrollmentStatusLookupState enrollmentStatusLookupState,
            Instant statusObservedAt,
            List<AllowedAction> allowedActions,
            boolean transcriptionEnabled) {
    }

    public record EnrollmentStatusResponse(
            String correlationId,
            EnrollmentStatus status,
            Instant observedAt,
            List<AllowedAction> allowedActions) {
    }

    private final SessionAuthenticator authenticator;
    private final SessionRegistry sessions;
    private final SessionCookiePolicy cookiePolicy;
    private final EnrollmentStatusPort enrollmentStatus;
    private final boolean transcriptionEnabled;

    public IdentityController(
            SessionAuthenticator authenticator,
            SessionRegistry sessions,
            SessionCookiePolicy cookiePolicy,
            EnrollmentStatusPort enrollmentStatus,
            @Value("${ai-world.speech.enabled:false}") boolean transcriptionEnabled) {
        this.authenticator = authenticator;
        this.sessions = sessions;
        this.cookiePolicy = cookiePolicy;
        this.enrollmentStatus = enrollmentStatus;
        this.transcriptionEnabled = transcriptionEnabled;
    }

    @GetMapping("/me")
    public Mono<ResponseEntity<CurrentUser>> me(ServerWebExchange exchange) {
        SessionView session = authenticator.require(exchange);
        String correlationId = correlationId(exchange);
        return enrollmentStatus.lookup(session.identity().userGuid(), correlationId)
                .map(observation -> ResponseEntity.ok()
                        .header("X-CSRF-Token", rotateCsrf(exchange))
                        .body(currentUser(session, correlationId, observation)))
                .onErrorResume(ignored -> Mono.just(ResponseEntity.ok()
                        .header("X-CSRF-Token", rotateCsrf(exchange))
                        .body(new CurrentUser(
                                "1.0", correlationId, session.identity().username(),
                                session.identity().displayName(), session.identity().organization(),
                                EnrollmentStatus.UNKNOWN,
                                EnrollmentStatusLookupState.TEMPORARILY_UNAVAILABLE,
                                null,
                                List.of(AllowedAction.SIGN_OUT), transcriptionEnabled))));
    }

    @GetMapping("/voice/enrollment-status")
    public Mono<EnrollmentStatusResponse> enrollmentStatus(ServerWebExchange exchange) {
        SessionView session = authenticator.require(exchange);
        String correlationId = correlationId(exchange);
        return enrollmentStatus.lookup(session.identity().userGuid(), correlationId)
                .map(observation -> new EnrollmentStatusResponse(
                        correlationId,
                        observation.status(),
                        observation.observedAt(),
                        actions(observation.status())))
                .onErrorMap(ignored -> ApiException.providerUnavailable("IAM", "ENROLLMENT_STATUS_UNAVAILABLE"));
    }

    private CurrentUser currentUser(
            SessionView session,
            String correlationId,
            EnrollmentObservation observation) {
        return new CurrentUser(
                "1.0", correlationId, session.identity().username(),
                session.identity().displayName(), session.identity().organization(),
                observation.status(), EnrollmentStatusLookupState.AVAILABLE,
                observation.observedAt(), actions(observation.status()), transcriptionEnabled);
    }

    private static List<AllowedAction> actions(EnrollmentStatus status) {
        return switch (status) {
            case ENROLLED -> List.of(
                    AllowedAction.VERIFY,
                    AllowedAction.DELETE_VOICE_ENROLLMENT,
                    AllowedAction.SIGN_OUT);
            case NOT_ENROLLED -> List.of(AllowedAction.ENROLL, AllowedAction.SIGN_OUT);
            case UNKNOWN -> List.of(AllowedAction.SIGN_OUT);
        };
    }

    private static String correlationId(ServerWebExchange exchange) {
        return exchange.getAttributeOrDefault(CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "unknown-correlation");
    }

    private String rotateCsrf(ServerWebExchange exchange) {
        var cookie = cookiePolicy.read(exchange);
        return sessions.rotateCsrf(cookie == null ? null : cookie.getValue())
                .orElseThrow(ApiException::unauthorized);
    }
}
