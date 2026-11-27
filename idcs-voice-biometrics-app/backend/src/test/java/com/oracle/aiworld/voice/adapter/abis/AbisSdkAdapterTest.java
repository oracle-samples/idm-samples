package com.oracle.aiworld.voice.adapter.abis;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import com.oracle.aiworld.voice.port.*;
import com.oracle.voicebiometrics.*;
import java.net.URI;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class AbisSdkAdapterTest {
    static final class Harness implements AbisSdkAdapter.SessionFactory {
        BiometricsVoiceSession.Builder builder;
        final BiometricsVoiceSession session = mock(BiometricsVoiceSession.class);
        final CompletableFuture<VoiceSessionResult> result = new CompletableFuture<>();
        Harness() {
            when(session.whenReady()).thenReturn(CompletableFuture.completedFuture(null));
            when(session.result()).thenReturn(result);
            when(session.finish()).thenReturn(result);
            when(session.tryAddAudioData(any(byte[].class))).thenReturn(true);
        }
        public BiometricsVoiceSession build(BiometricsVoiceSession.Builder builder) {
            this.builder = builder; return session;
        }
        BiometricsVoiceSessionDelegate delegate() { return builder._biometricsVoiceSessionDelegate; }
        AbisSdkAdapter adapter() {
            return new AbisSdkAdapter(true, new AbisSdkAdapter.Configuration(
                URI.create("wss://abis.example.test/root"), 10000, true, false, false,
                VoiceSessionConfiguration.defaults()), this, new SecureRandom());
        }
        VoiceBranchSession open(String purpose) {
            try (var request = new AbisVoicePort.OpenRequest("local-session", "correlation", purpose,
                    "SYNTHETIC_TOKEN".toCharArray(), AudioProfile.canonical())) {
                return adapter().open(request).block();
            }
        }
        void finish(String terminal) {
            result.complete(new VoiceSessionResult("private-session", builder._sessionType,
                VoiceSessionResult.Status.COMPLETED, null, terminal, List.of(), List.of(),
                List.of(), List.of(), 0, "{}", "{}"));
        }
    }
    @Test void consumesAuthorizedArtifactWithoutCallingManagedIamAndClearsInputFrames() {
        var h = new Harness(); var branch = h.open("VERIFICATION");
        assertThat(h.builder._useIam).isTrue();
        assertThat(h.builder._iamStateInfo).isNull();
        assertThat(h.builder._authorizedIamSession.operation()).isEqualTo(SessionType.verification);
        assertThatThrownBy(() -> h.builder.build()).isInstanceOf(IllegalStateException.class);
        byte[] pcm = new byte[640]; Arrays.fill(pcm, (byte)7);
        branch.sendAudio(1, pcm).block();
        verify(h.session).tryAddAudioData(pcm);
        assertThat(pcm).containsOnly((byte)0);
        branch.pause().block(); verify(h.session).pauseAudioData();
        branch.cancel().block(); verify(h.session).cancel(); verify(h.session).close();
    }
    @Test void retainsStableIdsAndOutOfOrderResultsWithoutTurningRejectionIntoMismatch() {
        var h = new Harness(); var branch = h.open("VERIFICATION");
        var events = new ArrayList<VoiceBranchSession.BranchEvent>(); branch.events().subscribe(events::add);
        for(int i=1;i<=501;i++)branch.sendAudio(i,new byte[640]).block();
        h.delegate().biometricsVoiceSessionDelegateUtteranceStarted(h.session, 1, 0);
        h.delegate().biometricsVoiceSessionDelegateUtteranceSubmitted(h.session,
            new VoiceUtteranceMetadata(SessionType.verification, 2, 0, 0, 10000, 10000, 0, 9800, 9500));
        h.delegate().biometricsVoiceSessionDelegateUtteranceSubmitted(h.session,
            new VoiceUtteranceMetadata(SessionType.verification, 3, 1, 10000, 10020, 20, 0, 20, 0));
        h.delegate().biometricsVoiceSessionDelegateUtteranceResult(h.session,
            new VoiceUtteranceResult(3, 1, 10000, 10020, 20, "REQUEST_REJECTED", "private detail", true));
        h.delegate().biometricsVoiceSessionDelegateUtteranceResult(h.session,
            new VoiceUtteranceResult(2, 0, 0, 10000, 10000, "MATCH", "matched", false));
        var start=events.get(0); var sealed=events.get(1); var rejected=events.get(3); var match=events.get(4);
        assertThat(start.payload().get("utteranceId")).isEqualTo(sealed.payload().get("utteranceId"))
            .isEqualTo(match.payload().get("utteranceId"));
        assertThat(sealed.payload()).containsEntry("endAudioSequence",500L).containsEntry("detectedSpeechMs",9500L);
        assertThat(events.get(2).payload()).containsEntry("detectedSpeechMs",0L);
        assertThat(rejected.type()).isEqualTo(VoiceBranchSession.BranchEventType.ASSURANCE_FAILED);
        assertThat(rejected.payload()).doesNotContainKey("outcome");
        assertThat(match.payload()).containsEntry("outcome","MATCH");
        var finished=branch.complete().toFuture();
        org.awaitility.Awaitility.await().untilAsserted(()->verify(h.session).finish());
        h.finish("VERIFICATION_COMPLETED"); finished.join();
        assertThat(events.getLast().safeCode()).isEqualTo("ABIS_VERIFICATION_COMPLETED");
        assertThat(events.getLast().payload()).doesNotContainKey("outcome");
        verify(h.session).finish(); verify(h.session).close();
    }
    @Test void reportsActualEnrollmentRangeWithoutClaimingProviderAcceptance() {
        var h = new Harness(); var branch = h.open("ENROLLMENT");
        var events = new ArrayList<VoiceBranchSession.BranchEvent>(); branch.events().subscribe(events::add);
        h.delegate().biometricsVoiceSessionDelegateEnrollmentProgress(h.session,
            new VoiceEnrollmentProgress(1,7500,7000,10000));
        assertThat(events.getLast().payload()).containsEntry("capturedSampleMs",7500)
            .containsEntry("minimumSampleMs",7000).containsEntry("maximumSampleMs",10000)
            .containsEntry("acceptedUtteranceCount",0);
        h.delegate().biometricsVoiceSessionDelegateUtteranceResult(h.session,
            new VoiceUtteranceResult(2,0,0,7500,7500,"REQUEST_REJECTED","private reason",true));
        assertThat(events.getLast().payload()).containsEntry("qualityState","REJECTED")
            .containsEntry("acceptedUtteranceCount",0);
        h.delegate().biometricsVoiceSessionDelegateEnrollmentProgress(h.session,
            new VoiceEnrollmentProgress(2,7500,7000,10000));
        assertThat(events.getLast().payload()).containsEntry("qualityState","WAITING");
        h.delegate().biometricsVoiceSessionDelegateRegistrationStatusForAcceptedAudioData(h.session,7500,0);
        assertThat(events.getLast().payload()).containsEntry("acceptedUtteranceCount",1);
        h.finish("REGISTRATION_SUCCEEDED");
        assertThat(events.getLast().type()).isEqualTo(VoiceBranchSession.BranchEventType.SUCCEEDED);
        assertThat(events.toString()).doesNotContain("private-session","SYNTHETIC_TOKEN");
    }
    @Test void refusesUnsupportedFramesAndSurfacesProcessingFailureSeparately() {
        var h = new Harness(); var branch = h.open("VERIFICATION");
        assertThatThrownBy(() -> branch.sendAudio(1,new byte[2]).block())
            .isInstanceOf(VoiceBranchSession.BranchProcessingException.class);
        h.result.completeExceptionally(new IllegalStateException("private provider/token detail"));
        assertThatThrownBy(() -> branch.complete().block()).isInstanceOf(VoiceBranchSession.BranchProcessingException.class);
    }
}
