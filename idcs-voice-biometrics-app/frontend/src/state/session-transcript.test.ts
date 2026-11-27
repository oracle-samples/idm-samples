import { mergeTranscriptSegment } from "./session-transcript";
import type { TranscriptUpdate } from "../services/voice-socket";

function segment(overrides: Partial<TranscriptUpdate> = {}): TranscriptUpdate {
  return {
    utteranceId: "utterance-one",
    revision: 1,
    text: "Initial words",
    final: false,
    startAudioSequence: 1,
    endAudioSequence: 20,
    ...overrides
  };
}

describe("session transcript", () => {
  it("revises only the matching partial and preserves finalized segments", () => {
    let transcript: readonly TranscriptUpdate[] = [];
    transcript = mergeTranscriptSegment(transcript, segment());
    transcript = mergeTranscriptSegment(transcript, segment({ revision: 2, text: "First sentence", final: true }));
    transcript = mergeTranscriptSegment(transcript, segment({ revision: 3, text: "Late partial", final: false }));
    transcript = mergeTranscriptSegment(transcript, segment({
      utteranceId: "utterance-two", revision: 4, text: "Second sentence", final: true,
      startAudioSequence: 21, endAudioSequence: 40
    }));

    expect(transcript.map((item) => item.text)).toEqual(["First sentence", "Second sentence"]);
    expect(transcript.every((item) => item.final)).toBe(true);
  });

  it("orders independently arriving segments by accepted audio position", () => {
    let transcript: readonly TranscriptUpdate[] = [];
    transcript = mergeTranscriptSegment(transcript, segment({
      utteranceId: "later", revision: 2, text: "Later", startAudioSequence: 50, endAudioSequence: 60
    }));
    transcript = mergeTranscriptSegment(transcript, segment({
      utteranceId: "earlier", revision: 1, text: "Earlier", startAudioSequence: 10, endAudioSequence: 20
    }));
    expect(transcript.map((item) => item.text)).toEqual(["Earlier", "Later"]);
  });
});
