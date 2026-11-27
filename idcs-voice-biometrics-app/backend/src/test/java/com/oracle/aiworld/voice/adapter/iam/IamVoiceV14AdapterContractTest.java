package com.oracle.aiworld.voice.adapter.iam;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oracle.aiworld.voice.auth.SecretStore;
import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.HttpMessageWriter;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.web.reactive.function.BodyInserter;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

class IamVoiceV14AdapterContractTest {
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-09-16T00:00:00Z"), ZoneOffset.UTC);
    private static final ObjectMapper JSON = new ObjectMapper();

    private StubExchange exchange;
    private IamEnrollmentStatusAdapter adapter;

    @BeforeEach
    void setUp() {
        exchange = new StubExchange();
        WebClient client = WebClient.builder()
                .baseUrl("https://iam.example.test")
                .exchangeFunction(exchange::exchange)
                .build();
        adapter = new IamEnrollmentStatusAdapter(
                iam(), CLOCK, new SecretStore(new SecureRandom(), CLOCK), client);
    }

    @Test
    void enrollmentUsesFactorCollectionAndFactorResourceContracts() throws Exception {
        exchange.json(token())
                .json("""
                        {"status":"success","factorId":"factor-1","factorStatus":"CONSENT_REQUIRED",
                         "methods":["VOICE_BIOMETRIC"],"requestState":"state-0",
                         "consent":{"locale":"en","consentStatement":"Consent text"}}
                        """)
                .json(token())
                .json("""
                        {"status":"success","factorId":"factor-1","factorStatus":"INITIATED",
                         "requestState":"state-1","securityToken":"secret-token",
                         "baseUrl":"wss://abis.example.test"}
                        """)
                .json(token())
                .json("{\"status\":\"success\"}");

        var initiation = adapter.beginEnrollment("doctor-guid", "en", "correlation-1").block();
        try (var authorization = adapter.createEnrollmentSession(
                "doctor-guid", initiation.factorId(), initiation.requestState(), "correlation-2").block()) {
            adapter.completeEnrollment(
                    "doctor-guid", authorization.factorId(), authorization.requestState(),
                    "correlation-3").block();
        }

        assertTokenRequest(exchange.requests.get(0));
        assertTokenRequest(exchange.requests.get(2));
        assertTokenRequest(exchange.requests.get(4));
        assertRequest(exchange.requests.get(1), HttpMethod.POST,
                "/mfa/v1/users/doctor-guid/factors", "{\"method\":\"VOICE_BIOMETRIC\"}");
        assertRequest(exchange.requests.get(3), HttpMethod.PATCH,
                "/mfa/v1/users/doctor-guid/factors/factor-1",
                "{\"action\":\"ACCEPTED\",\"requestState\":\"state-0\"}");
        assertRequest(exchange.requests.get(5), HttpMethod.PATCH,
                "/mfa/v1/users/doctor-guid/factors/factor-1",
                "{\"status\":\"COMPLETED\",\"requestState\":\"state-1\"}");
    }

    @Test
    void verificationResolvesVoiceFactorThenUsesRequestResources() throws Exception {
        exchange.json(token())
                .json("""
                        {"status":"success","userGUID":"doctor-guid","factors":[
                          {"factorId":"factor-1","userGUID":"doctor-guid","methods":["VOICE_BIOMETRIC"]}
                        ]}
                        """)
                .json(token())
                .json("""
                        {"status":"success","requestId":"request-1","userGUID":"doctor-guid",
                         "factorId":"factor-1","method":"VOICE_BIOMETRIC","displayName":"Doctor",
                         "requestState":"verify-state","securityToken":"secret-token",
                         "baseUrl":"wss://abis.example.test"}
                        """)
                .json(token())
                .json("{\"status\":\"success\"}");

        try (var authorization = adapter.authorizeVerification(
                "doctor-guid", "correlation-1").block()) {
            adapter.completeVerification(
                    authorization.userGuid(), authorization.factorId(), authorization.requestId(),
                    authorization.requestState(), "correlation-2").block();
        }

        assertTokenRequest(exchange.requests.get(0));
        assertThat(exchange.requests.get(1).method()).isEqualTo(HttpMethod.GET);
        assertThat(exchange.requests.get(1).path())
                .isEqualTo("/mfa/v1/users/doctor-guid/factors");
        assertTokenRequest(exchange.requests.get(2));
        assertRequest(exchange.requests.get(3), HttpMethod.POST, "/mfa/v1/requests", """
                {"userId":"doctor-guid","userIdType":"USER_GUID",
                 "factorId":"factor-1","method":"VOICE_BIOMETRIC"}
                """);
        assertTokenRequest(exchange.requests.get(4));
        assertRequest(exchange.requests.get(5), HttpMethod.PATCH,
                "/mfa/v1/requests/request-1",
                "{\"status\":\"COMPLETED\",\"requestState\":\"verify-state\"}");
    }

    private static void assertTokenRequest(CapturedRequest request) {
        assertThat(request.method()).isEqualTo(HttpMethod.POST);
        assertThat(request.path()).isEqualTo("/oauth2/v1/token");
    }

    private static void assertRequest(
            CapturedRequest request, HttpMethod method, String path, String body) throws Exception {
        assertThat(request.method()).isEqualTo(method);
        assertThat(request.path()).isEqualTo(path);
        assertThat(JSON.readTree(request.body())).isEqualTo(JSON.readTree(body));
    }

    private static String token() {
        return "{\"access_token\":\"synthetic-service-token\","
                + "\"token_type\":\"Bearer\",\"expires_in\":300}";
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

    private record CapturedRequest(HttpMethod method, String path, String body) {
    }

    private static final class StubExchange {
        private static final BodyInserter.Context CONTEXT = new BodyInserter.Context() {
            @Override
            public List<HttpMessageWriter<?>> messageWriters() {
                return ExchangeStrategies.withDefaults().messageWriters();
            }

            @Override
            public Optional<ServerHttpRequest> serverRequest() {
                return Optional.empty();
            }

            @Override
            public Map<String, Object> hints() {
                return Map.of();
            }
        };

        private final Queue<ClientResponse> responses = new ArrayDeque<>();
        private final List<CapturedRequest> requests = new ArrayList<>();

        StubExchange json(String body) {
            responses.add(ClientResponse.create(HttpStatus.OK)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .build());
            return this;
        }

        Mono<ClientResponse> exchange(ClientRequest request) {
            ClientResponse response = responses.poll();
            if (response == null) {
                return Mono.error(new AssertionError("Unexpected IAM request: " + request.url()));
            }
            MockClientHttpRequest bodyTarget = new MockClientHttpRequest(
                    request.method(), request.url());
            AtomicReference<String> serialized = new AtomicReference<>("");
            bodyTarget.setWriteHandler(body -> DataBufferUtils.join(body)
                    .doOnNext(buffer -> {
                        byte[] bytes = new byte[buffer.readableByteCount()];
                        buffer.read(bytes);
                        DataBufferUtils.release(buffer);
                        serialized.set(new String(bytes, StandardCharsets.UTF_8));
                    })
                    .then());
            return request.body().insert(bodyTarget, CONTEXT)
                    .then(Mono.fromSupplier(serialized::get))
                    .map(body -> {
                        requests.add(new CapturedRequest(
                                request.method(), request.url().getPath(), body));
                        return response;
                    });
        }
    }
}
