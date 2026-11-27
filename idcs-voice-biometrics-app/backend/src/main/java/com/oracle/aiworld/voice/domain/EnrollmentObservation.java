package com.oracle.aiworld.voice.domain;

import java.time.Instant;

public record EnrollmentObservation(EnrollmentStatus status, Instant observedAt) {
    public EnrollmentObservation {
        if (status != EnrollmentStatus.NOT_ENROLLED && status != EnrollmentStatus.ENROLLED) {
            throw new IllegalArgumentException("An authoritative observation cannot be UNKNOWN");
        }
    }
}
