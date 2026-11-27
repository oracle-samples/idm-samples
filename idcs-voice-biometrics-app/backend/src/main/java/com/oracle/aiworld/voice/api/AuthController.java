package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.auth.AuthenticationService;
import com.oracle.aiworld.voice.auth.LoginContextRegistry;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.security.FixedWindowRateLimiter;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import com.oracle.aiworld.voice.security.PreAuthenticationFilter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.InetSocketAddress;
import java.time.Clock;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    public record LoginContextResponse(
            String protocolVersion,
            String loginContextToken) {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 254) String username,
            @Size(min = 1, max = 1024) char[] password) {
    }

    private final LoginContextRegistry loginContexts;
    private final AuthenticationService authenticationService;
    private final SessionRegistry sessions;
    private final SessionCookiePolicy cookiePolicy;
    private final FixedWindowRateLimiter rateLimiter;
    private final Clock clock;
    private final long sessionAbsoluteSeconds;

    public AuthController(
            LoginContextRegistry loginContexts,
            AuthenticationService authenticationService,
            SessionRegistry sessions,
            SessionCookiePolicy cookiePolicy,
            FixedWindowRateLimiter rateLimiter,
            Clock clock,
            AiWorldProperties properties) {
        this.loginContexts = loginContexts;
        this.authenticationService = authenticationService;
        this.sessions = sessions;
        this.cookiePolicy = cookiePolicy;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        Long configuredAbsolute = properties.session().absoluteSeconds();
        this.sessionAbsoluteSeconds = configuredAbsolute == null || configuredAbsolute <= 0
                ? 28_800
                : configuredAbsolute;
    }

    @GetMapping("/login-context")
    public ResponseEntity<LoginContextResponse> loginContext(ServerWebExchange exchange) {
        String address = remoteAddress(exchange);
        if (!rateLimiter.acquire("login-context:" + OpaqueTokens.digest(address), 30, Duration.ofMinutes(1))) {
            throw ApiException.tooManyRequests("LOGIN_CONTEXT_RATE_LIMITED", 60);
        }
        try {
            String csrf = loginContexts.issue();
            return ResponseEntity.ok()
                    .header("X-CSRF-Token", csrf)
                    .body(new LoginContextResponse("1.0", csrf));
        } catch (LoginContextRegistry.LoginContextCapacityException full) {
            throw ApiException.tooManyRequests("LOGIN_CONTEXT_CAPACITY_REACHED", 2);
        }
    }

    @PostMapping("/login")
    public Mono<ResponseEntity<Void>> login(
            @Valid @RequestBody LoginRequest request,
            ServerWebExchange exchange) {
        if (!Boolean.TRUE.equals(exchange.getAttribute(PreAuthenticationFilter.LOGIN_CONTEXT_CONSUMED_ATTRIBUTE))) {
            java.util.Arrays.fill(request.password(), '\0');
            return Mono.error(ApiException.forbidden("LOGIN_CONTEXT_REQUIRED"));
        }
        String correlationId = exchange.getAttributeOrDefault(
                CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "missing-correlation");
        return authenticationService.login(
                        request.username(), request.password(), remoteAddress(exchange), correlationId)
                .map(created -> {
                    long maxAge = Math.max(0, Math.min(sessionAbsoluteSeconds,
                            Duration.between(clock.instant(), created.expiresAt()).toSeconds()));
                    var cookie = cookiePolicy.create(created.cookieValue(), maxAge);
                    return ResponseEntity.noContent()
                            .header(HttpHeaders.SET_COOKIE, cookie.toString())
                            .header("X-CSRF-Token", created.csrfToken())
                            .build();
                });
    }

    @PostMapping("/sign-out")
    public ResponseEntity<Void> signOut(ServerWebExchange exchange) {
        var cookie = cookiePolicy.read(exchange);
        sessions.remove(cookie == null ? null : cookie.getValue());
        var expired = cookiePolicy.expire();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, expired.toString()).build();
    }

    private static String remoteAddress(ServerWebExchange exchange) {
        InetSocketAddress address = exchange.getRequest().getRemoteAddress();
        return address == null || address.getAddress() == null
                ? "unknown"
                : address.getAddress().getHostAddress();
    }
}
