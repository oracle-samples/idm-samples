package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.application.unenrollment.VoiceUnenrollmentService;
import com.oracle.aiworld.voice.auth.SessionAuthenticator;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.domain.AllowedAction;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/voice/enrollment")
public class VoiceUnenrollmentController {
    public record VoiceUnenrollmentResponse(
            String protocolVersion,
            String correlationId,
            Outcome outcome,
            EnrollmentStatus enrollmentStatus,
            IdentityController.EnrollmentStatusLookupState enrollmentStatusLookupState,
            Instant statusObservedAt,
            List<AllowedAction> allowedActions) {
    }

    private final SessionAuthenticator authenticator;
    private final SessionCookiePolicy cookiePolicy;
    private final SessionRegistry sessions;
    private final VoiceUnenrollmentService unenrollment;

    public VoiceUnenrollmentController(
            SessionAuthenticator authenticator,
            SessionCookiePolicy cookiePolicy,
            SessionRegistry sessions,
            VoiceUnenrollmentService unenrollment) {
        this.authenticator = authenticator;
        this.cookiePolicy = cookiePolicy;
        this.sessions = sessions;
        this.unenrollment = unenrollment;
    }

    @DeleteMapping
    public Mono<ResponseEntity<VoiceUnenrollmentResponse>> deleteCurrentEnrollment(
            ServerWebExchange exchange) {
        return rejectBody(exchange).then(Mono.defer(() -> {
            SessionView session = requireCsrf(exchange);
            String idempotencyKey = exchange.getRequest().getHeaders().getFirst("Idempotency-Key");
            String correlationId = exchange.getAttributeOrDefault(
                    CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "unknown-correlation");
            return unenrollment.deleteCurrentEnrollment(session, idempotencyKey, correlationId)
                    .map(result -> ResponseEntity.ok(new VoiceUnenrollmentResponse(
                            "1.0",
                            correlationId,
                            result.outcome(),
                            EnrollmentStatus.NOT_ENROLLED,
                            IdentityController.EnrollmentStatusLookupState.AVAILABLE,
                            result.observedAt(),
                            List.of(AllowedAction.ENROLL, AllowedAction.SIGN_OUT))));
        }));
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

    private static Mono<Void> rejectBody(ServerWebExchange exchange) {
        long contentLength = exchange.getRequest().getHeaders().getContentLength();
        List<String> transferEncoding = exchange.getRequest().getHeaders()
                .getOrEmpty(HttpHeaders.TRANSFER_ENCODING);
        if (contentLength > 0 || !transferEncoding.isEmpty()) {
            return Mono.error(ApiException.badRequest("REQUEST_BODY_NOT_ALLOWED"));
        }
        return exchange.getRequest().getBody()
                .hasElements()
                .flatMap(hasBody -> hasBody
                        ? Mono.error(ApiException.badRequest("REQUEST_BODY_NOT_ALLOWED"))
                        : Mono.empty());
    }
}
