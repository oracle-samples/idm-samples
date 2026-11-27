package com.oracle.aiworld.voice.api;

import com.oracle.aiworld.voice.security.OpaqueTokens;
import java.security.SecureRandom;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationNoStoreFilter implements WebFilter {
    public static final String CORRELATION_ATTRIBUTE =
            "com.oracle.aiworld.voice.correlationId";

    private final SecureRandom random;

    public CorrelationNoStoreFilter(SecureRandom random) {
        this.random = random;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        if (!exchange.getRequest().getPath().value().startsWith("/api/v1/")) {
            return chain.filter(exchange);
        }
        String correlationId = OpaqueTokens.random(random);
        exchange.getAttributes().put(CORRELATION_ATTRIBUTE, correlationId);
        exchange.getResponse().beforeCommit(() -> {
            exchange.getResponse().getHeaders().setCacheControl("no-store");
            exchange.getResponse().getHeaders().set("X-Correlation-ID", correlationId);
            exchange.getResponse().getHeaders().set(HttpHeaders.PRAGMA, "no-cache");
            return Mono.empty();
        });
        return chain.filter(exchange);
    }
}
