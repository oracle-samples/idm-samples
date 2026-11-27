package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentInitiation;
import java.util.List;
import java.util.Map;

final class IamEnrollmentResponseMapper {
    private IamEnrollmentResponseMapper() {
    }

    static EnrollmentInitiation map(Map<?, ?> values) {
        require(values, "status", "success");
        require(values, "factorStatus", "CONSENT_REQUIRED");
        if (!(values.get("methods") instanceof List<?> methods)
                || !methods.contains("VOICE_BIOMETRIC")) {
            throw new IllegalArgumentException("Unexpected provider response");
        }
        String factorId = string(values, "factorId", 512);
        String requestState = string(values, "requestState", 8192);
        if (!(values.get("consent") instanceof Map<?, ?> consent)) {
            throw new IllegalArgumentException("Missing consent object");
        }
        String locale = string(consent, "locale", 35);
        String statement = string(consent, "consentStatement", 10_000);
        return new EnrollmentInitiation(factorId, requestState, locale, statement);
    }

    private static void require(Map<?, ?> values, String field, String expected) {
        if (!expected.equals(values.get(field))) {
            throw new IllegalArgumentException("Unexpected provider response");
        }
    }

    private static String string(Map<?, ?> values, String field, int maximum) {
        Object value = values.get(field);
        if (!(value instanceof String text) || text.isBlank() || text.length() > maximum) {
            throw new IllegalArgumentException("Invalid provider response");
        }
        return text;
    }

}
