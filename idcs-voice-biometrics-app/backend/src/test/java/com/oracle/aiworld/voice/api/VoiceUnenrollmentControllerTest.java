package com.oracle.aiworld.voice.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.application.unenrollment.VoiceUnenrollmentService;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService;
import com.oracle.aiworld.voice.auth.SecretStore;
import com.oracle.aiworld.voice.auth.SessionAuthenticator;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort;
import com.oracle.aiworld.voice.port.IdentityProviderPort.SecretMaterial;
import com.oracle.aiworld.voice.support.TestProperties;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpCookie;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

@SpringBootTest(properties = {
        "ai-world.public-origin=https://localhost:8443",
        "ai-world.idcs.enabled=false",
        "ai-world.iam.status-enabled=false"
})
class VoiceUnenrollmentControllerTest {
    private static final String ORIGIN = "https://localhost:8443";

    @Autowired
    ApplicationContext applicationContext;

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .build();
    }

    @Test
    void anonymousDeleteFailsAsAuthenticationRequiredAndRemainsNoStore() {
        sameOrigin(client.delete().uri("/api/v1/voice/enrollment"))
                .header("X-CSRF-Token", "not-a-session-token")
                .header("Idempotency-Key", "delete-attempt-1")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectBody()
                .jsonPath("$.code").isEqualTo("AUTHENTICATION_REQUIRED");
    }

    @Test
    void deleteRouteAcceptsNoRequestBodyOrProviderIdentifierPath() throws Exception {
        Class<?> controller = Class.forName(
                "com.oracle.aiworld.voice.api.VoiceUnenrollmentController");
        assertThat(controller.getDeclaredMethods())
                .filteredOn(method -> method.getName().equals("deleteCurrentEnrollment"))
                .singleElement()
                .satisfies(method -> {
                    assertThat(method.getParameterTypes()).contains(
                            org.springframework.web.server.ServerWebExchange.class);
                    assertThat(method.getParameterTypes()).doesNotContain(java.util.Map.class);
                });
    }

    @Test
    void missingSameOriginAndMutationHeadersCannotReachDeletion() {
        client.delete().uri("/api/v1/voice/enrollment")
                .exchange()
                .expectStatus().isForbidden()
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    @Test
    void authenticatedDeleteUsesOnlySessionIdentityAndReturnsIdentifierFreeProjection() {
        Fixture fixture = fixture();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.delete("/api/v1/voice/enrollment")
                        .cookie(new HttpCookie(fixture.cookiePolicy.cookieName(), fixture.cookie))
                        .header("X-CSRF-Token", fixture.csrfToken)
                        .header("Idempotency-Key", "delete-attempt-0001")
                        .build());
        exchange.getAttributes().put(
                CorrelationNoStoreFilter.CORRELATION_ATTRIBUTE, "correlation-delete-1");

        var response = fixture.controller.deleteCurrentEnrollment(exchange).block();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).satisfies(body -> {
            assertThat(body.outcome()).isEqualTo(Outcome.DELETED);
            assertThat(body.enrollmentStatus().name()).isEqualTo("NOT_ENROLLED");
            assertThat(body.allowedActions()).extracting(Enum::name)
                    .containsExactly("ENROLL", "SIGN_OUT");
            assertThat(body.toString()).doesNotContain("doctor-guid").doesNotContain("factorId");
        });
        assertThat(fixture.iam.calls.get()).isOne();
        assertThat(fixture.iam.lastSubject).isEqualTo("doctor-guid");
    }

    @Test
    void requestBodyIsRejectedBeforeAuthenticationOrMutation() {
        Fixture fixture = fixture();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.delete("/api/v1/voice/enrollment")
                        .header(HttpHeaders.CONTENT_LENGTH, "2")
                        .build());

        assertThatThrownBy(() -> fixture.controller.deleteCurrentEnrollment(exchange).block())
                .isInstanceOf(ApiException.class)
                .satisfies(failure -> {
                    ApiException problem = (ApiException) failure;
                    assertThat(problem.status().value()).isEqualTo(400);
                    assertThat(problem.code()).isEqualTo("REQUEST_BODY_NOT_ALLOWED");
                });
    }

    private static Fixture fixture() {
        Instant now = Instant.parse("2026-09-09T00:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        var properties = TestProperties.properties(900, 3600, 100);
        SecretStore secrets = new SecretStore(new SecureRandom(), clock);
        var sessionToken = new SecretMaterial(
                "application-token".toCharArray(), null, now.plusSeconds(600));
        var secretHandle = secrets.put(sessionToken);
        sessionToken.close();
        SessionRegistry sessions = new SessionRegistry(secrets, new SecureRandom(), clock, properties);
        var created = sessions.create(
                new DoctorIdentity(
                        "doctor-subject", "doctor@example.test", "Doctor", "Example", "doctor-guid"),
                secretHandle,
                now.plusSeconds(600));
        SessionCookiePolicy cookiePolicy = new SessionCookiePolicy(properties);
        SessionAuthenticator authenticator = new SessionAuthenticator(sessions, cookiePolicy);
        FakeIam iam = new FakeIam();
        EnrollmentStatusPort status = (userGuid, correlationId) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, now));
        VoiceSessionService voiceSessions = new VoiceSessionService(
                null, null, null, clock, new SecureRandom());
        VoiceUnenrollmentService service = new VoiceUnenrollmentService(
                iam, status, voiceSessions, clock);
        return new Fixture(
                new VoiceUnenrollmentController(authenticator, cookiePolicy, sessions, service),
                cookiePolicy,
                created.cookieValue(),
                created.csrfToken(),
                iam);
    }

    private record Fixture(
            VoiceUnenrollmentController controller,
            SessionCookiePolicy cookiePolicy,
            String cookie,
            String csrfToken,
            FakeIam iam) {
    }

    private static final class FakeIam implements IamVoiceUnenrollmentPort {
        private final AtomicInteger calls = new AtomicInteger();
        private String lastSubject;

        @Override
        public Mono<VoiceUnenrollmentResult> deleteCurrentVoiceFactor(
                String subject, String idempotencyKey, String correlationId) {
            calls.incrementAndGet();
            lastSubject = subject;
            return Mono.just(new VoiceUnenrollmentResult(
                    Outcome.DELETED, Instant.parse("2026-09-09T00:00:00Z")));
        }
    }

    private static <S extends WebTestClient.RequestHeadersSpec<?>> S sameOrigin(S request) {
        request.header(HttpHeaders.ORIGIN, ORIGIN)
                .header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty");
        return request;
    }
}
