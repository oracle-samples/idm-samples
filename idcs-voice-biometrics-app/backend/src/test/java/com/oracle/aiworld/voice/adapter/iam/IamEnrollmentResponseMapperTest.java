package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentInitiation;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IamEnrollmentResponseMapperTest {
    @Test
    void mapsOnlyTheConfirmedConsentRequiredEnrollmentShape() {
        EnrollmentInitiation result = IamEnrollmentResponseMapper.map(Map.of(
                "status", "success",
                "factorStatus", "CONSENT_REQUIRED",
                "factorId", "factor-1",
                "methods", java.util.List.of("VOICE_BIOMETRIC"),
                "requestState", "request-state-1",
                "consent", Map.of("locale", "en", "consentStatement", "I consent to voice enrollment.")));

        assertThat(result.factorId()).isEqualTo("factor-1");
        assertThat(result.requestState()).isEqualTo("request-state-1");
        assertThat(result.locale()).isEqualTo("en");
        assertThat(result.consentText()).isEqualTo("I consent to voice enrollment.");
    }

    @Test
    void rejectsMissingConsentAndUnexpectedProviderStates() {
        assertThatThrownBy(() -> IamEnrollmentResponseMapper.map(Map.of(
                "status", "success", "methods", java.util.List.of("VOICE_BIOMETRIC"),
                "factorStatus", "INITIATED", "factorId", "factor-1",
                "requestState", "INITIATED", "consent", Map.of("locale", "en", "consentStatement", "text"))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IamEnrollmentResponseMapper.map(Map.of(
                "status", "success", "methods", java.util.List.of("VOICE_BIOMETRIC"),
                "factorStatus", "CONSENT_REQUIRED", "factorId", "factor-1", "requestState", "state-1",
                "consent", Map.of("locale", "en"))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
