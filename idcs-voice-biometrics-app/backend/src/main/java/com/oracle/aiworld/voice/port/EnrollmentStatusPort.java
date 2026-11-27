package com.oracle.aiworld.voice.port;

import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import reactor.core.publisher.Mono;

public interface EnrollmentStatusPort {
    Mono<EnrollmentObservation> lookup(String userGuid, String correlationId);

    final class StatusUnavailableException extends RuntimeException {
        public StatusUnavailableException(Throwable cause) {
            super(null, cause, false, false);
        }

        public StatusUnavailableException() {
            this(null);
        }
    }
}
