package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.auth.SecretStore;
import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.FailureKind;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.VoiceUnenrollmentException;
import com.oracle.aiworld.voice.security.SafeProviderExchangeLog;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

class IamVoiceUnenrollmentAdapterContractTest {
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-09-09T00:00:00Z"), ZoneOffset.UTC);
    private static final String SUBJECT = "doctor-guid";
    private static final String IDEMPOTENCY_KEY = "delete-attempt-0001";

    private SecretStore secretStore;

    @BeforeEach
    void setUp() {
        secretStore = new SecretStore(new SecureRandom(), CLOCK);
    }

    @Test
    void currentSubjectPortDoesNotAcceptBrowserProviderIdentifiers() throws Exception {
        Class<?> port = requiredType("com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort");
        Method operation = port.getMethod(
                "deleteCurrentVoiceFactor", String.class, String.class, String.class);

        assertThat(operation.getReturnType()).isEqualTo(Mono.class);
        assertThat(operation.getParameterCount()).isEqualTo(3);
        assertThat(operation.getName()).doesNotContain("UserId").doesNotContain("FactorId");
    }

    @Test
    void existingIamAdapterOwnsTheProviderSpecificDeletionBoundary() throws Exception {
        Class<?> port = requiredType("com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort");

        assertThat(port.isAssignableFrom(IamEnrollmentStatusAdapter.class)).isTrue();
        assertThatCode(() -> IamEnrollmentStatusAdapter.class.getMethod(
                "deleteCurrentVoiceFactor", String.class, String.class, String.class))
                .doesNotThrowAnyException();
    }

    @Test
    void resolverIsServerOnlyAndRequiresAnAuthoritativePayloadAndCurrentSubject() throws Exception {
        Class<?> resolver = requiredType("com.oracle.aiworld.voice.adapter.iam.IamVoiceFactorResolver");

        assertThat(Modifier.isPublic(resolver.getModifiers())).isFalse();
        assertThat(resolver.getDeclaredMethod("resolve", Object.class, String.class)).isNotNull();
    }

    @Test
    void reviewedAdapterContractCoversEveryFailClosedAndReconciliationCase() throws IOException {
        String contract = Files.readString(repoFile("specs/001-ai-world-voice-demo/contracts/iam-adapter.md"));

        assertThat(contract)
                .contains("fresh factor-list lookup")
                .contains("exact `VOICE_BIOMETRIC`")
                .contains("Zero matches")
                .contains("Multiple matches")
                .contains("malformed")
                .contains("cross-user")
                .contains("at most once")
                .contains("fresh factor-list reconciliation")
                .contains("never triggers an automatic destructive retry")
                .contains("mTLS");
    }

    @Test
    void resolverSelectsExactlyOneCurrentUserVoiceFactorAndRejectsUnsafeShapes() {
        IamVoiceFactorResolver resolver = new IamVoiceFactorResolver(iam());
        IamVoiceFactorResolver.Resolution resolved = resolver.resolve(
                factors(otherFactor("email-factor-1"), voiceFactor("voice-factor-1")), SUBJECT);
        assertThat(resolved).isInstanceOf(IamVoiceFactorResolver.Resolved.class);
        ((IamVoiceFactorResolver.Resolved) resolved).handle().close();

        assertThat(resolver.resolve(factors(), SUBJECT))
                .isInstanceOf(IamVoiceFactorResolver.Absent.class);
        assertFailure(resolver, factors(voiceFactor("voice-1"), voiceFactor("voice-2")),
                FailureKind.AMBIGUOUS_FACTOR);
        assertFailure(resolver, factors(Map.of(
                "userGUID", SUBJECT,
                "methods", List.of("VOICE_BIOMETRIC"))), FailureKind.MALFORMED_FACTOR);
        assertFailure(resolver, Map.of(
                "status", "success",
                "userGUID", "some-other-user",
                "factors", List.of()), FailureKind.CROSS_USER_FACTOR);
        assertThat(resolver.resolve(factors(Map.of(
                "factorId", "label-only-factor",
                "userGUID", SUBJECT,
                "displayName", "Voice biometric",
                "methods", List.of("EMAIL"))), SUBJECT))
                .isInstanceOf(IamVoiceFactorResolver.Absent.class);
        assertFailure(resolver, factors(Map.of(
                "factorId", "voice-factor-other-user",
                "userGUID", "some-other-user",
                "methods", List.of("VOICE_BIOMETRIC"))), FailureKind.CROSS_USER_FACTOR);
        assertThat(SafeProviderExchangeLog.body(factors(voiceFactor("voice-factor-raw"))).toString())
                .doesNotContain("voice-factor-raw");
    }

