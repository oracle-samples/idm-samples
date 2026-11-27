package com.oracle.aiworld.voice.port;

import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import reactor.core.publisher.Mono;

public interface SpeechTranscriptionPort {
    default boolean availableForLiveSession() { return true; }

    record OpenRequest(String voiceSessionId, String correlationId, AudioProfile audioProfile) {
    }

    Mono<VoiceBranchSession> open(OpenRequest request);

    final class BranchUnavailableException extends RuntimeException {
        private final String safeCode;

        public BranchUnavailableException() {
            this("SPEECH_ADAPTER_NOT_READY", null);
        }

        public BranchUnavailableException(String safeCode, Throwable cause) {
            super(null, cause, false, false);
            this.safeCode = safeCode;
        }

        public String safeCode() {
            return safeCode;
        }
    }
}
