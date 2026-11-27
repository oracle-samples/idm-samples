package com.oracle.aiworld.voice.application.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class EnrollmentServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-02T00:00:00Z");

    @Test
    void beginsFromFreshNotEnrolledStatusAndRecordsAcceptanceLocally() {
        AtomicInteger providerCalls = new AtomicInteger();
        EnrollmentStatusPort status = (user, correlation) ->
                Mono.just(new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, NOW));
        IamVoiceEnrollmentPort iam = (user, locale, correlation) -> {
            providerCalls.incrementAndGet();
            return Mono.just(new IamVoiceEnrollmentPort.EnrollmentInitiation(
                    "factor-1", "request-state-0", "en", "Current IAM consent"));
        };
        EnrollmentService service = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        EnrollmentService.EnrollmentAttemptView started = service.begin(
                "session-1", "doctor-guid", "en", "correlation-1").block();
        assertThat(started.state()).isEqualTo(EnrollmentService.AttemptState.CONSENT_PENDING);
        assertThat(started.consent().text()).isEqualTo("Current IAM consent");

        EnrollmentService.EnrollmentAttemptView accepted = service.recordConsent(
                "session-1", started.enrollmentAttemptId(), "ACCEPT", started.consent().version());
        assertThat(accepted.state()).isEqualTo(
                EnrollmentService.AttemptState.CONSENT_ACCEPT_INTENT_RECORDED);
        assertThat(providerCalls).hasValue(1);
    }

    @Test
    void declineIsTerminalAndMakesNoFollowUpIamCall() {
        AtomicInteger providerCalls = new AtomicInteger();
        EnrollmentService service = service(EnrollmentStatus.NOT_ENROLLED, providerCalls);
        EnrollmentService.EnrollmentAttemptView started = service.begin(
                "session-1", "doctor-guid", "en", "correlation-1").block();

        EnrollmentService.EnrollmentAttemptView declined = service.recordConsent(
                "session-1", started.enrollmentAttemptId(), "DECLINE", started.consent().version());
        assertThat(declined.state()).isEqualTo(EnrollmentService.AttemptState.CONSENT_DECLINED);
        assertThat(providerCalls).hasValue(1);
        assertThatThrownBy(() -> service.recordConsent(
                "session-1", started.enrollmentAttemptId(), "ACCEPT", started.consent().version()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsEnrolledDoctorWrongOwnerAndAlteredConsentVersion() {
        assertThatThrownBy(() -> service(EnrollmentStatus.ENROLLED, new AtomicInteger()).begin(
                "session-1", "doctor-guid", "en", "correlation-1").block())
                .isInstanceOf(ApiException.class);

        EnrollmentService service = service(EnrollmentStatus.NOT_ENROLLED, new AtomicInteger());
        EnrollmentService.EnrollmentAttemptView started = service.begin(
                "session-1", "doctor-guid", "en", "correlation-1").block();
        assertThatThrownBy(() -> service.recordConsent(
                "session-2", started.enrollmentAttemptId(), "ACCEPT", started.consent().version()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.recordConsent(
                "session-1", started.enrollmentAttemptId(), "ACCEPT", "altered"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void repeatedBeginResumesTheActiveAttemptWithoutAnotherIamMutation() {
        AtomicInteger providerCalls = new AtomicInteger();
        EnrollmentService service = service(EnrollmentStatus.NOT_ENROLLED, providerCalls);

        EnrollmentService.EnrollmentAttemptView first = service.begin(
                "session-1", "doctor-guid", "en", "correlation-1").block();
        EnrollmentService.EnrollmentAttemptView resumed = service.begin(
                "session-1", "doctor-guid", "en", "correlation-2").block();

        assertThat(resumed.enrollmentAttemptId()).isEqualTo(first.enrollmentAttemptId());
        assertThat(resumed.consent()).isEqualTo(first.consent());
        assertThat(providerCalls).hasValue(1);
    }

    @Test
    void authorizesOnlyAfterLocalAcceptanceAndConsumesTheAttemptOnce() {
        AtomicInteger initiationCalls = new AtomicInteger();
        AtomicInteger authorizationCalls = new AtomicInteger();
        EnrollmentStatusPort status = (user, correlation) ->
                Mono.just(new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, NOW));
        IamVoiceEnrollmentPort iam = new IamVoiceEnrollmentPort() {
            @Override
            public Mono<EnrollmentInitiation> beginEnrollment(String user, String locale, String correlation) {
                initiationCalls.incrementAndGet();
                return Mono.just(new EnrollmentInitiation(
                        "factor-1", "request-state-0", "en", "Current IAM consent"));
            }

            @Override
            public Mono<EnrollmentAuthorization> createEnrollmentSession(
                    String user, String factorId, String requestState, String correlation) {
                authorizationCalls.incrementAndGet();
                return Mono.just(new EnrollmentAuthorization(
                        user, factorId, "request-state-1", "secret-token".toCharArray()));
            }
        };
        EnrollmentService service = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        EnrollmentService.EnrollmentAttemptView started = service.begin(
                "session-1", "doctor-guid", "en", "correlation-1").block();

        assertThatThrownBy(() -> service.authorize(
                "session-1", started.enrollmentAttemptId(), "correlation-2").block())
                .isInstanceOf(ApiException.class);

        service.recordConsent("session-1", started.enrollmentAttemptId(),
                "ACCEPT", started.consent().version());
        try (EnrollmentService.AuthorizedEnrollment authorized = service.authorize(
                "session-1", started.enrollmentAttemptId(), "correlation-3").block()) {
            assertThat(authorized.securityToken()).containsExactly("secret-token".toCharArray());
        }
        assertThat(authorizationCalls).hasValue(1);
        assertThatThrownBy(() -> service.authorize(
                "session-1", started.enrollmentAttemptId(), "correlation-4").block())
                .isInstanceOf(ApiException.class);

        EnrollmentService.EnrollmentAttemptView retried = service.begin(
                "session-1", "doctor-guid", "en", "correlation-5").block();
        assertThat(retried.enrollmentAttemptId()).isNotEqualTo(started.enrollmentAttemptId());
        assertThat(retried.state()).isEqualTo(EnrollmentService.AttemptState.CONSENT_PENDING);
        assertThat(initiationCalls).hasValue(2);
    }

    private static EnrollmentService service(EnrollmentStatus statusValue, AtomicInteger calls) {
        EnrollmentStatusPort status = (user, correlation) ->
                Mono.just(new EnrollmentObservation(statusValue, NOW));
        IamVoiceEnrollmentPort iam = (user, locale, correlation) -> {
            calls.incrementAndGet();
            return Mono.just(new IamVoiceEnrollmentPort.EnrollmentInitiation(
                    "factor-1", "request-state-0", "en", "Current IAM consent"));
        };
        return new EnrollmentService(status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
    }
}
