package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.auth.SecretStore;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.port.IdentityProviderPort.SecretMaterial;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort.StatusUnavailableException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IamEnrollmentStatusAdapterSecurityTest {
    @Test
    void serviceTokenMustUseExactBearerProfile() {
        Instant issuedAt = Instant.parse("2026-09-01T00:00:00Z");
        try (SecretMaterial material = IamEnrollmentStatusAdapter.requireBearerServiceToken(Map.of(
                "access_token", "token", "token_type", "Bearer", "expires_in", 3600), issuedAt)) {
            assertThat(material.copyAccessToken()).containsExactly('t', 'o', 'k', 'e', 'n');
            assertThat(material.expiresAt()).isEqualTo(issuedAt.plusSeconds(3600));
        }
        assertThatThrownBy(() -> IamEnrollmentStatusAdapter.requireBearerServiceToken(Map.of(
                "access_token", "token", "token_type", "bearer", "expires_in", 3600), issuedAt))
                .isInstanceOf(StatusUnavailableException.class);
        assertThatThrownBy(() -> IamEnrollmentStatusAdapter.requireBearerServiceToken(Map.of(
                "access_token", "token", "token_type", "Bearer"), issuedAt))
                .isInstanceOf(StatusUnavailableException.class);
        assertThatThrownBy(() -> IamEnrollmentStatusAdapter.requireBearerServiceToken(Map.of(
                "access_token", "token", "token_type", "Bearer", "expires_in", 0), issuedAt))
                .isInstanceOf(StatusUnavailableException.class);
    }

    @Test
    void recognizesOnlyExactDocumentedNoFactorCause() {
        assertThat(IamEnrollmentStatusAdapter.isNoFactorFound(Map.of(
                "status", "noFactorFound",
                "cause", java.util.List.of(Map.of("code", "AUTH-1131"))))).isTrue();
        assertThat(IamEnrollmentStatusAdapter.isNoFactorFound(Map.of(
                "status", "noFactorFound",
                "cause", java.util.List.of(Map.of("code", "AUTH-1034"))))).isFalse();
        assertThat(IamEnrollmentStatusAdapter.isNoFactorFound(Map.of(
                "status", "failed",
                "cause", java.util.List.of(Map.of("code", "AUTH-1131"))))).isFalse();
    }

    @Test
    void extractsOnlySafeProviderDiagnosticCodes() {
        assertThat(IamEnrollmentStatusAdapter.providerCode(Map.of("error", "invalid_client")))
                .isEqualTo("invalid_client");
        assertThat(IamEnrollmentStatusAdapter.providerCode(Map.of(
                "status", "failed",
                "cause", List.of(Map.of("code", "AUTH-3018", "message", "sensitive detail")))))
                .isEqualTo("AUTH-3018");
        assertThat(IamEnrollmentStatusAdapter.providerCode(Map.of(
                "error", "unsafe value containing spaces and user data")))
                .isEqualTo("not_provided");
    }

    @Test
    void preservesSafeProviderEcidFromBodyOrResponseHeader() {
        assertThat(IamEnrollmentStatusAdapter.providerEcId(Map.of("ecId", "body-ecid_123")))
                .isEqualTo("body-ecid_123");
        assertThat(IamEnrollmentStatusAdapter.withProviderEcId(
                Map.of("status", "success"), "header-ecid:123;4^5"))
                .containsEntry("ecId", "header-ecid:123;4^5");
        assertThat(IamEnrollmentStatusAdapter.withProviderEcId(
                Map.of("ecId", "body-ecid"), "header-ecid"))
                .containsEntry("ecId", "body-ecid");
        assertThat(IamEnrollmentStatusAdapter.providerEcId(
                IamEnrollmentStatusAdapter.withProviderEcId(
                        Map.of("status", "success"), "unsafe ecid\nforged")))
                .isNull();
    }

    @Test
    void rejectsAuthorityLikeOrNonContractPathsBeforeOpeningProviderConnection() {
        assertUnavailable(iam("https://iam.example.test", "//evil.example/token",
                "/mfa/v1/users/{userId}/factors"));
        assertUnavailable(iam("https://iam.example.test", "/oauth2/v1/token",
                "//evil.example/mfa/{userId}"));
        assertUnavailable(iam("https://iam.example.test/base", "/oauth2/v1/token",
                "/mfa/v1/users/{userId}/factors"));
        assertUnavailable(iam("https://iam.example.test?redirect=evil", "/oauth2/v1/token",
                "/mfa/v1/users/{userId}/factors"));
    }

    @Test
    void rejectsUnsafeUserGuidBeforeUsingConfiguredPathTemplate() {
        IamEnrollmentStatusAdapter adapter = new IamEnrollmentStatusAdapter(
                properties(iam("https://iam.example.test", "/oauth2/v1/token",
                        "/mfa/v1/users/{userId}/factors")), Clock.systemUTC(), secretStore());
        assertThatThrownBy(() -> adapter.lookup("../../other-user", "correlation").block())
                .isInstanceOf(StatusUnavailableException.class);
    }

    @Test
    void createsTheDocumentedEnrollmentSessionTokenRequest() {
        assertThat(IamEnrollmentStatusAdapter.enrollmentSessionRequest(
                "request-state-1"))
                .containsEntry("action", "ACCEPTED")
                .containsEntry("requestState", "request-state-1")
                .hasSize(2);
    }

    @Test
    void createsTheDocumentedEnrollmentCompletionRequest() {
        assertThat(IamEnrollmentStatusAdapter.enrollmentCompletionRequest(
                "request-state-1"))
                .containsEntry("status", "COMPLETED")
                .containsEntry("requestState", "request-state-1")
                .hasSize(2);
    }

    @Test
    void createsTheDocumentedVoiceAuthenticationCompletionRequest() {
        assertThat(IamEnrollmentStatusAdapter.verificationCompletionRequest(
                "request-state-1"))
                .containsEntry("status", "COMPLETED")
                .containsEntry("requestState", "request-state-1")
                .hasSize(2);
    }

    private static void assertUnavailable(AiWorldProperties.Iam iam) {
        IamEnrollmentStatusAdapter adapter = new IamEnrollmentStatusAdapter(
                properties(iam), Clock.systemUTC(), secretStore());
        assertThatThrownBy(() -> adapter.lookup("safe-user-guid", "correlation").block())
                .isInstanceOf(StatusUnavailableException.class);
    }

    private static SecretStore secretStore() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC);
        return new SecretStore(new SecureRandom(), clock);
    }

    private static AiWorldProperties properties(AiWorldProperties.Iam iam) {
        return new AiWorldProperties(
                "https://localhost:8443",
                new AiWorldProperties.Session(900L, 3600L, 100),
                new AiWorldProperties.Idcs(
                        false, "STRICT_JWT", "", "/oauth2/v1/token", "/admin/v1/Me", "", "", "", true, "", "", "",
                        "", "", "", "", "", "",
                        60L, 10, 100, 60L, "", 3000, 10000),
                iam);
    }

    private static AiWorldProperties.Iam iam(String domain, String tokenPath, String factorPath) {
        return new AiWorldProperties.Iam(
                true,
                false,
                domain,
                tokenPath,
                "client",
                "scope",
                true,
                "/missing-keystore",
                "/missing-keystore-password",
                "PKCS12",
                "/missing-truststore",
                "/missing-truststore-password",
                "PKCS12",
                factorPath,
                "/mfa/v1/requests",
                "/mfa/v1/requests/{requestId}",
                3000,
                10000,
                true,
                "/factors",
                "methods",
                "status",
                "VOICE_BIOMETRIC",
                "ACTIVE",
                "PENDING",
                "UNAVAILABLE",
                false,
                "/mfa/v1/users/{userId}/factors/{factorId}",
                "factorId",
                "userGUID");
    }
}
