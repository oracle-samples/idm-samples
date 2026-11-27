package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.port.IdentityProviderPort.SecretMaterial;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import jakarta.annotation.PreDestroy;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class SecretStore {
    public record SecretHandle(String value) {
    }

    public record TokenLease(char[] accessToken, char[] refreshToken, Instant expiresAt) implements AutoCloseable {
        @Override
        public void close() {
            Arrays.fill(accessToken, '\0');
            if (refreshToken != null) {
                Arrays.fill(refreshToken, '\0');
            }
        }
    }

    private static final class StoredSecret {
        private char[] accessToken;
        private char[] refreshToken;
        private final Instant expiresAt;

        private StoredSecret(char[] accessToken, char[] refreshToken, Instant expiresAt) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresAt = expiresAt;
        }

        synchronized Optional<TokenLease> lease(Instant now) {
            if (accessToken == null || !expiresAt.isAfter(now)) {
                clear();
                return Optional.empty();
            }
            return Optional.of(new TokenLease(
                    Arrays.copyOf(accessToken, accessToken.length),
                    refreshToken == null ? null : Arrays.copyOf(refreshToken, refreshToken.length),
                    expiresAt));
        }

        synchronized void clear() {
            if (accessToken != null) {
                Arrays.fill(accessToken, '\0');
                accessToken = null;
            }
            if (refreshToken != null) {
                Arrays.fill(refreshToken, '\0');
                refreshToken = null;
            }
        }
    }

    private final Map<String, StoredSecret> secrets = new ConcurrentHashMap<>();
    private final SecureRandom random;
    private final Clock clock;

    public SecretStore(SecureRandom random, Clock clock) {
        this.random = random;
        this.clock = clock;
    }

    public SecretHandle put(SecretMaterial material) {
        String handle = OpaqueTokens.random(random);
        char[] access = material.copyAccessToken();
        char[] refresh = material.copyRefreshToken();
        secrets.put(handle, new StoredSecret(access, refresh, material.expiresAt()));
        return new SecretHandle(handle);
    }

    public Optional<TokenLease> lease(SecretHandle handle) {
        StoredSecret secret = secrets.get(handle.value());
        if (secret == null) {
            return Optional.empty();
        }
        Optional<TokenLease> result = secret.lease(clock.instant());
        if (result.isEmpty()) {
            secrets.remove(handle.value(), secret);
        }
        return result;
    }

    public void destroy(SecretHandle handle) {
        StoredSecret removed = secrets.remove(handle.value());
        if (removed != null) {
            removed.clear();
        }
    }

    int size() {
        return secrets.size();
    }

    @PreDestroy
    void clearAll() {
        secrets.values().forEach(StoredSecret::clear);
        secrets.clear();
    }
}
