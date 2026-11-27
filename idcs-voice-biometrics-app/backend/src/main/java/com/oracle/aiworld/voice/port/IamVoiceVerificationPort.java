package com.oracle.aiworld.voice.port;

import java.util.Arrays;
import reactor.core.publisher.Mono;

/** Confirmed IAM boundary for creating an ABIS voice-verification session. */
public interface IamVoiceVerificationPort {
    record VerificationAuthorization(
            String userGuid,
            String factorId,
            String requestId,
            String requestState,
            char[] securityToken) implements AutoCloseable {
        public VerificationAuthorization {
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

    record VerificationCompletion(String userGuid, String factorId) {
    }

    Mono<VerificationAuthorization> authorizeVerification(
            String userGuid, String correlationId);

    default Mono<VerificationCompletion> completeVerification(
            String userGuid,
            String factorId,
            String requestId,
            String requestState,
            String correlationId) {
        return Mono.error(new VerificationUnavailableException());
    }

    final class VerificationUnavailableException extends RuntimeException {
        public VerificationUnavailableException() {
            super(null, null, false, false);
        }

        public VerificationUnavailableException(Throwable cause) {
            super(null, cause, false, false);
        }
    }
}
