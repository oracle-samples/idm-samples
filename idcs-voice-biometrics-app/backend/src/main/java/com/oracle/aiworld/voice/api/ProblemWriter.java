package com.oracle.aiworld.voice.api;

import java.nio.charset.StandardCharsets;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class ProblemWriter {
    public Mono<Void> write(ServerWebExchange exchange, ApiException exception, String correlationId) {
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(exception);
        }
        exchange.getResponse().setStatusCode(exception.status());
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_PROBLEM_JSON);
        exchange.getResponse().getHeaders().setCacheControl("no-store");
        if (exception.retryAfterSeconds() != null) {
            exchange.getResponse().getHeaders().set(HttpHeaders.RETRY_AFTER,
                    Integer.toString(exception.retryAfterSeconds()));
        }
        ApiProblem problem = new ApiProblem(
                "urn:ai-world:problem:" + exception.code().toLowerCase(java.util.Locale.ROOT),
                exception.title(),
                exception.status().value(),
                exception.code(),
                exception.stage(),
                exception.failureKind(),
                exception.retryable(),
                exception.terminal(),
                correlationId,
                exception.safeDetail());
        byte[] body = toJson(problem).getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    private static String toJson(ApiProblem p) {
        StringBuilder json = new StringBuilder(320)
                .append('{')
                .append("\"type\":\"").append(escape(p.type())).append("\",")
                .append("\"title\":\"").append(escape(p.title())).append("\",")
                .append("\"status\":").append(p.status()).append(',')
                .append("\"code\":\"").append(escape(p.code())).append("\",")
                .append("\"stage\":\"").append(escape(p.stage())).append("\",")
                .append("\"failureKind\":\"").append(escape(p.failureKind())).append("\",")
                .append("\"retryable\":").append(p.retryable()).append(',')
                .append("\"terminal\":").append(p.terminal()).append(',')
                .append("\"correlationId\":\"").append(escape(p.correlationId())).append('"');
        if (p.detail() != null) {
            json.append(",\"detail\":\"").append(escape(p.detail())).append('"');
        }
        return json.append('}').toString();
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n");
    }
}
