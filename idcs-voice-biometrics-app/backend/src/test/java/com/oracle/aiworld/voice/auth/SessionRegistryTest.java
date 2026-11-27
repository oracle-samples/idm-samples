package com.oracle.aiworld.voice.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.port.IdentityProviderPort.SecretMaterial;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import com.oracle.aiworld.voice.support.MutableClock;
import com.oracle.aiworld.voice.support.TestProperties;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class SessionRegistryTest {
    private final MutableClock clock = new MutableClock(Instant.parse("2026-09-01T00:00:00Z"));
    private final SecureRandom random = new SecureRandom();
    private final SecretStore secrets = new SecretStore(random, clock);
    private final SessionRegistry sessions = new SessionRegistry(
            secrets, random, clock, TestProperties.properties(5, 100, 10));
    private final DoctorIdentity doctor = new DoctorIdentity("subject", "doctor@example.test", null, null, "guid");

    @Test
    void purgeDoesNotRefreshUnrelatedSessionIdleDeadline() {
        SessionRegistry.CreatedSession first = createSession();
        clock.advance(Duration.ofSeconds(5).minusMillis(1));
        assertThat(sessions.find(first.cookieValue())).isPresent();

        clock.advance(Duration.ofSeconds(4));
        createSession(); // invokes purge; it must not touch the first session
        clock.advance(Duration.ofSeconds(2));

        assertThat(sessions.find(first.cookieValue())).isEmpty();
    }

    @Test
    void csrfRotationReturnsFreshRawTokenAndStoresOnlyItsDigest() {
        SessionRegistry.CreatedSession created = createSession();

        String rotated = sessions.rotateCsrf(created.cookieValue()).orElseThrow();
        SessionRegistry.SessionView view = sessions.find(created.cookieValue()).orElseThrow();

        assertThat(rotated).isNotEqualTo(created.csrfToken());
        assertThat(view.csrfDigest()).isEqualTo(OpaqueTokens.digest(rotated));
        assertThat(view.csrfDigest()).isNotEqualTo(rotated);
    }

    @Test
    void removalAlsoDestroysSeparateSecretHandle() {
        SessionRegistry.CreatedSession created = createSession();
        assertThat(secrets.size()).isOne();

        sessions.remove(created.cookieValue());

        assertThat(sessions.find(created.cookieValue())).isEmpty();
        assertThat(secrets.size()).isZero();
    }

    @Test
    void createsAndResolvesParallelUserSessionsWithoutCrossUserState() {
        SecretStore parallelSecrets = new SecretStore(random, clock);
        SessionRegistry parallelSessions = new SessionRegistry(
                parallelSecrets, random, clock, TestProperties.properties(30, 300, 100));
        Map<Integer, SessionRegistry.CreatedSession> created = new ConcurrentHashMap<>();

        IntStream.range(0, 32).parallel().forEach(index -> {
            DoctorIdentity identity = new DoctorIdentity(
                    "subject-" + index,
                    "doctor-" + index + "@example.test",
                    null,
                    null,
                    "guid-" + index);
            try (SecretMaterial material = new SecretMaterial(
                    ("access-token-" + index).toCharArray(), null,
                    clock.instant().plusSeconds(200))) {
                SecretStore.SecretHandle handle = parallelSecrets.put(material);
                created.put(index, parallelSessions.create(identity, handle, material.expiresAt()));
            }
        });

        assertThat(created).hasSize(32);
        assertThat(created.values()).extracting(SessionRegistry.CreatedSession::cookieValue)
                .doesNotHaveDuplicates();
        assertThat(created.values()).extracting(SessionRegistry.CreatedSession::csrfToken)
                .doesNotHaveDuplicates();
        assertThat(parallelSessions.size()).isEqualTo(32);
        assertThat(parallelSecrets.size()).isEqualTo(32);

        created.forEach((index, session) -> assertThat(parallelSessions.find(session.cookieValue()))
                .get()
                .extracting(view -> view.identity().username())
                .isEqualTo("doctor-" + index + "@example.test"));

        parallelSessions.remove(created.get(0).cookieValue());
        assertThat(parallelSessions.find(created.get(0).cookieValue())).isEmpty();
        assertThat(parallelSessions.find(created.get(1).cookieValue())).isPresent();
        assertThat(parallelSecrets.size()).isEqualTo(31);
        parallelSessions.clearAll();
    }

    private SessionRegistry.CreatedSession createSession() {
        try (SecretMaterial material = new SecretMaterial(
                "access-token".toCharArray(), null, clock.instant().plusSeconds(200))) {
            SecretStore.SecretHandle handle = secrets.put(material);
            return sessions.create(doctor, handle, material.expiresAt());
        }
    }
}
