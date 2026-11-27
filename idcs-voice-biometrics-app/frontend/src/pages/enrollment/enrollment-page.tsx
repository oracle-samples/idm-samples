import { h } from "preact";
import type { MicrophonePreparation } from "../../services/audio-capture";
import type { EnrollmentAttempt } from "../../types/application-contracts";
import { EnrollmentConsent } from "./enrollment-consent";
import { TranscriptPanel } from "../../components/transcript-panel/index";
import { AudioWaveform } from "../../components/audio-waveform/index";
import { ContextNavigation } from "../../components/context-navigation/index";
import type { TranscriptUpdate } from "../../services/voice-socket";
import { promptForEnrollmentSample } from "./enrollment-prompts";

export interface EnrollmentPageProps {
  readonly attempt: EnrollmentAttempt;
  readonly busy: boolean;
  readonly microphone?: MicrophonePreparation;
  readonly voiceState?: "IDLE" | "CONNECTING" | "READY" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  readonly sentFrameCount?: number;
  readonly utteranceOrdinal?: number;
  readonly acceptedUtteranceCount?: number;
  readonly capturedSampleMs?: number;
  readonly maximumSampleMs?: number;
  readonly minimumSampleMs?: number;
  readonly waveform?: readonly number[];
  readonly transcriptState?: "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
  readonly transcriptSegments?: readonly TranscriptUpdate[];
  readonly voiceActivity?: "SILENCE" | "SPEECH" | "AWAITING_PAUSE";
  readonly qualityState?: "WAITING" | "ACCEPTED" | "SILENCE" | "REJECTED" | "DEGRADED";
  readonly message?: string;
  readonly onConsent: (decision: "ACCEPT" | "DECLINE") => void;
  readonly onStart?: () => void;
  readonly onContinue?: () => void;
  readonly onBack: () => void;
}

interface EnrollmentProgressRingProps {
  readonly voiceState: NonNullable<EnrollmentPageProps["voiceState"]>;
  readonly utteranceOrdinal: number;
  readonly acceptedUtteranceCount: number;
  readonly capturedSampleMs: number;
  readonly maximumSampleMs: number;
  readonly minimumSampleMs: number;
}

