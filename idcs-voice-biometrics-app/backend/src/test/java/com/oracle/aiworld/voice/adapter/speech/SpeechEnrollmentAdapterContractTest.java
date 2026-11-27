package com.oracle.aiworld.voice.adapter.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.ProviderTranscript;
import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.ProviderToken;
import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.RealtimeClient;
import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.RealtimeClientFactory;
import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.RealtimeListener;
import com.oracle.aiworld.voice.adapter.speech.OciSpeechAdapter.SpeechConfiguration;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import com.oracle.aiworld.voice.port.SpeechTranscriptionPort;
import com.oracle.aiworld.voice.port.VoiceBranchSession;
import com.oracle.bmc.aispeech.model.RealtimeParameters;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.eclipse.jetty.websocket.client.WebSocketClient;
import org.junit.jupiter.api.Test;

class SpeechEnrollmentAdapterContractTest {
    @Test
    void pinnedJettyClientHasNoSpringBootFourBinaryLinkageConflict() throws Exception {
        WebSocketClient client = new WebSocketClient();
        client.start();
        try {
            assertThat(client.isStarted()).isTrue();
        } finally {
            client.stop();
        }
    }

    @Test
    void remainsUnavailableUntilEveryServerSideSettingIsValid() {
        OciSpeechAdapter disabled = new OciSpeechAdapter(configuration(false), new FakeFactory());

        assertThat(disabled.availableForLiveSession()).isFalse();
        assertThatThrownBy(() -> new OciSpeechAdapter(
                configuration(true).withEndpoint("ws://speech.example.test"), new FakeFactory()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invalid enabled OCI Speech configuration");
        assertThatThrownBy(() -> new OciSpeechAdapter(
                configuration(true).withAuthMode("API_KEY"), new FakeFactory()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invalid enabled OCI Speech configuration");
    }

    @Test
    void buildsOracleParametersWithOracleOnlyStreamingControls() {
        RealtimeParameters parameters = OciSpeechAdapter.parameters(configuration(true));

        assertThat(parameters.getModelType()).isEqualTo("ORACLE");
        assertThat(parameters.getModelDomain()).isEqualTo(RealtimeParameters.ModelDomain.Medical);
        assertThat(parameters.getLanguageCode()).isEqualTo("en-US");
        assertThat(parameters.getPartialSilenceThresholdInMs()).isZero();
        assertThat(parameters.getFinalSilenceThresholdInMs()).isEqualTo(2000);
        assertThat(parameters.getStabilizePartialResults())
                .isEqualTo(RealtimeParameters.StabilizePartialResults.None);
    }

    @Test
    void buildsWhisperParametersWithoutOracleOnlyStreamingControls() {
        SpeechConfiguration whisper = whisperConfiguration("en");

        assertThat(new OciSpeechAdapter(whisper, new FakeFactory()).availableForLiveSession()).isTrue();
        RealtimeParameters parameters = OciSpeechAdapter.parameters(whisper);
        assertThat(parameters.getModelType()).isEqualTo("WHISPER");
        assertThat(parameters.getModelDomain()).isEqualTo(RealtimeParameters.ModelDomain.Generic);
        assertThat(parameters.getLanguageCode()).isEqualTo("en");
        assertThat(parameters.getPartialSilenceThresholdInMs()).isNull();
        assertThat(parameters.getFinalSilenceThresholdInMs()).isNull();
        assertThat(parameters.getStabilizePartialResults()).isNull();
        assertThat(parameters.getCustomizations()).isNull();
        assertThat(parameters.getShouldIgnoreInvalidCustomizations()).isNull();
    }

    @Test
    void whisperPublishesOnlyFinalTranscriptResults() {
        FakeFactory factory = new FakeFactory();
        VoiceBranchSession branch = new OciSpeechAdapter(
                whisperConfiguration("en"), factory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-whisper", "correlation-whisper", AudioProfile.canonical()))
                .block();
        List<VoiceBranchSession.BranchEvent> events = new CopyOnWriteArrayList<>();
        branch.events().subscribe(events::add);

        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-whisper", "ignored partial", false, 0, 400, 0.7f));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-whisper", "Final transcript.", true, 0, 800, 0.9f,
                List.of(new ProviderToken("Final", 0, 300, "WORD"))));

        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event.type()).isEqualTo(VoiceBranchSession.BranchEventType.TRANSCRIPT_FINAL);
            assertThat(event.payload()).containsEntry("text", "Final transcript.");
        });
    }

