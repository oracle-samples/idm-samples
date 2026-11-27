package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class IamEnrollmentAuthorizationMapperTest {
    @Test
    void mapsOnlyTheApprovedEnrollmentAuthorizationShape() {
        try (var value = IamEnrollmentAuthorizationMapper.map(Map.of(
                "status", "success",
                "factorStatus", "INITIATED",
                "factorId", "factor-1",
                "requestState", "request-state-1",
                "securityToken", "secret-1",
                "baseUrl", "wss://abis.example.test"), "user-1")) {
            assertThat(value.userGuid()).isEqualTo("user-1");
            assertThat(value.factorId()).isEqualTo("factor-1");
            assertThat(value.requestState()).isEqualTo("request-state-1");
            assertThat(value.securityToken()).containsExactly("secret-1".toCharArray());
        }
    }

    @Test
    void rejectsIncompleteProviderResponses() {
        assertThatThrownBy(() -> IamEnrollmentAuthorizationMapper.map(Map.of(
                "status", "success",
                "factorStatus", "INITIATED",
                "factorId", "factor-1",
                "requestState", "state-1"), "user-1"))
                .isInstanceOf(RuntimeException.class);
        assertThat(IamEnrollmentAuthorizationMapper.failureCode(Map.of(
                "status", "success",
                "factorStatus", "INITIATED",
                "factorId", "factor-1",
                "requestState", "state-1")))
                .isEqualTo("security_token_missing");
    }
}
