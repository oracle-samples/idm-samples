package com.oracle.aiworld.voice.application.unenrollment;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentAttempt;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort.StatusUnavailableException;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.FailureKind;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.VoiceUnenrollmentException;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import com.oracle.aiworld.voice.security.SafeDiagnosticFingerprint;
import java.time.Clock;
import java.util.Map;
import java.time.Duration;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

@Service
public class VoiceUnenrollmentService {
    private static final Logger LOGGER = LoggerFactory.getLogger(VoiceUnenrollmentService.class);
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9._:-]{16,128}$");
    private static final int MAX_ATTEMPTS = 1_000;
    private static final Duration TERMINAL_RETENTION = Duration.ofMinutes(15);

    private record StoredAttempt(
            String idempotencyKey,
            AtomicReference<VoiceUnenrollmentAttempt> state,
            Mono<VoiceUnenrollmentResult> result) {
        boolean terminal() {
            return state.get().state() != VoiceUnenrollmentAttempt.State.IN_PROGRESS;
        }
    }

    private final IamVoiceUnenrollmentPort iam;
    private final EnrollmentStatusPort enrollmentStatus;
    private final VoiceSessionService voiceSessions;
    private final Clock clock;
    private final Map<String, StoredAttempt> attempts = new ConcurrentHashMap<>();

    public VoiceUnenrollmentService(
            IamVoiceUnenrollmentPort iam,
            EnrollmentStatusPort enrollmentStatus,
            VoiceSessionService voiceSessions,
            Clock clock) {
        this.iam = iam;
        this.enrollmentStatus = enrollmentStatus;
        this.voiceSessions = voiceSessions;
        this.clock = clock;
    }

    public Mono<VoiceUnenrollmentResult> deleteCurrentEnrollment(
            SessionView session,
            String idempotencyKey,
            String correlationId) {
        return Mono.defer(() -> startOrReplay(session, idempotencyKey, correlationId));
    }

    private synchronized Mono<VoiceUnenrollmentResult> startOrReplay(
            SessionView session,
            String idempotencyKey,
            String correlationId) {
        if (session == null
                || idempotencyKey == null || !IDEMPOTENCY_KEY.matcher(idempotencyKey).matches()) {
            return Mono.error(ApiException.badRequest("INVALID_IDEMPOTENCY_KEY"));
        }
        purgeTerminalAttempts();
        String owner = OpaqueTokens.digest(session.secretHandle().value());
        StoredAttempt existing = attempts.get(owner);
        if (existing != null) {
            if (existing.idempotencyKey().equals(idempotencyKey)) {
                return existing.result();
            }
            if (!existing.terminal()) {
                return Mono.error(ApiException.conflict("IAM", "VOICE_UNENROLLMENT_IN_PROGRESS"));
            }
            attempts.remove(owner, existing);
        }

        if (voiceSessions.hasActiveSession(owner)) {
            return Mono.error(ApiException.conflict("FLOW", "VOICE_SESSION_ACTIVE"));
        }
        ensureCapacity();

        var now = clock.instant();
        AtomicReference<VoiceUnenrollmentAttempt> state = new AtomicReference<>(
                new VoiceUnenrollmentAttempt(
                        idempotencyKey,
                        VoiceUnenrollmentAttempt.State.IN_PROGRESS,
                        now,
                        now));
        Mono<VoiceUnenrollmentResult> result = execute(session, idempotencyKey, correlationId)
                .doOnSuccess(outcome -> {
                    state.updateAndGet(attempt -> attempt.transition(
                            VoiceUnenrollmentAttempt.State.COMPLETED, clock.instant()));
                    LOGGER.info(
                            "Voice unenrollment completed: correlationId={} idempotencyKeyFp={} outcome={}",
                            safeCorrelation(correlationId),
                            SafeDiagnosticFingerprint.of(idempotencyKey),
                            outcome.outcome());
                })
                .doOnError(failure -> {
                    state.updateAndGet(attempt -> attempt.transition(
                            VoiceUnenrollmentAttempt.State.FAILED, clock.instant()));
                    LOGGER.warn(
                            "Voice unenrollment failed: correlationId={} idempotencyKeyFp={} failureType={}",
                            safeCorrelation(correlationId),
                            SafeDiagnosticFingerprint.of(idempotencyKey),
                            failure instanceof ApiException problem ? problem.code() : "UNEXPECTED_FAILURE");
                })
                .cache();
        attempts.put(owner, new StoredAttempt(idempotencyKey, state, result));
        LOGGER.info(
                "Voice unenrollment requested: correlationId={} idempotencyKeyFp={}",
                safeCorrelation(correlationId), SafeDiagnosticFingerprint.of(idempotencyKey));
        return result;
    }

    private void purgeTerminalAttempts() {
        var cutoff = clock.instant().minus(TERMINAL_RETENTION);
        attempts.entrySet().removeIf(entry -> {
            VoiceUnenrollmentAttempt attempt = entry.getValue().state().get();
            return entry.getValue().terminal() && attempt.updatedAt().isBefore(cutoff);
        });
    }

    private void ensureCapacity() {
        if (attempts.size() < MAX_ATTEMPTS) return;
        attempts.entrySet().stream()
                .filter(entry -> entry.getValue().terminal())
                .min(Comparator.comparing(entry -> entry.getValue().state().get().updatedAt()))
                .ifPresent(entry -> attempts.remove(entry.getKey(), entry.getValue()));
        if (attempts.size() >= MAX_ATTEMPTS) {
            throw ApiException.providerUnavailable("IAM", "VOICE_UNENROLLMENT_CAPACITY_REACHED");
        }
    }

    private Mono<VoiceUnenrollmentResult> execute(
            SessionView session,
            String idempotencyKey,
            String correlationId) {
        String userGuid = session.identity().userGuid();
        return enrollmentStatus.lookup(userGuid, correlationId)
                .onErrorMap(StatusUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "VOICE_UNENROLLMENT_STATUS_UNAVAILABLE"))
                .flatMap(observation -> {
                    if (observation.status() == EnrollmentStatus.NOT_ENROLLED) {
                        return Mono.just(new VoiceUnenrollmentResult(
                                Outcome.ALREADY_NOT_ENROLLED, observation.observedAt()));
                    }
                    if (observation.status() != EnrollmentStatus.ENROLLED) {
                        return Mono.error(ApiException.providerUnavailable(
                                "IAM", "VOICE_UNENROLLMENT_STATUS_UNAVAILABLE"));
                    }
                    return iam.deleteCurrentVoiceFactor(userGuid, idempotencyKey, correlationId);
                })
                .onErrorMap(VoiceUnenrollmentException.class, this::mapFailure);
    }

    private ApiException mapFailure(VoiceUnenrollmentException failure) {
        FailureKind kind = failure.failureKind();
        return switch (kind) {
            case AMBIGUOUS_FACTOR, MALFORMED_FACTOR, CROSS_USER_FACTOR ->
                    ApiException.conflict("IAM", "VOICE_FACTOR_NOT_UNIQUELY_RESOLVED");
            case LAST_ACTIVE_FACTOR ->
                    ApiException.conflict("IAM", "VOICE_UNENROLLMENT_REQUIRES_ANOTHER_FACTOR");
            case DEPENDENCY_FAILURE ->
                    ApiException.dependencyFailure("IAM", "VOICE_UNENROLLMENT_FAILED");
            case DEPENDENCY_UNAVAILABLE, OUTCOME_UNCONFIRMED ->
                    ApiException.providerUnavailable("IAM", "VOICE_UNENROLLMENT_UNCONFIRMED");
        };
    }

    private static String safeCorrelation(String value) {
        return value != null && value.matches("^[A-Za-z0-9._:-]{1,128}$")
                ? value : "redacted_or_missing";
    }
}
