package com.oracle.aiworld.voice.port;

import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;
import java.util.Map;

public interface VoiceBranchSession {
    enum BranchEventType {
        WAITING,
        SUCCEEDED,
        FAILED,
        CAPTURE_QUALITY,
        UTTERANCE_STARTED,
        UTTERANCE_DISCARDED,
        UTTERANCE_SEALED,
        ASSURANCE_RESULT,
        ASSURANCE_FAILED,
        ACKNOWLEDGED,
        TRANSCRIPT_PARTIAL,
        TRANSCRIPT_FINAL,
        TRANSCRIPT_FAILED
    }

    record BranchEvent(
            BranchEventType type,
            String source,
            String action,
            String safeCode,
            Map<String, Object> payload) {
        public BranchEvent {
            source = source == null || source.isBlank() ? "APPLICATION" : source;
            payload = payload == null ? Map.of() : Map.copyOf(payload);
        }

        public BranchEvent(BranchEventType type, String action, String safeCode) {
            this(type, "ABIS", action, safeCode, Map.of());
        }
    }

    Mono<Void> sendAudio(long sequence, byte[] pcm);

    Mono<Void> complete();

    default Mono<Void> pause() {
        return Mono.empty();
    }

    Mono<Void> cancel();

    default Flux<BranchEvent> events() {
        return Flux.empty();
    }

    final class BranchProcessingException extends RuntimeException {
        private final String safeCode;

        public BranchProcessingException(String safeCode, Throwable cause) {
            super(null, cause, false, false);
            this.safeCode = safeCode;
        }

        public String safeCode() {
            return safeCode;
        }
    }
}
