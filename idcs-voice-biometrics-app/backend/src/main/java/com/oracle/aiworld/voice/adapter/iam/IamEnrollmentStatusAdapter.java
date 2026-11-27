package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.config.AiWorldProperties;
import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import com.oracle.aiworld.voice.auth.SecretStore;
import com.oracle.aiworld.voice.auth.SecretStore.SecretHandle;
import com.oracle.aiworld.voice.auth.SecretStore.TokenLease;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.IdentityProviderPort.SecretMaterial;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentInitiation;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentAuthorization;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentCompletion;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort.EnrollmentUnavailableException;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationAuthorization;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationCompletion;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort.VerificationUnavailableException;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.FailureKind;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.VoiceUnenrollmentException;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort.StatusUnavailableException;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult;
import com.oracle.aiworld.voice.domain.unenrollment.VoiceUnenrollmentResult.Outcome;
import com.oracle.aiworld.voice.security.SafeDiagnosticFingerprint;
import com.oracle.aiworld.voice.security.SafeProviderExchangeLog;
import io.netty.channel.ChannelOption;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.TrustManagerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

@Component
public class IamEnrollmentStatusAdapter implements
        EnrollmentStatusPort, IamVoiceEnrollmentPort, IamVoiceVerificationPort,
        IamVoiceUnenrollmentPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(IamEnrollmentStatusAdapter.class);
    private static final int MAX_PROVIDER_RESPONSE_BYTES = 128 * 1024;
    private static final Pattern SAFE_USER_GUID = Pattern.compile("^[A-Za-z0-9_-]{1,256}$");
    private static final Pattern SAFE_DIAGNOSTIC_VALUE = Pattern.compile("^[A-Za-z0-9_.-]{1,128}$");
    private static final Pattern SAFE_PROVIDER_ECID =
            Pattern.compile("^[A-Za-z0-9._:;=+/@^\\-]{1,256}$");
    private static final String PROVIDER_ECID_HEADER = "X-ORACLE-DMS-ECID";

    private final Iam config;
    private final Clock clock;
    private final SecretStore secretStore;
    private final AtomicReference<RuntimeClient> runtime = new AtomicReference<>();

    @Autowired
    public IamEnrollmentStatusAdapter(AiWorldProperties properties, Clock clock, SecretStore secretStore) {
        this.config = properties.iam();
        this.clock = clock;
        this.secretStore = secretStore;
    }

    IamEnrollmentStatusAdapter(Iam config, Clock clock, SecretStore secretStore, WebClient webClient) {
        this.config = config;
        this.clock = clock;
        this.secretStore = secretStore;
        this.runtime.set(new RuntimeClient(
                webClient,
                new IamFactorResponseMapper(config),
                new IamVoiceFactorResolver(config)));
    }

    @Override
    public Mono<EnrollmentObservation> lookup(String userGuid, String correlationId) {
        return Mono.defer(() -> {
            if (userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()) {
                logFailure(correlationId, "USER_GUID_VALIDATION", null, "invalid_shape");
                return Mono.error(new StatusUnavailableException());
            }
            RuntimeClient client;
            try {
                client = runtimeClient();
            } catch (RuntimeException failure) {
                logFailure(correlationId, "CLIENT_CONFIGURATION", null, failureKind(failure));
                throw failure;
            }
            return requestServiceToken(client.webClient(), correlationId)
                    .flatMap(handle -> requestFactorStatus(client.webClient(), handle, userGuid, correlationId))
                    .flatMap(payload -> mapFactorStatus(client.mapper(), payload, correlationId))
                    .map(status -> new EnrollmentObservation(status, clock.instant()))
                    .doOnNext(observation -> LOGGER.info(
                            "IAM enrollment status resolved: correlationId={} status={}",
                            diagnosticValue(correlationId),
                            observation.status()))
                    .onErrorMap(this::translateFailure);
        });
    }

    @Override
    public Mono<VoiceUnenrollmentResult> deleteCurrentVoiceFactor(
            String subject,
            String idempotencyKey,
            String correlationId) {
        return Mono.defer(() -> {
            if (!config.unenrollmentEnabled()
                    || subject == null || !SAFE_USER_GUID.matcher(subject).matches()
                    || idempotencyKey == null || !SAFE_DIAGNOSTIC_VALUE.matcher(idempotencyKey).matches()) {
                return Mono.error(new VoiceUnenrollmentException(FailureKind.DEPENDENCY_UNAVAILABLE));
            }
            RuntimeClient client;
            try {
                client = runtimeClient();
            } catch (RuntimeException failure) {
                return Mono.error(unenrollmentFailure(failure));
            }
            return freshFactorList(client.webClient(), subject, correlationId)
                    .flatMap(payload -> {
                        IamVoiceFactorResolver.Resolution resolution =
                                client.voiceFactorResolver().resolve(payload, subject);
                        if (resolution instanceof IamVoiceFactorResolver.Absent) {
                            return Mono.just(new VoiceUnenrollmentResult(
                                    Outcome.ALREADY_NOT_ENROLLED, clock.instant()));
                        }
                        IamVoiceFactorResolver.Resolved resolved =
                                (IamVoiceFactorResolver.Resolved) resolution;
                        return deleteAndReconcile(
                                client.webClient(), client.voiceFactorResolver(), resolved.handle(),
                                subject, correlationId);
                    })
                    .doOnNext(result -> LOGGER.info(
                            "IAM voice unenrollment reconciled: correlationId={} outcome={}",
                            diagnosticValue(correlationId), result.outcome()))
                    .onErrorMap(this::unenrollmentFailure);
        });
    }

    private Mono<Object> freshFactorList(
            WebClient webClient,
            String userGuid,
            String correlationId) {
        return requestServiceToken(webClient, correlationId)
                .flatMap(handle -> requestFactorStatus(
                        webClient, handle, userGuid, correlationId));
    }

    private Mono<VoiceUnenrollmentResult> deleteAndReconcile(
            WebClient webClient,
            IamVoiceFactorResolver resolver,
            IamVoiceFactorResolver.VoiceFactorHandle factor,
            String userGuid,
            String correlationId) {
        return Mono.using(
                () -> factor,
                handle -> requestFactorDelete(webClient, handle, userGuid, correlationId)
                        .flatMap(disposition -> freshFactorList(webClient, userGuid, correlationId)
                                .flatMap(payload -> {
                                    IamVoiceFactorResolver.Resolution post =
                                            resolver.resolve(payload, userGuid);
                                    if (post instanceof IamVoiceFactorResolver.Absent) {
                                        return Mono.just(new VoiceUnenrollmentResult(
                                                Outcome.DELETED, clock.instant()));
                                    }
                                    if (post instanceof IamVoiceFactorResolver.Resolved resolved) {
                                        resolved.handle().close();
                                    }
                                    FailureKind kind = switch (disposition) {
                                        case LAST_ACTIVE_FACTOR -> FailureKind.LAST_ACTIVE_FACTOR;
                                        case REJECTED -> FailureKind.DEPENDENCY_FAILURE;
                                        default -> FailureKind.OUTCOME_UNCONFIRMED;
                                    };
                                    return Mono.error(new VoiceUnenrollmentException(kind));
                                })),
                IamVoiceFactorResolver.VoiceFactorHandle::close);
    }

    private Mono<DeleteDisposition> requestFactorDelete(
            WebClient webClient,
            IamVoiceFactorResolver.VoiceFactorHandle factor,
            String userGuid,
            String correlationId) {
        return requestServiceToken(webClient, correlationId)
                .flatMap(handle -> Mono.defer(() -> {
                    TokenLease lease = secretStore.lease(handle)
                            .orElseThrow(() -> new VoiceUnenrollmentException(
                                    FailureKind.DEPENDENCY_UNAVAILABLE));
                    char[] factorId = factor.copyValue();
                    String factorIdValue = new String(factorId);
                    LOGGER.info(
                            "IAM HTTP request: operation=FACTOR_DELETE method=DELETE endpoint={} "
                                    + "correlationId={} factorIdFp={} headers={Authorization=<redacted>, "
                                    + "X-Correlation-ID={}, Content-Type=application/json}",
                            SafeProviderExchangeLog.endpoint(
                                    config.secureDomainUrl(), config.factorResourcePath()),
                            diagnosticValue(correlationId),
                            SafeDiagnosticFingerprint.of(factorIdValue),
                            diagnosticValue(correlationId));
                    return Mono.using(
                            () -> lease,
                            token -> webClient.delete()
                                    .uri(config.factorResourcePath(), userGuid, factorIdValue)
                                    .headers(headers -> {
                                        headers.setBearerAuth(new String(token.accessToken()));
                                        headers.set("X-Correlation-ID", correlationId);
                                        headers.setContentType(MediaType.APPLICATION_JSON);
                                    })
                                    .accept(MediaType.APPLICATION_JSON)
                                    .exchangeToMono(response -> {
                                        int status = response.statusCode().value();
                                        String responseEcId = response.headers().asHttpHeaders()
                                                .getFirst(PROVIDER_ECID_HEADER);
                                        return response.bodyToMono(Map.class)
                                                .defaultIfEmpty(Map.of())
                                                .map(values -> withProviderEcId(values, responseEcId))
                                                .doOnNext(values -> {
                                                    logHttpResponse(
                                                            "FACTOR_DELETE", status,
                                                            correlationId, values);
                                                    if (!response.statusCode().is2xxSuccessful()) {
                                                        logFailure(
                                                                correlationId, "FACTOR_DELETE",
                                                                status, providerCode(values),
                                                                providerEcId(values));
                                                    }
                                                })
                                                .map(values -> {
                                                    if (response.statusCode().is2xxSuccessful()) {
                                                        return DeleteDisposition.ACCEPTED;
                                                    }
                                                    if (status == 404) {
                                                        return DeleteDisposition.NOT_FOUND;
                                                    }
                                                    if (status == 400
                                                            && "AUTH-1143".equals(providerCode(values))) {
                                                        return DeleteDisposition.LAST_ACTIVE_FACTOR;
                                                    }
                                                    return DeleteDisposition.REJECTED;
                                                });
                                    }),
                            TokenLease::close)
                            .doFinally(ignored -> {
                                Arrays.fill(factorId, '\0');
                                secretStore.destroy(handle);
                            });
                }))
                .onErrorResume(failure -> {
                    logTransportFailure(correlationId, "FACTOR_DELETE", failure);
                    return Mono.just(DeleteDisposition.AMBIGUOUS);
                });
    }

    private VoiceUnenrollmentException unenrollmentFailure(Throwable failure) {
        if (failure instanceof VoiceUnenrollmentException expected) {
            return expected;
        }
        FailureKind kind = failure instanceof StatusUnavailableException
                ? FailureKind.DEPENDENCY_UNAVAILABLE
                : FailureKind.DEPENDENCY_FAILURE;
        return new VoiceUnenrollmentException(kind, failure);
    }

    private enum DeleteDisposition {
        ACCEPTED,
        NOT_FOUND,
        LAST_ACTIVE_FACTOR,
        REJECTED,
        AMBIGUOUS
    }

    @Override
    public Mono<EnrollmentInitiation> beginEnrollment(String userGuid, String locale, String correlationId) {
        return Mono.defer(() -> {
            if (!config.enrollmentEnabled()
                    || userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()
                    || locale == null || !locale.matches("^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")) {
                return Mono.error(new EnrollmentUnavailableException());
            }
            RuntimeClient client = runtimeClient();
            Map<String, Object> request = Map.of("method", "VOICE_BIOMETRIC");
            return requestServiceToken(client.webClient(), correlationId)
                    .flatMap(handle -> exchangeJson(
                            client.webClient(), handle, HttpMethod.POST,
                            config.factorStatusPath(), new Object[] {userGuid},
                            "ENROLLMENT_INITIATION", request, correlationId))
                    .map(IamEnrollmentResponseMapper::map)
                    .onErrorMap(failure -> failure instanceof EnrollmentUnavailableException
                            ? failure
                            : new EnrollmentUnavailableException(failure));
        });
    }

    @Override
    public Mono<EnrollmentAuthorization> createEnrollmentSession(
            String userGuid,
            String factorId,
            String requestState,
            String correlationId) {
        return Mono.defer(() -> {
            if (!config.enrollmentEnabled()
                    || userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()
                    || factorId == null || factorId.isBlank()
                    || requestState == null || requestState.isBlank()) {
                return Mono.error(new EnrollmentUnavailableException());
            }
            RuntimeClient client = runtimeClient();
            Map<String, Object> request = enrollmentSessionRequest(requestState);
            return requestServiceToken(client.webClient(), correlationId)
                    .flatMap(handle -> exchangeJson(
                            client.webClient(), handle, HttpMethod.PATCH,
                            config.factorResourcePath(), new Object[] {userGuid, factorId},
                            "ENROLLMENT_SESSION", request, correlationId))
                    .map(response -> mapEnrollmentSession(
                            response, userGuid, factorId, correlationId))
                    .onErrorMap(failure -> failure instanceof EnrollmentUnavailableException
                            ? failure
                            : new EnrollmentUnavailableException(failure));
        });
    }

    @Override
    public Mono<EnrollmentCompletion> completeEnrollment(
            String userGuid,
            String factorId,
            String requestState,
            String correlationId) {
        return Mono.defer(() -> {
            if (!config.enrollmentEnabled()
                    || userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()
                    || factorId == null || factorId.isBlank()
                    || requestState == null || requestState.isBlank()) {
                return Mono.error(new EnrollmentUnavailableException());
            }
            RuntimeClient client = runtimeClient();
            Map<String, Object> request = enrollmentCompletionRequest(requestState);
            LOGGER.info(
                    "IAM enrollment completion requested: correlationId={} userGuidFp={} "
                            + "factorId={} requestStateFp={} status=COMPLETED",
                    diagnosticValue(correlationId),
                    SafeDiagnosticFingerprint.of(userGuid),
                    diagnosticValue(factorId),
                    SafeDiagnosticFingerprint.of(requestState));
            return requestServiceToken(client.webClient(), correlationId)
                    .flatMap(handle -> exchangeJson(
                            client.webClient(), handle, HttpMethod.PATCH,
                            config.factorResourcePath(), new Object[] {userGuid, factorId},
                            "ENROLLMENT_COMPLETION", request, correlationId))
                    .map(response -> mapEnrollmentCompletion(
                            response, factorId, correlationId))
                    .onErrorMap(failure -> failure instanceof EnrollmentUnavailableException
                            ? failure
                            : new EnrollmentUnavailableException(failure));
        });
    }

    @Override
    public Mono<VerificationAuthorization> authorizeVerification(
            String userGuid, String correlationId) {
        return Mono.defer(() -> {
            if (!config.enrollmentEnabled()
                    || userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()) {
                return Mono.error(new VerificationUnavailableException());
            }
            RuntimeClient client = runtimeClient();
            LOGGER.info(
                    "IAM voice verification authorization requested: correlationId={} userGuidFp={}",
                    diagnosticValue(correlationId), SafeDiagnosticFingerprint.of(userGuid));
            return freshFactorList(client.webClient(), userGuid, correlationId)
                    .flatMap(payload -> authorizeVerificationForFactor(
                            client, payload, userGuid, correlationId))
                    .doOnNext(authorization -> LOGGER.info(
                            "IAM ABIS verification session created: correlationId={} userGuidFp={} "
                                    + "factorId={} requestId={} requestStateFp={} securityTokenFp={}",
                            diagnosticValue(correlationId),
                            SafeDiagnosticFingerprint.of(authorization.userGuid()),
                            diagnosticValue(authorization.factorId()),
                            diagnosticValue(authorization.requestId()),
                            SafeDiagnosticFingerprint.of(authorization.requestState()),
                            SafeDiagnosticFingerprint.of(authorization.securityToken())))
                    .onErrorMap(failure -> failure instanceof VerificationUnavailableException
                            ? failure : new VerificationUnavailableException(failure));
        });
    }

    @Override
    public Mono<VerificationCompletion> completeVerification(
            String userGuid,
            String factorId,
            String requestId,
            String requestState,
            String correlationId) {
        return Mono.defer(() -> {
            if (!config.enrollmentEnabled()
                    || userGuid == null || !SAFE_USER_GUID.matcher(userGuid).matches()
                    || factorId == null || factorId.isBlank() || factorId.length() > 512
                    || requestId == null || requestId.isBlank() || requestId.length() > 512
                    || requestState == null || requestState.isBlank() || requestState.length() > 8192) {
                return Mono.error(new VerificationUnavailableException());
            }
            RuntimeClient client = runtimeClient();
            Map<String, Object> request = verificationCompletionRequest(requestState);
            LOGGER.info(
                    "IAM voice authentication completion requested: correlationId={} userGuidFp={} "
                            + "factorId={} requestId={} requestStateFp={} status=COMPLETED",
                    diagnosticValue(correlationId),
                    SafeDiagnosticFingerprint.of(userGuid),
                    diagnosticValue(factorId),
                    diagnosticValue(requestId),
                    SafeDiagnosticFingerprint.of(requestState));
            return requestServiceToken(client.webClient(), correlationId)
                    .flatMap(handle -> exchangeJson(
                            client.webClient(), handle, HttpMethod.PATCH,
                            config.verificationRequestItemPath(), new Object[] {requestId},
                            "VERIFICATION_COMPLETION", request, correlationId))
                    .map(response -> mapVerificationCompletion(
                            response, userGuid, factorId, requestId, correlationId))
                    .onErrorMap(failure -> failure instanceof VerificationUnavailableException
                            ? failure : new VerificationUnavailableException(failure));
        });
    }

    private Mono<VerificationAuthorization> authorizeVerificationForFactor(
            RuntimeClient client,
            Object payload,
            String userGuid,
            String correlationId) {
        final IamVoiceFactorResolver.Resolution resolution;
        try {
            resolution = client.voiceFactorResolver().resolve(payload, userGuid);
        } catch (RuntimeException failure) {
            return Mono.error(new VerificationUnavailableException(failure));
        }
        if (!(resolution instanceof IamVoiceFactorResolver.Resolved resolved)) {
            return Mono.error(new VerificationUnavailableException());
        }
        char[] factor = resolved.handle().copyValue();
        String factorId = new String(factor);
        Arrays.fill(factor, '\0');
        resolved.handle().close();
        Map<String, Object> request = verificationRequest(userGuid, factorId);
        return requestServiceToken(client.webClient(), correlationId)
                .flatMap(handle -> exchangeJson(
                        client.webClient(), handle, HttpMethod.POST,
                        config.verificationRequestPath(), new Object[0],
                        "VERIFICATION_AUTHORIZATION", request, correlationId))
                .map(response -> mapVerificationAuthorization(
                        response, userGuid, correlationId));
    }

    private static VerificationAuthorization mapVerificationAuthorization(
            Map<?, ?> response,
            String expectedUserGuid,
            String correlationId) {
        String shapeFailure = IamVerificationAuthorizationMapper.failureCode(response);
        if (shapeFailure != null) {
            String code = "provider_rejected".equals(shapeFailure)
                    ? providerCode(response) : shapeFailure;
            LOGGER.warn(
                    "IAM verification response rejected: correlationId={} responseStatus={} "
                            + "factorStatus={} method={} scenario={} userGuidPresent={} "
                            + "factorIdPresent={} requestIdPresent={} requestStatePresent={} "
                            + "securityTokenPresent={}",
                    diagnosticValue(correlationId),
                    diagnosticValue(response.get("status")),
                    diagnosticValue(response.get("factorStatus")),
                    diagnosticValue(response.get("method")),
                    diagnosticValue(response.get("scenario")),
                    presentString(response.get("userGUID")),
                    presentString(response.get("factorId")),
                    presentString(response.get("requestId")),
                    presentString(response.get("requestState")),
                    presentString(response.get("securityToken")));
            logFailure(correlationId, "VERIFICATION_AUTHORIZATION_RESPONSE", null,
                    code, providerEcId(response));
            throw new VerificationUnavailableException();
        }
        VerificationAuthorization authorization = IamVerificationAuthorizationMapper.map(response);
        if (!authorization.userGuid().equalsIgnoreCase(expectedUserGuid)) {
            authorization.close();
            logFailure(correlationId, "VERIFICATION_AUTHORIZATION_RESPONSE", null,
                    "authorization_user_mismatch");
            throw new VerificationUnavailableException();
        }
        LOGGER.info(
                "IAM voice verification authorization accepted: correlationId={} providerEcId={}",
                diagnosticValue(correlationId), diagnosticEcId(providerEcId(response)));
        return authorization;
    }

    private static boolean presentString(Object value) {
        return value instanceof String text && !text.isBlank();
    }

    static Map<String, Object> verificationRequest(String userGuid, String factorId) {
        return Map.of(
                "userId", userGuid,
                "userIdType", "USER_GUID",
                "factorId", factorId,
                "method", "VOICE_BIOMETRIC");
    }

    static Map<String, Object> verificationCompletionRequest(String requestState) {
        return Map.of(
                "status", "COMPLETED",
                "requestState", requestState);
    }

    static Map<String, Object> enrollmentSessionRequest(String requestState) {
        return Map.of(
                "action", "ACCEPTED",
                "requestState", requestState);
    }

    static Map<String, Object> enrollmentCompletionRequest(String requestState) {
        return Map.of(
                "status", "COMPLETED",
                "requestState", requestState);
    }

    private static EnrollmentCompletion mapEnrollmentCompletion(
            Map<?, ?> response,
            String factorId,
            String correlationId) {
        String failureCode = IamEnrollmentCompletionMapper.failureCode(response);
        if (failureCode != null) {
            logFailure(correlationId, "ENROLLMENT_COMPLETION_RESPONSE", null, failureCode);
            throw new EnrollmentUnavailableException();
        }
        EnrollmentCompletion completion = IamEnrollmentCompletionMapper.map(response);
        LOGGER.info(
                "IAM enrollment completion acknowledged: correlationId={} factorId={} status=success",
                diagnosticValue(correlationId),
                diagnosticValue(factorId));
        return completion;
    }

    private static VerificationCompletion mapVerificationCompletion(
            Map<?, ?> response,
            String userGuid,
            String factorId,
            String requestId,
            String correlationId) {
        String failureCode = IamVerificationCompletionMapper.failureCode(response);
        if (failureCode != null) {
            String code = "provider_status_not_success".equals(failureCode)
                    ? providerCode(response) : failureCode;
            logFailure(correlationId, "VERIFICATION_COMPLETION_RESPONSE", null,
                    code, providerEcId(response));
            throw new VerificationUnavailableException();
        }
        VerificationCompletion completion = IamVerificationCompletionMapper.map(
                response, userGuid, factorId);
        LOGGER.info(
                "IAM voice authentication completed: correlationId={} userGuidFp={} "
                        + "factorId={} requestId={} status=success providerEcId={}",
                diagnosticValue(correlationId),
                SafeDiagnosticFingerprint.of(completion.userGuid()),
                diagnosticValue(completion.factorId()),
                diagnosticValue(requestId),
                diagnosticEcId(providerEcId(response)));
        return completion;
    }

    private static EnrollmentAuthorization mapEnrollmentSession(
            Map<?, ?> response,
            String expectedUserGuid,
            String expectedFactorId,
            String correlationId) {
        String shapeFailure = IamEnrollmentAuthorizationMapper.failureCode(response);
        if (shapeFailure != null) {
            logFailure(correlationId, "ENROLLMENT_SESSION_RESPONSE", null, shapeFailure);
            throw new EnrollmentUnavailableException();
        }
        EnrollmentAuthorization authorization = IamEnrollmentAuthorizationMapper.map(
                response, expectedUserGuid);
        if (!authorization.userGuid().equalsIgnoreCase(expectedUserGuid)
                || !authorization.factorId().equals(expectedFactorId)) {
            logFailure(correlationId, "ENROLLMENT_SESSION_RESPONSE", null,
                    "authorization_correlation_mismatch");
            throw new EnrollmentUnavailableException();
        }
        String securityToken = (String) response.get("securityToken");
        String requestState = (String) response.get("requestState");
        Object responseBaseUrl = response.get("baseUrl");
        String baseUrlFingerprint = responseBaseUrl instanceof String baseUrl && !baseUrl.isBlank()
                ? SafeDiagnosticFingerprint.of(normalizedEndpoint(baseUrl)) : "not_supplied";
        LOGGER.info(
                "IAM ABIS session created: correlationId={} userGuidFp={} factorId={} "
                        + "requestStateFp={} securityTokenFp={} tokenLength={} tokenSegments={} "
                        + "responseBaseUrlPresent={} responseBaseUrl={} responseBaseUrlFp={}",
                diagnosticValue(correlationId),
                SafeDiagnosticFingerprint.of(authorization.userGuid()),
                diagnosticValue(response.get("factorId")),
                SafeDiagnosticFingerprint.of(requestState),
                SafeDiagnosticFingerprint.of(securityToken),
                securityToken.length(),
                SafeDiagnosticFingerprint.dotSeparatedSegments(securityToken),
                responseBaseUrl instanceof String baseUrl && !baseUrl.isBlank(),
                sanitizedEndpoint(responseBaseUrl),
                baseUrlFingerprint);
        return authorization;
    }

    private static String normalizedEndpoint(String value) {
        String normalized = value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static String sanitizedEndpoint(Object value) {
        if (!(value instanceof String endpoint) || endpoint.isBlank()) return "not_supplied";
        try {
            URI uri = URI.create(endpoint.trim());
            if (uri.getScheme() == null || uri.getHost() == null) return "invalid";
            String port = uri.getPort() < 0 ? "" : ":" + uri.getPort();
            String path = uri.getRawPath() == null ? "" : uri.getRawPath();
            return uri.getScheme() + "://" + uri.getHost() + port + path;
        } catch (IllegalArgumentException invalid) {
            return "invalid";
        }
    }

    private Mono<SecretHandle> requestServiceToken(WebClient webClient, String correlationId) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "tls_client_auth");
        form.add("client_id", config.serviceClientId());
        form.add("scope", config.serviceScope());
        logHttpRequest(
                "SERVICE_TOKEN",
                "POST",
                config.serviceTokenPath(),
                correlationId,
                Map.of(
                        "grant_type", "tls_client_auth",
                        "client_id", config.serviceClientId(),
                        "scope", config.serviceScope(),
                        "client_certificate", "configured"));
        return webClient.post()
                .uri(config.serviceTokenPath())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(BodyInserters.fromFormData(form))
                .exchangeToMono(response -> {
                    int status = response.statusCode().value();
                    String responseEcId = response.headers().asHttpHeaders()
                            .getFirst(PROVIDER_ECID_HEADER);
                    return response.bodyToMono(Map.class)
                            .defaultIfEmpty(Map.of())
                            .flatMap(values -> {
                                Map loggedValues = withProviderEcId(values, responseEcId);
                                logHttpResponse("SERVICE_TOKEN", status, correlationId, loggedValues);
                                if (response.statusCode().is2xxSuccessful()) {
                                    return Mono.just(loggedValues);
                                }
                                logFailure(correlationId, "SERVICE_TOKEN", status,
                                        providerCode(loggedValues), providerEcId(loggedValues));
                                return Mono.error(new StatusUnavailableException());
                            });
                })
                .map(values -> requireBearerServiceToken(values, clock.instant()))
                .map(material -> {
                    try (material) {
                        return secretStore.put(material);
                    }
                })
                .doOnError(failure -> logTransportFailure(correlationId, "SERVICE_TOKEN", failure));
    }

    private Mono<Object> requestFactorStatus(
            WebClient webClient,
            SecretHandle handle,
            String userGuid,
            String correlationId) {
        return Mono.defer(() -> {
            TokenLease lease = secretStore.lease(handle).orElseThrow(StatusUnavailableException::new);
            logHttpRequest(
                    "FACTOR_STATUS",
                    "GET",
                    config.factorStatusPath(),
                    correlationId,
                    Map.of("userGuid", userGuid, "authorization", "Bearer credential"));
            return Mono.using(
                    () -> lease,
                    token -> webClient.get()
                            .uri(config.factorStatusPath(), userGuid)
                            .headers(headers -> {
                                headers.setBearerAuth(new String(token.accessToken()));
                                headers.set("X-Correlation-ID", correlationId);
                            })
                            .accept(MediaType.APPLICATION_JSON)
                            .exchangeToMono(response -> {
                                int status = response.statusCode().value();
                                String responseEcId = response.headers().asHttpHeaders()
                                        .getFirst(PROVIDER_ECID_HEADER);
                                if (response.statusCode().is2xxSuccessful()) {
                                    return response.bodyToMono(Object.class)
                                            .defaultIfEmpty(Map.of())
                                            .map(values -> values instanceof Map map
                                                    ? withProviderEcId(map, responseEcId)
                                                    : values)
                                            .doOnNext(values -> logHttpResponse(
                                                    "FACTOR_STATUS", status, correlationId, values));
                                }
                                return response.bodyToMono(Map.class)
                                        .defaultIfEmpty(Map.of())
                                        .map(values -> withProviderEcId(values, responseEcId))
                                        .flatMap(values -> {
                                            logHttpResponse("FACTOR_STATUS", status, correlationId, values);
                                            if (status == 401 && isNoFactorFound(values)) {
                                                return Mono.just(Map.of(
                                                        "status", "success",
                                                        config.factorUserGuidField(), userGuid,
                                                        "factors", List.of()));
                                            }
                                            logFailure(correlationId, "FACTOR_STATUS", status, providerCode(values));
                                            return Mono.error(new StatusUnavailableException());
                                        });
                            }),
                    TokenLease::close);
        }).doOnError(failure -> logTransportFailure(correlationId, "FACTOR_STATUS", failure))
                .doFinally(ignored -> secretStore.destroy(handle));
    }

    private Mono<EnrollmentStatus> mapFactorStatus(
            IamFactorResponseMapper mapper,
            Object payload,
            String correlationId) {
        try {
            return Mono.just(mapper.map(payload));
        } catch (RuntimeException failure) {
            logFailure(correlationId, "FACTOR_RESPONSE_MAPPING", null, failureKind(failure));
            return Mono.error(failure);
        }
    }

    private static void logTransportFailure(String correlationId, String stage, Throwable failure) {
        if (!(failure instanceof StatusUnavailableException)
                && !(failure instanceof EnrollmentUnavailableException)) {
            logFailure(correlationId, stage, null, failureKind(failure));
        }
    }

    private static void logFailure(String correlationId, String stage, Integer providerStatus, String providerCode) {
        logFailure(correlationId, stage, providerStatus, providerCode, null);
    }

    private static void logFailure(
            String correlationId,
            String stage,
            Integer providerStatus,
            String providerCode,
            String providerEcId) {
        LOGGER.warn(
                "IAM voice request failure: correlationId={} stage={} providerStatus={} "
                        + "providerCode={} providerEcId={}",
                diagnosticValue(correlationId),
                diagnosticValue(stage),
                providerStatus == null ? "not_available" : providerStatus,
                diagnosticValue(providerCode),
                diagnosticEcId(providerEcId));
    }

    static String providerEcId(Map<?, ?> values) {
        return safeProviderEcIdOrNull(values.get("ecId"));
    }

    static String providerCode(Map<?, ?> values) {
        String direct = diagnosticValueOrNull(values.get("error"));
        if (direct != null) {
            return direct;
        }
        Object causes = values.get("cause");
        if (causes instanceof List<?> list) {
            for (Object value : list) {
                if (value instanceof Map<?, ?> cause) {
                    String code = diagnosticValueOrNull(cause.get("code"));
                    if (code != null) {
                        return code;
                    }
                }
            }
        }
        return "not_provided";
    }

    private static String failureKind(Throwable failure) {
        return switch (failure.getClass().getSimpleName()) {
            case "WebClientRequestException" -> "transport_failure";
            case "StatusUnavailableException" -> "status_unavailable";
            default -> "unexpected_failure";
        };
    }

    private static String diagnosticValue(Object value) {
        String safe = diagnosticValueOrNull(value);
        return safe == null ? "redacted_or_missing" : safe;
    }

    private static String diagnosticValueOrNull(Object value) {
        if (value instanceof String text && SAFE_DIAGNOSTIC_VALUE.matcher(text).matches()) {
            return text;
        }
        return null;
    }

    private static String diagnosticEcId(String value) {
        String safe = safeProviderEcIdOrNull(value);
        return safe == null ? "redacted_or_missing" : safe;
    }

    private static String safeProviderEcIdOrNull(Object value) {
        if (value instanceof String text && SAFE_PROVIDER_ECID.matcher(text).matches()) {
            return text;
        }
        return null;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    static Map withProviderEcId(Map values, String responseHeaderEcId) {
        if (providerEcId(values) != null) return values;
        String safeHeader = safeProviderEcIdOrNull(responseHeaderEcId);
        if (safeHeader == null) return values;
        Map copy = new LinkedHashMap(values);
        copy.put("ecId", safeHeader);
        return copy;
    }

    @SuppressWarnings("rawtypes")
    private Mono<Map> exchangeJson(
            WebClient webClient,
            SecretHandle handle,
            HttpMethod method,
            String path,
            Object[] uriVariables,
            String operation,
            Map<String, Object> request,
            String correlationId) {
        return Mono.defer(() -> {
            TokenLease lease = secretStore.lease(handle).orElseThrow(EnrollmentUnavailableException::new);
            logHttpRequest(
                    operation,
                    method.name(),
                    path,
                    correlationId,
                    request);
            return Mono.using(
                    () -> lease,
                    token -> webClient.method(method)
                            .uri(path, uriVariables)
                            .headers(headers -> {
                                headers.setBearerAuth(new String(token.accessToken()));
                                headers.set("X-Correlation-ID", correlationId);
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .accept(MediaType.APPLICATION_JSON)
                            .bodyValue(request)
                            .exchangeToMono(response -> {
                                String responseEcId = response.headers().asHttpHeaders()
                                        .getFirst(PROVIDER_ECID_HEADER);
                                int status = response.statusCode().value();
                                return response.bodyToMono(Map.class)
                                        .defaultIfEmpty(Map.of())
                                        .map(values -> withProviderEcId(values, responseEcId))
                                        .flatMap(values -> {
                                            logHttpResponse(operation, status, correlationId, values);
                                            if (response.statusCode().is2xxSuccessful()) {
                                                return Mono.just(values);
                                            }
                                            logFailure(correlationId, operation, status,
                                                    providerCode(values), providerEcId(values));
                                            return Mono.error(new EnrollmentUnavailableException());
                                        });
                            }),
                    TokenLease::close);
        }).doOnError(failure -> logTransportFailure(correlationId, operation, failure))
                .doFinally(ignored -> secretStore.destroy(handle));
    }

    private void logHttpRequest(
            String operation,
            String method,
            String path,
            String correlationId,
            Object requestBody) {
        LOGGER.info(
                "IAM HTTP request: operation={} method={} endpoint={} correlationId={} "
                        + "headers={Authorization=<redacted>, X-Correlation-ID={}} requestBody={}",
                diagnosticValue(operation),
                method,
                SafeProviderExchangeLog.endpoint(config.secureDomainUrl(), path),
                diagnosticValue(correlationId),
                diagnosticValue(correlationId),
                SafeProviderExchangeLog.body(requestBody));
    }

    private static void logHttpResponse(
            String operation,
            int status,
            String correlationId,
            Object responseBody) {
        String providerEcId = responseBody instanceof Map<?, ?> values
                ? providerEcId(values) : null;
        LOGGER.info(
                "IAM HTTP response: operation={} status={} correlationId={} providerEcId={} responseBody={}",
                diagnosticValue(operation),
                status,
                diagnosticValue(correlationId),
                diagnosticEcId(providerEcId),
                SafeProviderExchangeLog.body(responseBody));
    }

    static boolean isNoFactorFound(Map<?, ?> values) {
        if (!"noFactorFound".equals(values.get("status")) || !(values.get("cause") instanceof List<?> causes)) {
            return false;
        }
        return causes.stream().anyMatch(value -> value instanceof Map<?, ?> cause
                && "AUTH-1131".equals(cause.get("code")));
    }

    static SecretMaterial requireBearerServiceToken(Map<?, ?> values, java.time.Instant issuedAt) {
        Object token = values.get("access_token");
        Object tokenType = values.get("token_type");
        Object expiresIn = values.get("expires_in");
        if (token instanceof String string && !string.isBlank()
                && "Bearer".equals(tokenType)
                && expiresIn instanceof Number duration
                && duration.longValue() > 0
                && duration.longValue() <= 86_400) {
            return new SecretMaterial(string.toCharArray(), null, issuedAt.plusSeconds(duration.longValue()));
        }
        throw new StatusUnavailableException();
    }

    private RuntimeException translateFailure(Throwable failure) {
        if (failure instanceof StatusUnavailableException unavailable) {
            return unavailable;
        }
        return new StatusUnavailableException(failure);
    }

    private RuntimeClient runtimeClient() {
        RuntimeClient existing = runtime.get();
        if (existing != null) {
            return existing;
        }
        validateConfiguration();
        try {
            KeyManagerFactory keyManagers = loadKeyManagers();
            SslContextBuilder sslBuilder = SslContextBuilder.forClient().keyManager(keyManagers);
            if (config.tlsVerify()) {
                sslBuilder.trustManager(loadTrustManagers());
            } else {
                LOGGER.warn("IAM TLS certificate validation is disabled; local demo use only");
                sslBuilder.trustManager(InsecureTrustManagerFactory.INSTANCE);
            }
            SslContext sslContext = sslBuilder.build();
            HttpClient httpClient = HttpClient.create()
                    .followRedirect(false)
                    .secure(ssl -> ssl.sslContext(sslContext))
                    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, config.connectTimeoutMs())
                    .responseTimeout(Duration.ofMillis(config.responseTimeoutMs()));
            WebClient webClient = WebClient.builder()
                    .baseUrl(config.secureDomainUrl())
                    .clientConnector(new ReactorClientHttpConnector(httpClient))
                    .exchangeStrategies(ExchangeStrategies.builder()
                            .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_PROVIDER_RESPONSE_BYTES))
                            .build())
                    .build();
            RuntimeClient built = new RuntimeClient(
                    webClient,
                    new IamFactorResponseMapper(config),
                    new IamVoiceFactorResolver(config));
            if (runtime.compareAndSet(null, built)) {
                return built;
            }
            return runtime.get();
        } catch (Exception failure) {
            throw new StatusUnavailableException(failure);
        }
    }

    private void validateConfiguration() {
        if ((!config.statusEnabled() && !config.enrollmentEnabled() && !config.unenrollmentEnabled())
                || !config.factorMappingApproved()) {
            throw new StatusUnavailableException();
        }
        for (String value : new String[] {
                config.secureDomainUrl(), config.serviceTokenPath(), config.serviceClientId(), config.serviceScope(),
                config.mtlsKeystoreFile(), config.mtlsKeystorePasswordFile(), config.mtlsKeystoreType(),
                config.mtlsTruststoreFile(), config.mtlsTruststorePasswordFile(), config.mtlsTruststoreType(),
                config.factorStatusPath(), config.verificationRequestPath(),
                config.verificationRequestItemPath(), config.factorsJsonPointer(), config.factorMethodField(),
                config.voiceMethodValue(), config.absentVoiceStatus(), config.factorResourcePath(),
                config.factorIdField(), config.factorUserGuidField()}) {
            if (value == null || value.isBlank()) {
                throw new StatusUnavailableException();
            }
        }
        if (!isHttpsUri(config.secureDomainUrl())
                || !"/oauth2/v1/token".equals(config.serviceTokenPath())
                || !"/mfa/v1/users/{userId}/factors".equals(config.factorStatusPath())
                || !"/mfa/v1/users/{userId}/factors/{factorId}".equals(config.factorResourcePath())
                || !"/mfa/v1/requests".equals(config.verificationRequestPath())
                || !"/mfa/v1/requests/{requestId}".equals(config.verificationRequestItemPath())
                || !config.factorsJsonPointer().startsWith("/")
                || config.connectTimeoutMs() == null || config.connectTimeoutMs() <= 0
                || config.responseTimeoutMs() == null || config.responseTimeoutMs() <= 0
                || !Set.of("NOT_ENROLLED", "UNAVAILABLE").contains(config.absentVoiceStatus())) {
            throw new StatusUnavailableException();
        }
        for (String file : new String[] {
                config.mtlsKeystoreFile(), config.mtlsKeystorePasswordFile(),
                config.mtlsTruststoreFile(), config.mtlsTruststorePasswordFile()}) {
            if (!Files.isRegularFile(Path.of(file))) {
                throw new StatusUnavailableException();
            }
        }
    }

    private KeyManagerFactory loadKeyManagers() throws Exception {
        char[] password = readPassword(Path.of(config.mtlsKeystorePasswordFile()));
        try {
            KeyStore store = loadStore(Path.of(config.mtlsKeystoreFile()), config.mtlsKeystoreType(), password);
            KeyManagerFactory factory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            factory.init(store, password);
            return factory;
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    private TrustManagerFactory loadTrustManagers() throws Exception {
        char[] password = readPassword(Path.of(config.mtlsTruststorePasswordFile()));
        try {
            KeyStore store = loadStore(Path.of(config.mtlsTruststoreFile()), config.mtlsTruststoreType(), password);
            TrustManagerFactory factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            factory.init(store);
            return factory;
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    private static KeyStore loadStore(Path path, String type, char[] password) throws Exception {
        KeyStore store = KeyStore.getInstance(type);
        try (InputStream input = Files.newInputStream(path)) {
            store.load(input, password);
        }
        return store;
    }

    private static char[] readPassword(Path path) throws IOException {
        byte[] bytes = Files.readAllBytes(path);
        try {
            int length = bytes.length;
            while (length > 0 && Character.isWhitespace(bytes[length - 1])) {
                length--;
            }
            if (length == 0) {
                throw new StatusUnavailableException();
            }
            return new String(bytes, 0, length, StandardCharsets.UTF_8).toCharArray();
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }

    private static boolean isHttpsUri(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && uri.getRawUserInfo() == null
                    && uri.getRawQuery() == null
                    && uri.getRawFragment() == null
                    && (uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()));
        } catch (IllegalArgumentException invalid) {
            return false;
        }
    }

    private record RuntimeClient(
            WebClient webClient,
            IamFactorResponseMapper mapper,
            IamVoiceFactorResolver voiceFactorResolver) {
    }
}
