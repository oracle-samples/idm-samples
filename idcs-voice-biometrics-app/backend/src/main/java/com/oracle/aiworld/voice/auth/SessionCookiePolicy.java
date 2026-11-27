package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.config.AiWorldProperties;
import java.net.URI;
import java.time.Duration;
import java.util.Set;
import org.springframework.http.HttpCookie;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

@Component
public final class SessionCookiePolicy {
    public static final String SECURE_COOKIE_NAME = "__Host-AIWORLD_SESSION";
    public static final String LOOPBACK_COOKIE_NAME = "AIWORLD_LOOPBACK_SESSION";

    private static final Set<String> LOCAL_DEMO_HOSTS = Set.of("localhost", "127.0.0.1");

    private final String cookieName;
    private final boolean secure;
    private final String sameSite;

    public SessionCookiePolicy(AiWorldProperties properties) {
        URI origin = configuredOrigin(properties.publicOrigin());
        if ("https".equalsIgnoreCase(origin.getScheme())) {
            cookieName = SECURE_COOKIE_NAME;
            secure = true;
            sameSite = "Lax";
            return;
        }
        if ("http".equalsIgnoreCase(origin.getScheme())
                && LOCAL_DEMO_HOSTS.contains(origin.getHost())
                && origin.getPort() > 0) {
            cookieName = LOOPBACK_COOKIE_NAME;
            secure = false;
            sameSite = "Strict";
            return;
        }
        throw new IllegalArgumentException(
                "AI_WORLD_PUBLIC_ORIGIN must use HTTPS or an explicit local loopback HTTP port");
    }

    public String cookieName() {
        return cookieName;
    }

    public boolean secure() {
        return secure;
    }

    public String sameSite() {
        return sameSite;
    }

    public HttpCookie read(ServerWebExchange exchange) {
        return exchange.getRequest().getCookies().getFirst(cookieName);
    }

    public ResponseCookie create(String value, long maxAgeSeconds) {
        return base(value)
                .maxAge(Duration.ofSeconds(Math.max(0, maxAgeSeconds)))
                .build();
    }

    public ResponseCookie expire() {
        return base("")
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/");
    }

    private static URI configuredOrigin(String value) {
        try {
            URI origin = URI.create(value == null ? "" : value);
            if (origin.getHost() == null
                    || origin.getRawUserInfo() != null
                    || origin.getRawQuery() != null
                    || origin.getRawFragment() != null
                    || (origin.getRawPath() != null
                            && !origin.getRawPath().isEmpty()
                            && !"/".equals(origin.getRawPath()))) {
                throw new IllegalArgumentException("Invalid application origin");
            }
            return origin;
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("AI_WORLD_PUBLIC_ORIGIN is not a valid origin", invalid);
        }
    }
}
