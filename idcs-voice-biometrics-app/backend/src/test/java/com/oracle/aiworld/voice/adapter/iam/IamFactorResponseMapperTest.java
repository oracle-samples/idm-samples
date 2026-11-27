package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort.StatusUnavailableException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IamFactorResponseMapperTest {
    @Test
    void mapsDocumentedMethodsArrayAndVoiceAbsence() {
        IamFactorResponseMapper mapper = new IamFactorResponseMapper(config("NOT_ENROLLED"));

        assertThat(mapper.map(payload())).isEqualTo(EnrollmentStatus.ENROLLED);
        assertThat(mapper.map(Map.of("status", "success", "factors", List.of(
                Map.of("methods", List.of("SMS")))))).isEqualTo(EnrollmentStatus.NOT_ENROLLED);
    }

    @Test
    void absenceSemanticsAreExplicitAndDuplicateVoiceFactorsFailClosed() {
        Object noVoice = Map.of("status", "success", "factors", List.of(
                Map.of("methods", List.of("SMS"))));
        assertThat(new IamFactorResponseMapper(config("NOT_ENROLLED")).map(noVoice))
                .isEqualTo(EnrollmentStatus.NOT_ENROLLED);
        assertThatThrownBy(() -> new IamFactorResponseMapper(config("UNAVAILABLE")).map(noVoice))
                .isInstanceOf(StatusUnavailableException.class);

        Object duplicate = Map.of("status", "success", "factors", List.of(
                Map.of("methods", List.of("VOICE_BIOMETRIC")),
                Map.of("methods", List.of("VOICE_BIOMETRIC"))));
        assertThatThrownBy(() -> new IamFactorResponseMapper(config("NOT_ENROLLED")).map(duplicate))
                .isInstanceOf(StatusUnavailableException.class);
    }

    @Test
    void malformedOrSchemaMismatchedPayloadFailsClosed() {
        IamFactorResponseMapper mapper = new IamFactorResponseMapper(config("NOT_ENROLLED"));
        assertThatThrownBy(() -> mapper.map(Map.of("status", "success", "items", List.of())))
                .isInstanceOf(StatusUnavailableException.class);
        assertThatThrownBy(() -> mapper.map(Map.of("status", "success", "factors", "not-an-array")))
                .isInstanceOf(StatusUnavailableException.class);
        assertThatThrownBy(() -> mapper.map(Map.of("status", "failed", "factors", List.of())))
                .isInstanceOf(StatusUnavailableException.class);
    }

    private static Object payload() {
        return Map.of("status", "success", "factors", List.of(Map.of(
                "methods", List.of("TOTP", "VOICE_BIOMETRIC"))));
    }

    private static Iam config(String absentStatus) {
        return new Iam(
                true,
                false,
                "https://iam.example.test",
                "/oauth2/v1/token",
                "client",
                "scope",
                true,
                "/keystore",
                "/keystore-password",
                "PKCS12",
                "/truststore",
                "/truststore-password",
                "PKCS12",
                "/mfa/v1/users/{userId}/factors",
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
                "PENDING,DISABLED",
                absentStatus,
                false,
                "/mfa/v1/users/{userId}/factors/{factorId}",
                "factorId",
                "userGUID");
    }
}
