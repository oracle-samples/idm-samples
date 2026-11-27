package com.oracle.aiworld.voice.adapter.abis;

import com.oracle.aiworld.voice.port.AbisVoicePort;
import com.oracle.aiworld.voice.port.VoiceBranchSession;
import com.oracle.aiworld.voice.security.OpaqueTokens;
import com.oracle.voicebiometrics.*;
import java.net.URI;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.*;
import reactor.core.scheduler.Schedulers;

/** Consumes the SDK artifact; the application owns the existing IAM attempt and its completion. */
@Component
public final class AbisSdkAdapter implements AbisVoicePort {
    private static final Logger LOG = LoggerFactory.getLogger(AbisSdkAdapter.class);
    @FunctionalInterface interface SessionFactory {
        BiometricsVoiceSession build(BiometricsVoiceSession.Builder builder) throws Exception;
    }
    record Configuration(URI origin, int connectTimeoutMs, boolean tlsVerify,
            boolean storeEnrollmentAudio, boolean storeVerificationAudio, VoiceSessionConfiguration audio) {}
    private final boolean enabled;
    private final Configuration configuration;
    private final SessionFactory factory;
    private final SecureRandom random;

    @Autowired
    public AbisSdkAdapter(
            @Value("${ai-world.abis.enabled:false}") boolean enabled,
            @Value("${ai-world.abis.base-url:}") String baseUrl,
            @Value("${ai-world.abis.tls-verify:true}") boolean tlsVerify,
            @Value("${ai-world.abis.connect-timeout-ms:10000}") int connectTimeoutMs,
            @Value("${ai-world.abis.verification-max-ms:10000}") int verificationMaxMs,
            @Value("${ai-world.abis.registration-min-ms:7000}") int registrationMinMs,
            @Value("${ai-world.abis.registration-max-ms:10000}") int registrationMaxMs,
            @Value("${ai-world.abis.pre-roll-ms:200}") int preRollMs,
            @Value("${ai-world.abis.end-silence-ms:800}") int endSilenceMs,
            @Value("${ai-world.abis.registration-start-frames:3}") int registrationStartFrames,
            @Value("${ai-world.abis.pending-pcm-bytes:4194304}") int pendingPcmBytes,
            @Value("${ai-world.abis.finish-timeout-ms:30000}") int finishTimeoutMs,
            @Value("${ai-world.abis.store-enrollment-audio:false}") boolean storeEnrollmentAudio,
            @Value("${ai-world.abis.store-verification-audio:false}") boolean storeVerificationAudio,
            SecureRandom random) {
        this(enabled, new Configuration(parseOrigin(baseUrl), connectTimeoutMs, tlsVerify,
            storeEnrollmentAudio, storeVerificationAudio, VoiceSessionConfiguration.builder()
                .maximumVerificationUtteranceMs(verificationMaxMs)
                .minimumRegistrationUtteranceMs(registrationMinMs)
                .maximumRegistrationUtteranceMs(registrationMaxMs).preRollMs(preRollMs)
                .speechEndSilenceMs(endSilenceMs).registrationSpeechStartFrames(registrationStartFrames)
                .maximumPendingPcmBytes(pendingPcmBytes).finishTimeoutMs(finishTimeoutMs).build()),
            BiometricsVoiceSession.Builder::build, random);
    }
    AbisSdkAdapter(boolean enabled, Configuration configuration, SessionFactory factory, SecureRandom random) {
        this.enabled=enabled; this.configuration=configuration; this.factory=factory; this.random=random;
        if (configuration.connectTimeoutMs()<1 || configuration.connectTimeoutMs()>300000)
            throw new IllegalArgumentException("Invalid ABIS connection timeout");
        if (enabled && !configuration.tlsVerify()) LOG.warn("ABIS TLS verification disabled for configured test attempts only");
    }
    private static URI parseOrigin(String value) {
        if(value==null || value.isBlank()) return null;
        try {
            URI uri=URI.create(value.trim());
            if(!"wss".equalsIgnoreCase(uri.getScheme()) || uri.getHost()==null || uri.getRawUserInfo()!=null
                || uri.getRawQuery()!=null || uri.getRawFragment()!=null || uri.getPort()==0 || uri.getPort()>65535)
                throw new IllegalArgumentException();
            return uri;
        } catch(IllegalArgumentException invalid) { throw new IllegalArgumentException("Invalid AI_WORLD_ABIS_BASE_URL"); }
    }
    @Override public boolean availableForLiveSession() { return enabled && configuration.origin()!=null; }
    @Override public Mono<VoiceBranchSession> open(OpenRequest request) {
        if(!availableForLiveSession()) return Mono.error(new BranchUnavailableException());
        if(!request.audioProfile().isCanonical() || !Set.of("ENROLLMENT","VERIFICATION").contains(request.purpose()))
            return Mono.error(new BranchUnavailableException("ABIS_REQUEST_UNSUPPORTED",null));
        return Mono.defer(() -> {
            Branch branch=new Branch("VERIFICATION".equals(request.purpose()));
            return Mono.fromCallable(() -> {
                char[] token=request.securityToken();
                try(var authorization=new IamAuthorizedSession(branch.verification ? SessionType.verification : SessionType.registration,
                        configuration.origin(), token, configuration.connectTimeoutMs(),
                        branch.verification ? configuration.storeVerificationAudio() : configuration.storeEnrollmentAudio(),
                        tlsContext(), configuration.tlsVerify())) {
                    branch.session=factory.build(BiometricsVoiceSession.builder()
                        .sessionType(authorization.operation()).useIam(true).authorizedIamSession(authorization)
                        .configuration(configuration.audio()).biometricsVoiceSessionDelegate(branch));
                } finally { Arrays.fill(token,'\0'); }
                if(branch.disposed.get()) { branch.session.close(); throw new IllegalStateException("Attempt cancelled"); }
                branch.session.connect();
                // connect() starts a fresh SDK attempt and its completion future.
                branch.session.result().whenComplete(branch::ended);
                return branch;
            }).subscribeOn(Schedulers.boundedElastic())
                .flatMap(opened -> Mono.fromFuture(opened.session.whenReady()).thenReturn((VoiceBranchSession)opened))
                .doOnCancel(branch::dispose)
                .doOnError(ignored -> branch.dispose())
                .onErrorMap(ignored -> new BranchUnavailableException("ABIS_CONNECT_FAILED",null));
        });
    }
    private SSLContext tlsContext() throws Exception {
        if(configuration.tlsVerify()) return null;
        SSLContext context=SSLContext.getInstance("TLS");
        context.init(null,new TrustManager[]{new X509TrustManager(){
            public X509Certificate[] getAcceptedIssuers(){return new X509Certificate[0];}
            public void checkClientTrusted(X509Certificate[] chain,String authType){}
            public void checkServerTrusted(X509Certificate[] chain,String authType){}
        }},null);
        return context;
    }
    private final class Branch implements VoiceBranchSession, BiometricsVoiceSessionDelegate {
        private final boolean verification;
        private final Sinks.Many<BranchEvent> events=Sinks.many().replay().limit(128);
        private final Map<Integer,String> ids=new HashMap<>();
        // SDK offsets count frames delivered to it; browser sequence IDs can skip while muted.
        private final List<Long> deliveredFrames=new ArrayList<>();
        private final AtomicBoolean terminal=new AtomicBoolean(), disposed=new AtomicBoolean();
        private final CompletableFuture<Void> completion=new CompletableFuture<>();
        private BiometricsVoiceSession session;
        private VoiceEnrollmentProgress progress=new VoiceEnrollmentProgress(1,0,
            configuration.audio().minimumRegistrationUtteranceMs(),configuration.audio().maximumRegistrationUtteranceMs());
        private int acceptedCount;
        private String sampleQuality="WAITING";
        Branch(boolean verification){this.verification=verification;}
        private synchronized void emit(BranchEventType type,String code,Map<String,Object> payload) {
            if(!disposed.get()) events.tryEmitNext(new BranchEvent(type,"ABIS","CONTINUE",code,payload));
        }
        private synchronized String id(int ordinal){return ids.computeIfAbsent(ordinal, ignored->OpaqueTokens.random(random));}
        private synchronized long sequence(int milliseconds, boolean end) {
            int index=end ? Math.max(0,(milliseconds+19)/20-1) : Math.max(0,milliseconds/20);
            if(deliveredFrames.isEmpty()) throw new IllegalStateException("SDK capture precedes input");
            return deliveredFrames.get(Math.min(index,deliveredFrames.size()-1));
        }
        public void biometricsVoiceSessionDelegateUtteranceStarted(BiometricsVoiceSession s,int ordinal,int start){
            if(verification) emit(BranchEventType.UTTERANCE_STARTED,"VOICE_UTTERANCE_STARTED",Map.of(
                "utteranceId",id(ordinal),"utteranceOrdinal",(long)ordinal,"startAudioSequence",sequence(start,false)));
        }
        public void biometricsVoiceSessionDelegateUtteranceSubmitted(BiometricsVoiceSession s,VoiceUtteranceMetadata m){
            if(!verification) return;
            int ordinal=m.utteranceIndex()+1;
            emit(BranchEventType.UTTERANCE_SEALED,"VOICE_UTTERANCE_SEALED",Map.of(
                "utteranceId",id(ordinal),"utteranceOrdinal",(long)ordinal,
                "startAudioSequence",sequence(m.captureStartMs(),false),"endAudioSequence",sequence(m.captureEndMs(),true),
                "voiceStartAudioSequence",sequence(m.captureStartMs()+m.voiceStartMs(),false),
                "voiceEndAudioSequence",sequence(m.captureStartMs()+m.voiceEndMs(),true),
                "detectedSpeechMs",(long)m.detectedSpeechMs()));
        }
        public void biometricsVoiceSessionDelegateUtteranceResult(BiometricsVoiceSession s,VoiceUtteranceResult r){
            if(!verification) {
                if(r.inputRejected()) {
                    synchronized(this){sampleQuality="REJECTED";enrollmentProgress();}
                }
                return;
            }
            int ordinal=r.utteranceIndex()+1;
            if(r.inputRejected()) emit(BranchEventType.ASSURANCE_FAILED,"VOICE_UTTERANCE_REJECTED",Map.of(
                "utteranceId",id(ordinal),"utteranceOrdinal",(long)ordinal));
            else emit(BranchEventType.ASSURANCE_RESULT,"VOICE_"+safeOutcome(r.code()),Map.of(
                "utteranceId",id(ordinal),"utteranceOrdinal",(long)ordinal,"outcome",safeOutcome(r.code())));
        }
        private String safeOutcome(String code){return Set.of("MATCH","MISMATCH","INCONCLUSIVE").contains(code) ? code : "INCONCLUSIVE";}
        public synchronized void biometricsVoiceSessionDelegateEnrollmentProgress(BiometricsVoiceSession s,VoiceEnrollmentProgress value){
            progress=value; sampleQuality="WAITING"; enrollmentProgress();
        }
        public synchronized void biometricsVoiceSessionDelegateRegistrationStatusForAcceptedAudioData(BiometricsVoiceSession s,int acceptedMs,int requiredMs){
            acceptedCount++; enrollmentProgress();
        }
        private void enrollmentProgress(){
            emit(BranchEventType.ACKNOWLEDGED,"ABIS_AUDIO_PROGRESS",Map.of(
                "utteranceOrdinal",progress.utteranceOrdinal(),"acceptedUtteranceCount",acceptedCount,
                "capturedSampleMs",progress.retainedAudioMs(),"minimumSampleMs",progress.minimumAudioMs(),
                "maximumSampleMs",progress.maximumAudioMs(),"qualityState",sampleQuality,
                "voiceActivity",progress.retainedAudioMs()>=progress.minimumAudioMs() ? "AWAITING_PAUSE" : "SPEECH"));
        }
        private void ended(VoiceSessionResult result,Throwable error){
            if(!terminal.compareAndSet(false,true)) return;
            boolean ended=error==null && result.status()==VoiceSessionResult.Status.COMPLETED
                && (verification ? "VERIFICATION_COMPLETED".equals(result.providerMessageType())
                                 : "REGISTRATION_SUCCEEDED".equals(result.providerMessageType()))
                && result.unresolvedSequences().isEmpty() && (!verification || result.unsentPcmBytes()==0);
            if(ended){
                emit(BranchEventType.SUCCEEDED, verification ? "ABIS_VERIFICATION_COMPLETED" : "REGISTRATION_SUCCEEDED",Map.of());
                completion.complete(null);
            }else{
                emit(BranchEventType.FAILED,"ABIS_PROCESSING_FAILED",Map.of());
                completion.completeExceptionally(new BranchProcessingException("ABIS_PROCESSING_FAILED",null));
            }
            dispose();
        }
        @Override public Mono<Void> sendAudio(long sequence,byte[] pcm){
            return Mono.<Void>fromRunnable(() -> {
                try {
                    synchronized(this){
                        if(disposed.get() || terminal.get()) return;
                        if(pcm.length!=640 || deliveredFrames.size()>=180000 || sequence<1
                            || !deliveredFrames.isEmpty() && sequence<=deliveredFrames.getLast())
                            throw new BranchProcessingException("ABIS_AUDIO_FRAME_INVALID",null);
                        deliveredFrames.add(sequence);
                    }
                    if(!session.tryAddAudioData(pcm)) {
                        synchronized(this){deliveredFrames.removeLast();}
                    }
                } finally { Arrays.fill(pcm,(byte)0); }
            }).subscribeOn(Schedulers.boundedElastic()).onErrorMap(AbisSdkAdapter::processingFailure);
        }
        @Override public Mono<Void> pause(){return Mono.<Void>fromRunnable(()->{if(!disposed.get())session.pauseAudioData();})
            .subscribeOn(Schedulers.boundedElastic()).onErrorMap(AbisSdkAdapter::processingFailure);}
        @Override public Mono<Void> complete(){return Mono.defer(()-> {
            try { if(!disposed.get()) session.finish(); }
            catch(IllegalStateException closing) { if(!terminal.get()) throw closing; }
            return Mono.fromFuture(completion.copy());
        }).subscribeOn(Schedulers.boundedElastic()).onErrorMap(AbisSdkAdapter::processingFailure);}
        @Override public Mono<Void> cancel(){return Mono.<Void>fromRunnable(()->{if(!disposed.get())session.cancel();dispose();})
            .subscribeOn(Schedulers.boundedElastic());}
        private void dispose(){if(disposed.compareAndSet(false,true) && session!=null)session.close();}
        @Override public Flux<BranchEvent> events(){return events.asFlux();}
    }
    private static RuntimeException processingFailure(Throwable failure){
        return failure instanceof VoiceBranchSession.BranchProcessingException e ? e
            : new VoiceBranchSession.BranchProcessingException("ABIS_PROCESSING_FAILED",null);
    }
}