    @Test
    void successfulDeletionUsesExactlyOneResolvedFactorAndFreshPostconditionLookup() {
        StubExchange exchange = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(
                        otherFactor("email-factor-1"), voiceFactor("voice-factor-1")))
                .json(HttpStatus.OK, token())
                .empty(HttpStatus.NO_CONTENT)
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(otherFactor("email-factor-1")));

        var result = adapter(exchange).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-1").block();

        assertThat(result.outcome()).isEqualTo(Outcome.DELETED);
        assertThat(exchange.requests).extracting(request -> request.method())
                .containsExactly(
                        HttpMethod.POST, HttpMethod.GET, HttpMethod.POST,
                        HttpMethod.DELETE, HttpMethod.POST, HttpMethod.GET);
        assertThat(exchange.requests.stream()
                .filter(request -> request.method() == HttpMethod.DELETE)
                .map(request -> request.url().getPath()))
                .containsExactly("/mfa/v1/users/doctor-guid/factors/voice-factor-1");
        assertThat(exchange.requests.stream()
                .filter(request -> request.method() == HttpMethod.DELETE)
                .map(request -> request.headers().getContentType()))
                .containsExactly(MediaType.APPLICATION_JSON);
        assertThat(exchange.requests).allSatisfy(request -> {
            assertThat(request.url().getQuery()).isNull();
            assertThat(request.headers().getFirst("Idempotency-Key")).isNull();
        });
    }

    @Test
    void absentVoiceFactorIsIdempotentAndNeverIssuesDelete() {
        StubExchange exchange = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors());

        var result = adapter(exchange).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-2").block();

        assertThat(result.outcome()).isEqualTo(Outcome.ALREADY_NOT_ENROLLED);
        assertThat(exchange.requests).noneMatch(request -> request.method() == HttpMethod.DELETE);
    }

    @Test
    void notFoundOrAmbiguousTransportIsReconciledWithoutRetryingDelete() {
        StubExchange notFound = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")))
                .json(HttpStatus.OK, token())
                .empty(HttpStatus.NOT_FOUND)
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors());
        assertThat(adapter(notFound).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-3").block().outcome())
                .isEqualTo(Outcome.DELETED);
        assertThat(notFound.deleteCount()).isOne();

        StubExchange ambiguous = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")))
                .json(HttpStatus.OK, token())
                .failure(new IOException("synthetic disconnect"))
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors());
        assertThat(adapter(ambiguous).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-4").block().outcome())
                .isEqualTo(Outcome.DELETED);
        assertThat(ambiguous.deleteCount()).isOne();
    }

    @Test
    void rejectedDeleteWithRemainingFactorNeverFabricatesSuccess() {
        StubExchange exchange = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")))
                .json(HttpStatus.OK, token())
                .json(HttpStatus.BAD_GATEWAY, Map.of("status", "failed"))
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")));

        assertThatThrownBy(() -> adapter(exchange).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-5").block())
                .isInstanceOf(VoiceUnenrollmentException.class)
                .extracting(failure -> ((VoiceUnenrollmentException) failure).failureKind())
                .isEqualTo(FailureKind.DEPENDENCY_FAILURE);
        assertThat(exchange.deleteCount()).isOne();
    }

    @Test
    void lastActiveFactorRejectionIsPreservedAsAProviderPolicyConflict() {
        StubExchange exchange = new StubExchange()
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")))
                .json(HttpStatus.OK, token())
                .json(HttpStatus.BAD_REQUEST, Map.of(
                        "status", "failed",
                        "cause", List.of(Map.of("code", "AUTH-1143"))))
                .json(HttpStatus.OK, token())
                .json(HttpStatus.OK, factors(voiceFactor("voice-factor-1")));

        assertThatThrownBy(() -> adapter(exchange).deleteCurrentVoiceFactor(
                SUBJECT, IDEMPOTENCY_KEY, "correlation-delete-6").block())
                .isInstanceOf(VoiceUnenrollmentException.class)
                .extracting(failure -> ((VoiceUnenrollmentException) failure).failureKind())
                .isEqualTo(FailureKind.LAST_ACTIVE_FACTOR);
        assertThat(exchange.deleteCount()).isOne();
    }

    private IamEnrollmentStatusAdapter adapter(StubExchange exchange) {
        WebClient client = WebClient.builder()
                .baseUrl("https://iam.example.test")
                .exchangeFunction(exchange::exchange)
                .build();
        return new IamEnrollmentStatusAdapter(iam(), CLOCK, secretStore, client);
    }

    private static void assertFailure(
            IamVoiceFactorResolver resolver,
            Object payload,
            FailureKind expected) {
        assertThatThrownBy(() -> resolver.resolve(payload, SUBJECT))
                .isInstanceOf(VoiceUnenrollmentException.class)
                .extracting(failure -> ((VoiceUnenrollmentException) failure).failureKind())
                .isEqualTo(expected);
    }

    private static Map<String, Object> factors(Map<String, Object>... factors) {
        return Map.of(
                "status", "success",
                "userGUID", SUBJECT,
                "factors", List.of(factors));
    }

    private static Map<String, Object> voiceFactor(String id) {
        return Map.of(
                "factorId", id,
                "userGUID", SUBJECT,
                "methods", List.of("VOICE_BIOMETRIC"));
    }

    private static Map<String, Object> otherFactor(String id) {
        return Map.of(
                "factorId", id,
                "userGUID", SUBJECT,
                "methods", List.of("EMAIL"));
    }

    private static Map<String, Object> token() {
        return Map.of(
                "access_token", "synthetic-service-token",
                "token_type", "Bearer",
                "expires_in", 300);
    }

    private static Iam iam() {
        return new Iam(
                true, true, "https://iam.example.test", "/oauth2/v1/token", "client", "scope",
                true, "unused", "unused", "PKCS12", "unused", "unused", "PKCS12",
                "/mfa/v1/users/{userId}/factors", "/mfa/v1/requests",
                "/mfa/v1/requests/{requestId}", 3000, 10000,
                true, "/factors", "methods", "status", "VOICE_BIOMETRIC", "ACTIVE",
                "PENDING", "NOT_ENROLLED", true,
                "/mfa/v1/users/{userId}/factors/{factorId}", "factorId", "userGUID");
    }

    private static final class StubExchange {
        private final Queue<Mono<ClientResponse>> responses = new ArrayDeque<>();
        private final List<ClientRequest> requests = new ArrayList<>();

        StubExchange json(HttpStatus status, Object body) {
            responses.add(Mono.just(ClientResponse.create(status)
                    .header("Content-Type", "application/json")
                    .body(toJson(body))
                    .build()));
            return this;
        }

        StubExchange empty(HttpStatus status) {
            responses.add(Mono.just(ClientResponse.create(status).build()));
            return this;
        }

        StubExchange failure(Throwable failure) {
            responses.add(Mono.error(failure));
            return this;
        }

        Mono<ClientResponse> exchange(ClientRequest request) {
            requests.add(request);
            Mono<ClientResponse> response = responses.poll();
            return response == null
                    ? Mono.error(new AssertionError("Unexpected IAM request: " + request.url()))
                    : response;
        }

        long deleteCount() {
            return requests.stream().filter(request -> request.method() == HttpMethod.DELETE).count();
        }

        private static String toJson(Object value) {
            if (value instanceof Map<?, ?> map && map.containsKey("access_token")) {
                return "{\"access_token\":\"synthetic-service-token\",\"token_type\":\"Bearer\",\"expires_in\":300}";
            }
            if (value instanceof Map<?, ?> map && map.containsKey("factors")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> factors = (List<Map<String, Object>>) map.get("factors");
                String entries = factors.stream()
                        .map(factor -> "{\"factorId\":\"" + factor.get("factorId")
                                + "\",\"userGUID\":\"" + factor.get("userGUID")
                                + "\",\"methods\":[\""
                                + ((List<?>) factor.get("methods")).getFirst() + "\"]}")
                        .reduce((left, right) -> left + "," + right)
                        .orElse("");
                return "{\"status\":\"success\",\"userGUID\":\"doctor-guid\",\"factors\":["
                        + entries + "]}";
            }
            if (value instanceof Map<?, ?> map && map.containsKey("cause")) {
                return "{\"status\":\"failed\",\"cause\":[{\"code\":\"AUTH-1143\"}]}";
            }
            return "{\"status\":\"failed\"}";
        }
    }

    private static Class<?> requiredType(String name) throws ClassNotFoundException {
        return Class.forName(name);
    }

    private static Path repoFile(String relative) {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            Path candidate = current.resolve(relative);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Cannot locate " + relative);
    }
}
