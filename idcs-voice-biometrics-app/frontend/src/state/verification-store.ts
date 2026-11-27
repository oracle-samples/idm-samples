import { ApiError } from "../services/api-client";
import { AudioCapture, audioCaptureFailureMessage, type MicrophonePreparation } from "../services/audio-capture";
import { appendWaveformLevel, calculatePcm16Level } from "../services/audio-level";
import { AuthenticationClient } from "../services/authentication";
import {
  VoiceSocket,
  type AssuranceFailureUpdate,
  type AssuranceUpdate,
  type CaptureQualityUpdate,
  type TranscriptFailureUpdate,
  type TranscriptUpdate,
  type UtteranceSealedUpdate,
  type UtteranceStartedUpdate
} from "../services/voice-socket";
import { mergeTranscriptSegment } from "./session-transcript";
import type { VerificationTimelineItem } from "../types/verification-timeline";

export interface VerificationSnapshot {
  readonly active: boolean;
  readonly busy: boolean;
  readonly microphone: MicrophonePreparation;
  readonly voiceState: "IDLE" | "CONNECTING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  readonly sentFrameCount: number;
  readonly muted: boolean;
  readonly waveform: readonly number[];
  readonly transcriptState: "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
  readonly transcriptSegments: readonly TranscriptUpdate[];
  readonly assurances: readonly AssuranceUpdate[];
  readonly assuranceFailures: readonly AssuranceFailureUpdate[];
  readonly timeline: readonly VerificationTimelineItem[];
  readonly captureQuality: CaptureQualityUpdate["state"];
  readonly message?: string;
}

type Listener = (snapshot: VerificationSnapshot) => void;

export class VerificationStore {
  private snapshot: VerificationSnapshot = {
    active: false, busy: false, microphone: "IDLE", voiceState: "IDLE",
    sentFrameCount: 0, muted: false, waveform: [], transcriptState: "NOT_STARTED",
    transcriptSegments: [], assurances: [], assuranceFailures: [], timeline: [], captureQuality: "GOOD"
  };
  private readonly listeners = new Set<Listener>();
  private readonly authentication: AuthenticationClient;
  private readonly audio: AudioCapture;
  private readonly createVoiceSocket: () => VoiceSocket;
  private voiceSocket?: VoiceSocket;
  private sentFrameCount = 0;
  private transcriptionEnabled = true;
  private muted = false;

  constructor(
    authentication: AuthenticationClient,
    audio = new AudioCapture(),
    createVoiceSocket: () => VoiceSocket = () => new VoiceSocket()
  ) {
    this.authentication = authentication;
    this.audio = audio;
    this.createVoiceSocket = createVoiceSocket;
  }