function EnrollmentProgressRing({
  voiceState,
  utteranceOrdinal,
  acceptedUtteranceCount,
  capturedSampleMs,
  maximumSampleMs,
  minimumSampleMs
}: EnrollmentProgressRingProps) {
  const terminalProgress = voiceState === "PROCESSING" || voiceState === "COMPLETED";
  const boundedSpeechMs = Math.max(0, Math.min(maximumSampleMs, capturedSampleMs));
  const percent = terminalProgress
    ? 100
    : Math.round((boundedSpeechMs / maximumSampleMs) * 100);
  const phase = voiceState === "COMPLETED" ? "success" :
    voiceState === "FAILED" ? "failure" :
      voiceState === "PROCESSING" ? "processing" :
        voiceState === "RECORDING" ? "recording" : "ready";
  const sampleAcceptedText = `${acceptedUtteranceCount} ${acceptedUtteranceCount === 1 ? "sample" : "samples"} accepted`;
  const title = phase === "success" ? "Voice enrolled" :
    phase === "failure" ? "Enrollment unsuccessful" :
      phase === "processing" ? "Processing voice samples" :
        phase === "recording"
          ? (percent === 100 ? `Voice sample ${utteranceOrdinal} collected` : `Voice sample ${utteranceOrdinal}`)
          : "Ready to record";
  const detail = phase === "success" ? "Your voice profile is ready for audit checks" :
    phase === "failure" ? "Select Enroll voice to try again" :
      phase === "processing" ? "Checking and creating your voice profile" :
        phase === "recording"
          ? (percent === 100
            ? "Checking if another sample is needed"
            : `${(boundedSpeechMs / 1000).toFixed(1)} of ${(maximumSampleMs / 1000).toFixed(1)} seconds • ${sampleAcceptedText}`)
          : `${(minimumSampleMs / 1000).toFixed(0)}–${(maximumSampleMs / 1000).toFixed(0)} seconds per sample`;
  const valueText = phase === "processing" ? "Voice samples collected; processing" :
    phase === "success" ? "Voice enrollment successful" :
      phase === "failure" ? `Voice enrollment failed after ${percent}% collection` :
        `Voice sample ${utteranceOrdinal}: ${percent}% of maximum sample audio collected; ${sampleAcceptedText}`;
  const visualPercent = phase === "failure" ? 100 : percent;

  return (
    <div class={`enrollment-progress-visual ${phase}`}>
      <div
        class="enrollment-progress-ring"
        role="progressbar"
        aria-label="Voice enrollment progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={valueText}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="progress-ring-track" cx="60" cy="60" r="51" pathLength="100" />
          <circle
            class="progress-ring-value"
            cx="60"
            cy="60"
            r="51"
            pathLength="100"
            style={{ strokeDashoffset: 100 - visualPercent }}
          />
        </svg>
        <div class="progress-ring-center" aria-hidden="true">
          {phase === "success" ? <span class="progress-result-icon">✓</span> :
            phase === "failure" ? <span class="progress-result-icon">!</span> :
              phase === "processing" ? <span class="processing-mark"><i /><i /><i /></span> :
                <><strong>{percent}%</strong><small>collected</small></>}
        </div>
      </div>
      <div
        class="enrollment-progress-copy"
        role="status"
        aria-live={phase === "recording" ? "off" : "polite"}
      >
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export function EnrollmentPage({
  attempt,
  busy,
  microphone = "IDLE",
  voiceState = "IDLE",
  utteranceOrdinal = 1,
  acceptedUtteranceCount = 0,
  capturedSampleMs = 0,
  maximumSampleMs = 10000,
  minimumSampleMs = 7000,
  waveform = [],
  transcriptState = "NOT_STARTED",
  transcriptSegments = [],
  voiceActivity = "SILENCE",
  qualityState = "WAITING",
  message,
  onConsent,
  onStart,
  onContinue,
  onBack
}: EnrollmentPageProps) {
  const recording = voiceState === "RECORDING";
  const prompt = promptForEnrollmentSample(attempt.enrollmentAttemptId, utteranceOrdinal);
  const remainingSeconds = Math.max(0, maximumSampleMs - capturedSampleMs) / 1000;
  const sampleComplete = capturedSampleMs >= maximumSampleMs;
  const coaching = qualityState === "REJECTED"
    ? "The service did not accept that sample. Keep reading naturally for the next sample."
    : qualityState === "DEGRADED"
    ? "Background noise detected — move closer to the microphone or use a headset."
    : sampleComplete
    ? `Voice sample ${utteranceOrdinal} collected — please wait while we check if another sample is needed.`
    : capturedSampleMs >= minimumSampleMs
    ? "Minimum sample length reached — pause briefly, or continue to the maximum."
    : voiceActivity === "SPEECH"
      ? `Keep reading naturally. ${remainingSeconds.toFixed(1)} seconds remaining.`
      : capturedSampleMs > 0
        ? "Continue reading. If you reached the end, repeat the highlighted sentence."
        : utteranceOrdinal > 1
          ? `A new reading script is ready for voice sample ${utteranceOrdinal}. Start at START.`
          : "Start reading the passage aloud in your natural voice.";
  const captureDescription = recording
    ? coaching
    : voiceState === "PROCESSING"
      ? "Recording is complete. Keep this page open while your voice profile is created."
      : voiceState === "COMPLETED"
        ? "Your voice profile is enrolled and ready for audit voice checks."
        : voiceState === "FAILED"
          ? "Voice enrollment was not completed. Use one speaker in a quieter place and try again."
          : "When you begin, read the highlighted passage aloud at your normal pace.";
  return (
    <div class="enrollment-layout">
      <header class="enrollment-heading">
        <div>
          <p class="eyebrow">VOICE ENROLLMENT</p>
          <h1>Register your voice</h1>
          <p>Create a voice profile for future audit-oriented voice checks.</p>
        </div>
        <ContextNavigation current="Enroll voice" onAccount={onBack} />
      </header>

      {attempt.state === "CONSENT_PENDING" ? (
        <EnrollmentConsent attempt={attempt} busy={busy} onDecision={onConsent} />
      ) : attempt.state === "CONSENT_DECLINED" ? (
        <section class="consent-card" aria-labelledby="declined-title">
          <p class="eyebrow">ENROLLMENT ENDED</p>
          <h2 id="declined-title">Voice enrollment was not started</h2>
          <p>No recording was made.</p>
          <button class="secondary-button" type="button" onClick={onBack}>Return to account</button>
        </section>
      ) : (
        <div class="enrollment-grid">
          <section class="capture-card" aria-labelledby="capture-title">
            <p class="eyebrow">VOICE CAPTURE</p>
            <h2 id="capture-title">{voiceState === "RECORDING" ? "Enrollment recording" :
              voiceState === "CONNECTING" ? "Starting enrollment" :
              voiceState === "PROCESSING" ? "Creating your voice profile" :
              voiceState === "COMPLETED" ? "Enrollment complete" :
                  voiceState === "FAILED" ? "Enrollment was not completed" : "Ready when you are"}</h2>
            <div class="enrollment-capture-overview">
              <section class={`read-aloud-card ${recording ? "is-recording" : ""}`} aria-labelledby="read-aloud-title">
                <div class="read-aloud-heading">
                  <div>
                    <p class="eyebrow">YOUR READING SCRIPT · SAMPLE {utteranceOrdinal}</p>
                    <h3 id="read-aloud-title">{recording ? "Read the text below now" : "Read this text aloud"}</h3>
                  </div>
                  {recording ? <span class="recording-badge"><i aria-hidden="true" /> Recording</span> : null}
                </div>
                <p class="read-aloud-instruction">
                  {recording
                    ? "Recording is active. Keep reading at your normal pace until enrollment starts processing."
                    : "Select Enroll voice, then speak clearly at your normal pace from START to END."}
                </p>
                <div class="reading-script" role="group" aria-label="Text to read aloud for voice enrollment">
                  <span class="script-boundary">START</span>
                  <blockquote>{prompt.text}</blockquote>
                  <span class="script-boundary script-boundary-end">END</span>
                </div>
                <p class="repeat-instruction">
                  If you reach END before this sample finishes, repeat this highlighted sentence:
                  {" "}<mark>{prompt.repeatText}</mark>
                </p>
              </section>
              <EnrollmentProgressRing
                voiceState={voiceState}
                utteranceOrdinal={utteranceOrdinal}
                acceptedUtteranceCount={acceptedUtteranceCount}
                capturedSampleMs={capturedSampleMs}
                maximumSampleMs={maximumSampleMs}
                minimumSampleMs={minimumSampleMs}
              />
            </div>
            <AudioWaveform
              levels={waveform}
              active={recording}
              label={recording ? "Live enrollment microphone waveform" : "Enrollment microphone waveform waiting for capture"}
            />
            <div class="enrollment-control-row">
              <div class="enrollment-control-copy">
                {!recording ? <p>{captureDescription}</p> : null}
                {recording ? <p class="coaching-message" role="status" aria-live="polite">{coaching}</p> : null}
                {voiceState === "CONNECTING" ? <p role="status">Preparing your voice session…</p> : null}
                {voiceState === "PROCESSING" ? <p role="status">Creating your voice profile…</p> : null}
              </div>
              {voiceState !== "RECORDING" && voiceState !== "PROCESSING" && voiceState !== "COMPLETED" ? (
                <button
                  class="primary-button"
                  type="button"
                  disabled={busy}
                  onClick={onStart}
                >
                  {microphone === "PREPARING" ? "Preparing microphone…" :
                    voiceState === "CONNECTING" ? "Starting enrollment…" : "Enroll voice"}
                </button>
              ) : null}
              {voiceState === "COMPLETED" ? (
                <button class="primary-button success-button" type="button" onClick={onContinue}>
                  Continue to Voice Verification <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>
            <TranscriptPanel state={transcriptState} segments={transcriptSegments} />
          </section>
          <aside class="before-card" aria-labelledby="before-title">
            <p class="eyebrow">BEFORE YOU BEGIN</p>
            <h2 id="before-title">Capture clear voice samples</h2>
            <ol>
              <li><strong>Choose a quiet space</strong><span>Reduce background noise.</span></li>
              <li><strong>Use one speaker</strong><span>The same person must read every requested sample.</span></li>
              <li><strong>Read the displayed script</strong><span>Begin at START and use your normal pace and volume.</span></li>
              <li><strong>Continue until finished</strong><span>Each sample uses {(minimumSampleMs / 1000).toFixed(0)}–{(maximumSampleMs / 1000).toFixed(0)} seconds of audio. Pause after reaching the minimum; more than one sample may be requested.</span></li>
            </ol>
            <section class="data-protection-card" aria-labelledby="enrollment-data-title">
              <p class="eyebrow">DATA USE</p>
              <h3 id="enrollment-data-title">How your voice is protected</h3>
              <ul>
                <li>Your voice profile is linked to your signed-in account and securely stored by the configured identity and biometric service.</li>
                <li>This demo app does not retain your raw voice recordings. Only an encrypted voice profile is stored for voice matching.</li>
                <li>Your voice data is not used for voice search, AI model training, granting access, or approving high-risk actions.</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
      {message ? <p class="page-message" role="status">{message}</p> : null}
    </div>
  );
}
