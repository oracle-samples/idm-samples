package com.oracle.aiworld.voice.support;

import com.oracle.aiworld.voice.config.AiWorldProperties;

public final class TestProperties {
    private TestProperties() {
    }

    public static AiWorldProperties properties(long idleSeconds, long absoluteSeconds, int capacity) {
        return new AiWorldProperties(
                "https://localhost:8443",
                new AiWorldProperties.Session(idleSeconds, absoluteSeconds, capacity),
                new AiWorldProperties.Idcs(
                        false, "STRICT_JWT", "", "/oauth2/v1/token", "/admin/v1/Me", "", "", "", true, "", "", "",
                        "", "", "", "", "", "", 60L, 10, 100, 60L, "", 3000, 10000),
                new AiWorldProperties.Iam(
                        false, false, "", "/oauth2/v1/token", "", "", true, "", "", "PKCS12", "", "",
                        "PKCS12", "", "/mfa/v1/requests", "/mfa/v1/requests/{requestId}",
                        3000, 10000, false, "", "", "", "", "", "", "",
                        false, "/mfa/v1/users/{userId}/factors/{factorId}", "factorId", "userGUID"));
    }
}
