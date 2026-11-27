package com.oracle.aiworld.voice.application.verification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class VerificationServiceTest {
    @Test
    void authorizesOnlyAnEnrolledDoctor() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, Instant.EPOCH));
        IamVoiceVerificationPort iam = (user, correlation) -> Mono.just(
                new IamVoiceVerificationPort.VerificationAuthorization(
                        user, "factor-1", "request-1", "state-1", "token-1".toCharArray()));

        var authorized = new VerificationService(status, iam)
                .authorize("doctor-guid", "correlation-1").block();

        assertThat(new String(authorized.securityToken())).isEqualTo("token-1");
        authorized.close();
    }

    @Test
    void rejectsVerificationWhenVoiceIsNotEnrolled() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, Instant.EPOCH));
        IamVoiceVerificationPort iam = (user, correlation) -> Mono.error(new AssertionError());

        assertThatThrownBy(() -> new VerificationService(status, iam)
                .authorize("doctor-guid", "correlation-1").block())
                .isInstanceOf(ApiException.class);
    }

    @Test
    void completesTheSameAuthorizedIamVerificationRequest() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, Instant.EPOCH));
        AtomicBoolean completed = new AtomicBoolean();
        IamVoiceVerificationPort iam = new IamVoiceVerificationPort() {
            @Override
            public Mono<VerificationAuthorization> authorizeVerification(
                    String user, String correlation) {
                return Mono.just(new VerificationAuthorization(
                        user, "factor-1", "request-1", "state-1",
                        "token-1".toCharArray()));
            }

            @Override
            public Mono<VerificationCompletion> completeVerification(
                    String user,
                    String factorId,
                    String requestId,
                    String requestState,
                    String correlation) {
                completed.set("doctor-guid".equals(user)
                        && "factor-1".equals(factorId)
                        && "request-1".equals(requestId)
                        && "state-1".equals(requestState)
                        && "correlation-1".equals(correlation));
                return Mono.just(new VerificationCompletion(user, factorId));
            }
        };
        VerificationService service = new VerificationService(status, iam);

        service.complete(new VerificationService.VerificationCompletionContext(
                "doctor-guid", "factor-1", "request-1", "state-1"),
                "correlation-1").block();

        assertThat(completed).isTrue();
    }
}
