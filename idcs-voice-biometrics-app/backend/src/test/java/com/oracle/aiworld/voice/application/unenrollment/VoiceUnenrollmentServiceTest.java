package com.oracle.aiworld.voice.application.unenrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService;
import com.oracle.aiworld.voice.auth.SecretStore.SecretHandle;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.FailureKind;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.VoiceUnenrollmentException;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class VoiceUnenrollmentServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-09T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String KEY = "delete-attempt-0001";

    @Test
    void serviceAcceptsOnlyTheAuthenticatedSessionAndRequestMetadata() throws Exception {
        Class<?> service = Class.forName(
                "com.oracle.aiworld.voice.application.unenrollment.VoiceUnenrollmentService");
        Method operation = service.getMethod(
                "deleteCurrentEnrollment", SessionView.class, String.class, String.class);

        assertThat(operation.getReturnType()).isEqualTo(Mono.class);
        assertThat(Arrays.stream(operation.getParameterTypes()))
                .doesNotContain(Object.class)
                .doesNotContain(java.util.Map.class);
    }

    @Test
    void boundedAttemptModelCarriesNormalizedTerminalOutcomesOnly() throws Exception {
        Class<?> attempt = Class.forName(
                "com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentAttempt");
        Class<?> result = Class.forName(
                "com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult");

        assertThat(attempt.isRecord()).isTrue();
        assertThat(result.getDeclaredClasses())
                .anySatisfy(nested -> assertThat(nested.getEnumConstants())
                        .extracting(Object::toString)
                        .containsExactlyInAnyOrder("DELETED", "ALREADY_NOT_ENROLLED"));
    }

    @Test
    void derivesCurrentSubjectAndDeletesOnlyAfterFreshEnrolledEligibility() {
        Fixture fixture = fixture(EnrollmentStatus.ENROLLED);
        VoiceUnenrollmentResult deleted = new VoiceUnenrollmentResult(Outcome.DELETED, NOW);
        fixture.iam.result.set(Mono.just(deleted));

        assertThat(fixture.service.deleteCurrentEnrollment(session(), KEY, "correlation-1").block())
                .isEqualTo(deleted);
        assertThat(fixture.status.calls.get()).isOne();
        assertThat(fixture.status.lastUserGuid).isEqualTo("doctor-guid");
        assertThat(fixture.iam.calls.get()).isOne();
        assertThat(fixture.iam.lastUserGuid).isEqualTo("doctor-guid");
    }

    @Test
    void freshAlreadyAbsentStatusIsIdempotentWithoutDestructiveCall() {
        Fixture fixture = fixture(EnrollmentStatus.NOT_ENROLLED);

        VoiceUnenrollmentResult result = fixture.service
                .deleteCurrentEnrollment(session(), KEY, "correlation-2").block();

        assertThat(result.outcome()).isEqualTo(Outcome.ALREADY_NOT_ENROLLED);
        assertThat(fixture.iam.calls.get()).isZero();
    }

    @Test
    void activeVoiceSessionRejectsBeforeLookupOrDelete() {
        Fixture fixture = fixture(EnrollmentStatus.ENROLLED);
        fixture.voiceSessions.active = true;

        assertApiFailure(
                () -> fixture.service.deleteCurrentEnrollment(session(), KEY, "correlation-3").block(),
                409, "VOICE_SESSION_ACTIVE");
        assertThat(fixture.status.calls.get()).isZero();
    }

    @Test
    void sameKeySharesOneInFlightOperationAndDifferentKeyConflicts() {
        Fixture fixture = fixture(EnrollmentStatus.ENROLLED);
        fixture.iam.result.set(Mono.never());

        fixture.service.deleteCurrentEnrollment(session(), KEY, "correlation-4").subscribe();
        fixture.service.deleteCurrentEnrollment(session(), KEY, "correlation-4").subscribe();
        assertThat(fixture.iam.calls.get()).isOne();

        assertApiFailure(
                () -> fixture.service.deleteCurrentEnrollment(
                        session(), "delete-attempt-0002", "correlation-4").block(),
                409, "VOICE_UNENROLLMENT_IN_PROGRESS");
    }

    @Test
    void unsafeResolverAndUnconfirmedOutcomesMapToSafeProblems() {
        Fixture conflict = fixture(EnrollmentStatus.ENROLLED);
        conflict.iam.result.set(
                Mono.error(new VoiceUnenrollmentException(FailureKind.AMBIGUOUS_FACTOR)));
        assertApiFailure(
                () -> conflict.service.deleteCurrentEnrollment(session(), KEY, "correlation-5").block(),
                409, "VOICE_FACTOR_NOT_UNIQUELY_RESOLVED");

        Fixture uncertain = fixture(EnrollmentStatus.ENROLLED);
        uncertain.iam.result.set(
                Mono.error(new VoiceUnenrollmentException(FailureKind.OUTCOME_UNCONFIRMED)));
        assertApiFailure(
                () -> uncertain.service.deleteCurrentEnrollment(session(), KEY, "correlation-6").block(),
                503, "VOICE_UNENROLLMENT_UNCONFIRMED");
    }

    @Test
    void lastActiveFactorRejectionMapsToActionableConflict() {
        Fixture fixture = fixture(EnrollmentStatus.ENROLLED);
        fixture.iam.result.set(
                Mono.error(new VoiceUnenrollmentException(FailureKind.LAST_ACTIVE_FACTOR)));

        assertApiFailure(
                () -> fixture.service.deleteCurrentEnrollment(session(), KEY, "correlation-7").block(),
                409, "VOICE_UNENROLLMENT_REQUIRES_ANOTHER_FACTOR");
    }

    private static Fixture fixture(EnrollmentStatus enrollmentStatus) {
        FakeIam iam = new FakeIam();
        FakeStatus status = new FakeStatus(enrollmentStatus);
        TestVoiceSessions voiceSessions = new TestVoiceSessions();
        return new Fixture(
                iam,
                status,
                voiceSessions,
                new VoiceUnenrollmentService(iam, status, voiceSessions, CLOCK));
    }

    private static SessionView session() {
        return new SessionView(
                new DoctorIdentity(
                        "doctor-subject", "doctor@example.test", "Doctor", "Example", "doctor-guid"),
                new SecretHandle("application-session-secret"),
                "csrf-digest",
                NOW,
                NOW.plusSeconds(600));
    }

    private static void assertApiFailure(Runnable operation, int status, String code) {
        assertThatThrownBy(operation::run)
                .isInstanceOf(ApiException.class)
                .satisfies(failure -> {
                    ApiException problem = (ApiException) failure;
                    assertThat(problem.status().value()).isEqualTo(status);
                    assertThat(problem.code()).isEqualTo(code);
                });
    }

    private record Fixture(
            FakeIam iam,
            FakeStatus status,
            TestVoiceSessions voiceSessions,
            VoiceUnenrollmentService service) {
    }

    private static final class FakeStatus implements EnrollmentStatusPort {
        private final EnrollmentStatus status;
        private final AtomicInteger calls = new AtomicInteger();
        private String lastUserGuid;

        private FakeStatus(EnrollmentStatus status) {
            this.status = status;
        }

        @Override
        public Mono<EnrollmentObservation> lookup(String userGuid, String correlationId) {
            calls.incrementAndGet();
            lastUserGuid = userGuid;
            return Mono.just(new EnrollmentObservation(status, NOW));
        }
    }

    private static final class FakeIam implements IamVoiceUnenrollmentPort {
        private final AtomicInteger calls = new AtomicInteger();
        private final AtomicReference<Mono<VoiceUnenrollmentResult>> result =
                new AtomicReference<>(Mono.just(new VoiceUnenrollmentResult(Outcome.DELETED, NOW)));
        private String lastUserGuid;

        @Override
        public Mono<VoiceUnenrollmentResult> deleteCurrentVoiceFactor(
                String subject, String idempotencyKey, String correlationId) {
            calls.incrementAndGet();
            lastUserGuid = subject;
            return result.get();
        }
    }

    private static final class TestVoiceSessions extends VoiceSessionService {
        private boolean active;

        private TestVoiceSessions() {
            super(null, null, null, CLOCK, new SecureRandom());
        }

        @Override
        public boolean hasActiveSession(String owner) {
            return active;
        }
    }
}
