package com.oracle.aiworld.voice.api;

import org.springframework.http.HttpStatus;

public final class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String stage;
    private final String failureKind;
    private final boolean retryable;
    private final boolean terminal;
    private final String title;
    private final String safeDetail;
    private final Integer retryAfterSeconds;

    private ApiException(
            HttpStatus status,
            String code,
            String stage,
            String failureKind,
            boolean retryable,
            boolean terminal,
            String title,
            String safeDetail,
            Integer retryAfterSeconds) {
        super(code, null, false, false);
        this.status = status;
        this.code = code;
        this.stage = stage;
        this.failureKind = failureKind;
        this.retryable = retryable;
        this.terminal = terminal;
        this.title = title;
        this.safeDetail = safeDetail;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static ApiException forbidden(String code) {
        return new ApiException(HttpStatus.FORBIDDEN, code, "AUTH", "POLICY_REJECTED",
                false, true, "Request rejected", null, null);
    }

    public static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "AUTH", "AUTHENTICATION_FAILED",
                false, true, "Authentication required", null, null);
    }

    public static ApiException loginFailed() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "AUTH", "AUTHENTICATION_FAILED",
                false, true, "Sign-in failed", "The username or password could not be accepted.", null);
    }

    public static ApiException passwordChangeRequired() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "PASSWORD_CHANGE_REQUIRED", "AUTH", "ACTION_REQUIRED",
                false, true, "Password change required",
                "Change your password through your organization's account sign-in page, then try again.", null);
    }

    public static ApiException badRequest(String code) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, "AUTH", "INVALID_REQUEST",
                false, true, "Invalid request", null, null);
    }

    public static ApiException tooManyRequests(String code, int retryAfterSeconds) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, "AUTH", "RATE_LIMITED",
                true, true, "Too many requests", null, retryAfterSeconds);
    }

    public static ApiException providerUnavailable(String stage, String code) {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, stage, "DEPENDENCY_UNAVAILABLE",
                true, true, "Service temporarily unavailable", null, null);
    }

    public static ApiException dependencyFailure(String stage, String code) {
        return new ApiException(HttpStatus.BAD_GATEWAY, code, stage, "DEPENDENCY_FAILURE",
                true, true, "Dependency request failed", null, null);
    }

    public static ApiException conflict(String stage, String code) {
        return new ApiException(HttpStatus.CONFLICT, code, stage, "STATE_CONFLICT",
                false, true, "Request conflicts with current state", null, null);
    }

    public static ApiException notFound(String stage, String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code, stage, "NOT_FOUND",
                false, true, "Resource not found", null, null);
    }

    public static ApiException gone(String stage, String code) {
        return new ApiException(HttpStatus.GONE, code, stage, "EXPIRED",
                false, true, "Resource expired", null, null);
    }

    public static ApiException internal() {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "APPLICATION", "INTERNAL_FAILURE",
                false, true, "Unexpected application error", null, null);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String stage() {
        return stage;
    }

    public String failureKind() {
        return failureKind;
    }

    public boolean retryable() {
        return retryable;
    }

    public boolean terminal() {
        return terminal;
    }

    public String title() {
        return title;
    }

    public String safeDetail() {
        return safeDetail;
    }

    public Integer retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
