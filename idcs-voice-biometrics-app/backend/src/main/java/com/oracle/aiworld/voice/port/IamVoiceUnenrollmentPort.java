package com.oracle.aiworld.voice.port;

import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult;
import reactor.core.publisher.Mono;

public interface IamVoiceUnenrollmentPort {
    Mono<VoiceUnenrollmentResult> deleteCurrentVoiceFactor(
            String subject,
            String idempotencyKey,
            String correlationId);

    enum FailureKind {
        AMBIGUOUS_FACTOR,
        MALFORMED_FACTOR,
        CROSS_USER_FACTOR,
        LAST_ACTIVE_FACTOR,
        DEPENDENCY_UNAVAILABLE,
        DEPENDENCY_FAILURE,
        OUTCOME_UNCONFIRMED
    }

    final class VoiceUnenrollmentException extends RuntimeException {
        private final FailureKind failureKind;

        public VoiceUnenrollmentException(FailureKind failureKind) {
            this(failureKind, null);
        }

        public VoiceUnenrollmentException(FailureKind failureKind, Throwable cause) {
            super(failureKind.name(), cause, false, false);
            this.failureKind = failureKind;
        }

        public FailureKind failureKind() {
            return failureKind;
        }
    }
}
