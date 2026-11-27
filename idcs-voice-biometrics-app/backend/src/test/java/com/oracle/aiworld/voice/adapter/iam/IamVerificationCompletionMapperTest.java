package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class IamVerificationCompletionMapperTest {
    @Test
    void acceptsDocumentedSuccessfulAuthenticationCompletion() {
        var completion = IamVerificationCompletionMapper.map(Map.of(
                "status", "success"), "doctor-guid", "factor-1");

        assertThat(completion.userGuid()).isEqualTo("doctor-guid");
        assertThat(completion.factorId()).isEqualTo("factor-1");
    }

    @Test
    void rejectsFailureResponse() {
        assertThat(IamVerificationCompletionMapper.failureCode(Map.of(
                "status", "failed")))
                .isEqualTo("provider_status_not_success");
    }
}
