package com.oracle.aiworld.voice.security;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.auth.LoginContextRegistry;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class PreAuthenticationFilter implements WebFilter {
    public static final String LOGIN_CONTEXT_CONSUMED_ATTRIBUTE =
            "com.oracle.aiworld.voice.loginContextConsumed";

    private final String publicOrigin;
    private final LoginContextRegistry loginContexts;

    public PreAuthenticationFilter(AiWorldProperties properties, LoginContextRegistry loginContexts) {
        this.publicOrigin = properties.publicOrigin();
        this.loginContexts = loginContexts;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        HttpMethod method = exchange.getRequest().getMethod();
        boolean loginContext = method == HttpMethod.GET && path.equals("/api/v1/auth/login-context");
        boolean login = method == HttpMethod.POST && path.equals("/api/v1/auth/login");
        boolean signOut = method == HttpMethod.POST && path.equals("/api/v1/auth/sign-out");
        boolean deleteVoiceEnrollment = method == HttpMethod.DELETE
                && path.equals("/api/v1/voice/enrollment");
        if (!loginContext && !login && !signOut && !deleteVoiceEnrollment) {
            return chain.filter(exchange);
        }
        requireSameOriginFetch(exchange, !loginContext);
        if (login) {
            String csrf = exchange.getRequest().getHeaders().getFirst("X-CSRF-Token");
            if (!loginContexts.consume(csrf)) {
                throw ApiException.forbidden("LOGIN_CONTEXT_REJECTED");
            }
            exchange.getAttributes().put(LOGIN_CONTEXT_CONSUMED_ATTRIBUTE, Boolean.TRUE);
        }
        return chain.filter(exchange);
    }

    private void requireSameOriginFetch(ServerWebExchange exchange, boolean originRequired) {
        String origin = exchange.getRequest().getHeaders().getOrigin();
        String fetchSite = exchange.getRequest().getHeaders().getFirst("Sec-Fetch-Site");
        String fetchMode = exchange.getRequest().getHeaders().getFirst("Sec-Fetch-Mode");
        String fetchDest = exchange.getRequest().getHeaders().getFirst("Sec-Fetch-Dest");
        // Fetch does not add Origin to a same-origin GET/HEAD. The safe login-context GET
        // therefore relies on exact Fetch Metadata and rejects a mismatched Origin when one is
        // present. Credential-bearing and sign-out POSTs always require the exact Origin.
        boolean originRejected = publicOrigin == null || (originRequired
                ? !publicOrigin.equals(origin)
                : origin != null && !publicOrigin.equals(origin));
        if (originRejected
                || !"same-origin".equals(fetchSite)
                || !("cors".equals(fetchMode) || "same-origin".equals(fetchMode))
                || !"empty".equals(fetchDest)) {
            throw ApiException.forbidden("SAME_ORIGIN_REQUIRED");
        }
    }
}
