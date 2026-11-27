import { h } from "preact";
import type { TranscriptUpdate } from "../../services/voice-socket";

export interface TranscriptPanelProps {
  readonly state: "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
  readonly segments?: readonly TranscriptUpdate[];
  readonly text?: string;
}

export function TranscriptPanel({ state, segments = [], text }: TranscriptPanelProps) {
  const label = state === "PARTIAL" ? "Transcribing live" :
    state === "FINAL" ? "Final transcript" :
      state === "FAILED" ? "Transcription unavailable" : "Waiting for speech";
  return (
    <section class={`transcript-panel transcript-${state.toLowerCase()}`}
      aria-labelledby="live-transcript-title">
      <div class="transcript-heading">
        <div>
          <p class="eyebrow">SESSION TRANSCRIPT</p>
          <h3 id="live-transcript-title">Live transcription</h3>
        </div>
        <span class="transcript-state">{label}</span>
      </div>
      <div class="transcript-text" role="log" aria-live="polite" aria-atomic="false">
        {segments.length > 0 ? (
          <ol class="transcript-segments">
            {segments.map((segment) => (
              <li key={segment.utteranceId} class={segment.final ? "is-final" : "is-partial"}>
                <p>{segment.text}</p>
                <span>{segment.final ? "Complete" : "Listening…"}</span>
              </li>
            ))}
          </ol>
        ) : text ? <p>{text}</p> : (
          <p class="transcript-placeholder">{state === "FAILED"
            ? "Live transcription is currently unavailable."
            : "Your words will appear here as you speak…"}</p>
        )}
      </div>
    </section>
  );
}
