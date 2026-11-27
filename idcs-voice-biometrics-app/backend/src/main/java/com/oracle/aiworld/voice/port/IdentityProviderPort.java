package com.oracle.aiworld.voice.port;

import com.oracle.aiworld.voice.domain.DoctorIdentity;
import java.time.Instant;
import java.util.Arrays;
import reactor.core.publisher.Mono;

public interface IdentityProviderPort {
    Mono<AuthenticationResult> authenticate(String username, char[] password);

    default Mono<AuthenticationResult> authenticate(
            String username, char[] password, String correlationId) {
        return authenticate(username, password);
    }

    record AuthenticationResult(DoctorIdentity identity, SecretMaterial secretMaterial) {
    }

    final class AuthenticationRejectedException extends RuntimeException {
    }

    final class PasswordChangeRequiredException extends RuntimeException {
    }

    final class ProviderUnavailableException extends RuntimeException {
        public ProviderUnavailableException(Throwable cause) {
            super(null, cause, false, false);
        }

        public ProviderUnavailableException() {
            this(null);
        }
    }

    final class InvalidProviderResponseException extends RuntimeException {
        public InvalidProviderResponseException(Throwable cause) {
            super(null, cause, false, false);
        }

        public InvalidProviderResponseException() {
            this(null);
        }
    }

    final class SecretMaterial implements AutoCloseable {
        private char[] accessToken;
        private char[] refreshToken;
        private final Instant expiresAt;

        public SecretMaterial(char[] accessToken, char[] refreshToken, Instant expiresAt) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresAt = expiresAt;
        }

        public char[] copyAccessToken() {
            ensureOpen();
            return Arrays.copyOf(accessToken, accessToken.length);
        }

        public char[] copyRefreshToken() {
            ensureOpen();
            return refreshToken == null ? null : Arrays.copyOf(refreshToken, refreshToken.length);
        }

        public Instant expiresAt() {
            return expiresAt;
        }

        private void ensureOpen() {
            if (accessToken == null) {
                throw new IllegalStateException("Secret material is closed");
            }
        }

        @Override
        public void close() {
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
}
