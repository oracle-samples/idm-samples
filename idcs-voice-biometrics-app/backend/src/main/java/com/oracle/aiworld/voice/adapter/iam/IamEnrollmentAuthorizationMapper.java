package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentAuthorization;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentUnavailableException;
import java.util.Map;

final class IamEnrollmentAuthorizationMapper {
    private IamEnrollmentAuthorizationMapper() {
    }

    static EnrollmentAuthorization map(Map<?, ?> values, String expectedUserGuid) {
        String failureCode = failureCode(values);
        if (failureCode != null) {
            throw new EnrollmentUnavailableException();
        }
        String factorId = required(values, "factorId", 512);
        String requestState = required(values, "requestState");
        String securityToken = required(values, "securityToken");
        return new EnrollmentAuthorization(
                expectedUserGuid, factorId, requestState, securityToken.toCharArray());
    }

    static String failureCode(Map<?, ?> values) {
        if (!"success".equals(values.get("status"))) return "provider_status_not_success";
        if (!"INITIATED".equals(values.get("factorStatus"))) return "factor_not_initiated";
        if (!present(values, "factorId", 512)) return "factor_id_missing";
        if (!present(values, "requestState")) return "request_state_missing";
        if (!present(values, "securityToken")) return "security_token_missing";
        return null;
    }

    private static String required(Map<?, ?> values, String name) {
        return required(values, name, 8192);
    }

    private static String required(Map<?, ?> values, String name, int maximum) {
        Object value = values.get(name);
        if (value instanceof String text && !text.isBlank() && text.length() <= maximum) {
            return text;
        }
        throw new EnrollmentUnavailableException();
    }

    private static boolean present(Map<?, ?> values, String name) {
        return present(values, name, 8192);
    }

    private static boolean present(Map<?, ?> values, String name, int maximum) {
        Object value = values.get(name);
        return value instanceof String text && !text.isBlank() && text.length() <= maximum;
    }
}
