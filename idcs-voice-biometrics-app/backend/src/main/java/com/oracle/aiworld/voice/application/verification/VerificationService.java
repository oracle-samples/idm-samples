package com.oracle.aiworld.voice.application.verification;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort;
import java.util.Arrays;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class VerificationService {
    public record VerificationCompletionContext(
            String userGuid,
            String factorId,
            String requestId,
            String requestState) {
    }

    public record AuthorizedVerification(
            String factorId,
            String requestId,
            String requestState,
            char[] securityToken) implements AutoCloseable {
        public AuthorizedVerification {
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

    private final EnrollmentStatusPort enrollmentStatus;
    private final IamVoiceVerificationPort iam;

    public VerificationService(
            EnrollmentStatusPort enrollmentStatus,
            IamVoiceVerificationPort iam) {
        this.enrollmentStatus = enrollmentStatus;
        this.iam = iam;
    }

    public Mono<AuthorizedVerification> authorize(
            String userGuid, String correlationId) {
        return enrollmentStatus.lookup(userGuid, correlationId)
                .flatMap(status -> status.status() == EnrollmentStatus.ENROLLED
                        ? iam.authorizeVerification(userGuid, correlationId)
                        : Mono.error(ApiException.conflict("IAM", "VERIFICATION_NOT_ALLOWED")))
                .map(provider -> {
                    try (provider) {
                        return new AuthorizedVerification(
                                provider.factorId(),
                                provider.requestId(),
                                provider.requestState(),
                                provider.securityToken());
                    }
                })
                .onErrorMap(IamVoiceVerificationPort.VerificationUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "VERIFICATION_AUTHORIZATION_UNAVAILABLE"))
                .onErrorMap(EnrollmentStatusPort.StatusUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "ENROLLMENT_STATUS_UNAVAILABLE"));
    }

    public Mono<Void> complete(
            VerificationCompletionContext completion,
            String correlationId) {
        if (completion == null) {
            return Mono.error(ApiException.providerUnavailable(
                    "IAM", "VERIFICATION_COMPLETION_UNAVAILABLE"));
        }
        return iam.completeVerification(
                        completion.userGuid(),
                        completion.factorId(),
                        completion.requestId(),
                        completion.requestState(),
                        correlationId)
                .then()
                .onErrorMap(IamVoiceVerificationPort.VerificationUnavailableException.class,
                        ignored -> ApiException.providerUnavailable(
                                "IAM", "VERIFICATION_COMPLETION_UNAVAILABLE"));
    }
}
