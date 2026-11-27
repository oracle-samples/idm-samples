package com.oracle.aiworld.voice.adapter.idcs;

import com.oracle.aiworld.voice.auth.AuthenticationService;
import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.config.AiWorldProperties.Idcs;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.port.IdentityProviderPort;
import com.oracle.aiworld.voice.port.IdentityProviderPort.PasswordChangeRequiredException;
import com.oracle.aiworld.voice.security.SafeDiagnosticFingerprint;
import com.oracle.aiworld.voice.security.SafeProviderExchangeLog;
import io.netty.channel.ChannelOption;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import javax.net.ssl.SSLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

@Component
public class IdcsPasswordGrantAdapter implements IdentityProviderPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(IdcsPasswordGrantAdapter.class);
    private static final int MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
    private static final long DEMO_DEFAULT_EXPIRES_IN_SECONDS = 3600;
    private static final String PROFILE_ATTRIBUTES = "id,ocid,displayName,userName,name,emails";
    private static final String PROVIDER_ECID_HEADER = "X-ORACLE-DMS-ECID";

    private enum AuthenticationMode {
        STRICT_JWT,
        DEMO_PROFILE
    }

    private final Idcs config;
    private final java.time.Clock clock;
    private final AtomicReference<RuntimeClient> runtime = new AtomicReference<>();

    @Autowired
    public IdcsPasswordGrantAdapter(AiWorldProperties properties, java.time.Clock clock) {
        this.config = properties.idcs();
        this.clock = clock;
    }

    IdcsPasswordGrantAdapter(Idcs config, java.time.Clock clock, RuntimeClient testRuntime) {
        this.config = config;
        this.clock = clock;
        if (testRuntime != null) {
            this.runtime.set(testRuntime);
        }
    }

    @Override
    public Mono<AuthenticationResult> authenticate(String username, char[] password) {
        return authenticate(username, password, "not_available");
    }

    @Override
    public Mono<AuthenticationResult> authenticate(
            String username, char[] password, String correlationId) {
        return Mono.defer(() -> {
            AuthenticationMode mode = authenticationMode();
            RuntimeClient client = runtimeClient(mode);
            String providerUsername = mode == AuthenticationMode.DEMO_PROFILE ? username.strip() : username;
            byte[] form = passwordGrantForm(providerUsername, password, config.scope());
            logHttpRequest(
                    "PASSWORD_GRANT",
                    "POST",
                    config.tokenPath(),
                    providerUsername,
                    correlationId,
                    Map.of(
                            "grant_type", "password",
                            "username", providerUsername,
                            "password", "provided",
                            "scope", config.scope(),
                            "client_id", config.clientId()));
            return client.webClient().post()
                    .uri(config.tokenPath())
                    .headers(headers -> applyBasicAuthentication(headers))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(form)
                    .exchangeToMono(response -> response.bodyToMono(Map.class)
                            .defaultIfEmpty(Map.of())
                            .flatMap(values -> {
                                logHttpResponse(
                                        "PASSWORD_GRANT",
                                        response.statusCode().value(),
                                        correlationId,
                                        response.headers().asHttpHeaders().getFirst(PROVIDER_ECID_HEADER),
                                        values);
                                return tokenResponse(response.statusCode(), Mono.just(values));
                            }))
                    .flatMap(token -> mode == AuthenticationMode.DEMO_PROFILE
                            ? validateDemoProfile(client, providerUsername, correlationId, token)
                            : validateStrictToken(client.decoder(), token))
                    .onErrorMap(this::translateFailure)
                    .doFinally(ignored -> Arrays.fill(form, (byte) 0));
        });
    }

    private Mono<AuthenticationResult> validateStrictToken(
            ReactiveJwtDecoder decoder,
            ProviderTokenResponse tokenResponse) {
        if (tokenResponse.accessToken() == null || tokenResponse.accessToken().isBlank()
                || !"Bearer".equals(tokenResponse.tokenType())
                || tokenResponse.refreshToken() != null
                || tokenResponse.accessToken().chars().filter(character -> character == '.').count() != 2) {
            return Mono.error(new InvalidProviderResponseException());
        }
        return decoder.decode(tokenResponse.accessToken())
                .onErrorMap(ignored -> new InvalidProviderResponseException())
                .map(jwt -> {
                    validateJwtProfile(jwt);
                    DoctorIdentity identity = projectIdentity(jwt);
                    if (!isApprovedDoctor(identity)) {
                        throw new AuthenticationRejectedException();
                    }
                    Instant expiresAt = jwt.getExpiresAt();
                    if (expiresAt == null) {
                        throw new InvalidProviderResponseException();
                    }
                    return new AuthenticationResult(
                            identity,
                            new SecretMaterial(tokenResponse.accessToken().toCharArray(), null, expiresAt));
                });
    }

    private Mono<AuthenticationResult> validateDemoProfile(
            RuntimeClient client,
            String submittedUsername,
            String correlationId,
            ProviderTokenResponse tokenResponse) {
        String tokenType = tokenResponse.tokenType();
        if (tokenResponse.accessToken() == null || tokenResponse.accessToken().isBlank()
                || (tokenType != null && !"Bearer".equalsIgnoreCase(tokenType))) {
            LOGGER.warn("IDCS DEMO_PROFILE token response rejected: accessTokenPresent={}, bearerTypeCompatible={}",
                    tokenResponse.accessToken() != null && !tokenResponse.accessToken().isBlank(),
                    tokenType == null || "Bearer".equalsIgnoreCase(tokenType));
            return Mono.error(new InvalidProviderResponseException());
        }
        Instant expiresAt = demoTokenExpiresAt(tokenResponse.expiresIn());
        logHttpRequest(
                "CURRENT_USER_PROFILE",
                "GET",
                config.profilePath(),
                submittedUsername,
                correlationId,
                Map.of("attributes", PROFILE_ATTRIBUTES, "authorization", "Bearer credential"));
        return client.webClient().get()
                .uri(builder -> builder.path(config.profilePath())
                        .queryParam("attributes", PROFILE_ATTRIBUTES)
                        .build())
                .headers(headers -> headers.setBearerAuth(tokenResponse.accessToken()))
                .accept(MediaType.APPLICATION_JSON)
                .exchangeToMono(response -> response.bodyToMono(Map.class)
                        .defaultIfEmpty(Map.of())
                        .flatMap(values -> {
                            logHttpResponse(
                                    "CURRENT_USER_PROFILE",
                                    response.statusCode().value(),
                                    correlationId,
                                    response.headers().asHttpHeaders().getFirst(PROVIDER_ECID_HEADER),
                                    values);
                            return profileResponse(response.statusCode(), Mono.just(values));
                        }))
                .map(profile -> {
                    DoctorIdentity identity = projectProfileIdentity(profile);
                    if (!AuthenticationService.normalizeUsername(submittedUsername)
                            .equals(AuthenticationService.normalizeUsername(identity.username()))) {
                        throw new AuthenticationRejectedException();
                    }
                    return new AuthenticationResult(
                            identity,
                            new SecretMaterial(tokenResponse.accessToken().toCharArray(), null, expiresAt));
                });
    }

    private Mono<Map> profileResponse(HttpStatusCode status, Mono<Map> body) {
        if (status.is2xxSuccessful()) {
            return body.switchIfEmpty(Mono.error(new InvalidProviderResponseException()));
        }
        LOGGER.warn("IDCS DEMO_PROFILE /admin/v1/Me request failed: status={}", status.value());
        if (status.is4xxClientError()) {
            return body.then(Mono.error(new InvalidProviderResponseException()));
        }
        return body.then(Mono.error(new ProviderUnavailableException()));
    }

    private void logHttpRequest(
            String operation,
            String method,
            String path,
            String username,
            String correlationId,
            Object requestBody) {
        LOGGER.info(
                "IDCS HTTP request: operation={} method={} endpoint={} correlationId={} usernameFp={} "
                        + "headers={Authorization=<redacted>} requestBody={}",
                operation,
                method,
                SafeProviderExchangeLog.endpoint(config.domainUrl(), path),
                SafeProviderExchangeLog.headerValue(correlationId),
                SafeDiagnosticFingerprint.of(username),
                SafeProviderExchangeLog.body(requestBody));
    }

    private static void logHttpResponse(
            String operation,
            int status,
            String correlationId,
            String providerEcId,
            Object responseBody) {
        LOGGER.info(
                "IDCS HTTP response: operation={} status={} correlationId={} providerEcId={} responseBody={}",
                operation,
                status,
                SafeProviderExchangeLog.headerValue(correlationId),
                SafeProviderExchangeLog.headerValue(providerEcId),
                SafeProviderExchangeLog.body(responseBody));
    }

    private Instant demoTokenExpiresAt(Object expiresIn) {
        long seconds = DEMO_DEFAULT_EXPIRES_IN_SECONDS;
        if (expiresIn != null) {
            if (expiresIn instanceof Number number) {
                double exactValue = number.doubleValue();
                seconds = number.longValue();
                if (!Double.isFinite(exactValue) || exactValue != seconds) {
                    throw new InvalidProviderResponseException();
                }
            } else if (expiresIn instanceof String string) {
                try {
                    seconds = Long.parseLong(string.trim());
                } catch (NumberFormatException invalidExpiry) {
                    throw new InvalidProviderResponseException(invalidExpiry);
                }
            } else {
                throw new InvalidProviderResponseException();
            }
            if (seconds <= 0) {
                throw new InvalidProviderResponseException();
            }
        }
        try {
            return clock.instant().plusSeconds(seconds);
        } catch (DateTimeException | ArithmeticException invalidExpiry) {
            throw new InvalidProviderResponseException(invalidExpiry);
        }
    }

    private DoctorIdentity projectProfileIdentity(Map<?, ?> profile) {
        String id = requiredProfileString(profile.get("id"));
        String username = firstProfileString(profile.get("userName"), profile.get("preferred_username"));
        if (username == null) {
            throw new InvalidProviderResponseException();
        }
        String displayName = firstProfileString(profile.get("displayName"), formattedName(profile.get("name")));
        return new DoctorIdentity(id, username, displayName, null, id);
    }

    private static Object formattedName(Object name) {
        if (name instanceof Map<?, ?> structuredName) {
            return structuredName.get("formatted");
        }
        return name;
    }

    private static String requiredProfileString(Object value) {
        String string = firstProfileString(value);
        if (string == null) {
            throw new InvalidProviderResponseException();
        }
        return string;
    }

    private static String firstProfileString(Object... values) {
        for (Object value : values) {
            if (value == null) {
                continue;
            }
            if (!(value instanceof String string)) {
                throw new InvalidProviderResponseException();
            }
            String trimmed = string.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.length() > 256) {
                throw new InvalidProviderResponseException();
            }
            return trimmed;
        }
        return null;
    }

    private void validateJwtProfile(Jwt jwt) {
        Object algorithm = jwt.getHeaders().get("alg");
        Instant now = clock.instant();
        Duration skew = Duration.ofSeconds(config.clockSkewSeconds());
        if (!"RS256".equals(String.valueOf(algorithm))
                || jwt.getIssuer() == null
                || !config.issuer().equals(jwt.getIssuer().toString())
                || !jwt.getAudience().contains(config.audience())
                || !config.identityDomainValue().equals(stringClaim(jwt, config.identityDomainClaim()))
                || jwt.getExpiresAt() == null
                || !jwt.getExpiresAt().isAfter(now)
                || (jwt.getNotBefore() != null && jwt.getNotBefore().isAfter(now.plus(skew)))
                || (jwt.getIssuedAt() != null && jwt.getIssuedAt().isAfter(now.plus(skew)))) {
            throw new InvalidProviderResponseException();
        }
    }

    private DoctorIdentity projectIdentity(Jwt jwt) {
        String subject = required(jwt.getSubject());
        String username = required(stringClaim(jwt, config.usernameClaim()));
        String userGuid = required(stringClaim(jwt, config.userGuidClaim()));
        String displayName = optionalStringClaim(jwt, config.displayNameClaim());
        String organization = optionalStringClaim(jwt, config.organizationClaim());
        return new DoctorIdentity(subject, username, displayName, organization, userGuid);
    }

    private static String stringClaim(Jwt jwt, String name) {
        Object value = jwt.getClaims().get(name);
        if (!(value instanceof String string)) {
            throw new InvalidProviderResponseException();
        }
        return string;
    }

    private static String optionalStringClaim(Jwt jwt, String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        Object value = jwt.getClaims().get(name);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String string) || string.length() > 256) {
            throw new InvalidProviderResponseException();
        }
        return string;
    }

    private static String required(String value) {
        if (value == null || value.isBlank() || value.length() > 256) {
            throw new InvalidProviderResponseException();
        }
        return value;
    }

    private boolean isApprovedDoctor(DoctorIdentity identity) {
        RuntimeClient current = runtime.get();
        return current != null && (current.approvedDoctors().contains(identity.subject())
                || current.approvedDoctors().contains(AuthenticationService.normalizeUsername(identity.username())));
    }

    private Mono<ProviderTokenResponse> tokenResponse(HttpStatusCode status, Mono<Map> body) {
        if (status.is2xxSuccessful()) {
            return body.switchIfEmpty(Mono.error(new InvalidProviderResponseException()))
                    .map(values -> new ProviderTokenResponse(
                            scalar(values.get("access_token")),
                            optionalScalar(values.get("token_type")),
                            values.get("refresh_token"),
                            values.get("expires_in")));
        }
        if (status.value() == 400) {
            return body.defaultIfEmpty(Map.of())
                    .flatMap(values -> {
                        Object error = values.get("error");
                        LOGGER.warn("IDCS token request failed: status=400 errorCode={}",
                                error instanceof String ? error : "not_provided");
                        if ("invalid_grant".equals(error)) {
                            return passwordChangeRequired(values.get("error_description"))
                                    ? Mono.error(new PasswordChangeRequiredException())
                                    : Mono.error(new AuthenticationRejectedException());
                        }
                        return Mono.error(new ProviderUnavailableException());
                    });
        }
        LOGGER.warn("IDCS token request failed: status={}", status.value());
        return body.then(Mono.error(new ProviderUnavailableException()));
    }

    private RuntimeException translateFailure(Throwable failure) {
        if (failure instanceof PasswordChangeRequiredException passwordChangeRequired) {
            return passwordChangeRequired;
        }
        if (failure instanceof AuthenticationRejectedException rejected) {
            return rejected;
        }
        if (failure instanceof ProviderUnavailableException unavailable) {
            return unavailable;
        }
        if (failure instanceof InvalidProviderResponseException invalid) {
            return invalid;
        }
        if (failure instanceof WebClientRequestException || failure instanceof WebClientResponseException) {
            return new ProviderUnavailableException(failure);
        }
        return new InvalidProviderResponseException(failure);
    }

    private static boolean passwordChangeRequired(Object description) {
        return description instanceof String value
                && "You must change your password.".equalsIgnoreCase(value.trim());
    }

    private void applyBasicAuthentication(HttpHeaders headers) {
        byte[] secretBytes = readSecretBytes(Path.of(config.clientSecretFile()));
        try {
            int length = trimmedLength(secretBytes);
            String secret = new String(secretBytes, 0, length, StandardCharsets.UTF_8);
            headers.setBasicAuth(config.clientId(), secret, StandardCharsets.UTF_8);
        } finally {
            Arrays.fill(secretBytes, (byte) 0);
        }
    }

    private RuntimeClient runtimeClient(AuthenticationMode mode) {
        RuntimeClient current = runtime.get();
        if (current != null) {
            return current;
        }
        if (!config.enabled()) {
            throw new ProviderUnavailableException();
        }
        validateConfiguration(mode);
        HttpClient httpClient = HttpClient.create()
                .followRedirect(false)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, config.connectTimeoutMs())
                .responseTimeout(Duration.ofMillis(config.responseTimeoutMs()));
        if (!config.tlsVerify()) {
            LOGGER.warn("IDCS TLS certificate validation is disabled for DEMO_PROFILE; local demo use only");
            httpClient = withInsecureDemoTls(httpClient);
        }
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_PROVIDER_RESPONSE_BYTES))
                .build();
        WebClient webClient = WebClient.builder()
                .baseUrl(config.domainUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .exchangeStrategies(strategies)
                .build();
        ReactiveJwtDecoder decoder = mode == AuthenticationMode.STRICT_JWT
                ? strictJwtDecoder(webClient)
                : null;
        Set<String> approvedDoctors = mode == AuthenticationMode.STRICT_JWT
                ? loadApprovedDoctors()
                : Set.of();
        RuntimeClient built = new RuntimeClient(webClient, decoder, approvedDoctors);
        if (runtime.compareAndSet(null, built)) {
            return built;
        }
        return runtime.get();
    }

    private static HttpClient withInsecureDemoTls(HttpClient httpClient) {
        try {
            SslContext context = SslContextBuilder.forClient()
                    .trustManager(InsecureTrustManagerFactory.INSTANCE)
                    .build();
            return httpClient.secure(ssl -> ssl.sslContext(context));
        } catch (SSLException failure) {
            throw new ProviderUnavailableException(failure);
        }
    }

    private ReactiveJwtDecoder strictJwtDecoder(WebClient webClient) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withJwkSetUri(config.jwksUri())
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .webClient(webClient)
                .build();
        JwtTimestampValidator timestamp = new JwtTimestampValidator(Duration.ofSeconds(config.clockSkewSeconds()));
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience().contains(config.audience())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Audience rejected", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestamp,
                new JwtIssuerValidator(config.issuer()),
                audience));
        return decoder;
    }

    private AuthenticationMode authenticationMode() {
        try {
            return AuthenticationMode.valueOf(config.authenticationMode().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException invalidMode) {
            throw new ProviderUnavailableException(invalidMode);
        }
    }

    void validateConfiguration() {
        validateConfiguration(authenticationMode());
    }

    private void validateConfiguration(AuthenticationMode mode) {
        requireConfigured(config.authenticationMode());
        requireConfigured(config.domainUrl());
        requireConfigured(config.tokenPath());
        requireConfigured(config.clientId());
        requireConfigured(config.clientSecretFile());
        requireConfigured(config.scope());
        if (config.connectTimeoutMs() == null || config.connectTimeoutMs() <= 0
                || config.responseTimeoutMs() == null || config.responseTimeoutMs() <= 0
                || !isHttpsOrigin(config.domainUrl())
                || !"/oauth2/v1/token".equals(config.tokenPath())
                || !Files.isRegularFile(Path.of(config.clientSecretFile()))) {
            throw new ProviderUnavailableException();
        }
        if (mode == AuthenticationMode.DEMO_PROFILE) {
            if (!"/admin/v1/Me".equals(config.profilePath())) {
                throw new ProviderUnavailableException();
            }
            return;
        }
        if (!config.tlsVerify()) {
            throw new ProviderUnavailableException();
        }
        requireConfigured(config.issuer());
        requireConfigured(config.audience());
        requireConfigured(config.jwksUri());
        requireConfigured(config.identityDomainClaim());
        requireConfigured(config.identityDomainValue());
        requireConfigured(config.usernameClaim());
        requireConfigured(config.userGuidClaim());
        requireConfigured(config.approvedDoctorsFile());
        if (config.clockSkewSeconds() == null || config.clockSkewSeconds() < 0
                || !isHttpsUri(config.jwksUri())
                || !Files.isRegularFile(Path.of(config.approvedDoctorsFile()))) {
            throw new ProviderUnavailableException();
        }
    }

    private Set<String> loadApprovedDoctors() {
        Path path = Path.of(config.approvedDoctorsFile());
        if (!Files.isRegularFile(path)) {
            throw new ProviderUnavailableException();
        }
        try {
            Set<String> approved = new HashSet<>();
            for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
                String value = line.trim();
                if (!value.isEmpty() && !value.startsWith("#")) {
                    approved.add(value);
                    approved.add(AuthenticationService.normalizeUsername(value));
                }
            }
            if (approved.isEmpty()) {
                throw new ProviderUnavailableException();
            }
            return Set.copyOf(approved);
        } catch (IOException failure) {
            throw new ProviderUnavailableException(failure);
        }
    }

    private static boolean isHttpsOrigin(String value) {
        try {
            URI uri = URI.create(value);
            return isCleanHttpsUri(uri)
                    && (uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()));
        } catch (IllegalArgumentException invalid) {
            return false;
        }
    }

    private static boolean isHttpsUri(String value) {
        try {
            URI uri = URI.create(value);
            return isCleanHttpsUri(uri);
        } catch (IllegalArgumentException invalid) {
            return false;
        }
    }

    private static boolean isCleanHttpsUri(URI uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getRawUserInfo() == null
                && uri.getRawQuery() == null
                && uri.getRawFragment() == null;
    }

    private static void requireConfigured(String value) {
        if (value == null || value.isBlank()) {
            throw new ProviderUnavailableException();
        }
    }

    private static byte[] readSecretBytes(Path path) {
        try {
            return Files.readAllBytes(path);
        } catch (IOException failure) {
            throw new ProviderUnavailableException(failure);
        }
    }

    private static int trimmedLength(byte[] value) {
        int length = value.length;
        while (length > 0 && Character.isWhitespace(value[length - 1])) {
            length--;
        }
        if (length == 0) {
            throw new ProviderUnavailableException();
        }
        return length;
    }

    private static String scalar(Object value) {
        if (value instanceof String string && !string.isBlank()) {
            return string;
        }
        throw new InvalidProviderResponseException();
    }

    private static String optionalScalar(Object value) {
        return value == null ? null : scalar(value);
    }

    private static byte[] passwordGrantForm(String username, char[] password, String scope) {
        ZeroableByteArrayOutputStream body = new ZeroableByteArrayOutputStream(256 + password.length * 3);
        ascii(body, "grant_type=password&username=");
        urlEncode(body, StandardCharsets.UTF_8.encode(username));
        ascii(body, "&password=");
        ByteBuffer passwordBytes = StandardCharsets.UTF_8.encode(CharBuffer.wrap(password));
        try {
            urlEncode(body, passwordBytes);
        } finally {
            if (passwordBytes.hasArray()) {
                Arrays.fill(passwordBytes.array(), (byte) 0);
            } else {
                while (passwordBytes.hasRemaining()) {
                    passwordBytes.put(passwordBytes.position(), (byte) 0);
                    passwordBytes.position(passwordBytes.position() + 1);
                }
            }
        }
        ascii(body, "&scope=");
        urlEncode(body, StandardCharsets.UTF_8.encode(scope));
        return body.takeAndClear();
    }

    private static void ascii(ByteArrayOutputStream output, String value) {
        output.writeBytes(value.getBytes(StandardCharsets.US_ASCII));
    }

    private static void urlEncode(ByteArrayOutputStream output, ByteBuffer bytes) {
        final char[] hex = "0123456789ABCDEF".toCharArray();
        while (bytes.hasRemaining()) {
            int value = Byte.toUnsignedInt(bytes.get());
            if ((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z')
                    || (value >= '0' && value <= '9') || value == '-' || value == '.'
                    || value == '_' || value == '~') {
                output.write(value);
            } else {
                output.write('%');
                output.write(hex[value >>> 4]);
                output.write(hex[value & 0x0f]);
            }
        }
    }

    private static final class ZeroableByteArrayOutputStream extends ByteArrayOutputStream {
        private ZeroableByteArrayOutputStream(int capacity) {
            super(capacity);
        }

        private byte[] takeAndClear() {
            byte[] result = toByteArray();
            Arrays.fill(buf, (byte) 0);
            reset();
            return result;
        }
    }

    record RuntimeClient(
            WebClient webClient,
            ReactiveJwtDecoder decoder,
            Set<String> approvedDoctors) {
    }

    private record ProviderTokenResponse(
            String accessToken,
            String tokenType,
            Object refreshToken,
            Object expiresIn) {
    }
}
