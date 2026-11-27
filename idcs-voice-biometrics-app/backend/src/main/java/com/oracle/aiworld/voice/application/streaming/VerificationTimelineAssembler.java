package com.oracle.aiworld.voice.application.streaming;

import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEvent;
import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEventType;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Joins independently arriving Speech projections to the exact VAD windows submitted to ABIS.
 * Raw audio and transcript content remain session-local and are discarded with this object.
 */
final class VerificationTimelineAssembler {
    private final Map<String, Window> windows = new LinkedHashMap<>();
    private final Map<String, SpeechFragment> speechFragments = new LinkedHashMap<>();

    synchronized List<BranchEvent> accept(BranchEvent event) {
        Objects.requireNonNull(event, "event");
        return switch (event.type()) {
            case UTTERANCE_STARTED -> onStarted(event);
            case UTTERANCE_DISCARDED -> onDiscarded(event);
            case UTTERANCE_SEALED -> onSealed(event);
            case TRANSCRIPT_PARTIAL, TRANSCRIPT_FINAL -> onTranscript(event);
            default -> List.of(event);
        };
    }

    private List<BranchEvent> onDiscarded(BranchEvent event) {
        String id = text(event.payload(), "utteranceId");
        windows.remove(id);
        return List.of(event);
    }

    private List<BranchEvent> onStarted(BranchEvent event) {
        String id = text(event.payload(), "utteranceId");
        long ordinal = number(event.payload(), "utteranceOrdinal");
        long start = number(event.payload(), "startAudioSequence");
        Window current = windows.get(id);
        if (current == null) {
            current = new Window(id, ordinal, start);
            windows.put(id, current);
        }
        List<BranchEvent> emitted = new ArrayList<>();
        emitted.add(event);
        emitted.addAll(reconcile(current));
        return List.copyOf(emitted);
    }

    private List<BranchEvent> onSealed(BranchEvent event) {
        String id = text(event.payload(), "utteranceId");
        Window window = windows.computeIfAbsent(id, ignored -> new Window(
                id,
                number(event.payload(), "utteranceOrdinal"),
                number(event.payload(), "startAudioSequence")));
        window.seal(
                number(event.payload(), "endAudioSequence"),
                number(event.payload(), "voiceEndAudioSequence"));
        List<BranchEvent> emitted = new ArrayList<>();
        emitted.add(event);
        emitted.addAll(reconcile(window));
        return List.copyOf(emitted);
    }

    private List<BranchEvent> onTranscript(BranchEvent event) {
        SpeechFragment candidate = SpeechFragment.from(event);
        SpeechFragment existing = speechFragments.get(candidate.providerId());
        if (existing != null && existing.revision() >= candidate.revision()) return List.of();
        speechFragments.put(candidate.providerId(), candidate);

        List<BranchEvent> emitted = new ArrayList<>();
        for (Window window : windows.values()) emitted.addAll(reconcile(window));
        return List.copyOf(emitted);
    }

    private List<BranchEvent> reconcile(Window window) {
        if (window.transcriptFinal || window.transcriptFailed) return List.of();
        long end = window.endAudioSequence == null ? Long.MAX_VALUE : window.endAudioSequence;
        List<Token> tokens = new ArrayList<>();
        List<SpeechFragment> untimed = new ArrayList<>();
        long finalWatermark = 0;

        for (SpeechFragment fragment : speechFragments.values()) {
            if (!overlaps(window.startAudioSequence, end, fragment.start(), fragment.end())) continue;
            if (fragment.finalResult()) finalWatermark = Math.max(finalWatermark, fragment.end());
            if (fragment.tokens().isEmpty()) {
                untimed.add(fragment);
                continue;
            }
            for (Token token : fragment.tokens()) {
                long midpoint = token.start() + Math.max(0, token.end() - token.start()) / 2;
                if (midpoint >= window.startAudioSequence && midpoint <= end) tokens.add(token);
            }
        }

        Set<String> ambiguousProviderIds = new LinkedHashSet<>();
        List<SpeechFragment> mappedUntimed = new ArrayList<>();
        for (SpeechFragment fragment : untimed) {
            long matches = windows.values().stream()
                    .filter(candidate -> overlaps(
                            candidate.startAudioSequence,
                            candidate.endAudioSequence == null
                                    ? Long.MAX_VALUE : candidate.endAudioSequence,
                            fragment.start(),
                            fragment.end()))
                    .count();
            if (matches == 1) mappedUntimed.add(fragment);
            else if (matches > 1) ambiguousProviderIds.add(fragment.providerId());
        }
        if (!ambiguousProviderIds.isEmpty() && !window.transcriptFailed) {
            window.transcriptFailed = true;
            return List.of(new BranchEvent(
                    BranchEventType.TRANSCRIPT_FAILED,
                    "APPLICATION",
                    "TRANSCRIPT_CORRELATION_FAILED",
                    "SPEECH_TRANSCRIPT_CORRELATION_FAILED",
                    Map.of(
                            "utteranceId", window.id,
                            "utteranceOrdinal", window.ordinal)));
        }

        tokens = new ArrayList<>(new LinkedHashSet<>(tokens));
        tokens.sort(Comparator.comparingLong(Token::start).thenComparingLong(Token::end));
        mappedUntimed.sort(Comparator.comparingLong(SpeechFragment::start));
        String transcript = tokens.isEmpty()
                ? mappedUntimed.stream().map(SpeechFragment::text)
                        .reduce("", VerificationTimelineAssembler::joinText)
                : renderTokens(tokens);
        if (transcript.isBlank()) return List.of();

        boolean finalResult = window.endAudioSequence != null
                && window.voiceEndAudioSequence != null
                && finalWatermark >= window.voiceEndAudioSequence;
        if (transcript.equals(window.lastText) && finalResult == window.transcriptFinal) {
            return List.of();
        }
        window.lastText = transcript;
        window.transcriptFinal = finalResult;
        long revision = ++window.revision;
        long projectedEnd = window.endAudioSequence == null
                ? Math.max(window.startAudioSequence, latestCoveredSequence(tokens, mappedUntimed))
                : window.endAudioSequence;
        return List.of(new BranchEvent(
                finalResult ? BranchEventType.TRANSCRIPT_FINAL : BranchEventType.TRANSCRIPT_PARTIAL,
                "SPEECH",
                finalResult ? "TRANSCRIPT_FINAL" : "TRANSCRIPT_PARTIAL",
                "SPEECH_TRANSCRIPT_AVAILABLE",
                Map.of(
                        "utteranceId", window.id,
                        "utteranceOrdinal", window.ordinal,
                        "revision", revision,
                        "text", transcript,
                        "startAudioSequence", window.startAudioSequence,
                        "endAudioSequence", projectedEnd)));
    }

