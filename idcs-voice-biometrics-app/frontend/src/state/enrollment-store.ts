import { ApiError } from "../services/api-client";
import { AudioCapture, type MicrophonePreparation } from "../services/audio-capture";
import { appendWaveformLevel, calculatePcm16Level } from "../services/audio-level";
import { AuthenticationClient } from "../services/authentication";
import {
  VoiceSocket,
  type EnrollmentProgressUpdate,
  type TranscriptUpdate
} from "../services/voice-socket";
import type { EnrollmentAttempt } from "../types/application-contracts";
import { mergeTranscriptSegment } from "./session-transcript";

const ENROLLMENT_SAMPLE_MAX_MS = 10_000;
const ENROLLMENT_SAMPLE_MIN_MS = 7_000;

function sameConsent(
  left: EnrollmentAttempt["consent"],
  right: EnrollmentAttempt["consent"]
): boolean {
  return left.version === right.version && left.locale === right.locale && left.text === right.text;
}

export interface EnrollmentSnapshot {
  readonly active: boolean;
  readonly attempt?: EnrollmentAttempt;
  readonly busy: boolean;
  readonly microphone: MicrophonePreparation;
  readonly voiceState: "IDLE" | "CONNECTING" | "READY" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  readonly sentFrameCount: number;
  readonly utteranceOrdinal: number;
  readonly acceptedUtteranceCount: number;
  readonly capturedSampleMs: number;
  readonly maximumSampleMs: number;
  readonly minimumSampleMs: number;
  readonly voiceActivity: EnrollmentProgressUpdate["voiceActivity"];
  readonly qualityState?: EnrollmentProgressUpdate["qualityState"];
  readonly waveform: readonly number[];
  readonly transcriptState: "NOT_STARTED" | "PARTIAL" | "FINAL" | "FAILED";
  readonly transcriptSegments: readonly TranscriptUpdate[];
  readonly message?: string;
}

type Listener = (snapshot: EnrollmentSnapshot) => void;

export class EnrollmentStore {
  private snapshot: EnrollmentSnapshot = {
    active: false, busy: false, microphone: "IDLE", voiceState: "IDLE", sentFrameCount: 0,
    utteranceOrdinal: 1, acceptedUtteranceCount: 0,
    capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
    transcriptState: "NOT_STARTED", transcriptSegments: []
  };
  private readonly listeners = new Set<Listener>();
  private readonly authentication: AuthenticationClient;
  private readonly audio: AudioCapture;
  private readonly createVoiceSocket: () => VoiceSocket;
  private voiceSocket?: VoiceSocket;
  private sentFrameCount = 0;
  private acceptedConsent?: EnrollmentAttempt["consent"];

  constructor(
    authentication: AuthenticationClient,
    audio = new AudioCapture(),
    createVoiceSocket: () => VoiceSocket = () => new VoiceSocket()
  ) {
    this.authentication = authentication;
    this.audio = audio;
    this.createVoiceSocket = createVoiceSocket;
  }

  get value(): EnrollmentSnapshot { return this.snapshot; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async begin(): Promise<void> {
    if (this.snapshot.busy) return;
    this.set({ active: true, busy: true, microphone: "IDLE", voiceState: "IDLE", sentFrameCount: 0,
      utteranceOrdinal: 1, acceptedUtteranceCount: 0,
      capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
      transcriptState: "NOT_STARTED", transcriptSegments: [] });
    try {
      const attempt = await this.authentication.beginEnrollment();
      if (attempt.state === "CONSENT_ACCEPT_INTENT_RECORDED") {
        this.acceptedConsent = attempt.consent;
      }
      this.set({ active: true, attempt, busy: false, microphone: "IDLE", voiceState: "IDLE", sentFrameCount: 0,
        utteranceOrdinal: 1, acceptedUtteranceCount: 0,
        capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
        transcriptState: "NOT_STARTED", transcriptSegments: [] });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.reset();
        throw error;
      }
      this.set({
        active: true, busy: false, microphone: "IDLE", voiceState: "FAILED", sentFrameCount: 0,
        utteranceOrdinal: 1, acceptedUtteranceCount: 0,
        capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
        transcriptState: "NOT_STARTED", transcriptSegments: [],
        message: error instanceof ApiError && error.status === 409
          ? "Voice enrollment cannot be started from the current account state."
          : "Voice enrollment could not be started. Please try again."
      });
      throw error;
    }
  }