    @Test
    void whisperDeduplicatesFinalsWithinASessionAndAcceptsThemAfterRestart() {
        ProviderTranscript finalResult = new ProviderTranscript(
                "speech-session-whisper", "Final transcript.", true, 0, 800, 0.9f,
                List.of(new ProviderToken("Final", 0, 300, "WORD")));

        FakeFactory firstFactory = new FakeFactory();
        VoiceBranchSession first = new OciSpeechAdapter(
                whisperConfiguration("en"), firstFactory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-whisper-1", "correlation-whisper-1",
                        AudioProfile.canonical()))
                .block();
        List<VoiceBranchSession.BranchEvent> firstEvents = new CopyOnWriteArrayList<>();
        first.events().subscribe(firstEvents::add);
        firstFactory.listener.onTranscript(finalResult);
        firstFactory.listener.onTranscript(finalResult);

        FakeFactory restartedFactory = new FakeFactory();
        VoiceBranchSession restarted = new OciSpeechAdapter(
                whisperConfiguration("en"), restartedFactory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-whisper-2", "correlation-whisper-2",
                        AudioProfile.canonical()))
                .block();
        List<VoiceBranchSession.BranchEvent> restartedEvents = new CopyOnWriteArrayList<>();
        restarted.events().subscribe(restartedEvents::add);
        restartedFactory.listener.onTranscript(finalResult);

        assertThat(firstEvents).singleElement().satisfies(event ->
                assertThat(event.payload()).containsEntry("revision", 1L));
        assertThat(restartedEvents).singleElement().satisfies(event ->
                assertThat(event.payload()).containsEntry("revision", 1L));
        first.cancel().block();
        restarted.cancel().block();
    }

    @Test
    void acceptsWhisperAutoLanguageAndRejectsLocaleAndMedicalCombinations() {
        assertThat(new OciSpeechAdapter(whisperConfiguration("auto"), new FakeFactory())
                .availableForLiveSession()).isTrue();
        assertThatThrownBy(() -> new OciSpeechAdapter(
                whisperConfiguration("en-US"), new FakeFactory()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new OciSpeechAdapter(
                new SpeechConfiguration(
                        true, "SESSION_TOKEN", "/tmp/oci-config", "AI_WORLD_DEMO", "", "",
                        "ocid1.compartment.oc1..example", "", "WHISPER", "MEDICAL", "en",
                        "audio/raw;rate=16000", "AUTO", true, "NONE", 0, 300, 1000, 1000),
                new FakeFactory())).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void derivesTenancyAndRegionFromSessionProfileAndSupportsInstancePrincipalConfiguration() {
        SpeechConfiguration sessionToken = providerDerivedConfiguration("SESSION_TOKEN");
        SpeechConfiguration instancePrincipal = providerDerivedConfiguration("INSTANCE_PRINCIPAL");

        assertThat(new OciSpeechAdapter(sessionToken, new FakeFactory()).availableForLiveSession())
                .isTrue();
        assertThat(new OciSpeechAdapter(instancePrincipal, new FakeFactory()).availableForLiveSession())
                .isTrue();
    }

    @Test
    void waitsForAuthenticatedReadinessThenStreamsCanonicalPcmAndNormalizesResults() {
        FakeFactory factory = new FakeFactory();
        OciSpeechAdapter adapter = new OciSpeechAdapter(configuration(true), factory);

        VoiceBranchSession branch = adapter.open(new SpeechTranscriptionPort.OpenRequest(
                "voice-session-1", "correlation-1", AudioProfile.canonical())).block();
        List<VoiceBranchSession.BranchEvent> events = new CopyOnWriteArrayList<>();
        branch.events().subscribe(events::add);

        byte[] pcm = new byte[640];
        pcm[0] = 42;
        branch.sendAudio(1, pcm).block();
        factory.listener.onAcknowledgement(1, 0, 640);
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "The patient reports", false, 0, 640, 0.91f));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "The patient reports fatigue.", true, 0, 1280, 0.96f,
                List.of(
                        new ProviderToken("The", 0, 120, "WORD"),
                        new ProviderToken("patient", 121, 400, "WORD"),
                        new ProviderToken("reports", 401, 780, "WORD"),
                        new ProviderToken("fatigue", 781, 1200, "WORD"),
                        new ProviderToken(".", 1201, 1201, "PUNCTUATION"))));
        branch.complete().block();

        assertThat(factory.openCount).isEqualTo(1);
        assertThat(factory.client.audio).singleElement().satisfies(frame -> {
            assertThat(frame).hasSize(640);
            assertThat(frame[0]).isEqualTo((byte) 42);
        });
        assertThat(pcm).containsOnly((byte) 0);
        assertThat(factory.client.finalRequested).isTrue();
        assertThat(factory.client.closed).isTrue();
        assertThat(events).extracting(event -> event.type().name())
                .containsExactly("ACKNOWLEDGED", "TRANSCRIPT_PARTIAL", "TRANSCRIPT_FINAL");
        assertThat(events.get(1).payload()).containsEntry("text", "The patient reports")
                .containsEntry("startAudioSequence", 1L)
                .containsEntry("endAudioSequence", 32L);
        assertThat(events.get(2).payload()).containsEntry("revision", 2L)
                .containsEntry("startAudioSequence", 1L)
                .containsEntry("endAudioSequence", 64L);
        assertThat(events.get(2).payload().get("tokens")).asList().hasSize(5);
    }

    @Test
    void turnsProviderFailureIntoTypedSpeechFailureAndClosesTransientResources() {
        FakeFactory factory = new FakeFactory();
        OciSpeechAdapter adapter = new OciSpeechAdapter(configuration(true), factory);
        VoiceBranchSession branch = adapter.open(new SpeechTranscriptionPort.OpenRequest(
                "voice-session-1", "correlation-1", AudioProfile.canonical())).block();
        List<VoiceBranchSession.BranchEvent> events = new CopyOnWriteArrayList<>();
        branch.events().subscribe(events::add);

        factory.listener.onFailure(new IllegalStateException("provider detail must not escape"));

        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event.type()).isEqualTo(VoiceBranchSession.BranchEventType.FAILED);
            assertThat(event.source()).isEqualTo("SPEECH");
            assertThat(event.safeCode()).isEqualTo("SPEECH_PROCESSING_FAILED");
            assertThat(event.payload()).isEmpty();
        });
        assertThat(factory.client.closed).isTrue();
    }

    @Test
    void endWaitsForAllOutstandingTextInsteadOfReusingAnEarlierFinal() throws Exception {
        FakeFactory factory = new FakeFactory();
        VoiceBranchSession branch = new OciSpeechAdapter(configuration(true), factory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-drain", "correlation-drain", AudioProfile.canonical())).block();
        branch.sendAudio(1, new byte[96_000]).block();
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Earlier final", true, 0, 1000, 0.9f));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Second pending", false, 1000, 2000, 0.8f));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Third pending", false, 2000, 3000, 0.8f));

        var completion = branch.complete().toFuture();
        assertThat(factory.client.finalRequest.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(completion.isDone()).isFalse();
        assertThat(factory.client.closed).isFalse();

        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Third final", true, 2000, 3000, 0.9f));
        assertThat(completion.isDone()).isFalse();
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Second final", true, 1000, 2000, 0.9f));
        completion.get(1, TimeUnit.SECONDS);
        assertThat(factory.client.closed).isTrue();
    }

    @Test
    void drainDeadlineClosesWithoutInventingAFinalTranscript() {
        FakeFactory factory = new FakeFactory();
        VoiceBranchSession branch = new OciSpeechAdapter(configuration(true), factory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-timeout", "correlation-timeout", AudioProfile.canonical())).block();
        List<VoiceBranchSession.BranchEvent> events = new CopyOnWriteArrayList<>();
        branch.events().subscribe(events::add);
        branch.sendAudio(1, new byte[640]).block();
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Available partial", false, 0, 20, 0.8f));

        branch.complete().block(java.time.Duration.ofSeconds(3));

        assertThat(factory.client.closed).isTrue();
        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event.type()).isEqualTo(VoiceBranchSession.BranchEventType.TRANSCRIPT_PARTIAL);
            assertThat(event.payload()).containsEntry("text", "Available partial");
        });
    }

    @Test
    void ignoresDuplicateUnmappableAndPostFinalConflictingFragments() {
        FakeFactory factory = new FakeFactory();
        OciSpeechAdapter adapter = new OciSpeechAdapter(configuration(true), factory);
        VoiceBranchSession branch = adapter.open(new SpeechTranscriptionPort.OpenRequest(
                "voice-session-1", "correlation-1", AudioProfile.canonical())).block();
        List<VoiceBranchSession.BranchEvent> events = new CopyOnWriteArrayList<>();
        branch.events().subscribe(events::add);

        ProviderTranscript partial = new ProviderTranscript(
                "speech-session-1", "The patient", false, 0, 400, 0.8f);
        factory.listener.onTranscript(partial);
        factory.listener.onTranscript(partial);
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "", false, 0, 0, null));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "The patient reports fatigue.", true, 0, 800, 0.9f));
        factory.listener.onTranscript(new ProviderTranscript(
                "speech-session-1", "Late partial", false, 0, 800, 0.5f));

        assertThat(events).extracting(VoiceBranchSession.BranchEvent::type)
                .containsExactly(
                        VoiceBranchSession.BranchEventType.TRANSCRIPT_PARTIAL,
                        VoiceBranchSession.BranchEventType.TRANSCRIPT_FINAL);
        assertThat(events).extracting(event -> event.payload().get("revision"))
                .containsExactly(1L, 2L);
    }

    @Test
    void readinessTimeoutAndCancellationCloseResourcesWithoutAudioReplay() {
        FakeFactory factory = new FakeFactory(false);
        OciSpeechAdapter adapter = new OciSpeechAdapter(
                configuration(true).withReadinessTimeout(25), factory);

        assertThatThrownBy(() -> adapter.open(new SpeechTranscriptionPort.OpenRequest(
                "voice-session-1", "correlation-1", AudioProfile.canonical())).block())
                .isInstanceOf(SpeechTranscriptionPort.BranchUnavailableException.class);
        assertThat(factory.client.closed).isTrue();

        FakeFactory readyFactory = new FakeFactory();
        VoiceBranchSession branch = new OciSpeechAdapter(configuration(true), readyFactory)
                .open(new SpeechTranscriptionPort.OpenRequest(
                        "voice-session-2", "correlation-2", AudioProfile.canonical())).block();
        branch.sendAudio(1, new byte[640]).block();
        branch.cancel().block();
        byte[] rejected = new byte[640];
        rejected[0] = 7;
        assertThatThrownBy(() -> branch.sendAudio(2, rejected).block())
                .isInstanceOf(VoiceBranchSession.BranchProcessingException.class);
        assertThat(rejected).containsOnly((byte) 0);
        assertThat(readyFactory.client.audio).hasSize(1);
    }

    private static SpeechConfiguration configuration(boolean enabled) {
        return new SpeechConfiguration(
                enabled,
                "SESSION_TOKEN",
                "/tmp/oci-config",
                "AI_WORLD_DEMO",
                "ocid1.tenancy.oc1..example",
                "eu-frankfurt-1",
                "ocid1.compartment.oc1..example",
                "wss://realtime.aiservice.eu-frankfurt-1.oci.oraclecloud.com",
                "ORACLE",
                "MEDICAL",
                "en-US",
                "audio/raw;rate=16000",
                "AUTO",
                true,
                "NONE",
                0,
                2000,
                1000,
                1000);
    }

    private static SpeechConfiguration providerDerivedConfiguration(String authMode) {
        SpeechConfiguration source = configuration(true);
        return new SpeechConfiguration(
                true,
                authMode,
                "SESSION_TOKEN".equals(authMode) ? source.configFile() : "",
                "SESSION_TOKEN".equals(authMode) ? source.profile() : "",
                "",
                "",
                source.compartmentOcid(),
                "",
                source.modelType(),
                source.modelDomain(),
                source.languageCode(),
                source.encoding(),
                source.punctuation(),
                source.ackEnabled(),
                source.stabilizePartialResults(),
                source.partialSilenceMs(),
                source.finalSilenceMs(),
                source.readinessTimeoutMs(),
                source.drainTimeoutMs());
    }

    private static SpeechConfiguration whisperConfiguration(String languageCode) {
        SpeechConfiguration source = configuration(true);
        return new SpeechConfiguration(
                true, source.authMode(), source.configFile(), source.profile(),
                source.expectedTenancyOcid(), source.region(), source.compartmentOcid(),
                source.realtimeEndpoint(), "WHISPER", "GENERIC", languageCode,
                source.encoding(), source.punctuation(), source.ackEnabled(),
                source.stabilizePartialResults(), source.partialSilenceMs(),
                source.finalSilenceMs(), source.readinessTimeoutMs(), source.drainTimeoutMs());
    }

    private static final class FakeFactory implements RealtimeClientFactory {
        private final boolean autoReady;
        private int openCount;
        private RealtimeListener listener;
        private final FakeClient client = new FakeClient();

        private FakeFactory() {
            this(true);
        }

        private FakeFactory(boolean autoReady) {
            this.autoReady = autoReady;
        }

        @Override
        public RealtimeClient open(SpeechConfiguration configuration, RealtimeListener listener) {
            openCount++;
            this.listener = listener;
            if (autoReady) listener.onAuthenticatedReady("speech-session-1");
            return client;
        }
    }

    private static final class FakeClient implements RealtimeClient {
        private final List<byte[]> audio = new ArrayList<>();
        private boolean finalRequested;
        private volatile boolean closed;
        private final CountDownLatch finalRequest = new CountDownLatch(1);

        @Override
        public void sendAudio(byte[] pcm) {
            audio.add(pcm.clone());
        }

        @Override
        public void requestFinalResult() {
            finalRequested = true;
            finalRequest.countDown();
        }

        @Override
        public void close() {
            closed = true;
        }
    }
}
