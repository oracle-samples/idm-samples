package com.oracle.aiworld.voice.application.streaming;

import static org.assertj.core.api.Assertions.assertThat;

import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEvent;
import com.oracle.aiworld.voice.port.VoiceBranchSession.BranchEventType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class VerificationTimelineAssemblerTest {
    @Test
    void aggregatesSeveralSpeechFragmentsIntoTheExactAbisWindow() {
        VerificationTimelineAssembler assembler = new VerificationTimelineAssembler();

        assertThat(assembler.accept(started("turn-one", 1, 1)))
                .extracting(BranchEvent::type)
                .containsExactly(BranchEventType.UTTERANCE_STARTED);

        List<BranchEvent> partial = assembler.accept(transcript(
                BranchEventType.TRANSCRIPT_PARTIAL,
                "speech-a",
                1,
                "Please take a deep breath",
                1,
                120,
                List.of(
                        token("Please", 1, 20, "WORD"),
                        token("take", 21, 40, "WORD"),
                        token("a", 41, 50, "WORD"),
                        token("deep", 51, 75, "WORD"),
                        token("breath", 76, 120, "WORD"))));
        assertThat(partial).singleElement().satisfies(event -> {
            assertThat(event.type()).isEqualTo(BranchEventType.TRANSCRIPT_PARTIAL);
            assertThat(event.payload()).containsEntry("utteranceId", "turn-one")
                    .containsEntry("text", "Please take a deep breath");
        });

        List<BranchEvent> sealed = assembler.accept(sealed("turn-one", 1, 1, 265, 250));
        assertThat(sealed).extracting(BranchEvent::type)
                .contains(BranchEventType.UTTERANCE_SEALED);

        List<BranchEvent> completedText = assembler.accept(transcript(
                BranchEventType.TRANSCRIPT_FINAL,
                "speech-b",
                2,
                "and hold it.",
                121,
                250,
                List.of(
                        token("and", 121, 145, "WORD"),
                        token("hold", 146, 180, "WORD"),
                        token("it", 181, 220, "WORD"),
                        token(".", 221, 221, "PUNCTUATION"))));
        assertThat(completedText).singleElement().satisfies(event -> {
            assertThat(event.type()).isEqualTo(BranchEventType.TRANSCRIPT_FINAL);
            assertThat(event.payload()).containsEntry("utteranceId", "turn-one")
                    .containsEntry("text", "Please take a deep breath and hold it.")
                    .containsEntry("startAudioSequence", 1L)
                    .containsEntry("endAudioSequence", 265L);
        });

        BranchEvent result = new BranchEvent(
                BranchEventType.ASSURANCE_RESULT,
                "ABIS",
                "RECORD_UTTERANCE",
                "VOICE_MATCH",
                Map.of("utteranceId", "turn-one", "utteranceOrdinal", 1L, "outcome", "MATCH"));
        assertThat(assembler.accept(result)).containsExactly(result);
    }

    @Test
    void buffersSpeechUntilTheAbisWindowArrivesAndRejectsAmbiguousUntimedText() {
        VerificationTimelineAssembler assembler = new VerificationTimelineAssembler();
        assertThat(assembler.accept(transcript(
                BranchEventType.TRANSCRIPT_PARTIAL,
                "speech-buffered",
                1,
                "Buffered words",
                1,
                80,
                List.of(token("Buffered", 1, 40, "WORD"), token("words", 41, 80, "WORD")))))
                .isEmpty();

        assertThat(assembler.accept(started("turn-one", 1, 1)))
                .extracting(BranchEvent::type)
                .containsExactly(BranchEventType.UTTERANCE_STARTED, BranchEventType.TRANSCRIPT_PARTIAL);
        assembler.accept(sealed("turn-one", 1, 1, 265, 250));
        assembler.accept(started("turn-two", 2, 266));
        assembler.accept(sealed("turn-two", 2, 266, 530, 515));

        List<BranchEvent> failures = assembler.accept(transcript(
                BranchEventType.TRANSCRIPT_FINAL,
                "speech-ambiguous",
                2,
                "Cannot be split safely",
                200,
                320,
                List.of()));
        assertThat(failures).extracting(BranchEvent::type)
                .containsOnly(BranchEventType.TRANSCRIPT_FAILED);
        assertThat(failures).extracting(event -> event.payload().get("utteranceId"))
                .containsExactlyInAnyOrder("turn-one", "turn-two");
        assertThat(assembler.accept(transcript(
                BranchEventType.TRANSCRIPT_FINAL,
                "speech-late",
                3,
                "Late text must not regress the failure",
                266,
                515,
                List.of(token("Late", 266, 300, "WORD")))))
                .isEmpty();
    }

    private static BranchEvent started(String id, long ordinal, long start) {
        return new BranchEvent(BranchEventType.UTTERANCE_STARTED, "ABIS", "RECORD_UTTERANCE",
                "ABIS_UTTERANCE_STARTED", Map.of(
                        "utteranceId", id,
                        "utteranceOrdinal", ordinal,
                        "startAudioSequence", start));
    }

    private static BranchEvent sealed(
            String id, long ordinal, long start, long end, long voiceEnd) {
        return new BranchEvent(BranchEventType.UTTERANCE_SEALED, "ABIS", "RECORD_UTTERANCE",
                "ABIS_UTTERANCE_SEALED", Map.of(
                        "utteranceId", id,
                        "utteranceOrdinal", ordinal,
                        "startAudioSequence", start,
                        "endAudioSequence", end,
                        "voiceStartAudioSequence", start,
                        "voiceEndAudioSequence", voiceEnd,
                        "detectedSpeechMs", 5_000L));
    }

    private static BranchEvent transcript(
            BranchEventType type,
            String providerId,
            long revision,
            String text,
            long start,
            long end,
            List<Map<String, Object>> tokens) {
        return new BranchEvent(type, "SPEECH", type.name(), "SPEECH_TRANSCRIPT_AVAILABLE", Map.of(
                "utteranceId", providerId,
                "revision", revision,
                "text", text,
                "startAudioSequence", start,
                "endAudioSequence", end,
                "tokens", new ArrayList<>(tokens)));
    }

    private static Map<String, Object> token(
            String text, long start, long end, String type) {
        return Map.of(
                "text", text,
                "startAudioSequence", start,
                "endAudioSequence", end,
                "type", type);
    }
}
