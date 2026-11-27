package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationAuthorization;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationUnavailableException;
import java.util.Map;

final class IamVerificationAuthorizationMapper {
    private IamVerificationAuthorizationMapper() {
    }

    static VerificationAuthorization map(Map<?, ?> values) {
        if (failureCode(values) != null) {
            throw new VerificationUnavailableException();
        }
        return new VerificationAuthorization(
                required(values, "userGUID", 512),
                required(values, "factorId", 512),
                required(values, "requestId", 512),
                required(values, "requestState", 8192),
                required(values, "securityToken", 8192).toCharArray());
    }

    static String failureCode(Map<?, ?> values) {
        if (!"success".equals(values.get("status"))) return "provider_rejected";
        if (!"VOICE_BIOMETRIC".equals(values.get("method"))) return "method_mismatch";
        if (!valid(values, "userGUID", 512)) return "user_guid_missing";
        if (!valid(values, "factorId", 512)) return "factor_id_missing";
        if (!valid(values, "requestId", 512)) return "request_id_missing";
        if (!valid(values, "requestState", 8192)) return "request_state_missing";
        if (!valid(values, "securityToken", 8192)) return "security_token_missing";
        return null;
    }

    private static boolean valid(Map<?, ?> values, String field, int maximum) {
        Object value = values.get(field);
        return value instanceof String text && !text.isBlank() && text.length() <= maximum;
    }

    private static String required(Map<?, ?> values, String field, int maximum) {
        Object value = values.get(field);
        if (value instanceof String text && !text.isBlank() && text.length() <= maximum) {
            return text;
        }
        throw new VerificationUnavailableException();
    }
}