    private static long latestCoveredSequence(
            List<Token> tokens, List<SpeechFragment> untimed) {
        long tokenEnd = tokens.stream().mapToLong(Token::end).max().orElse(0);
        long fragmentEnd = untimed.stream().mapToLong(SpeechFragment::end).max().orElse(0);
        return Math.max(tokenEnd, fragmentEnd);
    }

    private static String renderTokens(List<Token> tokens) {
        String rendered = "";
        for (Token token : tokens) {
            boolean punctuation = "PUNCTUATION".equals(token.type())
                    || token.text().matches("^[.,!?;:]$");
            rendered = punctuation ? rendered + token.text() : joinText(rendered, token.text());
        }
        return rendered.trim();
    }

    private static String joinText(String left, String right) {
        if (left == null || left.isBlank()) return right == null ? "" : right.trim();
        if (right == null || right.isBlank()) return left.trim();
        return left.trim() + " " + right.trim();
    }

    private static boolean overlaps(long leftStart, long leftEnd, long rightStart, long rightEnd) {
        return leftStart <= rightEnd && rightStart <= leftEnd;
    }

    private static String text(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException("Missing timeline text field: " + key);
        }
        return text;
    }

    private static long number(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (!(value instanceof Number number)) {
            throw new IllegalArgumentException("Missing timeline number field: " + key);
        }
        return number.longValue();
    }

    private static final class Window {
        private final String id;
        private final long ordinal;
        private final long startAudioSequence;
        private Long endAudioSequence;
        private Long voiceEndAudioSequence;
        private long revision;
        private String lastText = "";
        private boolean transcriptFinal;
        private boolean transcriptFailed;

        private Window(String id, long ordinal, long startAudioSequence) {
            this.id = id;
            this.ordinal = ordinal;
            this.startAudioSequence = startAudioSequence;
        }

        private void seal(long endAudioSequence, long voiceEndAudioSequence) {
            this.endAudioSequence = endAudioSequence;
            this.voiceEndAudioSequence = voiceEndAudioSequence;
        }
    }

    private record Token(String text, long start, long end, String type) {
        private static Token from(Map<?, ?> source) {
            Object text = source.get("text");
            Object start = source.get("startAudioSequence");
            Object end = source.get("endAudioSequence");
            Object type = source.get("type");
            if (!(text instanceof String tokenText)
                    || !(start instanceof Number tokenStart)
                    || !(end instanceof Number tokenEnd)) {
                throw new IllegalArgumentException("Invalid Speech token timing");
            }
            return new Token(tokenText, tokenStart.longValue(), tokenEnd.longValue(),
                    type instanceof String tokenType ? tokenType : "WORD");
        }
    }

    private record SpeechFragment(
            String providerId,
            long revision,
            String text,
            boolean finalResult,
            long start,
            long end,
            List<Token> tokens) {
        private static SpeechFragment from(BranchEvent event) {
            Map<String, Object> payload = event.payload();
            List<Token> tokens = new ArrayList<>();
            Object rawTokens = payload.get("tokens");
            if (rawTokens instanceof List<?> values) {
                for (Object value : values) {
                    if (value instanceof Map<?, ?> token) tokens.add(Token.from(token));
                }
            }
            return new SpeechFragment(
                    VerificationTimelineAssembler.text(payload, "utteranceId"),
                    number(payload, "revision"),
                    VerificationTimelineAssembler.text(payload, "text"),
                    event.type() == BranchEventType.TRANSCRIPT_FINAL,
                    number(payload, "startAudioSequence"),
                    number(payload, "endAudioSequence"),
                    List.copyOf(tokens));
        }
    }
}
