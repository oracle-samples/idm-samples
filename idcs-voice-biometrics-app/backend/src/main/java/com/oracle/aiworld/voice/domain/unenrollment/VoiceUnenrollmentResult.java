package com.oracle.aiworld.voice.domain.unenrollment;

import java.time.Instant;
import java.util.Objects;

public record VoiceUnenrollmentResult(Outcome outcome, Instant observedAt) {
    public enum Outcome {
        DELETED,
        ALREADY_NOT_ENROLLED
    }

    public VoiceUnenrollmentResult {
        Objects.requireNonNull(outcome, "outcome");
        Objects.requireNonNull(observedAt, "observedAt");
    }
}
