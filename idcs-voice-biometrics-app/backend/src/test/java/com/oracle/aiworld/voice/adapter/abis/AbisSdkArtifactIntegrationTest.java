package com.oracle.aiworld.voice.adapter.abis;

import static org.assertj.core.api.Assertions.*;
import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import com.oracle.aiworld.voice.port.*;
import com.oracle.voicebiometrics.*;
import java.net.*;
import java.nio.file.*;
import java.security.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import javax.net.ssl.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

/** Real installed SDK, model-free capture and TLS/protobuf peer; no live service or identity. */
class AbisSdkArtifactIntegrationTest {
    @TempDir Path temporary;
    SSLContext server;
    @BeforeEach void tlsPeer() throws Exception {
        Path file=temporary.resolve("synthetic-peer.p12");
        var process=new ProcessBuilder(Path.of(System.getProperty("java.home"),"bin/keytool").toString(),
            "-genkeypair","-alias","peer","-keyalg","RSA","-validity","1","-dname","CN=localhost",
            "-ext","SAN=dns:localhost","-storetype","PKCS12","-keystore",file.toString(),
            "-storepass","synthetic-only","-noprompt").redirectErrorStream(true)
            .redirectOutput(temporary.resolve("keytool.log").toFile()).start();
        assertThat(process.waitFor(20,TimeUnit.SECONDS)).isTrue(); assertThat(process.exitValue()).isZero();
        var keys=KeyStore.getInstance("PKCS12");
        try(var input=Files.newInputStream(file)){keys.load(input,"synthetic-only".toCharArray());}
        var km=KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        km.init(keys,"synthetic-only".toCharArray()); server=SSLContext.getInstance("TLS"); server.init(km.getKeyManagers(),null,null);
    }
    SdkAbisTestPeer peer() throws Exception {
        return new SdkAbisTestPeer(server.getServerSocketFactory().createServerSocket(0,1,InetAddress.getByName("127.0.0.1")));
    }
    VoiceBranchSession open(SdkAbisTestPeer peer,String purpose) {
        var adapter=new AbisSdkAdapter(true,new AbisSdkAdapter.Configuration(URI.create(peer.origin()),
            10000,false,false,false,VoiceSessionConfiguration.defaults()),BiometricsVoiceSession.Builder::build,new SecureRandom());
        try(var request=new AbisVoicePort.OpenRequest("local","local-correlation",purpose,
                "SYNTHETIC_TOKEN".toCharArray(),AudioProfile.canonical())) {
            return adapter.open(request).block(Duration.ofSeconds(20));
        }
    }
    byte[] toneFrame(int frame) {
        byte[] pcm=new byte[640];
        for(int i=0;i<320;i++) {
            short sample=(short)(12000*Math.sin(2*Math.PI*200*(frame*320+i)/16000));
            pcm[2*i]=(byte)sample; pcm[2*i+1]=(byte)(sample>>8);
        }
        return pcm;
    }
    @Test void actualSdkPreservesPauseAndMutedSequenceGapAndNeverFabricatesAuthenticationSuccess() throws Exception {
        var original=SSLContext.getDefault();
        try(var peer=peer()) {
            var branch=open(peer,"VERIFICATION");
            var events=new CopyOnWriteArrayList<VoiceBranchSession.BranchEvent>(); branch.events().subscribe(events::add);
            try {
                for(int i=0;i<100;i++)branch.sendAudio(i+1,toneFrame(i)).block();
                branch.pause().block();
                // Browser frames 101–200 were muted and never delivered to the SDK.
                for(int i=0;i<100;i++)branch.sendAudio(i+201,toneFrame(i+100)).block();
                branch.complete().block(Duration.ofSeconds(20));
                var sealed=events.stream().filter(e->e.type()==VoiceBranchSession.BranchEventType.UTTERANCE_SEALED).toList();
                var results=events.stream().filter(e->e.type()==VoiceBranchSession.BranchEventType.ASSURANCE_RESULT).toList();
                assertThat(sealed).hasSize(2);assertThat(results).hasSize(2);
                assertThat(sealed.get(0).payload()).containsEntry("startAudioSequence",1L).containsEntry("endAudioSequence",100L);
                assertThat(sealed.get(1).payload()).containsEntry("startAudioSequence",201L).containsEntry("endAudioSequence",300L);
                for(int i=0;i<2;i++)assertThat(results.get(i).payload().get("utteranceId")).isEqualTo(sealed.get(i).payload().get("utteranceId"));
                assertThat(events.getLast().safeCode()).isEqualTo("ABIS_VERIFICATION_COMPLETED");
                assertThat(events.getLast().payload()).isEmpty();
                assertThat(events.toString()).doesNotContain("SYNTHETIC_TOKEN",peer.origin(),"session1");
                assertThat(peer.handshakeRequest).contains("/voice/actions/verify/SYNTHETIC_TOKEN?sendVerificationResults=true");
            } finally { branch.cancel().block(); }
        }
        assertThat(SSLContext.getDefault()).isSameAs(original);
    }
    @Test void actualSdkSubmitsEightSecondEnrollmentWithinRangeAndEndsOnProviderWait() throws Exception {
        try(var peer=peer()) {
            peer.terminalType="REGISTRATION_SUCCEEDED";
            var branch=open(peer,"ENROLLMENT");
            var events=new CopyOnWriteArrayList<VoiceBranchSession.BranchEvent>();branch.events().subscribe(events::add);
            try {
                for(int i=0;i<400;i++)branch.sendAudio(i+1,toneFrame(i)).block();
                branch.complete().block(Duration.ofSeconds(20));
                assertThat(events).anySatisfy(e->assertThat(e.payload())
                    .containsEntry("minimumSampleMs",7000).containsEntry("maximumSampleMs",10000)
                    .containsEntry("capturedSampleMs",8000));
                assertThat(events).anySatisfy(e->assertThat(e.payload()).containsEntry("acceptedUtteranceCount",1));
                assertThat(events.getLast().safeCode()).isEqualTo("REGISTRATION_SUCCEEDED");
                var utterance=peer.take(VoiceBiometricEvent.ClientMessageType.UTTERANCE);
                assertThat(utterance.getAudio().getUtterance().size()).isEqualTo(256000);
                assertThat(peer.receivedSamples).isEqualTo(1);
            } finally {branch.cancel().block();}
        }
    }
    @Test void lateFramesAfterProviderWaitDoNotConvertSuccessfulEnrollmentIntoDeliveryFailure() throws Exception {
        try(var peer=peer()) {
            peer.terminalType="REGISTRATION_SUCCEEDED";
            peer.handler=(server,message)->{
                if(message.getMessageType()==VoiceBiometricEvent.ClientMessageType.VOICE_CAPTURE_ENDED)
                    Thread.sleep(300); // Input has ended, but terminal response is still in flight.
                server.respond(message);
            };
            var branch=open(peer,"ENROLLMENT");
            try {
                for(int i=0;i<500;i++)branch.sendAudio(i+1,toneFrame(i)).block();
                // Receiving END proves the SDK has already processed the provider WAIT.
                peer.take(VoiceBiometricEvent.ClientMessageType.VOICE_CAPTURE_ENDED);
                for(int i=500;i<550;i++)branch.sendAudio(i+1,toneFrame(i)).block();
                branch.complete().block(Duration.ofSeconds(20));
                assertThat(peer.receivedSamples).isEqualTo(1);
            } finally {branch.cancel().block();}
        }
    }

}
