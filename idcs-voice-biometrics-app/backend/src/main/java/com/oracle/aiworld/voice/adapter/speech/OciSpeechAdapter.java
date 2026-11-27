package com.oracle.aiworld.voice.adapter.speech;

import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import com.oracle.aiworld.voice.port.SpeechTranscriptionPort;
import com.oracle.aiworld.voice.port.VoiceBranchSession;
import com.oracle.aiworld.voice.security.SafeDiagnosticFingerprint;
import com.oracle.bmc.Region;
import com.oracle.bmc.aispeech.model.RealtimeMessageAckAudio;
import com.oracle.bmc.aispeech.model.RealtimeMessageConnect;
import com.oracle.bmc.aispeech.model.RealtimeMessageResult;
import com.oracle.bmc.aispeech.model.RealtimeMessageResultTranscription;
import com.oracle.bmc.aispeech.model.RealtimeMessageResultTranscriptionToken;
import com.oracle.bmc.aispeech.model.RealtimeParameters;
import com.oracle.bmc.aispeech.realtimespeech.RealtimeSpeechClient;
import com.oracle.bmc.aispeech.realtimespeech.RealtimeSpeechClientListener;
import com.oracle.bmc.auth.BasicAuthenticationDetailsProvider;
import com.oracle.bmc.auth.InstancePrincipalsAuthenticationDetailsProvider;
import com.oracle.bmc.auth.SessionTokenAuthenticationDetailsProvider;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.eclipse.jetty.websocket.client.WebSocketClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

