package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationUnavailableException;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IamVerificationAuthorizationMapperTest {
    @Test
    void mapsConfirmedAuthenticationContract() {
        var mapped = IamVerificationAuthorizationMapper.map(Map.of(
                "status", "success",
                "method", "VOICE_BIOMETRIC",
                "userGUID", "doctor-guid",
                "factorId", "factor-1",
                "requestId", "request-1",
                "requestState", "opaque-state",
                "securityToken", "opaque-token"));

        assertThat(mapped.userGuid()).isEqualTo("doctor-guid");
        assertThat(new String(mapped.securityToken())).isEqualTo("opaque-token");
        mapped.close();
    }

    @Test
    void acceptsV14ResponseWithoutScenarioOrFactorStatus() {
        var mapped = IamVerificationAuthorizationMapper.map(Map.of(
                "status", "success",
                "method", "VOICE_BIOMETRIC",
                "userGUID", "doctor-guid",
                "factorId", "factor-1",
                "requestId", "request-1",
                "requestState", "opaque-state",
                "securityToken", "opaque-token"));

        assertThat(mapped.factorId()).isEqualTo("factor-1");
        mapped.close();
    }

    @Test
    void rejectsIncompleteVerificationResponse() {
        assertThatThrownBy(() -> IamVerificationAuthorizationMapper.map(Map.of(
                "status", "success", "method", "VOICE_BIOMETRIC")))
                .isInstanceOf(VerificationUnavailableException.class);
    }

    @Test
    void reportsSafeFailureReasonsWithoutReturningSecretValues() {
        assertThat(IamVerificationAuthorizationMapper.failureCode(Map.of(
                "status", "failed",
                "cause", java.util.List.of(Map.of("code", "AUTH-1137")))))
                .isEqualTo("provider_rejected");
        assertThat(IamVerificationAuthorizationMapper.failureCode(Map.of(
                "status", "success",
                "method", "VOICE_BIOMETRIC",
                "userGUID", "doctor-guid",
                "factorId", "factor-1",
                "requestId", "request-1",
                "requestState", "opaque-state")))
                .isEqualTo("security_token_missing");
    }

    @Test
    void createsExactConfirmedVerificationInitiationBody() {
        assertThat(IamEnrollmentStatusAdapter.verificationRequest("doctor-guid", "factor-1"))
                .containsExactlyInAnyOrderEntriesOf(Map.of(
                        "userId", "doctor-guid",
                        "userIdType", "USER_GUID",
                        "factorId", "factor-1",
                        "method", "VOICE_BIOMETRIC"));
    }
}
