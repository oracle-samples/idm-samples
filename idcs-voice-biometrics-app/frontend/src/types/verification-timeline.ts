export type VerificationTranscriptState = "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
export type VerificationVoiceCheckState =
  "COLLECTING" | "CHECKING" | "MATCH" | "MISMATCH" | "INCONCLUSIVE" | "UNAVAILABLE";

export interface VerificationTimelineItem {
  readonly utteranceId: string;
  readonly utteranceOrdinal: number;
  readonly startAudioSequence: number;
  readonly endAudioSequence?: number;
  readonly lifecycle: "OPEN" | "SEALED";
  readonly transcriptState: VerificationTranscriptState;
  readonly text?: string;
  readonly voiceCheckState: VerificationVoiceCheckState;
  readonly completedAt?: string;
}
