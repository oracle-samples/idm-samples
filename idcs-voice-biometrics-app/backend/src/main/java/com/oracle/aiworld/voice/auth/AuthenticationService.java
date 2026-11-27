package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.auth.SessionRegistry.CreatedSession;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.port.IdentityProviderPort;
import com.oracle.aiworld.voice.security.FixedWindowRateLimiter;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class AuthenticationService {
    private final IdentityProviderPort identityProvider;
    private final SecretStore secretStore;
    private final SessionRegistry sessions;
    private final FixedWindowRateLimiter rateLimiter;
    private final int accountRateLimitAttempts;
    private final int ipRateLimitAttempts;
    private final Duration rateLimitWindow;

    public AuthenticationService(
            IdentityProviderPort identityProvider,
            SecretStore secretStore,
            SessionRegistry sessions,
            FixedWindowRateLimiter rateLimiter,
            AiWorldProperties properties) {
        this.identityProvider = identityProvider;
        this.secretStore = secretStore;
        this.sessions = sessions;
        this.rateLimiter = rateLimiter;
        this.accountRateLimitAttempts = positiveOrDefault(properties.idcs().loginRateLimitAttempts(), 10);
        this.ipRateLimitAttempts = positiveOrDefault(properties.idcs().loginRateLimitIpAttempts(), 100);
        this.rateLimitWindow = Duration.ofSeconds(positiveOrDefault(
                properties.idcs().loginRateLimitWindowSeconds(), 60));
    }

    public Mono<CreatedSession> login(
            String username, char[] password, String remoteAddress, String correlationId) {
        String normalized = normalizeUsername(username);
        if (normalized.isEmpty() || normalized.length() > 254 || password == null
                || password.length == 0 || password.length > 1024) {
            clear(password);
            return Mono.error(ApiException.badRequest("INVALID_LOGIN_REQUEST"));
        }
        String remoteKey = "login-ip:" + OpaqueTokens.digest(remoteAddress == null ? "unknown" : remoteAddress);
        String accountKey = "login-user:" + OpaqueTokens.digest(normalized);
        if (!rateLimiter.acquire(remoteKey, ipRateLimitAttempts, rateLimitWindow)
                || !rateLimiter.acquire(accountKey, accountRateLimitAttempts, rateLimitWindow)) {
            clear(password);
            return Mono.error(ApiException.tooManyRequests("LOGIN_RATE_LIMITED",
                    Math.toIntExact(Math.min(Integer.MAX_VALUE, rateLimitWindow.toSeconds()))));
        }

        return identityProvider.authenticate(username, password, correlationId)
                .map(result -> {
                    try (IdentityProviderPort.SecretMaterial material = result.secretMaterial()) {
                        SecretStore.SecretHandle handle = secretStore.put(material);
                        try {
                            return sessions.create(result.identity(), handle, material.expiresAt());
                        } catch (RuntimeException failure) {
                            secretStore.destroy(handle);
                            throw failure;
                        }
                    }
                })
                .onErrorMap(IdentityProviderPort.PasswordChangeRequiredException.class,
                        ignored -> ApiException.passwordChangeRequired())
                .onErrorMap(IdentityProviderPort.AuthenticationRejectedException.class,
                        ignored -> ApiException.loginFailed())
                .onErrorMap(IdentityProviderPort.ProviderUnavailableException.class,
                        ignored -> ApiException.providerUnavailable("AUTH", "IDCS_UNAVAILABLE"))
                .onErrorMap(IdentityProviderPort.InvalidProviderResponseException.class,
                        ignored -> ApiException.dependencyFailure("AUTH", "IDCS_RESPONSE_REJECTED"))
                .doFinally(ignored -> clear(password));
    }

    public static String normalizeUsername(String value) {
        return value == null ? "" : java.text.Normalizer.normalize(value.trim(), java.text.Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT);
    }

    private static void clear(char[] value) {
        if (value != null) {
            Arrays.fill(value, '\0');
        }
    }

    private static int positiveOrDefault(Integer value, int fallback) {
        return value == null || value <= 0 ? fallback : value;
    }

    private static long positiveOrDefault(Long value, long fallback) {
        return value == null || value <= 0 ? fallback : value;
    }
}
