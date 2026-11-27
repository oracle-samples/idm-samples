package com.oracle.aiworld.voice.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SafeProviderExchangeLogTest {
    @Test
    void redactsSecretsAndFingerprintsIdentityInNestedPayloads() {
        String diagnostic = SafeProviderExchangeLog.body(Map.of(
                "password", "doctor-password",
                "access_token", "access-token-value",
                "requestState", "opaque-request-state",
                "user", Map.of("value", "doctor-guid"),
                "displayName", "Dr. Example",
                "scenario", "ENROLLMENT",
                "cause", List.of(Map.of("code", "AUTH-3018"))))
                .toString();

        assertThat(diagnostic)
                .contains("password=<redacted>")
                .contains("access_token=<redacted fp=")
                .contains("requestState=<redacted fp=")
                .contains("value=<fp=")
                .contains("displayName=<fp=")
                .contains("scenario=ENROLLMENT")
                .contains("code=AUTH-3018")
                .doesNotContain("doctor-password", "access-token-value", "opaque-request-state",
                        "doctor-guid", "Dr. Example");
    }

    @Test
    void removesQueryValuesFromLoggedEndpoints() {
        assertThat(SafeProviderExchangeLog.endpoint(
                "https://identity.example.test:8943", "/admin/v1/Me?attributes=id,userName"))
                .isEqualTo("https://identity.example.test:8943/admin/v1/Me");
    }
}
