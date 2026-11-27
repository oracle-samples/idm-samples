package com.oracle.aiworld.voice.application.streaming;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.application.enrollment.EnrollmentService;
import com.oracle.aiworld.voice.application.enrollment.EnrollmentService.EnrollmentCompletionContext;
import com.oracle.aiworld.voice.application.verification.VerificationService;
import com.oracle.aiworld.voice.application.verification.VerificationService.VerificationCompletionContext;
import com.oracle.aiworld.voice.port.AbisVoicePort;
import com.oracle.aiworld.voice.port.AbisVoicePort.BranchUnavailableException;
import com.oracle.aiworld.voice.port.SpeechTranscriptionPort;
import com.oracle.aiworld.voice.port.VoiceBranchSession;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import jakarta.annotation.PreDestroy;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class VoiceSessionService {
    public enum SessionState { PREAUTHORIZED, BINDING, READY, CAPTURING, MUTED, DRAINING, COMPLETED, FAILED, CANCELLED }

    public record AudioProfile(
            String encoding,
            int sampleRateHz,
            int channels,
            int sampleSizeBits,
            String byteOrder,
            int nominalFrameMs) {
        public static AudioProfile canonical() {
            return new AudioProfile("PCM_SIGNED", 16000, 1, 16, "LITTLE_ENDIAN", 20);
        }

        public boolean isCanonical() { return equals(canonical()); }
    }

    public record VoiceSessionView(
            String protocolVersion,
            String correlationId,
            String voiceSessionId,
            String purpose,
            SessionState state,
            String websocketPath,
            Instant bindExpiresAt,
            AudioProfile audioProfile,
            OperationalLimits operationalLimits,
            int maxCaptureSeconds,
            int drainDeadlineSeconds,
            java.util.List<DependencyState> dependencies) {
    }

    public record OperationalLimits(
            int bindDeadlineSeconds,
            int dependencyReadinessDeadlineSeconds,
            int heartbeatIntervalSeconds,
            int halfOpenTimeoutSeconds,
            int branchQueueFrames,
            int branchQueueBytes,
            int drainDeadlineSeconds,
            int enrollmentMaxCaptureSeconds,
            int verificationMaxCaptureSeconds) {
        public static OperationalLimits standard() {
            return new OperationalLimits(5, 10, 15, 45, 100, 64000, 10, 90, 900);
        }
    }

    public record DependencyState(String dependency, String state, Instant observedAt) {
    }

    public record AudioAcknowledgement(
            long acceptedThroughAudioSequence,
            long acceptedFrameCount) {
    }

    private static final class StoredSession implements AutoCloseable {
        private final String owner;
        private final VoiceSessionView original;
        private final EnrollmentService enrollment;
        private final EnrollmentCompletionContext enrollmentCompletion;
        private final VerificationService verification;
        private final VerificationCompletionContext verificationCompletion;
        private final char[] abisToken;
        private final boolean speechEnabled;
        private final VerificationTimelineAssembler verificationTimeline;
        private SessionState state = SessionState.PREAUTHORIZED;
        private VoiceBranchSession abis;
        private VoiceBranchSession speech;
        private final Sinks.Many<VoiceBranchSession.BranchEvent> providerEvents =
                Sinks.many().replay().limit(4);
        private Disposable providerEventSubscription;
        private final AtomicBoolean iamCompletionStarted = new AtomicBoolean();
        private long audioSequence;

        private StoredSession(
                String owner,
                VoiceSessionView original,
                EnrollmentService enrollment,
                EnrollmentCompletionContext enrollmentCompletion,
                VerificationService verification,
                VerificationCompletionContext verificationCompletion,
                char[] token,
                boolean speechEnabled) {
            this.owner = owner;
            this.original = original;
            this.enrollment = enrollment;
            this.enrollmentCompletion = enrollmentCompletion;
            this.verification = verification;
            this.verificationCompletion = verificationCompletion;
            this.abisToken = token.clone();
            this.speechEnabled = speechEnabled;
            this.verificationTimeline = "VERIFICATION".equals(original.purpose())
                    ? new VerificationTimelineAssembler() : null;
        }

        synchronized VoiceSessionView view() {
            return new VoiceSessionView(
                    original.protocolVersion(), original.correlationId(), original.voiceSessionId(),
                    original.purpose(), state, original.websocketPath(), original.bindExpiresAt(),
                    original.audioProfile(), original.operationalLimits(), original.maxCaptureSeconds(),
                    original.drainDeadlineSeconds(), dependencyProjection());
        }

        synchronized boolean active() {
            return state != SessionState.COMPLETED
                    && state != SessionState.FAILED
                    && state != SessionState.CANCELLED;
        }

        private java.util.List<DependencyState> dependencyProjection() {
            String branchState = switch (state) {
                case PREAUTHORIZED -> "NOT_STARTED";
                case BINDING -> "CONNECTING";
                case READY -> "READY";
                case CAPTURING -> "PROCESSING";
                case MUTED -> "PROCESSING";
                case DRAINING -> "DRAINING";
                case COMPLETED -> "COMPLETED";
                default -> "FAILED";
            };
            Instant observedAt = original.bindExpiresAt().minusSeconds(5);
            return java.util.List.of(
                    new DependencyState("ABIS", branchState, observedAt),
                    new DependencyState(
                            "SPEECH", speechEnabled ? branchState : "NOT_CONFIGURED", observedAt));
        }

        synchronized void beginBind(Instant now) {
            if (state != SessionState.PREAUTHORIZED || !original.bindExpiresAt().isAfter(now)) {
                throw ApiException.conflict("FLOW", "VOICE_SESSION_BIND_NOT_ALLOWED");
            }
            state = SessionState.BINDING;
        }

        synchronized void ready(VoiceBranchSession abis, VoiceBranchSession speech) {
            if (state != SessionState.BINDING) {
                throw ApiException.conflict("FLOW", "VOICE_SESSION_STATE_CONFLICT");
            }
            this.abis = abis;
            this.speech = speech;
            Arrays.fill(abisToken, '\0');
            state = SessionState.READY;
            Flux<VoiceBranchSession.BranchEvent> events = speech == null
                    ? abis.events()
                    : Flux.merge(abis.events(), speech.events());
            this.providerEventSubscription = events.subscribe(this::providerEvent);
        }

        private void providerEvent(VoiceBranchSession.BranchEvent event) {
            if ("ABIS".equals(event.source())) {
                if ("ENROLLMENT".equals(original.purpose())
                        && (event.type() == VoiceBranchSession.BranchEventType.SUCCEEDED
                        || event.type() == VoiceBranchSession.BranchEventType.FAILED)) {
                    beginEnrollmentIamCompletion(event);
                    return;
                }
                if ("VERIFICATION".equals(original.purpose())
                        && (event.type() == VoiceBranchSession.BranchEventType.SUCCEEDED
                        || event.type() == VoiceBranchSession.BranchEventType.FAILED)) {
                    beginVerificationIamCompletion(event);
                    return;
                }
            }
            java.util.List<VoiceBranchSession.BranchEvent> projected =
                    verificationTimeline == null
                            ? java.util.List.of(event) : verificationTimeline.accept(event);
            synchronized (this) {
                for (VoiceBranchSession.BranchEvent projection : projected) {
                    if (projection.type() == VoiceBranchSession.BranchEventType.FAILED) {
                        state = SessionState.DRAINING;
                    }
                    providerEvents.tryEmitNext(projection);
                }
            }
        }

        private void beginVerificationIamCompletion(VoiceBranchSession.BranchEvent assurance) {
            if (!iamCompletionStarted.compareAndSet(false, true)) return;
            VoiceBranchSession speechBranch;
            synchronized (this) {
                state = SessionState.DRAINING;
                speechBranch = speech;
            }
            Mono<Void> speechDrain = speechBranch == null ? Mono.empty() : speechBranch.complete();
            // The browser closes its stream at this terminal event. Do not publish it while
            // Speech is still delivering final transcript updates.
            Mono.whenDelayError(verification.complete(verificationCompletion, original.correlationId()), speechDrain)
                    .subscribe(
                            ignored -> { },
                            ignored -> verificationIamCompletionFailed(assurance),
                            () -> verificationIamCompletionSucceeded(assurance));
        }

        private synchronized void verificationIamCompletionSucceeded(
                VoiceBranchSession.BranchEvent assurance) {
            if (assurance.type() == VoiceBranchSession.BranchEventType.FAILED) {
                // IAM has closed its request, but that successful lifecycle update must never
                // transform an ABIS processing failure into biometric success.
                state = SessionState.FAILED;
                providerEvents.tryEmitNext(assurance);
            } else {
                state = SessionState.COMPLETED;
                providerEvents.tryEmitNext(new VoiceBranchSession.BranchEvent(
                        VoiceBranchSession.BranchEventType.SUCCEEDED,
                        "IAM",
                        assurance.action(),
                        "IAM_VERIFICATION_COMPLETED",
                        assurance.payload()));
            }
        }

        private synchronized void verificationIamCompletionFailed(
                VoiceBranchSession.BranchEvent assurance) {
            state = SessionState.FAILED;
            if (assurance.type() == VoiceBranchSession.BranchEventType.FAILED) {
                // Keep the primary ABIS error visible. The IAM adapter records its separate
                // completion failure under the same correlation ID.
                providerEvents.tryEmitNext(assurance);
                return;
            }
            providerEvents.tryEmitNext(new VoiceBranchSession.BranchEvent(
                    VoiceBranchSession.BranchEventType.FAILED,
                    "IAM",
                    "SHOW_FAILURE",
                    "IAM_VERIFICATION_COMPLETION_FAILED",
                    Map.of()));
        }

        private void beginEnrollmentIamCompletion(VoiceBranchSession.BranchEvent abisTerminal) {
            if (!iamCompletionStarted.compareAndSet(false, true)) return;
            VoiceBranchSession speechBranch;
            boolean completeSpeech;
            synchronized (this) {
                completeSpeech = state != SessionState.DRAINING;
                state = SessionState.DRAINING;
                speechBranch = speech;
            }
            if (completeSpeech && speechBranch != null) {
                speechBranch.complete().subscribe(null, ignored -> { });
            }
            enrollment.complete(enrollmentCompletion, original.correlationId())
                    .subscribe(
                            ignored -> enrollmentIamCompletionSucceeded(abisTerminal),
                            ignored -> enrollmentIamCompletionFailed(abisTerminal));
        }

        private synchronized void enrollmentIamCompletionSucceeded(
                VoiceBranchSession.BranchEvent abisTerminal) {
            if (abisTerminal.type() == VoiceBranchSession.BranchEventType.FAILED) {
                // Closing the IAM request does not make a rejected/failed ABIS sample enrolled.
                state = SessionState.FAILED;
                providerEvents.tryEmitNext(abisTerminal);
            } else {
                state = SessionState.COMPLETED;
                providerEvents.tryEmitNext(new VoiceBranchSession.BranchEvent(
                        VoiceBranchSession.BranchEventType.SUCCEEDED,
                        abisTerminal.action(),
                        "IAM_ENROLLMENT_COMPLETED"));
            }
        }

        private synchronized void enrollmentIamCompletionFailed(
                VoiceBranchSession.BranchEvent abisTerminal) {
            state = SessionState.FAILED;
            if (abisTerminal.type() == VoiceBranchSession.BranchEventType.FAILED) {
                // Preserve the primary ABIS enrollment failure. IAM logs its completion failure
                // using the same correlation ID.
                providerEvents.tryEmitNext(abisTerminal);
                return;
            }
            providerEvents.tryEmitNext(new VoiceBranchSession.BranchEvent(
                    VoiceBranchSession.BranchEventType.FAILED,
                    "SHOW_FAILURE",
                    "IAM_ENROLLMENT_COMPLETION_FAILED"));
        }

        Flux<VoiceBranchSession.BranchEvent> events() {
            return providerEvents.asFlux();
        }

        synchronized void failed() {
            Arrays.fill(abisToken, '\0');
            state = SessionState.FAILED;
        }

        synchronized void start() {
            if (state != SessionState.READY) {
                throw ApiException.conflict("FLOW", "CAPTURE_START_NOT_ALLOWED");
            }
            state = SessionState.CAPTURING;
        }

        Mono<AudioAcknowledgement> accept(byte[] pcm) {
            long sequence;
            VoiceBranchSession abisBranch;
            VoiceBranchSession speechBranch;
            synchronized (this) {
                // A browser audio frame can already be in flight when ABIS publishes success.
                // Acknowledge that trailing frame without forwarding it or converting success
                // into a terminal UI delivery error.
                if (state == SessionState.DRAINING || state == SessionState.COMPLETED) {
                    sequence = ++audioSequence;
                    Arrays.fill(pcm, (byte) 0);
                    return Mono.just(new AudioAcknowledgement(sequence, sequence));
                }
                if (state == SessionState.MUTED) {
                    sequence = ++audioSequence;
                    Arrays.fill(pcm, (byte) 0);
                    return Mono.just(new AudioAcknowledgement(sequence, sequence));
                }
                if (state != SessionState.CAPTURING) {
                    return Mono.error(ApiException.conflict("FLOW", "AUDIO_NOT_ACCEPTED"));
                }
                if (pcm.length != 640) {
                    return Mono.error(ApiException.badRequest("INVALID_AUDIO_FRAME"));
                }
                sequence = ++audioSequence;
                abisBranch = abis;
                speechBranch = speech;
            }

            // Never call a provider branch while holding the StoredSession monitor. ABIS can
            // synchronously publish an acknowledgement while its SDK session lock is held; if an
            // audio-delivery thread held this monitor while waiting for that SDK lock, the event
            // callback and delivery thread would deadlock and the next enrollment sample would
            // never be requested.
            byte[] abisCopy = pcm.clone();
            byte[] speechCopy = pcm.clone();
            Mono<Void> speechSend = speechBranch == null
                    ? Mono.fromRunnable(() -> Arrays.fill(speechCopy, (byte) 0))
                    : speechBranch.sendAudio(sequence, speechCopy);
            return Mono.when(abisBranch.sendAudio(sequence, abisCopy), speechSend)
                    .thenReturn(new AudioAcknowledgement(sequence, sequence));
        }

        synchronized Mono<VoiceSessionView> complete() {
            if (state == SessionState.COMPLETED) return Mono.just(view());
            if (state == SessionState.DRAINING) return awaitProviderCompletion();
            if (state != SessionState.CAPTURING && state != SessionState.MUTED) {
                return Mono.error(ApiException.conflict("FLOW", "CAPTURE_END_NOT_ALLOWED"));
            }
            state = SessionState.DRAINING;
            Mono<Void> abisCompletion = abis == null ? Mono.empty() : abis.complete();
            Mono<Void> speechCompletion = speech == null ? Mono.empty() : speech.complete();
            return Mono.when(abisCompletion, speechCompletion)
                    .then(awaitProviderCompletion())
                    .doOnError(ignored -> markFailed());
        }

        synchronized Mono<VoiceSessionView> pause() {
            if (!"VERIFICATION".equals(original.purpose()) || state != SessionState.CAPTURING) {
                return Mono.error(ApiException.conflict("FLOW", "CAPTURE_PAUSE_NOT_ALLOWED"));
            }
            state = SessionState.MUTED;
            return (abis == null ? Mono.<Void>empty() : abis.pause())
                    .thenReturn(view())
                    .doOnError(ignored -> markFailed());
        }

        synchronized VoiceSessionView resume() {
            if (!"VERIFICATION".equals(original.purpose()) || state != SessionState.MUTED) {
                throw ApiException.conflict("FLOW", "CAPTURE_RESUME_NOT_ALLOWED");
            }
            state = SessionState.CAPTURING;
            return view();
        }

        private Mono<VoiceSessionView> awaitProviderCompletion() {
            return providerEvents.asFlux()
                    .filter(event -> event.type() == VoiceBranchSession.BranchEventType.SUCCEEDED
                            || event.type() == VoiceBranchSession.BranchEventType.FAILED)
                    .next()
                    .flatMap(event -> event.type() == VoiceBranchSession.BranchEventType.SUCCEEDED
                            ? Mono.fromCallable(this::view)
                            : Mono.error(new VoiceBranchSession.BranchProcessingException(
                                    event.safeCode(), null)));
        }

        private synchronized void markFailed() {
            state = SessionState.FAILED;
        }

        @Override
        public synchronized void close() {
            Arrays.fill(abisToken, '\0');
            if (providerEventSubscription != null) providerEventSubscription.dispose();
            providerEvents.tryEmitComplete();
            if (state == SessionState.COMPLETED) return;
            if (abis != null) abis.cancel().subscribe(null, ignored -> { });
            if (speech != null) speech.cancel().subscribe(null, ignored -> { });
            state = SessionState.CANCELLED;
        }
    }

    private final EnrollmentService enrollment;
    private final VerificationService verification;
    private final AbisVoicePort abis;
    private final SpeechTranscriptionPort speech;
    private final Clock clock;
    private final SecureRandom random;
    private final Map<String, StoredSession> sessions = new ConcurrentHashMap<>();

    @Autowired
    public VoiceSessionService(
            EnrollmentService enrollment,
            VerificationService verification,
            AbisVoicePort abis,
            SpeechTranscriptionPort speech,
            Clock clock,
            SecureRandom random) {
        this.enrollment = enrollment;
        this.verification = verification;
        this.abis = abis;
        this.speech = speech;
        this.clock = clock;
        this.random = random;
    }

    /** Test/source-compatible enrollment-only constructor. */
    public VoiceSessionService(
            EnrollmentService enrollment,
            AbisVoicePort abis,
            SpeechTranscriptionPort speech,
            Clock clock,
            SecureRandom random) {
        this(enrollment, null, abis, speech, clock, random);
    }

    public Mono<VoiceSessionView> createEnrollment(
            String owner,
            String attemptId,
            AudioProfile audioProfile,
            String correlationId) {
        if (!audioProfile.isCanonical()) {
            return Mono.error(ApiException.badRequest("UNSUPPORTED_AUDIO_PROFILE"));
        }
        if (!abis.availableForLiveSession()) {
            return Mono.error(ApiException.providerUnavailable(
                    "FLOW", "VOICE_DEPENDENCIES_NOT_CONFIGURED"));
        }
        return enrollment.authorize(owner, attemptId, correlationId)
                .map(authorization -> {
                    try (authorization) {
                        String id = OpaqueTokens.random(random);
                        VoiceSessionView view = new VoiceSessionView(
                                "1.0", correlationId, id, "ENROLLMENT", SessionState.PREAUTHORIZED,
                                "/ws/v1/voice", clock.instant().plusSeconds(5), audioProfile,
                                OperationalLimits.standard(), 90, 10,
                                java.util.List.of(
                                        new DependencyState("ABIS", "NOT_STARTED", clock.instant()),
                                        new DependencyState("SPEECH", speech.availableForLiveSession()
                                                ? "NOT_STARTED" : "NOT_CONFIGURED", clock.instant())));
                        StoredSession stored = new StoredSession(
                                owner,
                                view,
                                enrollment,
                                authorization.completion(),
                                null,
                                null,
                                authorization.securityToken(),
                                speech.availableForLiveSession());
                        sessions.put(id, stored);
                        return stored.view();
                    }
                });
    }

    public Mono<VoiceSessionView> createVerification(
            String owner,
            String userGuid,
            AudioProfile audioProfile,
            String correlationId) {
        if (!audioProfile.isCanonical()) {
            return Mono.error(ApiException.badRequest("UNSUPPORTED_AUDIO_PROFILE"));
        }
        if (!abis.availableForLiveSession()) {
            return Mono.error(ApiException.providerUnavailable(
                    "FLOW", "VOICE_DEPENDENCIES_NOT_CONFIGURED"));
        }
        if (verification == null) {
            return Mono.error(ApiException.providerUnavailable(
                    "IAM", "VERIFICATION_AUTHORIZATION_UNAVAILABLE"));
        }
        return verification.authorize(userGuid, correlationId)
                .map(authorization -> {
                    try (authorization) {
                        String id = OpaqueTokens.random(random);
                        VoiceSessionView view = new VoiceSessionView(
                                "1.0", correlationId, id, "VERIFICATION",
                                SessionState.PREAUTHORIZED,
                                "/ws/v1/voice", clock.instant().plusSeconds(5), audioProfile,
                                OperationalLimits.standard(), 900, 10,
                                java.util.List.of(
                                        new DependencyState("ABIS", "NOT_STARTED", clock.instant()),
                                        new DependencyState("SPEECH",
                                                speech.availableForLiveSession()
                                                        ? "NOT_STARTED" : "NOT_CONFIGURED",
                                                clock.instant())));
                        StoredSession stored = new StoredSession(
                                owner,
                                view,
                                enrollment,
                                null,
                                verification,
                                new VerificationCompletionContext(
                                        userGuid,
                                        authorization.factorId(),
                                        authorization.requestId(),
                                        authorization.requestState()),
                                authorization.securityToken(),
                                speech.availableForLiveSession());
                        sessions.put(id, stored);
                        return stored.view();
                    }
                });
    }

    public Mono<VoiceSessionView> bind(String owner, String voiceSessionId) {
        StoredSession stored = requireOwned(owner, voiceSessionId);
        stored.beginBind(clock.instant());
        AbisVoicePort.OpenRequest abisRequest = new AbisVoicePort.OpenRequest(
                voiceSessionId, stored.original.correlationId(), stored.original.purpose(),
                stored.abisToken,
                stored.original.audioProfile());
        SpeechTranscriptionPort.OpenRequest speechRequest = new SpeechTranscriptionPort.OpenRequest(
                voiceSessionId, stored.original.correlationId(), stored.original.audioProfile());
        Mono<VoiceSessionView> branches = speech.availableForLiveSession()
                ? Mono.zip(abis.open(abisRequest), speech.open(speechRequest))
                        .map(opened -> {
                            stored.ready(opened.getT1(), opened.getT2());
                            return stored.view();
                        })
                : abis.open(abisRequest).map(opened -> {
                    stored.ready(opened, null);
                    return stored.view();
                });
        return branches
                .doFinally(ignored -> abisRequest.close())
                .onErrorMap(failure -> {
                    stored.failed();
                    if (failure instanceof BranchUnavailableException
                            || failure instanceof SpeechTranscriptionPort.BranchUnavailableException) {
                        return failure;
                    }
                    return ApiException.providerUnavailable("FLOW", "VOICE_DEPENDENCIES_UNAVAILABLE");
                });
    }

    public Mono<VoiceSessionView> startCapture(String owner, String voiceSessionId) {
        StoredSession stored = requireOwned(owner, voiceSessionId);
        stored.start();
        return Mono.just(stored.view());
    }

    public Mono<AudioAcknowledgement> acceptAudio(String owner, String voiceSessionId, byte[] pcm) {
        return requireOwned(owner, voiceSessionId).accept(pcm);
    }

    public Mono<VoiceSessionView> pauseCapture(String owner, String voiceSessionId) {
        return requireOwned(owner, voiceSessionId).pause();
    }

    public Mono<VoiceSessionView> resumeCapture(String owner, String voiceSessionId) {
        return Mono.fromCallable(() -> requireOwned(owner, voiceSessionId).resume());
    }

    public Mono<VoiceSessionView> complete(String owner, String voiceSessionId) {
        return requireOwned(owner, voiceSessionId).complete();
    }

    public Flux<VoiceBranchSession.BranchEvent> events(String owner, String voiceSessionId) {
        return requireOwned(owner, voiceSessionId).events();
    }

    public VoiceSessionView get(String owner, String voiceSessionId) {
        return requireOwned(owner, voiceSessionId).view();
    }

    public void cancel(String owner, String voiceSessionId) {
        StoredSession stored = requireOwned(owner, voiceSessionId);
        stored.close();
        sessions.remove(voiceSessionId, stored);
    }

    public boolean hasActiveSession(String owner) {
        return owner != null && sessions.values().stream()
                .anyMatch(session -> session.owner.equals(owner) && session.active());
    }

    private StoredSession requireOwned(String owner, String id) {
        StoredSession stored = sessions.get(id);
        if (stored == null || !stored.owner.equals(owner)) {
            throw ApiException.notFound("FLOW", "VOICE_SESSION_NOT_FOUND");
        }
        return stored;
    }

    @PreDestroy
    void clear() {
        sessions.values().forEach(StoredSession::close);
        sessions.clear();
    }
}
