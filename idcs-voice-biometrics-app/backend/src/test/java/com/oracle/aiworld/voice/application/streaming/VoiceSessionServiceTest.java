package com.oracle.aiworld.voice.application.streaming;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.application.enrollment.EnrollmentService;
import com.oracle.aiworld.voice.application.verification.VerificationService;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.AbisVoicePort;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IamVoiceEnrollmentPort;
import com.oracle.aiworld.voice.port.IamVoiceVerificationPort;
import com.oracle.aiworld.voice.port.SpeechTranscriptionPort;
import com.oracle.aiworld.voice.port.VoiceBranchSession;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

class VoiceSessionServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-02T00:00:00Z");

    @Test
    void preauthorizesBindsBothBranchesAndFansOutCanonicalPcm() {
        AtomicBoolean enrolled = new AtomicBoolean();
        EnrollmentStatusPort status = (user, correlation) ->
                Mono.just(new EnrollmentObservation(
                        enrolled.get() ? EnrollmentStatus.ENROLLED : EnrollmentStatus.NOT_ENROLLED,
                        NOW));
        IamVoiceEnrollmentPort iam = new IamVoiceEnrollmentPort() {
            @Override
            public Mono<EnrollmentInitiation> beginEnrollment(String user, String locale, String correlation) {
                return Mono.just(new EnrollmentInitiation(
                        "factor-1", "request-state-0", "en", "Current consent"));
            }

            @Override
            public Mono<EnrollmentAuthorization> createEnrollmentSession(
                    String user, String factorId, String requestState, String correlation) {
                return Mono.just(new EnrollmentAuthorization(
                        user, factorId, "state-1", "token-1".toCharArray()));
            }

            @Override
            public Mono<EnrollmentCompletion> completeEnrollment(
                    String user,
                    String factorId,
                    String requestState,
                    String correlation) {
                enrolled.set(true);
                return Mono.just(new EnrollmentCompletion());
            }
        };
        EnrollmentService enrollment = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        var attempt = enrollment.begin("owner-1", "doctor-guid", "en", "correlation-1").block();
        enrollment.recordConsent("owner-1", attempt.enrollmentAttemptId(),
                "ACCEPT", attempt.consent().version());

        List<byte[]> abisFrames = new ArrayList<>();
        List<byte[]> speechFrames = new ArrayList<>();
        EventBranch abisBranch = new EventBranch(abisFrames);
        EventBranch speechBranch = new EventBranch(speechFrames);
        AbisVoicePort abis = request -> Mono.just(abisBranch);
        SpeechTranscriptionPort speech = request -> Mono.just(speechBranch);
        VoiceSessionService service = new VoiceSessionService(
                enrollment, abis, speech, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var created = service.createEnrollment(
                "owner-1", attempt.enrollmentAttemptId(), VoiceSessionService.AudioProfile.canonical(),
                "correlation-2").block();
        assertThat(created.state()).isEqualTo(VoiceSessionService.SessionState.PREAUTHORIZED);
        assertThat(created.websocketPath()).isEqualTo("/ws/v1/voice");

        var bound = service.bind("owner-1", created.voiceSessionId()).block();
        assertThat(bound.state()).isEqualTo(VoiceSessionService.SessionState.READY);
        service.startCapture("owner-1", created.voiceSessionId()).block();
        List<VoiceBranchSession.BranchEvent> providerEvents = new ArrayList<>();
        service.events("owner-1", created.voiceSessionId()).subscribe(providerEvents::add);
        byte[] frame = new byte[640];
        var acknowledgement = service.acceptAudio("owner-1", created.voiceSessionId(), frame).block();
        speechBranch.emit(new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.TRANSCRIPT_PARTIAL,
                "SPEECH",
                "TRANSCRIPT_PARTIAL",
                "SPEECH_TRANSCRIPT_AVAILABLE",
                java.util.Map.of(
                        "utteranceId", "utterance-1",
                        "revision", 1L,
                        "text", "The patient reports",
                        "startAudioSequence", 1L,
                        "endAudioSequence", 1L)));
        abisBranch.emit(VoiceBranchSession.BranchEventType.WAITING, "WAIT", "ABIS_PROCESSING");
        abisBranch.emit(
                VoiceBranchSession.BranchEventType.SUCCEEDED,
                "SHOW_SUCCESS",
                "REGISTRATION_SUCCEEDED");
        var trailingAcknowledgement = service.acceptAudio(
                "owner-1", created.voiceSessionId(), new byte[640]).block();
        var completed = service.complete("owner-1", created.voiceSessionId()).block();

        assertThat(acknowledgement.acceptedThroughAudioSequence()).isEqualTo(1);
        assertThat(trailingAcknowledgement.acceptedThroughAudioSequence()).isEqualTo(2);
        assertThat(completed.state()).isEqualTo(VoiceSessionService.SessionState.COMPLETED);
        assertThat(providerEvents).extracting(event -> event.type().name())
                .containsExactly("TRANSCRIPT_PARTIAL", "WAITING", "SUCCEEDED");
        assertThat(abisFrames).singleElement().satisfies(value -> assertThat(value).hasSize(640));
        assertThat(speechFrames).singleElement().satisfies(value -> assertThat(value).hasSize(640));
    }

    @Test
    void avoidsLockInversionBetweenProviderCallbackAndConcurrentAudioDelivery() throws Exception {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, NOW));
        IamVoiceEnrollmentPort iam = new IamVoiceEnrollmentPort() {
            @Override
            public Mono<EnrollmentInitiation> beginEnrollment(
                    String user, String locale, String correlation) {
                return Mono.just(new EnrollmentInitiation(
                        "factor-1", "request-state-0", "en", "Current consent"));
            }

            @Override
            public Mono<EnrollmentAuthorization> createEnrollmentSession(
                    String user, String factorId, String requestState, String correlation) {
                return Mono.just(new EnrollmentAuthorization(
                        user, factorId, "state-1", "token-1".toCharArray()));
            }
        };
        EnrollmentService enrollment = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        var attempt = enrollment.begin("owner-1", "doctor-guid", "en", "correlation-1").block();
        enrollment.recordConsent(
                "owner-1", attempt.enrollmentAttemptId(), "ACCEPT", attempt.consent().version());

        LockInvertingBranch abisBranch = new LockInvertingBranch();
        SpeechTranscriptionPort speech = new SpeechTranscriptionPort() {
            @Override
            public boolean availableForLiveSession() {
                return false;
            }

            @Override
            public Mono<VoiceBranchSession> open(OpenRequest request) {
                return Mono.error(new AssertionError("disabled Speech branch must not open"));
            }
        };
        VoiceSessionService service = new VoiceSessionService(
                enrollment, request -> Mono.just(abisBranch), speech,
                Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        var created = service.createEnrollment(
                "owner-1", attempt.enrollmentAttemptId(),
                VoiceSessionService.AudioProfile.canonical(), "correlation-2").block();
        service.bind("owner-1", created.voiceSessionId()).block();
        service.startCapture("owner-1", created.voiceSessionId()).block();

        ExecutorService executor = Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "voice-lock-inversion-regression");
            thread.setDaemon(true);
            return thread;
        });
        try {
            Future<?> callback = executor.submit(abisBranch::emitWhileHoldingProviderLock);
            assertThat(abisBranch.providerLockHeld.await(1, TimeUnit.SECONDS))
                    .as("provider callback acquired its SDK-like lock")
                    .isTrue();

            Future<VoiceSessionService.AudioAcknowledgement> audio = executor.submit(() ->
                    service.acceptAudio(
                            "owner-1", created.voiceSessionId(), new byte[640]).block());

            assertThat(abisBranch.sendAudioEntered.await(1, TimeUnit.SECONDS))
                    .as("audio dispatch reached the provider while its lock was held")
                    .isTrue();
            callback.get(2, TimeUnit.SECONDS);
            VoiceSessionService.AudioAcknowledgement acknowledgement =
                    audio.get(2, TimeUnit.SECONDS);

            assertThat(acknowledgement.acceptedThroughAudioSequence()).isEqualTo(1L);
            assertThat(abisBranch.callbackDelivered).isTrue();
            service.cancel("owner-1", created.voiceSessionId());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void completesIamRequestExactlyOnceWhenAbisEnrollmentFailsAndPreservesAbisFailure() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, NOW));
        AtomicInteger iamCompletionCount = new AtomicInteger();
        IamVoiceEnrollmentPort iam = new IamVoiceEnrollmentPort() {
            @Override
            public Mono<EnrollmentInitiation> beginEnrollment(
                    String user, String locale, String correlation) {
                return Mono.just(new EnrollmentInitiation(
                        "factor-1", "request-state-0", "en", "Current consent"));
            }

            @Override
            public Mono<EnrollmentAuthorization> createEnrollmentSession(
                    String user, String factorId, String requestState, String correlation) {
                return Mono.just(new EnrollmentAuthorization(
                        user, factorId, "state-1", "token-1".toCharArray()));
            }

            @Override
            public Mono<EnrollmentCompletion> completeEnrollment(
                    String user,
                    String factorId,
                    String requestState,
                    String correlation) {
                iamCompletionCount.incrementAndGet();
                return Mono.error(new IamVoiceEnrollmentPort.EnrollmentUnavailableException());
            }
        };
        EnrollmentService enrollment = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        var attempt = enrollment.begin("owner-1", "doctor-guid", "en", "correlation-1").block();
        enrollment.recordConsent("owner-1", attempt.enrollmentAttemptId(),
                "ACCEPT", attempt.consent().version());
        EventBranch abisBranch = new EventBranch(new ArrayList<>());
        VoiceSessionService service = new VoiceSessionService(
                enrollment, request -> Mono.just(abisBranch),
                request -> Mono.just(new EventBranch(new ArrayList<>())),
                Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var created = service.createEnrollment(
                "owner-1", attempt.enrollmentAttemptId(),
                VoiceSessionService.AudioProfile.canonical(), "correlation-2").block();
        service.bind("owner-1", created.voiceSessionId()).block();
        service.startCapture("owner-1", created.voiceSessionId()).block();
        var events = new ArrayList<VoiceBranchSession.BranchEvent>();
        service.events("owner-1", created.voiceSessionId()).subscribe(events::add);

        var abisFailure = new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.FAILED,
                "ABIS", "SHOW_FAILURE", "REGISTRATION_REJECTED", java.util.Map.of());
        abisBranch.emit(abisFailure);
        abisBranch.emit(abisFailure);

        assertThat(iamCompletionCount).hasValue(1);
        assertThat(service.get("owner-1", created.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.FAILED);
        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event.source()).isEqualTo("ABIS");
            assertThat(event.safeCode()).isEqualTo("REGISTRATION_REJECTED");
        });
    }

    @Test
    void startsAbisEnrollmentAndMarksSpeechNotConfiguredWhenSpeechIsDisabled() {
        EnrollmentStatusPort status = (user, correlation) ->
                Mono.just(new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, NOW));
        IamVoiceEnrollmentPort iam = new IamVoiceEnrollmentPort() {
            @Override
            public Mono<EnrollmentInitiation> beginEnrollment(
                    String user, String locale, String correlation) {
                return Mono.just(new EnrollmentInitiation(
                        "factor-1", "request-state-0", "en", "Current consent"));
            }

            @Override
            public Mono<EnrollmentAuthorization> createEnrollmentSession(
                    String user, String factorId, String requestState, String correlation) {
                return Mono.just(new EnrollmentAuthorization(
                        user, factorId, "state-1", "token-1".toCharArray()));
            }
        };
        EnrollmentService enrollment = new EnrollmentService(
                status, iam, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());
        var attempt = enrollment.begin("owner-1", "doctor-guid", "en", "correlation-1").block();
        enrollment.recordConsent("owner-1", attempt.enrollmentAttemptId(),
                "ACCEPT", attempt.consent().version());

        List<byte[]> abisFrames = new ArrayList<>();
        AbisVoicePort abis = request -> Mono.just(branch(abisFrames));
        SpeechTranscriptionPort speech = new SpeechTranscriptionPort() {
            @Override
            public boolean availableForLiveSession() { return false; }

            @Override
            public Mono<VoiceBranchSession> open(OpenRequest request) {
                return Mono.error(new AssertionError("disabled Speech branch must not open"));
            }
        };
        VoiceSessionService service = new VoiceSessionService(
                enrollment, abis, speech, Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var created = service.createEnrollment(
                "owner-1", attempt.enrollmentAttemptId(), VoiceSessionService.AudioProfile.canonical(),
                "correlation-2").block();
        assertThat(created.dependencies())
                .anySatisfy(dependency -> {
                    assertThat(dependency.dependency()).isEqualTo("SPEECH");
                    assertThat(dependency.state()).isEqualTo("NOT_CONFIGURED");
                });

        var bound = service.bind("owner-1", created.voiceSessionId()).block();
        assertThat(bound.state()).isEqualTo(VoiceSessionService.SessionState.READY);
        service.startCapture("owner-1", created.voiceSessionId()).block();
        service.acceptAudio("owner-1", created.voiceSessionId(), new byte[640]).block();

        assertThat(abisFrames).singleElement().satisfies(value -> assertThat(value).hasSize(640));
    }

    @Test
    void authorizesVerificationAndFansOneBrowserStreamToAbisAndSpeech() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, NOW));
        AtomicInteger iamCompletionCount = new AtomicInteger();
        IamVoiceVerificationPort iamVerification = new IamVoiceVerificationPort() {
            @Override
            public Mono<VerificationAuthorization> authorizeVerification(
                    String user, String correlation) {
                return Mono.just(new VerificationAuthorization(
                        user, "factor-1", "request-1", "state-1",
                        "verify-token".toCharArray()));
            }

            @Override
            public Mono<VerificationCompletion> completeVerification(
                    String user,
                    String factorId,
                    String requestId,
                    String requestState,
                    String correlation) {
                assertThat("doctor-guid".equals(user)
                        && "factor-1".equals(factorId)
                        && "request-1".equals(requestId)
                        && "state-1".equals(requestState)).isTrue();
                iamCompletionCount.incrementAndGet();
                return Mono.just(new VerificationCompletion(user, factorId));
            }
        };
        VerificationService verification = new VerificationService(status, iamVerification);
        EnrollmentService enrollment = new EnrollmentService(
                status,
                (user, locale, correlation) -> Mono.error(new AssertionError()),
                Clock.fixed(NOW, ZoneOffset.UTC),
                new SecureRandom());
        List<byte[]> abisFrames = new ArrayList<>();
        List<byte[]> speechFrames = new ArrayList<>();
        EventBranch abisBranch = new EventBranch(abisFrames);
        EventBranch speechBranch = new EventBranch(speechFrames);
        Sinks.One<Void> speechDrain = Sinks.one();
        speechBranch.completion = speechDrain.asMono();
        AtomicBoolean verificationPurpose = new AtomicBoolean();
        AbisVoicePort abis = request -> {
            verificationPurpose.set("VERIFICATION".equals(request.purpose()));
            return Mono.just(abisBranch);
        };
        SpeechTranscriptionPort speech = request -> Mono.just(speechBranch);
        VoiceSessionService service = new VoiceSessionService(
                enrollment, verification, abis, speech,
                Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var created = service.createVerification(
                "owner-1", "doctor-guid", VoiceSessionService.AudioProfile.canonical(),
                "correlation-1").block();
        service.bind("owner-1", created.voiceSessionId()).block();
        service.startCapture("owner-1", created.voiceSessionId()).block();
        service.acceptAudio("owner-1", created.voiceSessionId(), new byte[640]).block();
        var paused = service.pauseCapture("owner-1", created.voiceSessionId()).block();
        service.acceptAudio("owner-1", created.voiceSessionId(), new byte[640]).block();
        var resumed = service.resumeCapture("owner-1", created.voiceSessionId()).block();
        service.acceptAudio("owner-1", created.voiceSessionId(), new byte[640]).block();
        var events = new ArrayList<VoiceBranchSession.BranchEvent>();
        service.events("owner-1", created.voiceSessionId()).subscribe(events::add);
        abisBranch.emit(new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.ASSURANCE_RESULT,
                "ABIS", "RECORD_UTTERANCE", "VOICE_MATCH",
                java.util.Map.of(
                        "utteranceId", "opaque-one",
                        "utteranceOrdinal", 1L,
                        "outcome", "MATCH")));
        abisBranch.emit(new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.ASSURANCE_RESULT,
                "ABIS", "RECORD_UTTERANCE", "VOICE_MISMATCH",
                java.util.Map.of(
                        "utteranceId", "opaque-two",
                        "utteranceOrdinal", 2L,
                        "outcome", "MISMATCH")));
        assertThat(iamCompletionCount).hasValue(0);
        assertThat(service.get("owner-1", created.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.CAPTURING);
        abisBranch.emit(new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.SUCCEEDED,
                "ABIS", "SHOW_SUCCESS", "VOICE_MATCH", java.util.Map.of("outcome", "MATCH")));
        abisBranch.emit(new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.SUCCEEDED,
                "ABIS", "SHOW_SUCCESS", "VOICE_MATCH", java.util.Map.of("outcome", "MATCH")));

        assertThat(iamCompletionCount).hasValue(1);
        assertThat(service.get("owner-1", created.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.DRAINING);
        assertThat(events).hasSize(2);
        speechDrain.tryEmitEmpty();

        assertThat(verificationPurpose).isTrue();
        assertThat(paused.state()).isEqualTo(VoiceSessionService.SessionState.MUTED);
        assertThat(resumed.state()).isEqualTo(VoiceSessionService.SessionState.CAPTURING);
        assertThat(abisBranch.pauseCount).hasValue(1);
        assertThat(abisFrames).hasSize(2);
        assertThat(speechFrames).hasSize(2);
        assertThat(iamCompletionCount).hasValue(1);
        assertThat(service.get("owner-1", created.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.COMPLETED);
        assertThat(events).hasSize(3);
        assertThat(events.subList(0, 2))
                .extracting(event -> event.payload().get("utteranceId"))
                .containsExactly("opaque-one", "opaque-two");
        assertThat(events.get(2).payload()).containsEntry("outcome", "MATCH");
    }

    @Test
    void completesIamRequestExactlyOnceWhenAbisVerificationFailsAndPreservesAbisFailure() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, NOW));
        AtomicInteger iamCompletionCount = new AtomicInteger();
        IamVoiceVerificationPort iamVerification = new IamVoiceVerificationPort() {
            @Override
            public Mono<VerificationAuthorization> authorizeVerification(
                    String user, String correlation) {
                return Mono.just(new VerificationAuthorization(
                        user, "factor-1", "request-1", "state-1",
                        "verify-token".toCharArray()));
            }

            @Override
            public Mono<VerificationCompletion> completeVerification(
                    String user,
                    String factorId,
                    String requestId,
                    String requestState,
                    String correlation) {
                iamCompletionCount.incrementAndGet();
                return Mono.just(new VerificationCompletion(user, factorId));
            }
        };
        VerificationService verification = new VerificationService(status, iamVerification);
        EnrollmentService enrollment = new EnrollmentService(
                status,
                (user, locale, correlation) -> Mono.error(new AssertionError()),
                Clock.fixed(NOW, ZoneOffset.UTC),
                new SecureRandom());
        EventBranch abisBranch = new EventBranch(new ArrayList<>());
        VoiceSessionService service = new VoiceSessionService(
                enrollment, verification, request -> Mono.just(abisBranch),
                request -> Mono.just(new EventBranch(new ArrayList<>())),
                Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var created = service.createVerification(
                "owner-1", "doctor-guid", VoiceSessionService.AudioProfile.canonical(),
                "correlation-1").block();
        service.bind("owner-1", created.voiceSessionId()).block();
        service.startCapture("owner-1", created.voiceSessionId()).block();
        var events = new ArrayList<VoiceBranchSession.BranchEvent>();
        service.events("owner-1", created.voiceSessionId()).subscribe(events::add);

        var abisFailure = new VoiceBranchSession.BranchEvent(
                VoiceBranchSession.BranchEventType.FAILED,
                "ABIS", "SHOW_FAILURE", "ABIS_VERIFICATION_FAILED", java.util.Map.of());
        abisBranch.emit(abisFailure);
        abisBranch.emit(abisFailure);

        assertThat(iamCompletionCount).hasValue(1);
        assertThat(service.get("owner-1", created.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.FAILED);
        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event.source()).isEqualTo("ABIS");
            assertThat(event.safeCode()).isEqualTo("ABIS_VERIFICATION_FAILED");
        });
    }

    @Test
    void keepsParallelUsersVoiceSessionsAndAudioIsolated() {
        EnrollmentStatusPort status = (user, correlation) -> Mono.just(
                new EnrollmentObservation(EnrollmentStatus.ENROLLED, NOW));
        IamVoiceVerificationPort iamVerification = new IamVoiceVerificationPort() {
            @Override
            public Mono<VerificationAuthorization> authorizeVerification(
                    String user, String correlation) {
                return Mono.just(new VerificationAuthorization(
                        user, "factor-" + user, "request-" + user, "state-" + user,
                        ("token-" + user).toCharArray()));
            }

            @Override
            public Mono<VerificationCompletion> completeVerification(
                    String user, String factorId, String requestId,
                    String requestState, String correlation) {
                return Mono.just(new VerificationCompletion(user, factorId));
            }
        };
        VerificationService verification = new VerificationService(status, iamVerification);
        EnrollmentService enrollment = new EnrollmentService(
                status,
                (user, locale, correlation) -> Mono.error(new AssertionError()),
                Clock.fixed(NOW, ZoneOffset.UTC),
                new SecureRandom());
        Map<String, List<byte[]>> abisFramesBySession = new ConcurrentHashMap<>();
        AbisVoicePort abis = request -> {
            List<byte[]> frames = new ArrayList<>();
            abisFramesBySession.put(request.voiceSessionId(), frames);
            return Mono.just(branch(frames));
        };
        SpeechTranscriptionPort speech = new SpeechTranscriptionPort() {
            @Override
            public boolean availableForLiveSession() { return false; }

            @Override
            public Mono<VoiceBranchSession> open(OpenRequest request) {
                return Mono.error(new AssertionError("disabled Speech branch must not open"));
            }
        };
        VoiceSessionService service = new VoiceSessionService(
                enrollment, verification, abis, speech,
                Clock.fixed(NOW, ZoneOffset.UTC), new SecureRandom());

        var first = service.createVerification(
                "owner-1", "guid-1", VoiceSessionService.AudioProfile.canonical(),
                "correlation-1").block();
        var second = service.createVerification(
                "owner-2", "guid-2", VoiceSessionService.AudioProfile.canonical(),
                "correlation-2").block();

        service.bind("owner-1", first.voiceSessionId()).block();
        service.bind("owner-2", second.voiceSessionId()).block();
        service.startCapture("owner-1", first.voiceSessionId()).block();
        service.startCapture("owner-2", second.voiceSessionId()).block();
        byte[] firstFrame = new byte[640];
        byte[] secondFrame = new byte[640];
        firstFrame[0] = 1;
        secondFrame[0] = 2;
        service.acceptAudio("owner-1", first.voiceSessionId(), firstFrame).block();
        service.acceptAudio("owner-2", second.voiceSessionId(), secondFrame).block();

        assertThat(first.voiceSessionId()).isNotEqualTo(second.voiceSessionId());
        assertThat(abisFramesBySession.get(first.voiceSessionId()))
                .singleElement().satisfies(frame -> assertThat(frame[0]).isEqualTo((byte) 1));
        assertThat(abisFramesBySession.get(second.voiceSessionId()))
                .singleElement().satisfies(frame -> assertThat(frame[0]).isEqualTo((byte) 2));
        assertThatThrownBy(() -> service.get("owner-1", second.voiceSessionId()))
                .isInstanceOf(com.oracle.aiworld.voice.api.ApiException.class);

        service.cancel("owner-1", first.voiceSessionId());
        assertThat(service.hasActiveSession("owner-1")).isFalse();
        assertThat(service.hasActiveSession("owner-2")).isTrue();
        assertThat(service.get("owner-2", second.voiceSessionId()).state())
                .isEqualTo(VoiceSessionService.SessionState.CAPTURING);
        service.cancel("owner-2", second.voiceSessionId());
    }

    private static VoiceBranchSession branch(List<byte[]> frames) {
        return new VoiceBranchSession() {
            @Override
            public Mono<Void> sendAudio(long sequence, byte[] pcm) {
                frames.add(pcm.clone());
                return Mono.empty();
            }

            @Override
            public Mono<Void> complete() { return Mono.empty(); }

            @Override
            public Mono<Void> cancel() { return Mono.empty(); }
        };
    }

    private static final class EventBranch implements VoiceBranchSession {
        private final List<byte[]> frames;
        private final Sinks.Many<BranchEvent> events = Sinks.many().replay().limit(4);
        private final AtomicInteger pauseCount = new AtomicInteger();
        private Mono<Void> completion = Mono.empty();

        private EventBranch(List<byte[]> frames) {
            this.frames = frames;
        }

        private void emit(BranchEventType type, String action, String safeCode) {
            events.tryEmitNext(new BranchEvent(type, action, safeCode));
        }

        private void emit(BranchEvent event) {
            events.tryEmitNext(event);
        }

        @Override
        public Mono<Void> sendAudio(long sequence, byte[] pcm) {
            frames.add(pcm.clone());
            return Mono.empty();
        }

        @Override
        public Mono<Void> complete() {
            return completion;
        }

        @Override
        public Mono<Void> pause() {
            pauseCount.incrementAndGet();
            return Mono.empty();
        }

        @Override
        public Mono<Void> cancel() {
            return Mono.empty();
        }

        @Override
        public Flux<BranchEvent> events() {
            return events.asFlux();
        }
    }

    /**
     * Reproduces the lock order used by a provider SDK callback: the callback owns the
     * provider lock before entering the application, while audio delivery enters the provider
     * after entering the application. Calling {@code sendAudio} while holding StoredSession's
     * monitor would therefore deadlock these two daemon threads.
     */
    private static final class LockInvertingBranch implements VoiceBranchSession {
        private final Object providerLock = new Object();
        private final CountDownLatch providerLockHeld = new CountDownLatch(1);
        private final CountDownLatch sendAudioEntered = new CountDownLatch(1);
        private final AtomicBoolean callbackDelivered = new AtomicBoolean();
        private final Sinks.Many<BranchEvent> events = Sinks.many().replay().limit(1);

        private void emitWhileHoldingProviderLock() {
            synchronized (providerLock) {
                providerLockHeld.countDown();
                try {
                    if (!sendAudioEntered.await(1, TimeUnit.SECONDS)) {
                        throw new AssertionError("audio dispatch did not enter the provider");
                    }
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError("provider callback was interrupted", interrupted);
                }
                Sinks.EmitResult result = events.tryEmitNext(new BranchEvent(
                        BranchEventType.WAITING,
                        "ABIS",
                        "RECORD_UTTERANCE",
                        "ABIS_RECORDING_NEXT_SAMPLE",
                        Map.of()));
                if (result.isFailure()) {
                    throw new AssertionError("provider callback emission failed: " + result);
                }
                callbackDelivered.set(true);
            }
        }

        @Override
        public Mono<Void> sendAudio(long sequence, byte[] pcm) {
            sendAudioEntered.countDown();
            synchronized (providerLock) {
                return Mono.empty();
            }
        }

        @Override
        public Mono<Void> complete() {
            return Mono.empty();
        }

        @Override
        public Mono<Void> cancel() {
            return Mono.empty();
        }

        @Override
        public Flux<BranchEvent> events() {
            return events.asFlux();
        }
    }
}
