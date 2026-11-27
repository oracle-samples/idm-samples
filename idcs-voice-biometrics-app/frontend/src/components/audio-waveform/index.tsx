import { h } from "preact";

export interface AudioWaveformProps {
  readonly levels: readonly number[];
  readonly active: boolean;
  readonly label: string;
}

const BAR_COUNT = 36;
const IDLE_PATTERN = [0.08, 0.12, 0.18, 0.1, 0.22, 0.14];

export function AudioWaveform({ levels, active, label }: AudioWaveformProps) {
  const padding = Math.max(0, BAR_COUNT - levels.length);
  const visibleLevels = [
    ...Array.from({ length: padding }, (_, index) => IDLE_PATTERN[index % IDLE_PATTERN.length] ?? 0.1),
    ...levels.slice(-BAR_COUNT)
  ];
  const voiceDetected = active && (levels[levels.length - 1] ?? 0) >= 0.18;

  return (
    <div class={`audio-waveform ${active ? "is-active" : ""}`} aria-label={label}>
      <div class="waveform-heading">
        <span class={`waveform-live-dot ${voiceDetected ? "voice-detected" : ""}`} aria-hidden="true" />
        <strong>{active ? (voiceDetected ? "Voice input detected" : "Listening…") : "Microphone waveform"}</strong>
        <span>{active ? "Live input" : "Waiting for capture"}</span>
      </div>
      <div class="waveform-bars" aria-hidden="true">
        {visibleLevels.map((level, index) => (
          <span key={index} style={{ height: `${Math.round(6 + Math.min(1, Math.max(0, level)) * 54)}px` }} />
        ))}
      </div>
    </div>
  );
}
