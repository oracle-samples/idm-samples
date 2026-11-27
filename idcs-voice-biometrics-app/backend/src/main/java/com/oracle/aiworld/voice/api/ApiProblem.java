package com.oracle.aiworld.voice.api;

public record ApiProblem(
        String type,
        String title,
        int status,
        String code,
        String stage,
        String failureKind,
        boolean retryable,
        boolean terminal,
        String correlationId,
        String detail) {
}
