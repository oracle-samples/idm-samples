import { h } from "preact";
import type { MicrophonePreparation } from "../../services/audio-capture";
import type { AssuranceFailureUpdate, AssuranceUpdate, TranscriptUpdate } from "../../services/voice-socket";
import { VerifiedTranscriptTimeline } from "../../components/verified-transcript-timeline/index";
import { AudioWaveform } from "../../components/audio-waveform/index";
import { ContextNavigation } from "../../components/context-navigation/index";
import type { VerificationTimelineItem } from "../../types/verification-timeline";

export interface VerificationPageProps {
  readonly busy: boolean;
  readonly microphone: MicrophonePreparation;
  readonly voiceState: "IDLE" | "CONNECTING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  readonly sentFrameCount: number;
  readonly muted?: boolean;
  readonly waveform?: readonly number[];
  readonly transcriptState: "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
  readonly transcriptSegments?: readonly TranscriptUpdate[];
  readonly assurances?: readonly AssuranceUpdate[];
  readonly assuranceFailures?: readonly AssuranceFailureUpdate[];
  readonly timeline?: readonly VerificationTimelineItem[];
  readonly captureQuality?: "GOOD" | "NOISY";
  readonly message?: string;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onToggleMute?: () => void;
  readonly onRestart: () => void;
  readonly onBack: () => void;
}

export function VerificationPage(props: VerificationPageProps) {
  const recording = props.voiceState === "RECORDING";
  const processing = props.voiceState === "PROCESSING";
  const failed = props.voiceState === "FAILED" || props.microphone === "FAILED";
  const starting = props.busy || props.voiceState === "CONNECTING";
  const restartable = props.voiceState === "COMPLETED" || props.voiceState === "FAILED";
  const seconds = props.sentFrameCount / 50;
  const assurances = props.assurances ?? [];
  const assuranceFailures = props.assuranceFailures ?? [];
  const timeline = props.timeline ?? legacyTimeline(
    props.transcriptSegments ?? [], assurances, assuranceFailures);
  const latestRow = timeline[timeline.length - 1];
  const voiceCheck = latestRow?.voiceCheckState;
  const transcriptState = latestRow?.transcriptState ?? props.transcriptState;
  return (
    <div class="verification-layout">
      <ContextNavigation current="Audit voice check" onAccount={props.onBack} />
      <header class="verification-heading">
        <div>
          <p class="eyebrow">LIVE VOICE SESSION</p>
          <h1>Audit voice check</h1>
          <p>Speak naturally while voice matching evidence is captured for audit support only.</p>
        </div>
      </header>

      <section class="verification-status-strip" aria-label="Audit voice check session status">
        <div><small>MICROPHONE</small><strong>{props.muted ? "Muted" : recording ? "Listening" : props.microphone === "READY" ? "Ready" : "Not started"}</strong></div>
        <div><small>LIVE TRANSCRIPT</small><strong>{transcriptState === "PARTIAL" ? "Updating" : transcriptState === "FINAL" ? "Up to date" : transcriptState === "FAILED" ? "Unavailable" : "Waiting for speech"}</strong></div>
        <div><small>AUDIT VOICE CHECK</small><strong class={voiceCheck === "MATCH" ? "inline-success" : ""}>
          {voiceCheck === "MATCH" ? "Voice matched for audit" : voiceCheck === "MISMATCH" ? "Voice did not match" :
            voiceCheck === "INCONCLUSIVE" ? "Inconclusive" : voiceCheck === "UNAVAILABLE" ? "Unavailable" :
              voiceCheck === "CHECKING" ? "Checking voice" : voiceCheck === "COLLECTING" ? "Listening for voice" :
                props.voiceState === "PROCESSING" ? "Checking" : failed ? "Unavailable" : "Not started"}
        </strong></div>
      </section>

      {props.message && <p class={`page-message ${failed ? "verification-error" : ""}`}
        role={failed ? "alert" : "status"}>{props.message}</p>}

      <section class={`verification-ready ${recording ? "is-recording" : ""} ${props.muted ? "is-muted" : ""} ${failed ? "is-failed" : ""}`}>
        <div>
          <p class="eyebrow">{failed ? "SESSION UNAVAILABLE" : processing ? "FINISHING SESSION" : props.muted ? "AUDIO MUTED" : recording ? "SESSION LIVE" : "READY TO BEGIN"}</p>
          <h2>{failed ? props.sentFrameCount === 0 ? "Session could not start" : "Session ended" : processing ? "Waiting for final results" : props.muted ? "Audio is not being sent" : recording ? "Audit voice check is in progress" : "Start when the conversation begins"}</h2>
          <p>{failed ? "Audio capture has stopped. Try again when you are ready." : props.muted ? "Resume when you want transcription and audit voice checks to continue." : recording ?
            props.captureQuality === "NOISY"
              ? "Background noise detected — move closer to the microphone or use a headset."
              : `Session active for ${seconds.toFixed(1)} seconds.` :
            processing ? "The microphone is off. You can start another session when processing finishes." :
            "Speak naturally. Voice matching is recorded for audit support only."}</p>
        </div>
        {props.voiceState === "IDLE" || props.voiceState === "CONNECTING" ? (
          <button class="primary-button" type="button" disabled={starting} onClick={props.onStart}>
            {starting ? "Starting session…" : failed ? "Try again" : "Start session"}
          </button>
        ) : recording ? (
          <div class="verification-actions">
            <button class="secondary-button mute-button" type="button" aria-pressed={Boolean(props.muted)} onClick={props.onToggleMute}>
              {props.muted ? "Resume audio" : "Mute audio"}
            </button>
            <button class="secondary-button danger-button" type="button" onClick={props.onStop}>End session</button>
          </div>
        ) : processing ? (
          <button class="primary-button" type="button" disabled>Finishing session…</button>
        ) : restartable ? (
          <button class="primary-button" type="button" disabled={props.busy} onClick={props.onRestart}>
            {failed ? "Try again" : "Start another session"}
          </button>
        ) : null}
        <AudioWaveform
          levels={props.waveform ?? []}
          active={recording && !props.muted}
          label={props.muted ? "Audit voice check microphone muted" : recording ? "Live audit voice check microphone waveform" : "Audit voice check microphone waveform waiting for capture"}
        />
      </section>

      <VerifiedTranscriptTimeline items={timeline} />
    </div>
  );
}

