package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.application.enrollment.EnrollmentService;
import com.oracle.aiworld.voice.application.enrollment.EnrollmentService.EnrollmentAttemptView;
import com.oracle.aiworld.voice.auth.SessionAuthenticator;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/voice")
public class EnrollmentController {
    public record CreateEnrollmentAttemptRequest(
            @NotBlank @Pattern(regexp = "VOICE") String factor,
            @Pattern(regexp = "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$") String locale) {
    }

    public record ConsentDecisionRequest(
            @NotBlank @Size(max = 512) String enrollmentAttemptId,
            @NotBlank @Pattern(regexp = "ACCEPT|DECLINE") String decision,
            @NotBlank @Size(max = 128) String consentVersion) {
    }

    private final SessionAuthenticator authenticator;
    private final SessionCookiePolicy cookiePolicy;
    private final SessionRegistry sessions;
    private final EnrollmentService enrollment;

    public EnrollmentController(
            SessionAuthenticator authenticator,
            SessionCookiePolicy cookiePolicy,
            SessionRegistry sessions,
            EnrollmentService enrollment) {
        this.authenticator = authenticator;
        this.cookiePolicy = cookiePolicy;
        this.sessions = sessions;
        this.enrollment = enrollment;
    }

    @PostMapping("/enrollment-attempt")
    public Mono<ResponseEntity<EnrollmentAttemptView>> create(
            @Valid @RequestBody CreateEnrollmentAttemptRequest request,
            ServerWebExchange exchange) {
        SessionView session = requireCsrf(exchange);
        String correlationId = correlationId(exchange);
        return enrollment.begin(sessionKey(session), session.identity().userGuid(),
                        request.locale() == null ? "en" : request.locale(), correlationId)
                .map(value -> ResponseEntity.status(HttpStatus.CREATED).body(value));
    }

    @PutMapping("/enrollment-attempt/consent")
    public EnrollmentAttemptView consent(
            @Valid @RequestBody ConsentDecisionRequest request,
            ServerWebExchange exchange) {
        SessionView session = requireCsrf(exchange);
        return enrollment.recordConsent(sessionKey(session), request.enrollmentAttemptId(),
                request.decision(), request.consentVersion());
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

    private static String correlationId(ServerWebExchange exchange) {
        return exchange.getAttributeOrDefault(
                CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "unknown-correlation");
    }
}
