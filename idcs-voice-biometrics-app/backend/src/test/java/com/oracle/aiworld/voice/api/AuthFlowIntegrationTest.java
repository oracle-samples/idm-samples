package com.oracle.aiworld.voice.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.oracle.aiworld.voice.auth.AuthenticationService;
import com.oracle.aiworld.voice.auth.SessionRegistry;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IdentityProviderPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.EntityExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

@SpringBootTest(properties = {
        "ai-world.public-origin=https://localhost:8443",
        "ai-world.idcs.enabled=false",
        "ai-world.iam.status-enabled=false",
        "ai-world.session.idle-seconds=900",
        "ai-world.session.absolute-seconds=3600",
        "ai-world.session.capacity=100"
})
@Import(AuthFlowIntegrationTest.TestPorts.class)
class AuthFlowIntegrationTest {
    private static final String ORIGIN = "https://localhost:8443";

    @Autowired
    ApplicationContext applicationContext;

    @Autowired
    FakeIdentityProvider identityProvider;

    @Autowired
    FakeEnrollmentStatus enrollmentStatus;

    @Autowired
    FakeIamVoiceEnrollment iamVoiceEnrollment;

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .build();
        identityProvider.calls.set(0);
        identityProvider.failure.set(FakeIdentityProvider.Failure.NONE);
        enrollmentStatus.available.set(true);
        iamVoiceEnrollment.calls.set(0);
    }

    @Test
    void customLoginMeStatusAndLocalFirstSignOutWorkEndToEnd() {
        String loginCsrf = issueLoginContext();
        EntityExchangeResult<Void> login = sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", loginCsrf)
                .bodyValue(Map.of("username", "doctor@example.test", "password", "correct horse"))
                .exchange()
                .expectStatus().isNoContent()
                .expectHeader().valueMatches("X-CSRF-Token", "^[A-Za-z0-9_-]{32,}$")
                .expectHeader().value(HttpHeaders.SET_COOKIE, value -> {
                    assertThat(value).contains(SessionRegistry.COOKIE_NAME + "=");
                    assertThat(value).contains("Secure").contains("HttpOnly").contains("SameSite=Lax").contains("Path=/");
                    assertThat(value).doesNotContain("Domain=");
                })
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectBody().isEmpty();

        String cookie = cookieValue(login.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE));
        String loginSessionCsrf = login.getResponseHeaders().getFirst("X-CSRF-Token");

        EntityExchangeResult<byte[]> me = client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isOk()
                .expectHeader().value("X-CSRF-Token", value -> assertThat(value).isNotEqualTo(loginSessionCsrf))
                .expectBody()
                .jsonPath("$.protocolVersion").isEqualTo("1.0")
                .jsonPath("$.transcriptionEnabled").isEqualTo(false)
                .jsonPath("$.username").isEqualTo("doctor@example.test")
                .jsonPath("$.enrollmentStatus").isEqualTo("NOT_ENROLLED")
                .jsonPath("$.enrollmentStatusLookupState").isEqualTo("AVAILABLE")
                .jsonPath("$.allowedActions[0]").isEqualTo("ENROLL")
                .jsonPath("$.allowedActions[1]").isEqualTo("SIGN_OUT")
                .returnResult();
        assertThat(me.getResponseBody()).asString().doesNotContain("user-guid").doesNotContain("access-token");

        client.get().uri("/api/v1/voice/enrollment-status")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("NOT_ENROLLED")
                .jsonPath("$.allowedActions[0]").isEqualTo("ENROLL");

        sameOrigin(client.post().uri("/api/v1/auth/sign-out"))
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isNoContent()
                .expectHeader().value(HttpHeaders.SET_COOKIE, value -> {
                    assertThat(value).contains(SessionRegistry.COOKIE_NAME + "=");
                    assertThat(value).contains("Max-Age=0");
                });

        client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isUnauthorized();
        assertThat(identityProvider.calls).hasValue(1);
    }

    @Test
    void parallelLoginsCreateIsolatedSessionsAndSigningOutOneKeepsTheOtherActive() {
        CompletableFuture<LoggedInSession> firstLogin = CompletableFuture.supplyAsync(
                () -> loginAs("doctor.one@example.test"));
        CompletableFuture<LoggedInSession> secondLogin = CompletableFuture.supplyAsync(
                () -> loginAs("doctor.two@example.test"));

        LoggedInSession first = firstLogin.join();
        LoggedInSession second = secondLogin.join();

        assertThat(first.cookie()).isNotEqualTo(second.cookie());
        assertThat(first.csrf()).isNotEqualTo(second.csrf());
        assertCurrentUser(first, "doctor.one@example.test");
        assertCurrentUser(second, "doctor.two@example.test");

        sameOrigin(client.post().uri("/api/v1/auth/sign-out"))
                .cookie(SessionRegistry.COOKIE_NAME, first.cookie())
                .exchange()
                .expectStatus().isNoContent();

        client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, first.cookie())
                .exchange()
                .expectStatus().isUnauthorized();
        assertCurrentUser(second, "doctor.two@example.test");

        sameOrigin(client.post().uri("/api/v1/auth/sign-out"))
                .cookie(SessionRegistry.COOKIE_NAME, second.cookie())
                .exchange()
                .expectStatus().isNoContent();
        assertThat(identityProvider.calls).hasValue(2);
    }

    @Test
    void loginContextIsConsumedBeforeBodyParsingAndProviderCall() {
        String csrf = issueLoginContext();
        sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", csrf)
                .bodyValue(Map.of(
                        "username", "doctor@example.test",
                        "password", "secret",
                        "provider", "attacker-controlled"))
                .exchange()
                .expectStatus().isBadRequest();

        sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", csrf)
                .bodyValue(Map.of("username", "doctor@example.test", "password", "secret"))
                .exchange()
                .expectStatus().isForbidden();
        assertThat(identityProvider.calls).hasValue(0);
    }

    @Test
    void missingFetchMetadataIsRejectedWithoutIssuingContext() {
        client.get().uri("/api/v1/auth/login-context")
                .exchange()
                .expectStatus().isForbidden()
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectBody()
                .jsonPath("$.code").isEqualTo("SAME_ORIGIN_REQUIRED");
    }

    @Test
    void browserLoginContextGetMayOmitOriginButRejectsAMismatchedOrigin() {
        EntityExchangeResult<byte[]> loginContext = browserSameOriginGet(
                client.get().uri("/api/v1/auth/login-context"))
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectHeader().valueMatches("X-CSRF-Token", "^[A-Za-z0-9_-]{32,}$")
                .expectBody()
                .jsonPath("$.protocolVersion").isEqualTo("1.0")
                .jsonPath("$.loginContextToken").isNotEmpty()
                .jsonPath("$.passwordEnvelope").doesNotExist()
                .returnResult();
        String headerToken = loginContext.getResponseHeaders().getFirst("X-CSRF-Token");
        String bodyToken = loginContextToken(loginContext);
        assertThat(bodyToken).isEqualTo(headerToken);

        browserSameOriginGet(client.get().uri("/api/v1/auth/login-context"))
                .header(HttpHeaders.ORIGIN, "https://attacker.example.test")
                .exchange()
                .expectStatus().isForbidden()
                .expectBody()
                .jsonPath("$.code").isEqualTo("SAME_ORIGIN_REQUIRED");
    }

    @Test
    void enrollmentOutageKeepsIdentityButFailsClosedActionsAndStatusRefresh() {
        String cookie = loginCookie();
        enrollmentStatus.available.set(false);

        client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.username").isEqualTo("doctor@example.test")
                .jsonPath("$.enrollmentStatus").isEqualTo("UNKNOWN")
                .jsonPath("$.enrollmentStatusLookupState").isEqualTo("TEMPORARILY_UNAVAILABLE")
                .jsonPath("$.statusObservedAt").doesNotExist()
                .jsonPath("$.allowedActions.length()").isEqualTo(1)
                .jsonPath("$.allowedActions[0]").isEqualTo("SIGN_OUT");

        client.get().uri("/api/v1/voice/enrollment-status")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
                .expectBody()
                .jsonPath("$.code").isEqualTo("ENROLLMENT_STATUS_UNAVAILABLE");
    }

    @Test
    void signOutIsIdempotentWithoutAnApplicationSession() {
        sameOrigin(client.post().uri("/api/v1/auth/sign-out"))
                .exchange()
                .expectStatus().isNoContent();
    }

    @Test
    void passwordChangeRequiredIsReturnedAsSafeActionableProblem() {
        identityProvider.failure.set(FakeIdentityProvider.Failure.PASSWORD_CHANGE_REQUIRED);
        sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", issueLoginContext())
                .bodyValue(Map.of("username", "doctor@example.test", "password", "temporary-password"))
                .exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectHeader().doesNotExist(HttpHeaders.SET_COOKIE)
                .expectBody()
                .jsonPath("$.code").isEqualTo("PASSWORD_CHANGE_REQUIRED")
                .jsonPath("$.failureKind").isEqualTo("ACTION_REQUIRED")
                .jsonPath("$.retryable").isEqualTo(false)
                .jsonPath("$.detail").isEqualTo(
                        "Change your password through your organization's account sign-in page, then try again.")
                .consumeWith(result -> assertThat(result.getResponseBody()).asString()
                        .doesNotContain("temporary-password"));
    }

    @Test
    void providerFailuresRemainNoStoreGenericProblems() {
        identityProvider.failure.set(FakeIdentityProvider.Failure.UNAVAILABLE);
        sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", issueLoginContext())
                .bodyValue(Map.of("username", "doctor@example.test", "password", "never-echo-this"))
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
                .expectHeader().contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectBody()
                .jsonPath("$.code").isEqualTo("IDCS_UNAVAILABLE")
                .consumeWith(result -> assertThat(result.getResponseBody()).asString()
                        .doesNotContain("never-echo-this"));
    }

    @Test
    void enrollmentInitiationDisplaysConsentAndDecisionRemainsLocal() {
        EntityExchangeResult<Void> login = sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", issueLoginContext())
                .bodyValue(Map.of("username", "doctor@example.test", "password", "secret"))
                .exchange().expectStatus().isNoContent().expectBody().isEmpty();
        String cookie = cookieValue(login.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE));
        EntityExchangeResult<byte[]> me = client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .exchange().expectStatus().isOk().expectBody().returnResult();
        String csrf = me.getResponseHeaders().getFirst("X-CSRF-Token");

        EntityExchangeResult<byte[]> initiated = sameOrigin(client.post().uri("/api/v1/voice/enrollment-attempt"))
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .header("X-CSRF-Token", csrf)
                .header("Idempotency-Key", "test-initiation-1")
                .bodyValue(Map.of("factor", "VOICE", "locale", "en"))
                .exchange()
                .expectStatus().isCreated()
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectBody()
                .jsonPath("$.state").isEqualTo("CONSENT_PENDING")
                .jsonPath("$.consent.locale").isEqualTo("en")
                .jsonPath("$.consent.text").isEqualTo("Current IAM consent")
                .returnResult();

        String attemptId = JsonPath.read(new String(initiated.getResponseBody(), StandardCharsets.UTF_8),
                "$.enrollmentAttemptId");
        String version = JsonPath.read(new String(initiated.getResponseBody(), StandardCharsets.UTF_8),
                "$.consent.version");
        sameOrigin(client.put().uri("/api/v1/voice/enrollment-attempt/consent"))
                .cookie(SessionRegistry.COOKIE_NAME, cookie)
                .header("X-CSRF-Token", csrf)
                .header("Idempotency-Key", "test-consent-1")
                .bodyValue(Map.of("enrollmentAttemptId", attemptId, "decision", "ACCEPT", "consentVersion", version))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.state").isEqualTo("CONSENT_ACCEPT_INTENT_RECORDED");

        assertThat(iamVoiceEnrollment.calls).hasValue(1);
    }

    private String loginCookie() {
        EntityExchangeResult<Void> login = sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", issueLoginContext())
                .bodyValue(Map.of("username", "doctor@example.test", "password", "secret"))
                .exchange()
                .expectStatus().isNoContent()
                .expectBody().isEmpty();
        return cookieValue(login.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE));
    }

    private LoggedInSession loginAs(String username) {
        EntityExchangeResult<Void> login = sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", issueLoginContext())
                .bodyValue(Map.of("username", username, "password", "secret"))
                .exchange()
                .expectStatus().isNoContent()
                .expectBody().isEmpty();
        return new LoggedInSession(
                cookieValue(login.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE)),
                login.getResponseHeaders().getFirst("X-CSRF-Token"));
    }

    private void assertCurrentUser(LoggedInSession session, String username) {
        client.get().uri("/api/v1/me")
                .cookie(SessionRegistry.COOKIE_NAME, session.cookie())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.username").isEqualTo(username);
    }

    private record LoggedInSession(String cookie, String csrf) {
    }

    private String issueLoginContext() {
        EntityExchangeResult<byte[]> result = browserSameOriginGet(
                client.get().uri("/api/v1/auth/login-context"))
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectHeader().valueEquals(HttpHeaders.CACHE_CONTROL, "no-store")
                .expectHeader().valueMatches("X-CSRF-Token", "^[A-Za-z0-9_-]{32,}$")
                .expectBody()
                .jsonPath("$.protocolVersion").isEqualTo("1.0")
                .jsonPath("$.loginContextToken").isNotEmpty()
                .jsonPath("$.passwordEnvelope").doesNotExist()
                .returnResult();
        String headerToken = result.getResponseHeaders().getFirst("X-CSRF-Token");
        String bodyToken = loginContextToken(result);
        assertThat(bodyToken).isEqualTo(headerToken);
        return bodyToken;
    }

    private static String loginContextToken(EntityExchangeResult<byte[]> result) {
        assertThat(result.getResponseBody()).isNotNull();
        return JsonPath.read(new String(result.getResponseBody(), StandardCharsets.UTF_8),
                "$.loginContextToken");
    }

    private static <S extends WebTestClient.RequestHeadersSpec<?>> S sameOrigin(S request) {
        request.header(HttpHeaders.ORIGIN, ORIGIN)
                .header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty");
        return request;
    }

    private static <S extends WebTestClient.RequestHeadersSpec<?>> S browserSameOriginGet(S request) {
        request.header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty");
        return request;
    }

    private static String cookieValue(String setCookie) {
        assertThat(setCookie).isNotNull();
        String prefix = SessionRegistry.COOKIE_NAME + "=";
        assertThat(setCookie).startsWith(prefix);
        return setCookie.substring(prefix.length(), setCookie.indexOf(';'));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestPorts {
        @Bean
        @Primary
        FakeIdentityProvider fakeIdentityProvider() {
            return new FakeIdentityProvider();
        }

        @Bean
        @Primary
        FakeEnrollmentStatus fakeEnrollmentStatus() {
            return new FakeEnrollmentStatus();
        }

        @Bean
        @Primary
        FakeIamVoiceEnrollment fakeIamVoiceEnrollment() {
            return new FakeIamVoiceEnrollment();
        }
    }

    static final class FakeIdentityProvider implements IdentityProviderPort {
        enum Failure { NONE, REJECTED, PASSWORD_CHANGE_REQUIRED, UNAVAILABLE }

        private final AtomicInteger calls = new AtomicInteger();
        private final AtomicReference<Failure> failure = new AtomicReference<>(Failure.NONE);

        @Override
        public Mono<AuthenticationResult> authenticate(String username, char[] password) {
            calls.incrementAndGet();
            if (failure.get() == Failure.REJECTED) {
                return Mono.error(new AuthenticationRejectedException());
            }
            if (failure.get() == Failure.PASSWORD_CHANGE_REQUIRED) {
                return Mono.error(new PasswordChangeRequiredException());
            }
            if (failure.get() == Failure.UNAVAILABLE) {
                return Mono.error(new ProviderUnavailableException());
            }
            String normalizedUsername = AuthenticationService.normalizeUsername(username);
            return Mono.just(new AuthenticationResult(
                    new DoctorIdentity("subject:" + normalizedUsername, normalizedUsername,
                            "Dr. " + normalizedUsername, "Northstar Health",
                            "guid:" + normalizedUsername),
                    new SecretMaterial(("access-token:" + normalizedUsername).toCharArray(), null,
                            Instant.now().plusSeconds(3600))));
        }
    }

    static final class FakeEnrollmentStatus implements EnrollmentStatusPort {
        private final AtomicBoolean available = new AtomicBoolean(true);

        @Override
        public Mono<EnrollmentObservation> lookup(String userGuid, String correlationId) {
            return available.get()
                    ? Mono.just(new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, Instant.now()))
                    : Mono.error(new StatusUnavailableException());
        }
    }

    static final class FakeIamVoiceEnrollment implements IamVoiceEnrollmentPort {
        private final AtomicInteger calls = new AtomicInteger();

        @Override
        public Mono<EnrollmentInitiation> beginEnrollment(String userGuid, String locale, String correlationId) {
            calls.incrementAndGet();
            return Mono.just(new EnrollmentInitiation(
                    "factor-1", "request-state-0", "en", "Current IAM consent"));
        }
    }
}
