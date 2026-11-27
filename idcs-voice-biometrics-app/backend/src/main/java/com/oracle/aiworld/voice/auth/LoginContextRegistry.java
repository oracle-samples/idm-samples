package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.security.OpaqueTokens;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class LoginContextRegistry {
    static final Duration TIME_TO_LIVE = Duration.ofMinutes(2);
    static final int CAPACITY = 1_000;

    private final Map<String, Instant> contexts = new ConcurrentHashMap<>();
    private final Clock clock;
    private final SecureRandom random;

    public LoginContextRegistry(Clock clock, SecureRandom random) {
        this.clock = clock;
        this.random = random;
    }

    public synchronized String issue() {
        Instant now = clock.instant();
        contexts.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        if (contexts.size() >= CAPACITY) {
            throw new LoginContextCapacityException();
        }
        for (int attempt = 0; attempt < 3; attempt++) {
            String raw = OpaqueTokens.random(random);
            if (contexts.putIfAbsent(OpaqueTokens.digest(raw), now.plus(TIME_TO_LIVE)) == null) {
                return raw;
            }
        }
        throw new LoginContextCapacityException();
    }

    public synchronized boolean consume(String raw) {
        if (raw == null || raw.length() < 32 || raw.length() > 512) {
            return false;
        }
        Instant expiresAt = contexts.remove(OpaqueTokens.digest(raw));
        return expiresAt != null && expiresAt.isAfter(clock.instant());
    }

    public int size() {
        return contexts.size();
    }

    public static final class LoginContextCapacityException extends RuntimeException {
    }
}