  get value(): VerificationSnapshot { return this.snapshot; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  begin(): void {
    this.reset();
    this.set({ ...this.snapshot, active: true });
  }

  async prepareMicrophone(): Promise<void> {
    if (this.snapshot.busy || this.snapshot.microphone === "READY") return;
    this.set({ ...this.snapshot, busy: true, microphone: "PREPARING", message: undefined });
    try {
      await this.audio.prepare();
      this.set({ ...this.snapshot, busy: false, microphone: "READY",
        message: "Microphone connected. Start when the conversation begins." });
    } catch (error) {
      this.audio.release();
      this.set({ ...this.snapshot, busy: false, microphone: "FAILED",
        message: audioCaptureFailureMessage(error) ?? "Microphone permission or an available audio input is required." });
    }
  }

  async startFlow(transcriptionEnabled = true): Promise<void> {
    this.transcriptionEnabled = transcriptionEnabled;
    await this.prepareMicrophone();
    if (this.snapshot.microphone === "READY" && this.snapshot.voiceState === "IDLE") {
      await this.start();
    }
  }

  async start(): Promise<void> {
    if (this.snapshot.busy || this.snapshot.microphone !== "READY" ||
        this.snapshot.voiceState === "RECORDING") return;
    this.set({ ...this.snapshot, busy: true, voiceState: "CONNECTING", message: undefined });
    const socket = this.createVoiceSocket();
    this.voiceSocket = socket;
    const current = () => this.voiceSocket === socket;
    socket.onTerminalFailure((code) => { if (current()) this.fail(code); });
    if (this.transcriptionEnabled) {
      socket.onTranscript((update) => { if (current()) this.applyTranscript(update); });
      socket.onTranscriptFailure((update) => { if (current()) this.applyTranscriptFailure(update); });
    }
    socket.onUtteranceStarted((update) => { if (current()) this.applyUtteranceStarted(update); });
    socket.onUtteranceDiscarded((update) => { if (current()) this.applyUtteranceDiscarded(update); });
    socket.onUtteranceSealed((update) => { if (current()) this.applyUtteranceSealed(update); });
    socket.onAssurance((update) => { if (current()) this.applyAssurance(update); });
    socket.onAssuranceFailure((update) => { if (current()) this.applyAssuranceFailure(update); });
    socket.onCaptureQuality((update) => { if (current()) this.applyCaptureQuality(update); });
    socket.onCompleted(() => { if (current()) this.finish(); });
    try {
      const session = await this.authentication.createVerificationVoiceSession();
      await socket.connect(session);
      socket.startCapture();
      this.sentFrameCount = 0;
      await this.audio.start((frame) => {
        if (this.muted) return;
        if (socket.sendAudio(frame)) {
          this.sentFrameCount += 1;
          if (this.sentFrameCount % 4 === 0) {
            this.set({
              ...this.snapshot,
              sentFrameCount: this.sentFrameCount,
              waveform: appendWaveformLevel(this.snapshot.waveform, calculatePcm16Level(frame))
            });
          }
        }
      });
      this.muted = false;
      this.set({ ...this.snapshot, busy: false, voiceState: "RECORDING", waveform: [],
        muted: false, message: "Audit voice check is live. Speak naturally when you are ready." });
    } catch (error) {
      socket.close();
      this.voiceSocket = undefined;
      this.audio.release();
      if (error instanceof ApiError && error.status === 401) {
        this.reset();
        throw error;
      }
      const code = error instanceof ApiError ? error.problem?.code :
        error instanceof Error ? error.message : undefined;
      this.set({ ...this.snapshot, busy: false, microphone: "FAILED", voiceState: "FAILED",
        transcriptState: code?.startsWith("SPEECH_") ? "FAILED" : this.snapshot.transcriptState,
        message: audioCaptureFailureMessage(error) ?? (code?.startsWith("SPEECH_")
          ? "Transcription could not connect. Please try again."
          : "Audit voice check could not start. Check your connection and try again.") });
      throw error;
    }
  }

  stop(): void {
    if (this.snapshot.voiceState !== "RECORDING") return;
    this.voiceSocket?.endCapture(this.sentFrameCount);
    this.audio.release();
    this.set({ ...this.snapshot, microphone: "IDLE", voiceState: "PROCESSING",
      sentFrameCount: this.sentFrameCount,
      message: this.transcriptionEnabled ? "Capture ended. Waiting for final voice and transcript results."
        : "Capture ended. Waiting for final voice results." });
  }

  toggleMute(): void {
    if (this.snapshot.voiceState !== "RECORDING" || !this.voiceSocket) return;
    if (this.muted) {
      this.voiceSocket.resumeCapture();
      this.muted = false;
      this.set({ ...this.snapshot, muted: false,
        message: this.transcriptionEnabled ? "Audio resumed. New speech is being sent for transcription and audit voice checks."
          : "Audio resumed. New speech is being sent for audit voice checks." });
      return;
    }
    this.voiceSocket.pauseCapture();
    this.muted = true;
    this.set({ ...this.snapshot, muted: true,
      message: "Muted. Audio is not being sent." });
  }

  reset(): void {
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    this.audio.release();
    this.sentFrameCount = 0;
    this.muted = false;
    this.set({ active: false, busy: false, microphone: "IDLE", voiceState: "IDLE",
      sentFrameCount: 0, muted: false, waveform: [], transcriptState: "NOT_STARTED",
      transcriptSegments: [], assurances: [], assuranceFailures: [], timeline: [], captureQuality: "GOOD" });
  }

  private applyCaptureQuality(update: CaptureQualityUpdate): void {
    this.set({
      ...this.snapshot,
      captureQuality: update.state,
      message: update.state === "NOISY"
        ? "Background noise detected — move closer to the microphone or use a headset."
        : this.snapshot.message?.startsWith("Background noise detected")
          ? "Audit voice check is live. Speak naturally when you are ready."
          : this.snapshot.message
    });
  }

  private applyTranscript(update: TranscriptUpdate): void {
    const transcriptSegments = mergeTranscriptSegment(this.snapshot.transcriptSegments, update);
    if (transcriptSegments === this.snapshot.transcriptSegments) return;
    const timeline = updateTimeline(this.snapshot.timeline, update.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(update.utteranceId, this.snapshot.timeline.length + 1,
        update.startAudioSequence)),
      endAudioSequence: current?.endAudioSequence ?? update.endAudioSequence,
      transcriptState: update.final ? "FINAL" : "PARTIAL",
      text: update.text
    }));
    if (transcriptSegments === this.snapshot.transcriptSegments && timeline === this.snapshot.timeline) return;
    this.set({ ...this.snapshot, transcriptSegments, timeline,
      transcriptState: update.final ? "FINAL" : "PARTIAL" });
  }

  private applyTranscriptFailure(update: TranscriptFailureUpdate): void {
    const timeline = updateTimeline(this.snapshot.timeline, update.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(update.utteranceId, update.utteranceOrdinal, 1)),
      transcriptState: "FAILED"
    }));
    this.set({ ...this.snapshot, timeline });
  }

  private applyUtteranceStarted(update: UtteranceStartedUpdate): void {
    const timeline = updateTimeline(this.snapshot.timeline, update.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(
        update.utteranceId, update.utteranceOrdinal, update.startAudioSequence)),
      utteranceOrdinal: update.utteranceOrdinal,
      startAudioSequence: update.startAudioSequence,
      lifecycle: "OPEN",
      voiceCheckState: current?.voiceCheckState ?? "COLLECTING"
    }));
    this.set({ ...this.snapshot, timeline });
  }

  private applyUtteranceSealed(update: UtteranceSealedUpdate): void {
    const timeline = updateTimeline(this.snapshot.timeline, update.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(
        update.utteranceId, update.utteranceOrdinal, update.startAudioSequence)),
      utteranceOrdinal: update.utteranceOrdinal,
      startAudioSequence: update.startAudioSequence,
      endAudioSequence: update.endAudioSequence,
      lifecycle: "SEALED",
      voiceCheckState: current?.voiceCheckState === "COLLECTING"
        ? "CHECKING" : current?.voiceCheckState ?? "CHECKING"
    }));
    this.set({ ...this.snapshot, timeline });
  }

  private applyUtteranceDiscarded(update: UtteranceStartedUpdate): void {
    const timeline = this.snapshot.timeline.filter(
      (item) => item.utteranceId !== update.utteranceId);
    if (timeline.length !== this.snapshot.timeline.length) {
      this.set({ ...this.snapshot, timeline });
    }
  }

  private applyAssurance(assurance: AssuranceUpdate): void {
    const existing = this.snapshot.assurances.find(
      (candidate) => candidate.utteranceId === assurance.utteranceId);
    if (existing) return;
    const assurances = [...this.snapshot.assurances, assurance]
      .sort((left, right) => left.utteranceOrdinal - right.utteranceOrdinal);
    const latest = assurances[assurances.length - 1] ?? assurance;
    const timeline = updateTimeline(this.snapshot.timeline, assurance.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(
        assurance.utteranceId, assurance.utteranceOrdinal, 1)),
      utteranceOrdinal: assurance.utteranceOrdinal,
      lifecycle: "SEALED",
      voiceCheckState: assurance.outcome,
      completedAt: assurance.completedAt
    }));
    this.set({ ...this.snapshot, assurances, timeline,
      message: wordingFor(latest.outcome) + (this.snapshot.voiceState === "PROCESSING"
        ? ". Capture has stopped; finishing the session." : ". Audit voice check continues.") });
  }

  private applyAssuranceFailure(failure: AssuranceFailureUpdate): void {
    if (this.snapshot.assuranceFailures.some(
      (candidate) => candidate.utteranceId === failure.utteranceId)) return;
    const assuranceFailures = [...this.snapshot.assuranceFailures, failure]
      .sort((left, right) => left.utteranceOrdinal - right.utteranceOrdinal);
    const utteranceRejected = failure.code === "VOICE_UTTERANCE_REJECTED";
    const timeline = updateTimeline(this.snapshot.timeline, failure.utteranceId, (current) => ({
      ...(current ?? fallbackTimelineItem(failure.utteranceId, failure.utteranceOrdinal, 1)),
      utteranceOrdinal: failure.utteranceOrdinal,
      lifecycle: "SEALED",
      voiceCheckState: utteranceRejected ? "INCONCLUSIVE" : "UNAVAILABLE"
    }));
    this.set({ ...this.snapshot, assuranceFailures, timeline,
      message: (utteranceRejected ? "Inconclusive." : "Voice sample could not be processed.") +
        (this.snapshot.voiceState === "PROCESSING"
          ? " Capture has stopped; finishing the session." : " Audit voice check continues.") });
  }

  private finish(): void {
    this.audio.release();
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    const incomplete = this.transcriptionEnabled && this.snapshot.timeline.some((item) =>
      item.transcriptState === "PARTIAL" || item.transcriptState === "NOT_STARTED");
    const timeline = settleTimeline(this.snapshot.timeline, this.transcriptionEnabled);
    this.set({ ...this.snapshot, busy: false, microphone: "IDLE", voiceState: "COMPLETED",
      timeline,
      transcriptState: timeline.some((item) => item.transcriptState === "FAILED")
        ? "FAILED" : this.snapshot.transcriptState,
      sentFrameCount: this.sentFrameCount,
      message: incomplete
        ? "Audit voice check session completed. Some transcript text could not be finalized."
        : this.snapshot.assurances.length > 0
        ? "Audit voice check session completed."
        : "Audit voice check session completed without a voice result." });
  }

  private fail(code: string): void {
    this.audio.release();
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    const timeline = settleTimeline(this.snapshot.timeline, this.transcriptionEnabled);
    this.set({ ...this.snapshot, busy: false, microphone: "FAILED", voiceState: "FAILED",
      sentFrameCount: this.sentFrameCount,
      timeline,
      transcriptState: code.startsWith("SPEECH_") ? "FAILED" : this.snapshot.transcriptState,
      message: code === "IAM_VERIFICATION_COMPLETION_FAILED"
        ? this.snapshot.timeline.length === 0
          ? "Session ended without a voice result. Authentication was not completed. Please try again."
          : "Voice capture has ended. Authentication was not completed; individual voice results are shown below."
        : code === "ABIS_INSUFFICIENT_VERIFICATION_AUDIO"
        ? "Try a clearer sample or a longer reply, then pause briefly."
        : code.startsWith("SPEECH_")
          ? "Transcription became unavailable. Please start a new session."
        : "The audit voice check session ended before it could be completed. Please try again." });
  }

  private set(snapshot: VerificationSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function settleTimeline(items: readonly VerificationTimelineItem[], transcriptionEnabled: boolean): readonly VerificationTimelineItem[] {
  return items.map((item) => ({
    ...item,
    lifecycle: "SEALED",
    transcriptState: transcriptionEnabled && (item.transcriptState === "PARTIAL" || item.transcriptState === "NOT_STARTED")
      ? "FAILED" : item.transcriptState,
    voiceCheckState: item.voiceCheckState === "COLLECTING" || item.voiceCheckState === "CHECKING"
      ? "UNAVAILABLE" : item.voiceCheckState
  }));
}

function fallbackTimelineItem(
  utteranceId: string,
  utteranceOrdinal: number,
  startAudioSequence: number
): VerificationTimelineItem {
  return {
    utteranceId,
    utteranceOrdinal,
    startAudioSequence,
    lifecycle: "OPEN",
    transcriptState: "NOT_STARTED",
    voiceCheckState: "COLLECTING"
  };
}

function updateTimeline(
  items: readonly VerificationTimelineItem[],
  utteranceId: string,
  update: (current?: VerificationTimelineItem) => VerificationTimelineItem
): readonly VerificationTimelineItem[] {
  const index = items.findIndex((item) => item.utteranceId === utteranceId);
  const current = index >= 0 ? items[index] : undefined;
  const next = update(current);
  if (current && JSON.stringify(current) === JSON.stringify(next)) return items;
  const updated = index >= 0
    ? items.map((item, itemIndex) => itemIndex === index ? next : item)
    : [...items, next];
  return updated.sort((left, right) => left.utteranceOrdinal - right.utteranceOrdinal);
}

export function wordingFor(outcome: AssuranceUpdate["outcome"]): string {
  return outcome === "MATCH" ? "Matched enrolled voice for audit" :
    outcome === "MISMATCH" ? "Did not match enrolled voice" :
      "Inconclusive";
}
