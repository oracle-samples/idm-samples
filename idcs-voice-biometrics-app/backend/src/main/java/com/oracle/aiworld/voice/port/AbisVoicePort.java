package com.oracle.aiworld.voice.port;

import com.oracle.aiworld.voice.application.streaming.VoiceSessionService.AudioProfile;
import java.util.Arrays;
import reactor.core.publisher.Mono;

public interface AbisVoicePort {
    default boolean availableForLiveSession() { return true; }

    record OpenRequest(
            String voiceSessionId,
            String correlationId,
            String purpose,
            char[] securityToken,
            AudioProfile audioProfile) implements AutoCloseable {
        public OpenRequest {
            if (!"ENROLLMENT".equals(purpose) && !"VERIFICATION".equals(purpose)) {
                throw new IllegalArgumentException("Unsupported ABIS session purpose");
            }
            securityToken = securityToken.clone();
        }

        public OpenRequest(
                String voiceSessionId,
                String correlationId,
                char[] securityToken,
                AudioProfile audioProfile) {
            this(voiceSessionId, correlationId, "ENROLLMENT", securityToken, audioProfile);
        }

        @Override
        public char[] securityToken() {
            return securityToken.clone();
        }

        @Override
        public void close() {
            Arrays.fill(securityToken, '\0');
        }
    }

    Mono<VoiceBranchSession> open(OpenRequest request);

    final class BranchUnavailableException extends RuntimeException {
        private final String safeCode;

        public BranchUnavailableException() {
            this("ABIS_ADAPTER_NOT_READY", null);
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