/** OCI Realtime Speech boundary using session-token or OCI instance-principal authentication. */
@Component
public final class OciSpeechAdapter implements SpeechTranscriptionPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(OciSpeechAdapter.class);
    private static final int EVENT_REPLAY_LIMIT = 128;

    private final SpeechConfiguration configuration;
    private final RealtimeClientFactory clientFactory;

    @Autowired
    public OciSpeechAdapter(
            @Value("${ai-world.speech.enabled:false}") boolean enabled,
            @Value("${ai-world.speech.auth-mode:SESSION_TOKEN}") String authMode,
            @Value("${ai-world.speech.config-file:}") String configFile,
            @Value("${ai-world.speech.profile:DEFAULT}") String profile,
            @Value("${ai-world.speech.expected-tenancy-ocid:}") String expectedTenancyOcid,
            @Value("${ai-world.speech.region:}") String region,
            @Value("${ai-world.speech.compartment-ocid:}") String compartmentOcid,
            @Value("${ai-world.speech.realtime-endpoint:}") String realtimeEndpoint,
            @Value("${ai-world.speech.model-type:WHISPER}") String modelType,
            @Value("${ai-world.speech.model-domain:GENERIC}") String modelDomain,
            @Value("${ai-world.speech.language-code:en}") String languageCode,
            @Value("${ai-world.speech.encoding:audio/raw;rate=16000}") String encoding,
            @Value("${ai-world.speech.punctuation:AUTO}") String punctuation,
            @Value("${ai-world.speech.ack-enabled:true}") boolean ackEnabled,
            @Value("${ai-world.speech.stabilize-partial-results:NONE}") String stabilizePartialResults,
            @Value("${ai-world.speech.partial-silence-ms:0}") int partialSilenceMs,
            @Value("${ai-world.speech.final-silence-ms:300}") int finalSilenceMs,
            @Value("${ai-world.speech.readiness-timeout-ms:10000}") long readinessTimeoutMs,
            @Value("${ai-world.speech.drain-timeout-ms:10000}") long drainTimeoutMs) {
        this(new SpeechConfiguration(
                enabled, authMode, configFile, profile, expectedTenancyOcid, region,
                compartmentOcid, realtimeEndpoint, modelType, modelDomain, languageCode,
                encoding, punctuation, ackEnabled, stabilizePartialResults, partialSilenceMs,
                finalSilenceMs, readinessTimeoutMs, drainTimeoutMs), new OciRealtimeClientFactory());
    }

    OciSpeechAdapter(SpeechConfiguration configuration, RealtimeClientFactory clientFactory) {
        this.configuration = Objects.requireNonNull(configuration);
        this.clientFactory = Objects.requireNonNull(clientFactory);
        if (configuration.enabled() && !configuration.valid()) {
            throw new IllegalStateException("Invalid enabled OCI Speech configuration");
        }
    }

    @Override
    public boolean availableForLiveSession() {
        return configuration.valid();
    }

    @Override
    public Mono<VoiceBranchSession> open(OpenRequest request) {
        if (!availableForLiveSession()) {
            return Mono.error(new BranchUnavailableException("SPEECH_ADAPTER_NOT_READY", null));
        }
        if (!request.audioProfile().isCanonical()) {
            return Mono.error(new BranchUnavailableException("SPEECH_AUDIO_PROFILE_UNSUPPORTED", null));
        }

        return Mono.defer(() -> {
                    SpeechEventBridge bridge = new SpeechEventBridge(
                            request.voiceSessionId(), request.correlationId(),
                            configuration.isWhisper());
                    AtomicReference<RealtimeClient> opened = new AtomicReference<>();
                    return Mono.fromCallable(() -> {
                                RealtimeClient client = clientFactory.open(configuration, bridge);
                                opened.set(client);
                                bridge.attach(client);
                                return client;
                            })
                            .subscribeOn(Schedulers.boundedElastic())
                            .flatMap(client -> bridge.authenticatedReady()
                                    .timeout(Duration.ofMillis(configuration.readinessTimeoutMs()))
                                    .thenReturn((VoiceBranchSession) new SpeechBranch(
                                            client, bridge, configuration.drainTimeoutMs())))
                            .doOnSuccess(ignored -> LOGGER.info(
                                    "OCI Speech authenticated session ready: correlationId={} voiceSessionIdFp={}",
                                    request.correlationId(),
                                    SafeDiagnosticFingerprint.of(request.voiceSessionId())))
                            .doOnError(ignored -> closeQuietly(opened.get()));
                })
                .onErrorMap(failure -> failure instanceof BranchUnavailableException
                        ? failure
                        : speechUnavailable(request.correlationId(), failure));
    }

    record SpeechConfiguration(
            boolean enabled,
            String authMode,
            String configFile,
            String profile,
            String expectedTenancyOcid,
            String region,
            String compartmentOcid,
            String realtimeEndpoint,
            String modelType,
            String modelDomain,
            String languageCode,
            String encoding,
            String punctuation,
            boolean ackEnabled,
            String stabilizePartialResults,
            int partialSilenceMs,
            int finalSilenceMs,
            long readinessTimeoutMs,
            long drainTimeoutMs) {
        SpeechConfiguration {
            authMode = trim(authMode);
            configFile = trim(configFile);
            profile = trim(profile);
            expectedTenancyOcid = trim(expectedTenancyOcid);
            region = trim(region);
            compartmentOcid = trim(compartmentOcid);
            realtimeEndpoint = trim(realtimeEndpoint);
            modelType = trim(modelType);
            modelDomain = trim(modelDomain);
            languageCode = trim(languageCode);
            encoding = trim(encoding);
            punctuation = trim(punctuation);
            stabilizePartialResults = trim(stabilizePartialResults);
        }

        SpeechConfiguration withEndpoint(String endpoint) {
            return new SpeechConfiguration(
                    enabled, authMode, configFile, profile, expectedTenancyOcid, region,
                    compartmentOcid, endpoint, modelType, modelDomain, languageCode, encoding,
                    punctuation, ackEnabled, stabilizePartialResults, partialSilenceMs,
                    finalSilenceMs, readinessTimeoutMs, drainTimeoutMs);
        }

        SpeechConfiguration withAuthMode(String mode) {
            return new SpeechConfiguration(
                    enabled, mode, configFile, profile, expectedTenancyOcid, region,
                    compartmentOcid, realtimeEndpoint, modelType, modelDomain, languageCode,
                    encoding, punctuation, ackEnabled, stabilizePartialResults, partialSilenceMs,
                    finalSilenceMs, readinessTimeoutMs, drainTimeoutMs);
        }

        SpeechConfiguration withReadinessTimeout(long timeoutMs) {
            return new SpeechConfiguration(
                    enabled, authMode, configFile, profile, expectedTenancyOcid, region,
                    compartmentOcid, realtimeEndpoint, modelType, modelDomain, languageCode,
                    encoding, punctuation, ackEnabled, stabilizePartialResults, partialSilenceMs,
                    finalSilenceMs, timeoutMs, drainTimeoutMs);
        }

        boolean valid() {
            boolean sessionToken = "SESSION_TOKEN".equalsIgnoreCase(authMode);
            boolean instancePrincipal = "INSTANCE_PRINCIPAL".equalsIgnoreCase(authMode);
            boolean oracle = isOracle();
            boolean whisper = isWhisper();
            boolean compatibleModel = (oracle
                    && enumValue(modelDomain, "GENERIC", "MEDICAL")
                    && languageCode.matches("[a-z]{2}-[A-Z]{2}"))
                    || (whisper
                    && "GENERIC".equalsIgnoreCase(modelDomain)
                    && languageCode.matches("auto|[a-z]{2,3}"));
            return enabled
                    && (sessionToken || instancePrincipal)
                    && (!sessionToken || nonBlank(configFile, profile))
                    && nonBlank(compartmentOcid, modelType, modelDomain, languageCode, encoding,
                            punctuation)
                    && (realtimeEndpoint.isBlank() || secureOrigin(realtimeEndpoint))
                    && compatibleModel
                    && enumValue(punctuation, "NONE", "SPOKEN", "AUTO")
                    && (!oracle || (enumValue(stabilizePartialResults, "NONE", "LOW", "MEDIUM", "HIGH")
                    && partialSilenceMs >= 0
                    && finalSilenceMs >= 0))
                    && readinessTimeoutMs > 0
                    && drainTimeoutMs > 0;
        }

        boolean isOracle() {
            return "ORACLE".equalsIgnoreCase(modelType);
        }

        boolean isWhisper() {
            return "WHISPER".equalsIgnoreCase(modelType);
        }

        private static boolean secureOrigin(String endpoint) {
            try {
                URI uri = URI.create(endpoint);
                String path = uri.getRawPath();
                return "wss".equalsIgnoreCase(uri.getScheme())
                        && uri.getHost() != null
                        && uri.getRawUserInfo() == null
                        && uri.getRawQuery() == null
                        && uri.getRawFragment() == null
                        && (path == null || path.isBlank() || "/".equals(path));
            } catch (IllegalArgumentException ignored) {
                return false;
            }
        }

        private static boolean nonBlank(String... values) {
            return Arrays.stream(values).allMatch(value -> value != null && !value.isBlank());
        }

        private static boolean enumValue(String value, String... allowed) {
            return Arrays.stream(allowed).anyMatch(candidate -> candidate.equalsIgnoreCase(value));
        }

        private static String trim(String value) {
            return value == null ? "" : value.trim();
        }
    }

    static RealtimeParameters parameters(SpeechConfiguration configuration) {
        return OciRealtimeClientFactory.parameters(configuration);
    }

    record ProviderTranscript(
            String providerSessionId,
            String text,
            boolean finalResult,
            int startTimeMs,
            int endTimeMs,
            Float confidence,
            List<ProviderToken> tokens) {
        ProviderTranscript {
            tokens = tokens == null ? List.of() : List.copyOf(tokens);
        }

        ProviderTranscript(
                String providerSessionId,
                String text,
                boolean finalResult,
                int startTimeMs,
                int endTimeMs,
                Float confidence) {
            this(providerSessionId, text, finalResult, startTimeMs, endTimeMs, confidence,
                    List.of());
        }
    }

    record ProviderToken(String text, int startTimeMs, int endTimeMs, String type) {
    }

    interface RealtimeClientFactory {
        RealtimeClient open(SpeechConfiguration configuration, RealtimeListener listener) throws Exception;
    }

    interface RealtimeClient extends AutoCloseable {
        void sendAudio(byte[] pcm) throws Exception;

        void requestFinalResult() throws Exception;

        @Override
        void close() throws Exception;
    }

    interface RealtimeListener {
        void onAuthenticatedReady(String providerSessionId);

        void onAcknowledgement(int number, int offset, int length);

        void onTranscript(ProviderTranscript transcript);

        void onFailure(Throwable failure);

        default void onClosed(int statusCode, String reason) {
        }
    }

    private static final class SpeechEventBridge implements RealtimeListener {
        private final String voiceSessionId;
        private final String correlationId;
        private final boolean finalOnly;
        private final Sinks.One<Void> ready = Sinks.one();
        private final Sinks.One<Void> finalResult = Sinks.one();
        private final Sinks.Many<VoiceBranchSession.BranchEvent> events =
                Sinks.many().replay().limit(EVENT_REPLAY_LIMIT);
        private final AtomicLong revision = new AtomicLong();
        private final AtomicBoolean terminal = new AtomicBoolean();
        private final AtomicBoolean closing = new AtomicBoolean();
        private final AtomicReference<RealtimeClient> client = new AtomicReference<>();
        private final Set<String> seenResults = new LinkedHashSet<>();
        private final Set<String> finalizedRanges = new LinkedHashSet<>();
        private final Map<Integer, Integer> pendingTranscriptEnds = new LinkedHashMap<>();
        private long sentAudioBytes;
        private int latestFinalEndMs;
        private boolean draining;

        private SpeechEventBridge(
                String voiceSessionId,
                String correlationId,
                boolean finalOnly) {
            this.voiceSessionId = voiceSessionId;
            this.correlationId = correlationId;
            this.finalOnly = finalOnly;
        }

        Mono<Void> authenticatedReady() {
            return ready.asMono();
        }

        Mono<Void> finalResult() {
            return finalResult.asMono();
        }

        synchronized void audioSent(int bytes) {
            sentAudioBytes = Math.addExact(sentAudioBytes, bytes);
        }

        synchronized void beginDrain() {
            draining = true;
            // A previous final can satisfy drain only if it covers all delivered PCM.
            // Otherwise wait for the final response to the new SEND_FINAL_RESULT request.
            if (sentAudioBytes == 0 || (pendingTranscriptEnds.isEmpty()
                    && latestFinalEndMs * 32L >= sentAudioBytes)) {
                finalResult.tryEmitEmpty();
            }
        }

        void drainTimedOut() {
            LOGGER.warn("OCI Speech final drain timed out: correlationId={} voiceSessionIdFp={}",
                    correlationId, SafeDiagnosticFingerprint.of(voiceSessionId));
        }

        Flux<VoiceBranchSession.BranchEvent> events() {
            return events.asFlux();
        }

        void beginClose() {
            closing.set(true);
        }

        void attach(RealtimeClient openedClient) {
            client.set(openedClient);
            if (terminal.get()) closeQuietly(openedClient);
        }

        @Override
        public void onAuthenticatedReady(String providerSessionId) {
            LOGGER.info(
                    "OCI Speech CONNECT received: correlationId={} voiceSessionIdFp={} providerSessionIdFp={}",
                    correlationId,
                    SafeDiagnosticFingerprint.of(voiceSessionId),
                    SafeDiagnosticFingerprint.of(providerSessionId));
            ready.tryEmitEmpty();
        }

        @Override
        public void onAcknowledgement(int number, int offset, int length) {
            events.tryEmitNext(new VoiceBranchSession.BranchEvent(
                    VoiceBranchSession.BranchEventType.ACKNOWLEDGED,
                    "SPEECH",
                    "AUDIO_ACKNOWLEDGED",
                    "SPEECH_AUDIO_ACKNOWLEDGED",
                    Map.of("packetNumber", number, "byteOffset", offset, "byteLength", length)));
        }

        @Override
        public synchronized void onTranscript(ProviderTranscript transcript) {
            if (transcript == null
                    || transcript.providerSessionId() == null
                    || transcript.providerSessionId().isBlank()
                    || transcript.text() == null
                    || transcript.text().isBlank()
                    || transcript.text().length() > 20_000
                    || transcript.startTimeMs() < 0
                    || transcript.endTimeMs() <= transcript.startTimeMs()) {
                LOGGER.warn(
                        "OCI Speech result ignored because it cannot be safely mapped: correlationId={} voiceSessionIdFp={}",
                        correlationId, SafeDiagnosticFingerprint.of(voiceSessionId));
                return;
            }
            if (finalOnly && !transcript.finalResult()) {
                LOGGER.debug(
                        "OCI Speech non-final result ignored for final-only model: correlationId={} voiceSessionIdFp={}",
                        correlationId, SafeDiagnosticFingerprint.of(voiceSessionId));
                return;
            }
            String range = transcript.startTimeMs() + ":" + transcript.endTimeMs();
            String resultKey = range + ':' + transcript.finalResult() + ':' + transcript.text();
            if (seenResults.contains(resultKey)
                    || (!transcript.finalResult() && finalizedRanges.contains(range))) {
                return;
            }
            boundAdd(seenResults, resultKey);
            if (transcript.finalResult()) {
                latestFinalEndMs = Math.max(latestFinalEndMs, transcript.endTimeMs());
                pendingTranscriptEnds.entrySet().removeIf(entry ->
                        entry.getKey() == transcript.startTimeMs()
                        || (entry.getKey() >= transcript.startTimeMs()
                            && entry.getValue() <= transcript.endTimeMs()));
            } else pendingTranscriptEnds.put(transcript.startTimeMs(), transcript.endTimeMs());
            if (transcript.finalResult()) boundAdd(finalizedRanges, range);
            long nextRevision = revision.incrementAndGet();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("utteranceId", SafeDiagnosticFingerprint.of(
                    String.valueOf(transcript.providerSessionId()) + ':' + transcript.startTimeMs()));
            payload.put("revision", nextRevision);
            payload.put("text", transcript.text());
            payload.put("startAudioSequence", audioSequenceForStart(transcript.startTimeMs()));
            payload.put("endAudioSequence", audioSequenceForEnd(
                    transcript.startTimeMs(), transcript.endTimeMs()));
            payload.put("tokens", transcript.tokens().stream()
                    .filter(token -> token != null
                            && token.text() != null
                            && !token.text().isBlank()
                            && token.startTimeMs() >= 0
                            && token.endTimeMs() >= token.startTimeMs())
                    .map(token -> Map.<String, Object>of(
                            "text", token.text(),
                            "startAudioSequence", audioSequenceForStart(token.startTimeMs()),
                            "endAudioSequence", audioSequenceForEnd(
                                    token.startTimeMs(), token.endTimeMs()),
                            "type", token.type() == null ? "WORD" : token.type()))
                    .toList());
            events.tryEmitNext(new VoiceBranchSession.BranchEvent(
                    transcript.finalResult()
                            ? VoiceBranchSession.BranchEventType.TRANSCRIPT_FINAL
                            : VoiceBranchSession.BranchEventType.TRANSCRIPT_PARTIAL,
                    "SPEECH",
                    transcript.finalResult() ? "TRANSCRIPT_FINAL" : "TRANSCRIPT_PARTIAL",
                    "SPEECH_TRANSCRIPT_AVAILABLE",
                    payload));
            LOGGER.debug(
                    "OCI Speech result normalized: correlationId={} revision={} final={} textLength={} startTimeMs={} endTimeMs={}",
                    correlationId, nextRevision, transcript.finalResult(), transcript.text().length(),
                    transcript.startTimeMs(), transcript.endTimeMs());
            if (draining && transcript.finalResult()
                    && pendingTranscriptEnds.isEmpty()) finalResult.tryEmitEmpty();
        }

        private static long audioSequenceForStart(int startTimeMs) {
            return Math.max(1L, Math.floorDiv(Math.max(0, startTimeMs), 20) + 1L);
        }

        private static long audioSequenceForEnd(int startTimeMs, int endTimeMs) {
            long start = audioSequenceForStart(startTimeMs);
            long end = Math.max(1L, Math.floorDiv(Math.max(0, endTimeMs) + 19, 20));
            return Math.max(start, end);
        }

        private static void boundAdd(Set<String> values, String value) {
            if (values.size() >= 256) values.remove(values.iterator().next());
            values.add(value);
        }

        @Override
        public void onFailure(Throwable failure) {
            if (!terminal.compareAndSet(false, true)) return;
            ready.tryEmitError(new SpeechProviderException(failure));
            finalResult.tryEmitError(new SpeechProviderException(failure));
            events.tryEmitNext(new VoiceBranchSession.BranchEvent(
                    VoiceBranchSession.BranchEventType.FAILED,
                    "SPEECH",
                    "SHOW_TRANSCRIPTION_FAILURE",
                    "SPEECH_PROCESSING_FAILED",
                    Map.of()));
            LOGGER.warn(
                    "OCI Speech provider failure: correlationId={} voiceSessionIdFp={} causeType={}",
                    correlationId,
                    SafeDiagnosticFingerprint.of(voiceSessionId),
                    failure == null ? "unknown" : failure.getClass().getSimpleName());
            closeQuietly(client.get());
        }

        @Override
        public void onClosed(int statusCode, String reason) {
            if (!closing.get() && !terminal.get()) {
                onFailure(new IllegalStateException("OCI Speech connection closed: " + statusCode));
            }
        }
    }

    private static final class SpeechBranch implements VoiceBranchSession {
        private final RealtimeClient client;
        private final SpeechEventBridge bridge;
        private final Duration drainTimeout;
        private final AtomicBoolean closed = new AtomicBoolean();
        private Mono<Void> completion;

        private SpeechBranch(RealtimeClient client, SpeechEventBridge bridge, long drainTimeoutMs) {
            this.client = client;
            this.bridge = bridge;
            this.drainTimeout = Duration.ofMillis(drainTimeoutMs);
        }

        @Override
        public Mono<Void> sendAudio(long sequence, byte[] pcm) {
            if (closed.get()) {
                Arrays.fill(pcm, (byte) 0);
                return Mono.error(processingFailure("SPEECH_SESSION_CLOSED", null));
            }
            return Mono.fromRunnable(() -> {
                        try {
                            client.sendAudio(pcm);
                            bridge.audioSent(pcm.length);
                        } catch (Exception failure) {
                            throw processingFailure("SPEECH_AUDIO_DELIVERY_FAILED", failure);
                        }
                    })
                    .subscribeOn(Schedulers.boundedElastic())
                    .doFinally(ignored -> Arrays.fill(pcm, (byte) 0))
                    .then();
        }

        @Override
        public synchronized Mono<Void> complete() {
            if (completion != null) return completion;
            completion = Mono.fromRunnable(() -> {
                        try {
                            bridge.beginDrain();
                            client.requestFinalResult();
                        } catch (Exception failure) {
                            throw processingFailure("SPEECH_FINAL_RESULT_REQUEST_FAILED", failure);
                        }
                    })
                    .subscribeOn(Schedulers.boundedElastic())
                    .then(bridge.finalResult().timeout(drainTimeout))
                    // A missing final must not discard already received text or biometric
                    // evidence. Session-end projection labels any remaining partials incomplete.
                    .onErrorResume(java.util.concurrent.TimeoutException.class, failure -> {
                        bridge.drainTimedOut();
                        return Mono.empty();
                    })
                    .onErrorMap(failure -> failure instanceof VoiceBranchSession.BranchProcessingException
                            ? failure
                            : processingFailure("SPEECH_FINAL_RESULT_UNAVAILABLE", failure))
                    .doOnTerminate(this::close)
                    .cache();
            return completion;
        }

        @Override
        public Mono<Void> cancel() {
            return Mono.fromRunnable(this::close).subscribeOn(Schedulers.boundedElastic()).then();
        }

        @Override
        public Flux<VoiceBranchSession.BranchEvent> events() {
            return bridge.events();
        }

        private void close() {
            if (!closed.compareAndSet(false, true)) return;
            bridge.beginClose();
            closeQuietly(client);
        }
    }

    private static final class OciRealtimeClientFactory implements RealtimeClientFactory {
        @Override
        public RealtimeClient open(SpeechConfiguration configuration, RealtimeListener listener)
                throws Exception {
            AuthenticationContext authentication = null;
            WebSocketClient webSocketClient = null;
            RealtimeSpeechClient speechClient = null;
            try {
                authentication = authentication(configuration);
                Region providerRegion = verifyAndResolveRegion(configuration, authentication);
                String realtimeEndpoint = resolveEndpoint(configuration, providerRegion);
                webSocketClient = new WebSocketClient();
                RealtimeSpeechClientListener sdkListener = sdkListener(listener);
                speechClient = RealtimeSpeechClient.builder()
                        .listener(sdkListener)
                        .authenticationDetailsProvider(authentication.provider())
                        .webSocketClient(webSocketClient)
                        .compartmentId(configuration.compartmentOcid())
                        .build();
                LOGGER.info(
                        "OCI Speech authentication ready: mode={} region={} tenancyFp={} endpointHost={} modelType={} modelDomain={} languageCode={}",
                        configuration.authMode().toUpperCase(Locale.ROOT),
                        providerRegion.getRegionId(),
                        authentication.tenancyOcid() == null
                                ? "provider_managed"
                                : SafeDiagnosticFingerprint.of(authentication.tenancyOcid()),
                        URI.create(realtimeEndpoint).getHost(),
                        configuration.modelType().toUpperCase(Locale.ROOT),
                        configuration.modelDomain().toUpperCase(Locale.ROOT),
                        configuration.languageCode());
                speechClient.open(realtimeEndpoint, parameters(configuration));
                return new OciRealtimeClient(
                        speechClient, webSocketClient, authentication.cleanup());
            } catch (Exception failure) {
                if (speechClient != null) speechClient.close();
                stopQuietly(webSocketClient);
                closeAuthenticationQuietly(authentication);
                throw failure;
            }
        }

        private static AuthenticationContext authentication(SpeechConfiguration configuration)
                throws Exception {
            if ("SESSION_TOKEN".equalsIgnoreCase(configuration.authMode())) {
                SessionTokenAuthenticationDetailsProvider provider =
                        new SessionTokenAuthenticationDetailsProvider(
                                configuration.configFile(), configuration.profile());
                return new AuthenticationContext(
                        provider, provider.getRegion(), provider.getTenantId(), provider::close);
            }
            if ("INSTANCE_PRINCIPAL".equalsIgnoreCase(configuration.authMode())) {
                InstancePrincipalsAuthenticationDetailsProvider provider =
                        InstancePrincipalsAuthenticationDetailsProvider.builder().build();
                return new AuthenticationContext(provider, provider.getRegion(), null, () -> { });
            }
            throw new IllegalArgumentException("Unsupported OCI Speech authentication mode");
        }

        private static Region verifyAndResolveRegion(
                SpeechConfiguration configuration,
                AuthenticationContext authentication) {
            Region providerRegion = authentication.region();
            if (providerRegion == null && !configuration.region().isBlank()) {
                providerRegion = Region.fromRegionId(configuration.region());
            }
            if (providerRegion == null) {
                throw new IllegalStateException("OCI authentication provider did not supply a region");
            }
            if (!configuration.region().isBlank()
                    && !configuration.region().equalsIgnoreCase(providerRegion.getRegionId())) {
                throw new IllegalStateException("OCI authentication provider is for an unexpected region");
            }
            if (!configuration.expectedTenancyOcid().isBlank()) {
                if (authentication.tenancyOcid() == null) {
                    throw new IllegalStateException(
                            "Expected-tenancy validation is unavailable for instance-principal authentication");
                }
                if (!configuration.expectedTenancyOcid().equals(authentication.tenancyOcid())) {
                    throw new IllegalStateException("OCI authentication provider is for an unexpected tenancy");
                }
            }
            return providerRegion;
        }

        private static String resolveEndpoint(
                SpeechConfiguration configuration,
                Region providerRegion) {
            if (!configuration.realtimeEndpoint().isBlank()) {
                return configuration.realtimeEndpoint();
            }
            return "wss://realtime.aiservice."
                    + providerRegion.getRegionId()
                    + '.'
                    + providerRegion.getRealm().getSecondLevelDomain();
        }

        static RealtimeParameters parameters(SpeechConfiguration configuration) {
            RealtimeParameters.Builder builder = RealtimeParameters.builder()
                    .encoding(configuration.encoding())
                    .isAckEnabled(configuration.ackEnabled())
                    .modelType(configuration.modelType())
                    .modelDomain(modelDomain(configuration.modelDomain()))
                    .languageCode(configuration.languageCode())
                    .punctuation(punctuation(configuration.punctuation()));
            if (configuration.isOracle()) {
                builder.partialSilenceThresholdInMs(configuration.partialSilenceMs())
                        .finalSilenceThresholdInMs(configuration.finalSilenceMs())
                        .stabilizePartialResults(
                                stabilization(configuration.stabilizePartialResults()));
            }
            return builder.build();
        }

        private static RealtimeParameters.ModelDomain modelDomain(String value) {
            return switch (value.toUpperCase(Locale.ROOT)) {
                case "GENERIC" -> RealtimeParameters.ModelDomain.Generic;
                case "MEDICAL" -> RealtimeParameters.ModelDomain.Medical;
                default -> throw new IllegalArgumentException("Unsupported OCI Speech model domain");
            };
        }

        private static RealtimeParameters.Punctuation punctuation(String value) {
            return switch (value.toUpperCase(Locale.ROOT)) {
                case "NONE" -> RealtimeParameters.Punctuation.None;
                case "SPOKEN" -> RealtimeParameters.Punctuation.Spoken;
                case "AUTO" -> RealtimeParameters.Punctuation.Auto;
                default -> throw new IllegalArgumentException("Unsupported OCI Speech punctuation mode");
            };
        }

        private static RealtimeParameters.StabilizePartialResults stabilization(String value) {
            return switch (value.toUpperCase(Locale.ROOT)) {
                case "NONE" -> RealtimeParameters.StabilizePartialResults.None;
                case "LOW" -> RealtimeParameters.StabilizePartialResults.Low;
                case "MEDIUM" -> RealtimeParameters.StabilizePartialResults.Medium;
                case "HIGH" -> RealtimeParameters.StabilizePartialResults.High;
                default -> throw new IllegalArgumentException("Unsupported OCI Speech stabilization mode");
            };
        }

        private static RealtimeSpeechClientListener sdkListener(RealtimeListener listener) {
            return new RealtimeSpeechClientListener() {
                @Override
                public void onClose(int statusCode, String statusMessage) {
                    listener.onClosed(statusCode, statusMessage);
                }

                @Override
                public void onAckMessage(RealtimeMessageAckAudio acknowledgement) {
                    if (acknowledgement == null || acknowledgement.getDetails() == null) return;
                    var details = acknowledgement.getDetails();
                    listener.onAcknowledgement(
                            value(details.getNumber()), value(details.getOffset()), value(details.getLength()));
                }

                @Override
                public void onResult(RealtimeMessageResult result) {
                    if (result == null || result.getTranscriptions() == null) return;
                    for (RealtimeMessageResultTranscription transcription : result.getTranscriptions()) {
                        listener.onTranscript(new ProviderTranscript(
                                result.getSessionId(),
                                transcription.getTranscription(),
                                Boolean.TRUE.equals(transcription.getIsFinal()),
                                value(transcription.getStartTimeInMs()),
                                value(transcription.getEndTimeInMs()),
                                transcription.getConfidence(),
                                providerTokens(transcription.getTokens())));
                    }
                }

                @Override
                public void onError(Throwable error) {
                    listener.onFailure(error);
                }

                @Override
                public void onConnect() {
                    LOGGER.debug("OCI Speech WebSocket transport connected; awaiting authenticated CONNECT");
                }

                @Override
                public void onConnectMessage(RealtimeMessageConnect connectMessage) {
                    listener.onAuthenticatedReady(
                            connectMessage == null ? null : connectMessage.getSessionId());
                }
            };
        }

        private static int value(Integer value) {
            return value == null ? 0 : value;
        }

        private static List<ProviderToken> providerTokens(
                List<RealtimeMessageResultTranscriptionToken> tokens) {
            if (tokens == null || tokens.isEmpty()) return List.of();
            return tokens.stream()
                    .filter(Objects::nonNull)
                    .map(token -> new ProviderToken(
                            token.getToken(),
                            value(token.getStartTimeInMs()),
                            value(token.getEndTimeInMs()),
                            token.getType() == null
                                    ? "WORD" : token.getType().getValue().toUpperCase(Locale.ROOT)))
                    .toList();
        }
    }

    private static final class OciRealtimeClient implements RealtimeClient {
        private final RealtimeSpeechClient speechClient;
        private final WebSocketClient webSocketClient;
        private final AutoCloseable authenticationCleanup;
        private final AtomicBoolean closed = new AtomicBoolean();

        private OciRealtimeClient(
                RealtimeSpeechClient speechClient,
                WebSocketClient webSocketClient,
                AutoCloseable authenticationCleanup) {
            this.speechClient = speechClient;
            this.webSocketClient = webSocketClient;
            this.authenticationCleanup = authenticationCleanup;
        }

        @Override
        public void sendAudio(byte[] pcm) throws Exception {
            speechClient.sendAudioData(pcm);
        }

        @Override
        public void requestFinalResult() {
            speechClient.requestFinalResult();
        }

        @Override
        public void close() {
            if (!closed.compareAndSet(false, true)) return;
            speechClient.close();
            stopQuietly(webSocketClient);
            try {
                authenticationCleanup.close();
            } catch (Exception ignored) {
                LOGGER.debug("OCI Speech authentication cleanup failed");
            }
        }
    }

    private record AuthenticationContext(
            BasicAuthenticationDetailsProvider provider,
            Region region,
            String tenancyOcid,
            AutoCloseable cleanup) {
    }

    private static VoiceBranchSession.BranchProcessingException processingFailure(
            String safeCode, Throwable failure) {
        return new VoiceBranchSession.BranchProcessingException(safeCode, failure);
    }

    private static BranchUnavailableException speechUnavailable(String correlationId, Throwable failure) {
        LOGGER.warn(
                "OCI Speech open failed: correlationId={} safeCode=SPEECH_CONNECT_FAILED causeType={}",
                correlationId, failure.getClass().getSimpleName());
        return new BranchUnavailableException("SPEECH_CONNECT_FAILED", failure);
    }

    private static void closeQuietly(RealtimeClient client) {
        if (client == null) return;
        try {
            client.close();
        } catch (Exception ignored) {
            LOGGER.debug("OCI Speech transient client cleanup failed");
        }
    }

    private static void stopQuietly(WebSocketClient client) {
        if (client == null) return;
        try {
            client.stop();
        } catch (Exception ignored) {
            LOGGER.debug("OCI Speech WebSocket client cleanup failed");
        }
    }

    private static void closeAuthenticationQuietly(AuthenticationContext authentication) {
        if (authentication == null) return;
        try {
            authentication.cleanup().close();
        } catch (Exception ignored) {
            LOGGER.debug("OCI Speech authentication cleanup failed");
        }
    }

    private static final class SpeechProviderException extends RuntimeException {
        private SpeechProviderException(Throwable cause) {
            super(null, cause, false, false);
        }
    }
}
