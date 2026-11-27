package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentCompletion;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentUnavailableException;
import java.util.Map;

final class IamEnrollmentCompletionMapper {
    private IamEnrollmentCompletionMapper() {
    }

    static EnrollmentCompletion map(Map<?, ?> values) {
        String failureCode = failureCode(values);
        if (failureCode != null) throw new EnrollmentUnavailableException();
        return new EnrollmentCompletion();
    }

    static String failureCode(Map<?, ?> values) {
        if (!"success".equals(values.get("status"))) return "provider_status_not_success";
        return null;
    }
}
