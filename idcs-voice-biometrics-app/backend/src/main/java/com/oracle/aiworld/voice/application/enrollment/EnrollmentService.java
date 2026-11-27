package com.oracle.aiworld.voice.application.enrollment;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class EnrollmentService {
    public enum AttemptState {
        CONSENT_PENDING,
        CONSENT_ACCEPT_INTENT_RECORDED,
        CONSENT_DECLINED
    }

    public record ConsentText(String version, String locale, String text) {
    }

    public record EnrollmentAttemptView(
            String enrollmentAttemptId,
            String correlationId,
            AttemptState state,
            ConsentText consent,
            Instant expiresAt) {
    }

    public record AuthorizedEnrollment(
            EnrollmentCompletionContext completion,
            String requestState,
            char[] securityToken) implements AutoCloseable {
        public AuthorizedEnrollment {
            securityToken = securityToken.clone();
        }

        @Override
        public char[] securityToken() {
            return securityToken.clone();
        }

        @Override
        public void close() {
            Arrays.fill(securityToken, '\0');
        }
    }

    public record EnrollmentCompletionContext(
            String userGuid,
            String factorId,
            String requestState) {
    }

    private record AuthorizationInput(String userGuid, String factorId, String requestState) {
    }

    private static final long ATTEMPT_LIFETIME_MINUTES = 10;

    private static final class StoredAttempt {
        private final String sessionKey;
        private final String userGuid;
        private final String factorId;
        private final String requestState;
        private final EnrollmentAttemptView original;
        private AttemptState state;
        private boolean authorizationConsumed;

        private StoredAttempt(
                String sessionKey,
                String userGuid,
                String factorId,
                String requestState,
                EnrollmentAttemptView original) {
            this.sessionKey = sessionKey;
            this.userGuid = userGuid;
            this.factorId = factorId;
            this.requestState = requestState;
            this.original = original;
            this.state = original.state();
            this.authorizationConsumed = false;
        }

        synchronized EnrollmentAttemptView decide(String decision, String version, Instant now) {
            if (!original.expiresAt().isAfter(now)) {
                throw ApiException.gone("IAM", "ENROLLMENT_ATTEMPT_EXPIRED");
            }
            if (!original.consent().version().equals(version)) {
                throw ApiException.conflict("IAM", "CONSENT_VERSION_CONFLICT");
            }
            AttemptState requested = switch (decision) {
                case "ACCEPT" -> AttemptState.CONSENT_ACCEPT_INTENT_RECORDED;
                case "DECLINE" -> AttemptState.CONSENT_DECLINED;
                default -> throw ApiException.badRequest("INVALID_CONSENT_DECISION");
            };
            if (state == requested) {
                return view();
            }
            if (state != AttemptState.CONSENT_PENDING) {
                throw ApiException.conflict("IAM", "CONSENT_ALREADY_DECIDED");
            }
            state = requested;
            return view();
        }

        synchronized EnrollmentAttemptView view() {
            return new EnrollmentAttemptView(
                    original.enrollmentAttemptId(), original.correlationId(), state,
                    original.consent(), original.expiresAt());
        }

        synchronized boolean resumable(Instant now) {
            return original.expiresAt().isAfter(now)
                    && (state == AttemptState.CONSENT_PENDING
                    || state == AttemptState.CONSENT_ACCEPT_INTENT_RECORDED);
        }

        synchronized AuthorizationInput consumeAuthorization(
                String requestedAttemptId, Instant now) {
            if (!original.enrollmentAttemptId().equals(requestedAttemptId)) {
                throw ApiException.notFound("IAM", "ENROLLMENT_ATTEMPT_NOT_FOUND");
            }
            if (!original.expiresAt().isAfter(now)) {
                throw ApiException.gone("IAM", "ENROLLMENT_ATTEMPT_EXPIRED");
            }
            if (state != AttemptState.CONSENT_ACCEPT_INTENT_RECORDED || authorizationConsumed) {
                throw ApiException.conflict("IAM", "ENROLLMENT_AUTHORIZATION_NOT_ALLOWED");
            }
            authorizationConsumed = true;
            return new AuthorizationInput(userGuid, factorId, requestState);
        }
    }

    private final EnrollmentStatusPort enrollmentStatus;
    private final IamVoiceEnrollmentPort iam;
    private final Clock clock;
    private final SecureRandom random;
    private final Map<String, StoredAttempt> attempts = new ConcurrentHashMap<>();

    public EnrollmentService(
            EnrollmentStatusPort enrollmentStatus,
            IamVoiceEnrollmentPort iam,
            Clock clock,
            SecureRandom random) {
        this.enrollmentStatus = enrollmentStatus;
        this.iam = iam;
        this.clock = clock;
        this.random = random;
    }

    public Mono<EnrollmentAttemptView> begin(
            String sessionKey,
            String userGuid,
            String locale,
            String correlationId) {
        StoredAttempt active = attempts.get(sessionKey);
        if (active != null) {
            if (active.resumable(clock.instant())) {
                return Mono.just(active.view());
            }
            attempts.remove(sessionKey, active);
        }
        return enrollmentStatus.lookup(userGuid, correlationId)
                .flatMap(observation -> {
                    if (observation.status() != EnrollmentStatus.NOT_ENROLLED) {
                        return Mono.error(ApiException.conflict("IAM", "ENROLLMENT_NOT_ALLOWED"));
                    }
                    return iam.beginEnrollment(userGuid, locale, correlationId);
                })
                .map(provider -> {
                    Instant expiresAt = clock.instant().plus(ATTEMPT_LIFETIME_MINUTES, ChronoUnit.MINUTES);
                    String attemptId = OpaqueTokens.random(random);
                    ConsentText consent = new ConsentText(
                            fingerprint(provider.locale(), provider.consentText()),
                            provider.locale(),
                            provider.consentText());
                    EnrollmentAttemptView view = new EnrollmentAttemptView(
                            attemptId, correlationId, AttemptState.CONSENT_PENDING, consent, expiresAt);
                    StoredAttempt stored = new StoredAttempt(
                            sessionKey, userGuid, provider.factorId(), provider.requestState(), view);
                    StoredAttempt previous = attempts.putIfAbsent(sessionKey, stored);
                    if (previous != null && previous.resumable(clock.instant())) {
                        return previous.view();
                    }
                    if (previous != null) {
                        attempts.replace(sessionKey, previous, stored);
                    }
                    return view;
                })
                .onErrorMap(IamVoiceEnrollmentPort.EnrollmentUnavailableException.class,
                        ignored -> ApiException.providerUnavailable("IAM", "ENROLLMENT_INITIATION_UNAVAILABLE"))
                .onErrorMap(EnrollmentStatusPort.StatusUnavailableException.class,
                        ignored -> ApiException.providerUnavailable("IAM", "ENROLLMENT_STATUS_UNAVAILABLE"));
    }

    public EnrollmentAttemptView recordConsent(
            String sessionKey,
            String attemptId,
            String decision,
            String consentVersion) {
        StoredAttempt attempt = attempts.get(sessionKey);
        if (attempt == null || !attempt.sessionKey.equals(sessionKey)
                || !attempt.original.enrollmentAttemptId().equals(attemptId)) {
            throw ApiException.notFound("IAM", "ENROLLMENT_ATTEMPT_NOT_FOUND");
        }
        return attempt.decide(decision, consentVersion, clock.instant());
    }

    public Mono<AuthorizedEnrollment> authorize(
            String sessionKey,
            String attemptId,
            String correlationId) {
        StoredAttempt attempt = attempts.get(sessionKey);
        if (attempt == null || !attempt.sessionKey.equals(sessionKey)) {
            return Mono.error(ApiException.notFound("IAM", "ENROLLMENT_ATTEMPT_NOT_FOUND"));
        }
        final AuthorizationInput input;
        try {
            input = attempt.consumeAuthorization(attemptId, clock.instant());
        } catch (ApiException failure) {
            return Mono.error(failure);
        }
        return iam.createEnrollmentSession(
                        input.userGuid(), input.factorId(), input.requestState(), correlationId)
                .map(provider -> {
                    try (provider) {
                        return new AuthorizedEnrollment(
                                new EnrollmentCompletionContext(
                                        provider.userGuid(),
                                        provider.factorId(),
                                        provider.requestState()),
                                provider.requestState(),
                                provider.securityToken());
                    }
                })
                .doFinally(ignored -> attempts.remove(sessionKey, attempt))
                .onErrorMap(IamVoiceEnrollmentPort.EnrollmentUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "ENROLLMENT_AUTHORIZATION_UNAVAILABLE"));
    }

    public Mono<EnrollmentObservation> complete(
            EnrollmentCompletionContext completion,
            String correlationId) {
        return iam.completeEnrollment(
                        completion.userGuid(),
                        completion.factorId(),
                        completion.requestState(),
                        correlationId)
                .flatMap(ignored -> enrollmentStatus.lookup(
                        completion.userGuid(), correlationId))
                .flatMap(observation -> observation.status() == EnrollmentStatus.ENROLLED
                        ? Mono.just(observation)
                        : Mono.error(ApiException.providerUnavailable(
                                "IAM", "ENROLLMENT_STATUS_NOT_CONFIRMED")))
                .onErrorMap(IamVoiceEnrollmentPort.EnrollmentUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "ENROLLMENT_COMPLETION_UNAVAILABLE"))
                .onErrorMap(EnrollmentStatusPort.StatusUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "ENROLLMENT_STATUS_UNAVAILABLE"));
    }

    private static String fingerprint(String locale, String statement) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    digest.digest((locale + "\u0000" + statement).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
