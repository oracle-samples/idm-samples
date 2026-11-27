package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.auth.SecretStore.SecretHandle;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import jakarta.annotation.PreDestroy;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class SessionRegistry {
    public static final String COOKIE_NAME = "__Host-AIWORLD_SESSION";

    public record CreatedSession(String cookieValue, String csrfToken, Instant expiresAt) {
    }

    public record SessionView(
            DoctorIdentity identity,
            SecretHandle secretHandle,
            String csrfDigest,
            Instant createdAt,
            Instant expiresAt) {
    }

    private static final class StoredSession {
        private final DoctorIdentity identity;
        private final SecretHandle secretHandle;
        private String csrfDigest;
        private final Instant createdAt;
        private final Instant expiresAt;
        private Instant lastAccessedAt;

        private StoredSession(
                DoctorIdentity identity,
                SecretHandle secretHandle,
                String csrfDigest,
                Instant createdAt,
                Instant expiresAt) {
            this.identity = identity;
            this.secretHandle = secretHandle;
            this.csrfDigest = csrfDigest;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
            this.lastAccessedAt = createdAt;
        }

        synchronized boolean touch(Instant now, long idleSeconds) {
            if (!isAlive(now, idleSeconds)) {
                return false;
            }
            lastAccessedAt = now;
            return true;
        }

        synchronized boolean isAlive(Instant now, long idleSeconds) {
            return expiresAt.isAfter(now) && lastAccessedAt.plusSeconds(idleSeconds).isAfter(now);
        }

        synchronized void rotateCsrf(String digest) {
            csrfDigest = digest;
        }

        SessionView view() {
            return new SessionView(identity, secretHandle, csrfDigest, createdAt, expiresAt);
        }
    }

    private final Map<String, StoredSession> sessions = new ConcurrentHashMap<>();
    private final SecretStore secretStore;
    private final SecureRandom random;
    private final Clock clock;
    private final long idleSeconds;
    private final long absoluteSeconds;
    private final int capacity;

    public SessionRegistry(SecretStore secretStore, SecureRandom random, Clock clock, AiWorldProperties properties) {
        this.secretStore = secretStore;
        this.random = random;
        this.clock = clock;
        this.idleSeconds = positiveOrDefault(properties.session().idleSeconds(), 900L);
        this.absoluteSeconds = positiveOrDefault(properties.session().absoluteSeconds(), 28_800L);
        this.capacity = Math.toIntExact(positiveOrDefault(properties.session().capacity(), 1_000L));
    }

    public synchronized CreatedSession create(DoctorIdentity identity, SecretHandle secretHandle, Instant tokenExpiresAt) {
        Instant now = clock.instant();
        if (!tokenExpiresAt.isAfter(now)) {
            throw new IllegalArgumentException("Cannot create a session for expired token material");
        }
        purgeExpired(now);
        while (sessions.size() >= capacity) {
            evictOldest();
        }
        String cookie = OpaqueTokens.random(random);
        String csrf = OpaqueTokens.random(random);
        Instant expiresAt = now.plusSeconds(absoluteSeconds);
        if (tokenExpiresAt.isBefore(expiresAt)) {
            expiresAt = tokenExpiresAt;
        }
        StoredSession stored = new StoredSession(
                identity, secretHandle, OpaqueTokens.digest(csrf), now, expiresAt);
        sessions.put(OpaqueTokens.digest(cookie), stored);
        return new CreatedSession(cookie, csrf, expiresAt);
    }

    public Optional<SessionView> find(String cookie) {
        if (cookie == null || cookie.isBlank()) {
            return Optional.empty();
        }
        String digest = OpaqueTokens.digest(cookie);
        StoredSession stored = sessions.get(digest);
        if (stored == null) {
            return Optional.empty();
        }
        if (!stored.touch(clock.instant(), idleSeconds)) {
            if (sessions.remove(digest, stored)) {
                secretStore.destroy(stored.secretHandle);
            }
            return Optional.empty();
        }
        return Optional.of(stored.view());
    }

    public void remove(String cookie) {
        if (cookie == null || cookie.isBlank()) {
            return;
        }
        StoredSession removed = sessions.remove(OpaqueTokens.digest(cookie));
        if (removed != null) {
            secretStore.destroy(removed.secretHandle);
        }
    }

    public Optional<String> rotateCsrf(String cookie) {
        if (cookie == null || cookie.isBlank()) {
            return Optional.empty();
        }
        StoredSession session = sessions.get(OpaqueTokens.digest(cookie));
        if (session == null || !session.isAlive(clock.instant(), idleSeconds)) {
            return Optional.empty();
        }
        String raw = OpaqueTokens.random(random);
        session.rotateCsrf(OpaqueTokens.digest(raw));
        return Optional.of(raw);
    }

    public boolean verifyCsrf(String cookie, String csrfToken) {
        if (cookie == null || cookie.isBlank() || csrfToken == null || csrfToken.isBlank()) {
            return false;
        }
        StoredSession session = sessions.get(OpaqueTokens.digest(cookie));
        return session != null
                && session.isAlive(clock.instant(), idleSeconds)
                && java.security.MessageDigest.isEqual(
                        session.view().csrfDigest().getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                        OpaqueTokens.digest(csrfToken).getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }

    int size() {
        return sessions.size();
    }

    private void purgeExpired(Instant now) {
        sessions.entrySet().removeIf(entry -> {
            StoredSession session = entry.getValue();
            if (session.isAlive(now, idleSeconds)) {
                return false;
            }
            secretStore.destroy(session.secretHandle);
            return true;
        });
    }

    private void evictOldest() {
        sessions.entrySet().stream()
                .min(Comparator.comparing(entry -> entry.getValue().createdAt))
                .ifPresent(entry -> {
                    if (sessions.remove(entry.getKey(), entry.getValue())) {
                        secretStore.destroy(entry.getValue().secretHandle);
                    }
                });
    }

    @PreDestroy
    void clearAll() {
        sessions.values().forEach(session -> secretStore.destroy(session.secretHandle));
        sessions.clear();
    }

    private static long positiveOrDefault(Number value, long fallback) {
        return value == null || value.longValue() <= 0 ? fallback : value.longValue();
    }
}
