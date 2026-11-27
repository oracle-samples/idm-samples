package com.oracle.aiworld.voice.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.config.AiWorldProperties;
import org.junit.jupiter.api.Test;

class SessionCookiePolicyTest {

    @Test
    void httpsOriginUsesSecureHostCookie() {
        SessionCookiePolicy policy = new SessionCookiePolicy(properties("https://localhost:8443"));

        assertThat(policy.cookieName()).isEqualTo("__Host-AIWORLD_SESSION");
        assertThat(policy.secure()).isTrue();
        assertThat(policy.sameSite()).isEqualTo("Lax");
        assertThat(policy.create("opaque", 900).toString())
                .contains("__Host-AIWORLD_SESSION=opaque")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .contains("Path=/");
    }

    @Test
    void httpOriginUsesNonSecureLoopbackCookie() {
        SessionCookiePolicy policy = new SessionCookiePolicy(properties("http://localhost:8080"));

        assertThat(policy.cookieName()).isEqualTo("AIWORLD_LOOPBACK_SESSION");
        assertThat(policy.secure()).isFalse();
        assertThat(policy.sameSite()).isEqualTo("Strict");
        assertThat(policy.create("opaque", 900).toString())
                .contains("AIWORLD_LOOPBACK_SESSION=opaque")
                .doesNotContain("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Strict")
                .contains("Path=/");
        assertThat(policy.expire().toString())
                .contains("AIWORLD_LOOPBACK_SESSION=")
                .contains("Max-Age=0");
    }

    @Test
    void nonLoopbackHttpOriginIsRejected() {
        assertThatThrownBy(() -> new SessionCookiePolicy(properties("http://demo.example.test:8080")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static AiWorldProperties properties(String origin) {
        return new AiWorldProperties(origin, null, null, null);
    }
}
