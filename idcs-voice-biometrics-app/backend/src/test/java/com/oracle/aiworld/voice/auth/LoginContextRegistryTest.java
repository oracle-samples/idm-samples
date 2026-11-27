package com.oracle.aiworld.voice.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.support.MutableClock;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class LoginContextRegistryTest {
    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-01T00:00:00Z"));
    private final LoginContextRegistry registry = new LoginContextRegistry(clock, new SecureRandom());

    @Test
    void tokenIsOneUseAndExpiresAfterTwoMinutes() {
        String oneUse = registry.issue();
        assertThat(registry.consume(oneUse)).isTrue();
        assertThat(registry.consume(oneUse)).isFalse();

        String expiring = registry.issue();
        clock.advance(Duration.ofMinutes(2));
        assertThat(registry.consume(expiring)).isFalse();
    }

    @Test
    void registryIsBoundedAtOneThousandUnconsumedContexts() {
        for (int index = 0; index < LoginContextRegistry.CAPACITY; index++) {
            registry.issue();
        }
        assertThat(registry.size()).isEqualTo(1_000);
        assertThatThrownBy(registry::issue)
                .isInstanceOf(LoginContextRegistry.LoginContextCapacityException.class);
    }
}
