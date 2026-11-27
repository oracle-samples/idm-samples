package com.oracle.aiworld.voice.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

@Component
public class FixedWindowRateLimiter {
    private static final int MAX_KEYS = 10_000;

    private record Window(Instant expiresAt, AtomicInteger count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public FixedWindowRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean acquire(String key, int maximum, Duration duration) {
        Instant now = clock.instant();
        if (!windows.containsKey(key) && windows.size() >= MAX_KEYS) {
            windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
            if (windows.size() >= MAX_KEYS) {
                return false;
            }
        }
        Window window = windows.compute(key, (ignored, existing) -> {
            if (existing == null || !existing.expiresAt().isAfter(now)) {
                return new Window(now.plus(duration), new AtomicInteger(1));
            }
            existing.count().incrementAndGet();
            return existing;
        });
        return window.count().get() <= maximum;
    }
}
