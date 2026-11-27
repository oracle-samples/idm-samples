package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class IamEnrollmentCompletionMapperTest {
    @Test
    void acceptsTheV14CompletionAcknowledgement() {
        var completion = IamEnrollmentCompletionMapper.map(Map.of("status", "success"));

        assertThat(completion).isNotNull();
    }

    @Test
    void rejectsUnsuccessfulCompletionResponses() {
        assertThatThrownBy(() -> IamEnrollmentCompletionMapper.map(Map.of("status", "failed")))
                .isInstanceOf(RuntimeException.class);

        assertThat(IamEnrollmentCompletionMapper.failureCode(Map.of("status", "failed")))
                .isEqualTo("provider_status_not_success");
    }
}
