package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationCompletion;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationUnavailableException;
import java.util.Map;

final class IamVerificationCompletionMapper {
    private IamVerificationCompletionMapper() {
    }

    static VerificationCompletion map(
            Map<?, ?> values,
            String expectedUserGuid,
            String expectedFactorId) {
        if (failureCode(values) != null) {
            throw new VerificationUnavailableException();
        }
        return new VerificationCompletion(expectedUserGuid, expectedFactorId);
    }

    static String failureCode(Map<?, ?> values) {
        if (!"success".equals(values.get("status"))) return "provider_status_not_success";
        return null;
    }
}
