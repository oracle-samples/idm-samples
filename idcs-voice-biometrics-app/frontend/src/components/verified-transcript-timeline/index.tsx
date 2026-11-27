import { h } from "preact";
import type {
  VerificationTimelineItem,
  VerificationVoiceCheckState
} from "../../types/verification-timeline";

export interface VerifiedTranscriptTimelineProps {
  readonly transcriptionEnabled?: boolean;
  readonly items?: readonly VerificationTimelineItem[];
}

const VOICE_LABELS: Record<VerificationVoiceCheckState, string> = {
  COLLECTING: "Listening for voice",
  CHECKING: "Checking voice",
  MATCH: "Matched enrolled voice for audit",
  MISMATCH: "Did not match enrolled voice",
  INCONCLUSIVE: "Inconclusive",
  UNAVAILABLE: "Voice check unavailable"
};

const VOICE_ICONS: Record<VerificationVoiceCheckState, string> = {
  COLLECTING: "", CHECKING: "", MATCH: "✓", MISMATCH: "×", INCONCLUSIVE: "—", UNAVAILABLE: "!"
};

export function VerifiedTranscriptTimeline({ items = [], transcriptionEnabled = true }: VerifiedTranscriptTimelineProps) {
  const latestFirstItems = [...items].reverse();

  return (
    <section class="verified-transcript" aria-labelledby="verified-transcript-title">
      <div class="verified-transcript-heading">
        <div>
          <p class="eyebrow">{transcriptionEnabled ? "SESSION TRANSCRIPT" : "SESSION RESULTS"}</p>
          <h3 id="verified-transcript-title">{transcriptionEnabled ? "Audit session transcript" : "Voice check results"}</h3>
        </div>
        <span>Latest audit voice check appears first</span>
      </div>
      <div class="verified-transcript-body" role="log" aria-live="polite" aria-atomic="false">
        {items.length === 0 ? (
          <div class="verified-transcript-empty">
            <strong>Waiting for speech</strong>
            <span>{transcriptionEnabled ? "Live transcription and audit voice checks will appear together here." : "Voice check results will appear here as you speak."}</span>
          </div>
        ) : (
          <ol class="verified-transcript-list">
            {latestFirstItems.map((item) => <TimelineRow key={item.utteranceId} item={item} transcriptionEnabled={transcriptionEnabled} />)}
          </ol>
        )}
      </div>
    </section>
  );
}

function TimelineRow({ item, transcriptionEnabled }: { readonly item: VerificationTimelineItem; readonly transcriptionEnabled: boolean }) {
  const voiceLabel = VOICE_LABELS[item.voiceCheckState];
  const transcriptLabel = item.transcriptState === "FINAL" ? "Transcript complete" :
    item.transcriptState === "PARTIAL" ? "Transcribing…" :
      item.transcriptState === "FAILED" ? item.text ? "Transcript incomplete" : "Transcription unavailable" : "Listening…";
  return (
    <li class={`verified-transcript-row voice-${item.voiceCheckState.toLowerCase()}`}>
      <div class="verified-transcript-copy">
        <div class="verified-transcript-row-heading">
          <span>Audit voice check {item.utteranceOrdinal}</span>
          {transcriptionEnabled && <small>{transcriptLabel}</small>}
        </div>
        {!transcriptionEnabled ? <p>{voiceLabel}</p> : item.text ? <p>{item.text}</p> : item.transcriptState === "FAILED" ? (
          <p class="transcript-unavailable">Transcription unavailable for this audit voice check.</p>
        ) : <p class="transcript-placeholder">Your words will appear here as you speak…</p>}
        {transcriptionEnabled && item.transcriptState === "FAILED" && item.text &&
          <p class="transcript-unavailable">Final transcript was not received.</p>}
      </div>
      <div class="verified-transcript-outcome" role="status" aria-label={voiceLabel}
        title={voiceLabel} tabIndex={0}>
        <span class="verified-transcript-icon" aria-hidden="true">{VOICE_ICONS[item.voiceCheckState]}</span>
      </div>
    </li>
  );
}
