package com.oracle.aiworld.voice.domain.unenrollment;

import java.time.Instant;
import java.util.Objects;

public record VoiceUnenrollmentAttempt(
        String idempotencyKey,
        State state,
        Instant createdAt,
        Instant updatedAt) {
    public enum State {
        IN_PROGRESS,
        COMPLETED,
        FAILED
    }

    public VoiceUnenrollmentAttempt {
        Objects.requireNonNull(idempotencyKey, "idempotencyKey");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (idempotencyKey.isBlank() || updatedAt.isBefore(createdAt)) {
            throw new IllegalArgumentException("Invalid voice-unenrollment attempt");
        }
    }

    public VoiceUnenrollmentAttempt transition(State next, Instant now) {
        Objects.requireNonNull(next, "next");
        Objects.requireNonNull(now, "now");
        if (state != State.IN_PROGRESS || next == State.IN_PROGRESS || now.isBefore(updatedAt)) {
            throw new IllegalStateException("Invalid voice-unenrollment transition");
        }
        return new VoiceUnenrollmentAttempt(idempotencyKey, next, createdAt, now);
    }
}