function legacyTimeline(
  transcripts: readonly TranscriptUpdate[],
  assurances: readonly AssuranceUpdate[],
  failures: readonly AssuranceFailureUpdate[]
): readonly VerificationTimelineItem[] {
  const rows = new Map<string, VerificationTimelineItem>();
  transcripts.forEach((transcript, index) => rows.set(transcript.utteranceId, {
    utteranceId: transcript.utteranceId,
    utteranceOrdinal: index + 1,
    startAudioSequence: transcript.startAudioSequence,
    endAudioSequence: transcript.endAudioSequence,
    lifecycle: transcript.final ? "SEALED" : "OPEN",
    transcriptState: transcript.final ? "FINAL" : "PARTIAL",
    text: transcript.text,
    voiceCheckState: transcript.final ? "CHECKING" : "COLLECTING"
  }));
  assurances.forEach((assurance) => {
    const current = rows.get(assurance.utteranceId);
    rows.set(assurance.utteranceId, {
      ...(current ?? {
        utteranceId: assurance.utteranceId,
        startAudioSequence: 1,
        transcriptState: "NOT_STARTED" as const
      }),
      utteranceOrdinal: assurance.utteranceOrdinal,
      lifecycle: "SEALED",
      voiceCheckState: assurance.outcome,
      completedAt: assurance.completedAt
    });
  });
  failures.forEach((failure) => {
    const current = rows.get(failure.utteranceId);
    rows.set(failure.utteranceId, {
      ...(current ?? {
        utteranceId: failure.utteranceId,
        startAudioSequence: 1,
        transcriptState: "NOT_STARTED" as const
      }),
      utteranceOrdinal: failure.utteranceOrdinal,
      lifecycle: "SEALED",
      voiceCheckState: failure.code === "VOICE_UTTERANCE_REJECTED"
        ? "INCONCLUSIVE" : "UNAVAILABLE"
    });
  });
  return [...rows.values()].sort((left, right) => left.utteranceOrdinal - right.utteranceOrdinal);
}
