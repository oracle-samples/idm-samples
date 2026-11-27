package com.oracle.aiworld.voice.adapter.idcs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.config.AiWorldProperties.Idcs;
import com.oracle.aiworld.voice.port.IdentityProviderPort.AuthenticationResult;
import com.oracle.aiworld.voice.port.IdentityProviderPort.AuthenticationRejectedException;
import com.oracle.aiworld.voice.port.IdentityProviderPort.InvalidProviderResponseException;
import com.oracle.aiworld.voice.port.IdentityProviderPort.PasswordChangeRequiredException;
import com.oracle.aiworld.voice.port.IdentityProviderPort.ProviderUnavailableException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import okhttp3.Credentials;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

class IdcsPasswordGrantAdapterTest {
    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");

    @TempDir
    Path temporaryDirectory;

    private MockWebServer server;
    private Path secretFile;
    private Path doctorsFile;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        secretFile = temporaryDirectory.resolve("client-secret");
        doctorsFile = temporaryDirectory.resolve("approved-doctors");
        Files.writeString(secretFile, "client-secret\n", StandardCharsets.UTF_8);
        Files.writeString(doctorsFile, "doctor@example.test\n", StandardCharsets.UTF_8);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void sendsOneExactPasswordGrantWithBasicAuthenticationAndValidatesJwtProfile() throws Exception {
        server.enqueue(json(200, tokenResponse("Bearer", false)));
        IdcsPasswordGrantAdapter adapter = adapter(validJwt("RS256", "https://issuer.example.test",
                List.of("voice-demo"), NOW.plusSeconds(300)));

        AuthenticationResult result = adapter.authenticate(
                "doctor@example.test", "correct horse".toCharArray()).block();
        try (var ignored = result.secretMaterial()) {
            assertThat(result.identity().username()).isEqualTo("doctor@example.test");
            assertThat(result.identity().userGuid()).isEqualTo("user-guid");
        }

        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).isEqualTo("/oauth2/v1/token");
        assertThat(request.getMethod()).isEqualTo("POST");
        assertThat(request.getHeader("Authorization")).isEqualTo(Credentials.basic("client-id", "client-secret"));
        assertThat(request.getHeader("Content-Type")).startsWith(MediaType.APPLICATION_FORM_URLENCODED_VALUE);
        String form = request.getBody().readUtf8();
        assertThat(form).contains("grant_type=password")
                .contains("username=doctor%40example.test")
                .contains("password=correct%20horse")
                .contains("scope=openid%20profile");
        assertThat(form).doesNotContain("client-secret");
        assertThat(server.getRequestCount()).isOne();
    }

    @Test
    void demoProfileUsesPasswordGrantThenMeWithoutJwtConfiguration() throws Exception {
        server.enqueue(json(200, """
                {
                  "access_token":"opaque-demo-token",
                  "token_type":"Bearer",
                  "expires_in":1800,
                  "refresh_token":"ignored-in-demo-mode"
                }
                """));
        server.enqueue(json(200, """
                {
                  "id":"idcs-subject",
                  "ocid":"ocid1.user.oc1..doctor",
                  "userName":"doctor@example.test",
                  "displayName":"Dr. Demo Doctor",
                  "emails":[{"value":"doctor@example.test","primary":true}]
                }
                """));
        ReactiveJwtDecoder mustNotDecode = token -> Mono.error(new AssertionError("JWT decoder called in demo mode"));
        IdcsPasswordGrantAdapter adapter = demoAdapter(mustNotDecode, Set.of("doctor@example.test"));

        AuthenticationResult result = adapter.authenticate(
                " Doctor@Example.Test ", "correct horse".toCharArray()).block();

        assertThat(result.identity()).isNotNull();
        assertThat(result.identity().subject()).isEqualTo("idcs-subject");
        assertThat(result.identity().username()).isEqualTo("doctor@example.test");
        assertThat(result.identity().displayName()).isEqualTo("Dr. Demo Doctor");
        assertThat(result.identity().organization()).isNull();
        assertThat(result.identity().userGuid()).isEqualTo("idcs-subject");
        try (var material = result.secretMaterial()) {
            assertThat(material.copyAccessToken()).containsExactly("opaque-demo-token".toCharArray());
            assertThat(material.copyRefreshToken()).isNull();
            assertThat(material.expiresAt()).isEqualTo(NOW.plusSeconds(1800));
        }

        RecordedRequest tokenRequest = server.takeRequest();
        assertThat(tokenRequest.getPath()).isEqualTo("/oauth2/v1/token");
        assertThat(tokenRequest.getMethod()).isEqualTo("POST");
        assertThat(tokenRequest.getBody().readUtf8()).contains("username=Doctor%40Example.Test");

        RecordedRequest profileRequest = server.takeRequest();
        assertThat(profileRequest.getRequestUrl().encodedPath()).isEqualTo("/admin/v1/Me");
        assertThat(profileRequest.getRequestUrl().queryParameter("attributes"))
                .isEqualTo("id,ocid,displayName,userName,name,emails");
        assertThat(profileRequest.getMethod()).isEqualTo("GET");
        assertThat(profileRequest.getHeader("Authorization")).isEqualTo("Bearer opaque-demo-token");
        assertThat(profileRequest.getHeader("Accept")).contains(MediaType.APPLICATION_JSON_VALUE);
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void demoProfileDefaultsMissingExpiresInToOneHourLikeReferenceFlow() {
        server.enqueue(json(200, """
                {"access_token":"opaque-demo-token","token_type":"Bearer"}
                """));
        server.enqueue(json(200, profileResponse("doctor@example.test")));

        AuthenticationResult result = demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("doctor@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block();

        try (var material = result.secretMaterial()) {
            assertThat(material.expiresAt()).isEqualTo(NOW.plusSeconds(3600));
        }
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void demoProfileAcceptsPythonCompatibleOptionalTokenTypeAndStringExpiry() {
        server.enqueue(json(200, """
                {"access_token":"opaque-demo-token","expires_in":"1800"}
                """));
        server.enqueue(json(200, profileResponse("doctor@example.test")));

        AuthenticationResult result = demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("doctor@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block();

        try (var material = result.secretMaterial()) {
            assertThat(material.expiresAt()).isEqualTo(NOW.plusSeconds(1800));
        }
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void mapsOnlyTheExplicitIdcsPasswordChangeConditionToActionRequired() {
        server.enqueue(json(400, """
                {
                  "error":"invalid_grant",
                  "error_description":"You must change your password."
                }
                """));

        assertThatThrownBy(() -> demoAdapter(token -> Mono.error(new AssertionError()), Set.of())
                .authenticate("doctor@example.test", "temporary-password".toCharArray()).block())
                .isInstanceOf(PasswordChangeRequiredException.class);
        assertThat(server.getRequestCount()).isOne();
    }

    @Test
    void keepsOtherInvalidGrantResponsesGeneric() {
        server.enqueue(json(400, """
                {
                  "error":"invalid_grant",
                  "error_description":"Invalid credentials."
                }
                """));

        assertThatThrownBy(() -> demoAdapter(token -> Mono.error(new AssertionError()), Set.of())
                .authenticate("doctor@example.test", "wrong-password".toCharArray()).block())
                .isInstanceOf(AuthenticationRejectedException.class);
        assertThat(server.getRequestCount()).isOne();
    }

    @Test
    void demoProfileRejectsUsernameMismatchButAcceptsAuthenticatedUserOutsideStrictAllowlist() {
        server.enqueue(json(200, demoTokenResponse()));
        server.enqueue(json(200, profileResponse("other@example.test")));
        assertThatThrownBy(() -> demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("doctor@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(AuthenticationRejectedException.class);

        server.enqueue(json(200, demoTokenResponse()));
        server.enqueue(json(200, profileResponse("doctor@example.test")));
        AuthenticationResult result = demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("someone-else@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block();

        assertThat(result.identity().username()).isEqualTo("doctor@example.test");
        result.secretMaterial().close();
    }

    @Test
    void demoProfileRejectsMalformedProviderResponses() {
        server.enqueue(json(200, "{\"access_token\":\"opaque-demo-token\",\"token_type\":\"Bearer\",\"expires_in\":0}"));
        assertThatThrownBy(() -> demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("doctor@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(InvalidProviderResponseException.class);

        server.enqueue(json(200, demoTokenResponse()));
        server.enqueue(json(200, "{\"id\":\"idcs-subject\",\"displayName\":\"Missing username\"}"));
        assertThatThrownBy(() -> demoAdapter(token -> Mono.error(new AssertionError()),
                Set.of("doctor@example.test"))
                .authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(InvalidProviderResponseException.class);
    }

    @Test
    void demoProfileConfigurationRequiresExactMePathButNotJwtValidationSettings() {
        assertThatCode(() -> Files.delete(doctorsFile)).doesNotThrowAnyException();

        IdcsPasswordGrantAdapter demo = new IdcsPasswordGrantAdapter(
                demoConfig("https://idcs.example.test"), fixedClock(), null);
        assertThatCode(demo::validateConfiguration).doesNotThrowAnyException();

        IdcsPasswordGrantAdapter insecureLocalDemo = new IdcsPasswordGrantAdapter(
                demoConfig("https://idcs.example.test", "/admin/v1/Me", false), fixedClock(), null);
        assertThatCode(insecureLocalDemo::validateConfiguration).doesNotThrowAnyException();

        IdcsPasswordGrantAdapter wrongProfilePath = new IdcsPasswordGrantAdapter(
                demoConfig("https://idcs.example.test", "/admin/v1/Users"), fixedClock(), null);
        assertThatThrownBy(wrongProfilePath::validateConfiguration)
                .isInstanceOf(ProviderUnavailableException.class);

        IdcsPasswordGrantAdapter insecureStrictMode = new IdcsPasswordGrantAdapter(
                config("https://idcs.example.test", "/oauth2/v1/token",
                        "https://idcs.example.test/jwks", true), fixedClock(), null);
        assertThatThrownBy(insecureStrictMode::validateConfiguration)
                .isInstanceOf(ProviderUnavailableException.class);
    }

    @Test
    void rejectsWrongTokenTypeAndUnexpectedRefreshToken() {
        server.enqueue(json(200, tokenResponse("MAC", false)));
        assertThatThrownBy(() -> adapter(validJwt()).authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(InvalidProviderResponseException.class);

        server.enqueue(json(200, tokenResponse("Bearer", true)));
        assertThatThrownBy(() -> adapter(validJwt()).authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(InvalidProviderResponseException.class);
    }

    @Test
    void rejectsAlgorithmIssuerAudienceAndTimeProfileFailures() {
        List<Jwt> invalid = List.of(
                validJwt("HS256", "https://issuer.example.test", List.of("voice-demo"), NOW.plusSeconds(300)),
                validJwt("RS256", "https://other-issuer.example.test", List.of("voice-demo"), NOW.plusSeconds(300)),
                validJwt("RS256", "https://issuer.example.test", List.of("other-audience"), NOW.plusSeconds(300)),
                validJwt("RS256", "https://issuer.example.test", List.of("voice-demo"), NOW.minusSeconds(61)),
                validJwt("RS256", "https://issuer.example.test", List.of("voice-demo"), NOW.plusSeconds(300),
                        "other-domain"));
        for (Jwt jwt : invalid) {
            server.enqueue(json(200, tokenResponse("Bearer", false)));
            assertThatThrownBy(() -> adapter(jwt).authenticate("doctor@example.test", "secret".toCharArray()).block())
                    .isInstanceOf(InvalidProviderResponseException.class);
        }
    }

    @Test
    void rejectsSignatureDecoderFailureAndDoesNotFollowRedirect() {
        server.enqueue(json(200, tokenResponse("Bearer", false)));
        ReactiveJwtDecoder rejectingDecoder = token -> Mono.error(new IllegalArgumentException("bad signature"));
        assertThatThrownBy(() -> adapter(rejectingDecoder).authenticate(
                "doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(InvalidProviderResponseException.class);

        server.enqueue(new MockResponse().setResponseCode(302).addHeader("Location", "/other-host"));
        assertThatThrownBy(() -> adapter(validJwt()).authenticate(
                "doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(ProviderUnavailableException.class);
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void rejectsNetworkPathAndNonHttpsProductionConfigurationBeforeSendingSecrets() {
        Idcs unsafePath = config("https://idcs.example.test", "//evil.example/token", "https://idcs.example.test/jwks");
        assertThatThrownBy(() -> new IdcsPasswordGrantAdapter(unsafePath, fixedClock(), null)
                .authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(ProviderUnavailableException.class);

        Idcs clearText = config("http://localhost:8081", "/oauth2/v1/token", "http://localhost:8081/jwks");
        assertThatThrownBy(() -> new IdcsPasswordGrantAdapter(clearText, fixedClock(), null)
                .authenticate("doctor@example.test", "secret".toCharArray()).block())
                .isInstanceOf(ProviderUnavailableException.class);
        assertThat(server.getRequestCount()).isZero();
    }

    private IdcsPasswordGrantAdapter adapter(Jwt jwt) {
        return adapter(token -> Mono.just(jwt));
    }

    private IdcsPasswordGrantAdapter adapter(ReactiveJwtDecoder decoder) {
        WebClient client = WebClient.builder().baseUrl(server.url("/").toString()).build();
        IdcsPasswordGrantAdapter.RuntimeClient runtime = new IdcsPasswordGrantAdapter.RuntimeClient(
                client, decoder, Set.of("doctor@example.test"));
        return new IdcsPasswordGrantAdapter(config(server.url("/").toString(), "/oauth2/v1/token",
                "https://issuer.example.test/jwks"), fixedClock(), runtime);
    }

    private IdcsPasswordGrantAdapter demoAdapter(ReactiveJwtDecoder decoder, Set<String> approvedDoctors) {
        WebClient client = WebClient.builder().baseUrl(server.url("/").toString()).build();
        IdcsPasswordGrantAdapter.RuntimeClient runtime = new IdcsPasswordGrantAdapter.RuntimeClient(
                client, decoder, approvedDoctors);
        return new IdcsPasswordGrantAdapter(demoConfig(server.url("/").toString()), fixedClock(), runtime);
    }

    private Idcs config(String domainUrl, String tokenPath, String jwksUri) {
        return config(domainUrl, tokenPath, jwksUri, true);
    }

    private Idcs config(String domainUrl, String tokenPath, String jwksUri, boolean tlsVerify) {
        return new Idcs(
                true,
                "STRICT_JWT",
                domainUrl,
                tokenPath,
                "/admin/v1/Me",
                "client-id",
                secretFile.toString(),
                "openid profile",
                tlsVerify,
                "https://issuer.example.test",
                "voice-demo",
                jwksUri,
                "identityDomain",
                "approved-domain",
                "username",
                "displayName",
                "organization",
                "userGuid",
                60L,
                10,
                100,
                60L,
                doctorsFile.toString(),
                3000,
                10000);
    }

    private Idcs demoConfig(String domainUrl) {
        return demoConfig(domainUrl, "/admin/v1/Me");
    }

    private Idcs demoConfig(String domainUrl, String profilePath) {
        return demoConfig(domainUrl, profilePath, true);
    }

    private Idcs demoConfig(String domainUrl, String profilePath, boolean tlsVerify) {
        return new Idcs(
                true,
                "DEMO_PROFILE",
                domainUrl,
                "/oauth2/v1/token",
                profilePath,
                "client-id",
                secretFile.toString(),
                "urn:opc:idm:__myscopes__",
                tlsVerify,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                60L,
                10,
                100,
                60L,
                doctorsFile.toString(),
                3000,
                10000);
    }

    private static Jwt validJwt() {
        return validJwt("RS256", "https://issuer.example.test", List.of("voice-demo"), NOW.plusSeconds(300));
    }

    private static Jwt validJwt(String algorithm, String issuer, List<String> audience, Instant expiresAt) {
        return validJwt(algorithm, issuer, audience, expiresAt, "approved-domain");
    }

    private static Jwt validJwt(
            String algorithm,
            String issuer,
            List<String> audience,
            Instant expiresAt,
            String identityDomain) {
        Instant issuedAt = expiresAt.isBefore(NOW) ? expiresAt.minusSeconds(60) : NOW.minusSeconds(5);
        return Jwt.withTokenValue("header.payload.signature")
                .header("alg", algorithm)
                .issuer(issuer)
                .subject("doctor-subject")
                .audience(audience)
                .issuedAt(issuedAt)
                .notBefore(issuedAt)
                .expiresAt(expiresAt)
                .claim("identityDomain", identityDomain)
                .claim("username", "doctor@example.test")
                .claim("displayName", "Dr. Alex Morgan")
                .claim("organization", "Northstar Health")
                .claim("userGuid", "user-guid")
                .build();
    }

    private static Clock fixedClock() {
        return Clock.fixed(NOW, ZoneOffset.UTC);
    }

    private static MockResponse json(int status, String body) {
        return new MockResponse().setResponseCode(status)
                .addHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .setBody(body);
    }

    private static String tokenResponse(String type, boolean refresh) {
        return "{\"access_token\":\"header.payload.signature\",\"token_type\":\"" + type + "\""
                + (refresh ? ",\"refresh_token\":\"unexpected\"" : "") + "}";
    }

    private static String demoTokenResponse() {
        return "{\"access_token\":\"opaque-demo-token\",\"token_type\":\"Bearer\",\"expires_in\":1800}";
    }

    private static String profileResponse(String username) {
        return "{\"id\":\"idcs-subject\",\"userName\":\"" + username + "\"}";
    }

}
