package com.oracle.aiworld.voice.api;

import org.springframework.core.Ordered;
import org.springframework.core.codec.DecodingException;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.ServerWebInputException;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiWebExceptionHandler implements WebExceptionHandler {
    private final ProblemWriter problemWriter;

    public ApiWebExceptionHandler(ProblemWriter problemWriter) {
        this.problemWriter = problemWriter;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable failure) {
        ApiException exception;
        if (failure instanceof ApiException apiException) {
            exception = apiException;
        } else if (failure instanceof ServerWebInputException || failure instanceof DecodingException) {
            exception = ApiException.badRequest("INVALID_REQUEST");
        } else {
            exception = ApiException.internal();
        }
        String correlationId = exchange.getAttributeOrDefault(CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE,
                "unknown-correlation");
        return problemWriter.write(exchange, exception, correlationId);
    }
}
