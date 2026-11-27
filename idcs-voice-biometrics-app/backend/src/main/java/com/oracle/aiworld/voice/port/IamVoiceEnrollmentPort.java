package com.oracle.aiworld.voice.port;

import java.util.Arrays;
import reactor.core.publisher.Mono;

public interface IamVoiceEnrollmentPort {
    record EnrollmentInitiation(
            String factorId,
            String requestState,
            String locale,
            String consentText) {
    }

    record EnrollmentAuthorization(
            String userGuid,
            String factorId,
            String requestState,
            char[] securityToken) implements AutoCloseable {
        public EnrollmentAuthorization {
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

    record EnrollmentCompletion() {
    }

    Mono<EnrollmentInitiation> beginEnrollment(String userGuid, String locale, String correlationId);

    default Mono<EnrollmentAuthorization> createEnrollmentSession(
            String userGuid,
            String factorId,
            String requestState,
            String correlationId) {
        return Mono.error(new EnrollmentUnavailableException());
    }

    default Mono<EnrollmentCompletion> completeEnrollment(
            String userGuid,
            String factorId,
            String requestState,
            String correlationId) {
        return Mono.error(new EnrollmentUnavailableException());
    }

    final class EnrollmentUnavailableException extends RuntimeException {
        public EnrollmentUnavailableException() {
            super(null, null, false, false);
        }

        public EnrollmentUnavailableException(Throwable cause) {
            super(null, cause, false, false);
        }
    }
}