  async decide(decision: "ACCEPT" | "DECLINE"): Promise<void> {
    if (this.snapshot.busy || !this.snapshot.attempt) return;
    this.set({ ...this.snapshot, busy: true, message: undefined });
    try {
      const attempt = await this.authentication.recordEnrollmentConsent(this.snapshot.attempt, decision);
      this.acceptedConsent = decision === "ACCEPT" ? attempt.consent : undefined;
      this.set({ active: true, attempt, busy: false, microphone: "IDLE", voiceState: "IDLE", sentFrameCount: 0,
        utteranceOrdinal: 1, acceptedUtteranceCount: 0,
        capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
        transcriptState: "NOT_STARTED", transcriptSegments: [] });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.reset();
        throw error;
      }
      this.set({ ...this.snapshot, busy: false, message: "The consent decision could not be recorded." });
      throw error;
    }
  }

  async prepareMicrophone(): Promise<void> {
    if (this.snapshot.busy || this.snapshot.microphone === "READY" || !this.snapshot.attempt ||
        this.snapshot.attempt.state !== "CONSENT_ACCEPT_INTENT_RECORDED") return;
    this.set({ ...this.snapshot, busy: true, microphone: "PREPARING", message: undefined });
    try {
      await this.audio.prepare();
      this.set({
        ...this.snapshot, busy: false, microphone: "READY", voiceState: "IDLE",
        message: "Microphone ready."
      });
    } catch {
      this.audio.release();
      this.set({
        ...this.snapshot, busy: false, microphone: "FAILED",
        message: "Microphone permission or an available audio input is required."
      });
    }
  }

  async startFlow(): Promise<void> {
    // IAM/ABIS enrollment authorization is one-use. After a terminal voice-session
    // failure, obtain a fresh attempt while keeping the enrollment page mounted.
    if (this.snapshot.voiceState === "FAILED") {
      await this.refreshAttemptAfterFailure();
    }
    await this.prepareMicrophone();
    if (this.snapshot.microphone === "READY" && this.snapshot.voiceState === "IDLE") {
      await this.startRecording();
    }
  }

  private async refreshAttemptAfterFailure(): Promise<void> {
    const previousAttempt = this.snapshot.attempt;
    if (!previousAttempt || this.snapshot.busy) return;
    this.set({
      ...this.snapshot,
      busy: true,
      microphone: "IDLE",
      sentFrameCount: 0,
      utteranceOrdinal: 1,
      acceptedUtteranceCount: 0,
      capturedSampleMs: 0,
      maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS,
      voiceActivity: "SILENCE",
      waveform: [],
      transcriptState: "NOT_STARTED",
      transcriptSegments: [],
      message: "Starting a new recording attempt."
    });
    try {
      let attempt = await this.authentication.beginEnrollment();
      if (attempt.state === "CONSENT_PENDING" && this.acceptedConsent &&
          sameConsent(this.acceptedConsent, attempt.consent)) {
        attempt = await this.authentication.recordEnrollmentConsent(attempt, "ACCEPT");
        this.acceptedConsent = attempt.consent;
      } else if (attempt.state === "CONSENT_ACCEPT_INTENT_RECORDED") {
        this.acceptedConsent = attempt.consent;
      }
      this.set({
        ...this.snapshot,
        active: true,
        attempt,
        busy: false,
        microphone: "IDLE",
        voiceState: "IDLE",
        sentFrameCount: 0,
        utteranceOrdinal: 1,
        acceptedUtteranceCount: 0,
        capturedSampleMs: 0,
        maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS,
        voiceActivity: "SILENCE",
        waveform: [],
        transcriptState: "NOT_STARTED",
        transcriptSegments: [],
        message: attempt.state === "CONSENT_PENDING"
          ? "Review the updated consent statement before recording again."
          : undefined
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.reset();
        throw error;
      }
      this.set({
        ...this.snapshot,
        active: true,
        attempt: previousAttempt,
        busy: false,
        microphone: "FAILED",
        voiceState: "FAILED",
        message: error instanceof ApiError && error.status === 409
          ? "Voice enrollment cannot be started from the current account state."
          : "Voice enrollment could not be restarted. Please try again."
      });
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    if (this.snapshot.busy || this.snapshot.microphone !== "READY" || !this.snapshot.attempt ||
        this.snapshot.voiceState === "RECORDING") return;
    this.set({ ...this.snapshot, busy: true, voiceState: "CONNECTING", message: undefined });
    const socket = this.createVoiceSocket();
    this.voiceSocket = socket;
    socket.onTerminalFailure((code) => this.failLiveSession(code));
    socket.onCompleted(() => this.completeLiveSession());
    socket.onWaiting(() => this.waitForEnrollmentResult());
    socket.onEnrollmentProgress((update) => this.applyEnrollmentProgress(update));
    socket.onTranscript((update) => this.applyTranscript(update));
    try {
      const session = await this.authentication.createEnrollmentVoiceSession(this.snapshot.attempt);
      await socket.connect(session);
      socket.startCapture();
      this.sentFrameCount = 0;
      await this.audio.start((frame) => {
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
      this.set({
        ...this.snapshot, busy: false, voiceState: "RECORDING", sentFrameCount: 0,
        utteranceOrdinal: 1, acceptedUtteranceCount: 0,
        capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS,
        voiceActivity: "SILENCE", waveform: [],
        message: "Recording started. Read the passage aloud in your natural voice."
      });
    } catch (error) {
      socket.close();
      this.voiceSocket = undefined;
      this.audio.release();
      if (error instanceof ApiError && error.status === 401) {
        this.reset();
        throw error;
      }
      this.set({
        ...this.snapshot, busy: false, microphone: "FAILED", voiceState: "FAILED",
          sentFrameCount: this.sentFrameCount,
          message: "Voice recording could not be started. Check your connection and try again."
      });
      throw error;
    }
  }

  reset(): void {
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    this.audio.release();
    this.sentFrameCount = 0;
    this.acceptedConsent = undefined;
    this.set({
      active: false, busy: false, microphone: "IDLE", voiceState: "IDLE", sentFrameCount: 0,
      utteranceOrdinal: 1, acceptedUtteranceCount: 0,
      capturedSampleMs: 0, maximumSampleMs: ENROLLMENT_SAMPLE_MAX_MS, minimumSampleMs: ENROLLMENT_SAMPLE_MIN_MS, voiceActivity: "SILENCE", waveform: [],
      transcriptState: "NOT_STARTED", transcriptSegments: []
    });
  }

  private failLiveSession(code: string): void {
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    this.audio.release();
    this.set({
      ...this.snapshot,
      busy: false,
      microphone: "FAILED",
      voiceState: "FAILED",
      sentFrameCount: this.sentFrameCount,
      transcriptState: code.startsWith("SPEECH_") ? "FAILED" : this.snapshot.transcriptState,
      message: code === "ABIS_INSUFFICIENT_VOICE_AUDIO"
        ? "More clear speech was needed. Try again and continue reading until the circle is full."
        : code.startsWith("SPEECH_")
        ? "Live transcription stopped before enrollment finished. Please try again."
        : "Voice enrollment was not completed. Use one speaker in a quieter place and try again."
    });
  }

  private completeLiveSession(): void {
    this.voiceSocket?.close();
    this.voiceSocket = undefined;
    this.audio.release();
    this.set({
      ...this.snapshot,
      busy: false,
      microphone: "IDLE",
      voiceState: "COMPLETED",
      sentFrameCount: this.sentFrameCount,
      capturedSampleMs: this.snapshot.maximumSampleMs,
      message: "Your voice profile is ready for audit voice checks."
    });
  }

  private waitForEnrollmentResult(): void {
    this.audio.release();
    this.set({
      ...this.snapshot,
      busy: false,
      microphone: "IDLE",
      voiceState: "PROCESSING",
      sentFrameCount: this.sentFrameCount,
      message: "Voice samples collected. Creating your voice profile…"
    });
  }

  private applyEnrollmentProgress(update: EnrollmentProgressUpdate): void {
    const currentOrdinal = this.snapshot.utteranceOrdinal;
    if (update.utteranceOrdinal < currentOrdinal ||
        update.acceptedUtteranceCount < this.snapshot.acceptedUtteranceCount ||
        (update.utteranceOrdinal === currentOrdinal &&
          update.capturedSampleMs < this.snapshot.capturedSampleMs)) return;
    const newSample = update.utteranceOrdinal > currentOrdinal;
    const sampleComplete = update.capturedSampleMs >= update.maximumSampleMs;
    const message = newSample
      ? `${update.acceptedUtteranceCount} voice ${update.acceptedUtteranceCount === 1 ? "sample" : "samples"} accepted. Continue reading.`
      : sampleComplete
        ? `Voice sample ${update.utteranceOrdinal} collected. Checking if another sample is needed…`
        : this.snapshot.message;
    this.set({
      ...this.snapshot,
      busy: false,
      utteranceOrdinal: update.utteranceOrdinal,
      acceptedUtteranceCount: update.acceptedUtteranceCount,
      capturedSampleMs: update.capturedSampleMs,
      maximumSampleMs: update.maximumSampleMs,
      minimumSampleMs: update.minimumSampleMs,
      voiceActivity: update.voiceActivity,
      qualityState: update.qualityState,
      message
    });
  }

  private applyTranscript(update: TranscriptUpdate): void {
    const transcriptSegments = mergeTranscriptSegment(this.snapshot.transcriptSegments, update);
    if (transcriptSegments === this.snapshot.transcriptSegments) return;
    this.set({
      ...this.snapshot,
      transcriptSegments,
      transcriptState: update.final ? "FINAL" : "PARTIAL"
    });
  }

  private set(snapshot: EnrollmentSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
