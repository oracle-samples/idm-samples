import {
  CANONICAL_AUDIO_PROFILE,
  type VoiceSession
} from "../types/application-contracts";

type WebSocketFactory = (url: string) => WebSocket;

interface ServerEnvelope {
  readonly eventType?: string;
  readonly voiceSessionId?: string;
  readonly correlationId?: string;
  readonly utteranceId?: string;
  readonly payload?: Record<string, unknown>;
}

export interface TranscriptUpdate {
  readonly utteranceId: string;
  readonly revision: number;
  readonly text: string;
  readonly final: boolean;
  readonly startAudioSequence: number;
  readonly endAudioSequence: number;
}

export interface AssuranceUpdate {
  readonly utteranceId: string;
  readonly utteranceOrdinal: number;
  readonly outcome: "MATCH" | "MISMATCH" | "INCONCLUSIVE";
  readonly completedAt: string;
}

export interface AssuranceFailureUpdate {
  readonly utteranceId: string;
  readonly utteranceOrdinal: number;
  readonly code: string;
}

export interface UtteranceStartedUpdate {
  readonly utteranceId: string;
  readonly utteranceOrdinal: number;
  readonly startAudioSequence: number;
}

export interface UtteranceSealedUpdate extends UtteranceStartedUpdate {
  readonly endAudioSequence: number;
  readonly detectedSpeechMs: number;
}

export interface TranscriptFailureUpdate {
  readonly utteranceId: string;
  readonly utteranceOrdinal: number;
  readonly code: string;
}

export interface EnrollmentProgressUpdate {
  readonly utteranceOrdinal: number;
  readonly acceptedUtteranceCount: number;
  readonly capturedSampleMs: number;
  readonly maximumSampleMs: number;
  readonly minimumSampleMs: number;
  readonly qualityState: "WAITING" | "ACCEPTED" | "SILENCE" | "REJECTED" | "DEGRADED";
  readonly voiceActivity: "SILENCE" | "SPEECH" | "AWAITING_PAUSE";
}

export interface CaptureQualityUpdate {
  readonly state: "GOOD" | "NOISY";
}

export class VoiceSocket {
  private readonly createSocket: WebSocketFactory;
  private socket?: WebSocket;
  private session?: VoiceSession;
  private sequence = 0;
  private availableFrames = 0;
  private availableBytes = 0;
  private readyResolve?: () => void;
  private readyReject?: (failure: Error) => void;
  private terminalFailureListener?: (code: string) => void;
  private completionListener?: () => void;
  private waitingListener?: () => void;
  private enrollmentProgressListener?: (update: EnrollmentProgressUpdate) => void;
  private transcriptListener?: (update: TranscriptUpdate) => void;
  private assuranceListener?: (update: AssuranceUpdate) => void;
  private assuranceFailureListener?: (update: AssuranceFailureUpdate) => void;
  private utteranceStartedListener?: (update: UtteranceStartedUpdate) => void;
  private utteranceDiscardedListener?: (update: UtteranceStartedUpdate) => void;
  private utteranceSealedListener?: (update: UtteranceSealedUpdate) => void;
  private transcriptFailureListener?: (update: TranscriptFailureUpdate) => void;
  private captureQualityListener?: (update: CaptureQualityUpdate) => void;
  private closing = false;
  private terminal = false;

  constructor(createSocket: WebSocketFactory = (url) => new WebSocket(url)) {
    this.createSocket = createSocket;
  }

  onTerminalFailure(listener: (code: string) => void): void {
    this.terminalFailureListener = listener;
  }

  onCompleted(listener: () => void): void {
    this.completionListener = listener;
  }

  onWaiting(listener: () => void): void {
    this.waitingListener = listener;
  }

  onEnrollmentProgress(listener: (update: EnrollmentProgressUpdate) => void): void {
    this.enrollmentProgressListener = listener;
  }

  onTranscript(listener: (update: TranscriptUpdate) => void): void {
    this.transcriptListener = listener;
  }

  onAssurance(listener: (update: AssuranceUpdate) => void): void {
    this.assuranceListener = listener;
  }

  onAssuranceFailure(listener: (update: AssuranceFailureUpdate) => void): void {
    this.assuranceFailureListener = listener;
  }

  onUtteranceStarted(listener: (update: UtteranceStartedUpdate) => void): void {
    this.utteranceStartedListener = listener;
  }

  onUtteranceDiscarded(listener: (update: UtteranceStartedUpdate) => void): void {
    this.utteranceDiscardedListener = listener;
  }

  onUtteranceSealed(listener: (update: UtteranceSealedUpdate) => void): void {
    this.utteranceSealedListener = listener;
  }

  onTranscriptFailure(listener: (update: TranscriptFailureUpdate) => void): void {
    this.transcriptFailureListener = listener;
  }

  onCaptureQuality(listener: (update: CaptureQualityUpdate) => void): void {
    this.captureQualityListener = listener;
  }

  connect(session: VoiceSession): Promise<void> {
    this.close();
    this.closing = false;
    this.terminal = false;
    this.session = session;
    this.sequence = 0;
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = this.createSocket(`${scheme}//${window.location.host}${session.websocketPath}`);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = () => this.sendCommand("session.bind", {
      requestedProtocolVersion: "1.0"
    });
    this.socket.onmessage = (event) => this.receive(event.data);
    this.socket.onerror = () => this.fail("VOICE_SOCKET_CONNECTION_FAILED");
    this.socket.onclose = () => {
      if (!this.closing) this.fail("VOICE_SOCKET_CLOSED");
    };
    return new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  startCapture(): void {
    if (this.availableFrames <= 0 || this.availableBytes < 640) {
      throw new Error("VOICE_SOCKET_NOT_READY");
    }
    this.sendCommand("capture.start", { audioProfile: CANONICAL_AUDIO_PROFILE });
  }

  sendAudio(frame: ArrayBuffer): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || frame.byteLength !== 640 ||
        this.availableFrames <= 0 || this.availableBytes < frame.byteLength) {
      return false;
    }
    this.socket.send(frame);
    this.availableFrames -= 1;
    this.availableBytes -= frame.byteLength;
    return true;
  }

  endCapture(sentFrameCount: number): void {
    this.sendCommand("capture.end", { reason: "USER_REQUEST", sentFrameCount });
  }

  pauseCapture(): void {
    this.sendCommand("capture.pause", { reason: "USER_REQUEST" });
  }

  resumeCapture(): void {
    this.sendCommand("capture.resume", {});
  }

  close(): void {
    this.closing = true;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    this.readyResolve = undefined;
    this.readyReject = undefined;
    this.availableFrames = 0;
    this.availableBytes = 0;
  }

  private receive(data: unknown): void {
    if (this.closing || this.terminal || typeof data !== "string" || !this.session) return;
    let event: ServerEnvelope;
    try { event = JSON.parse(data) as ServerEnvelope; } catch { this.fail("VOICE_PROTOCOL_INVALID"); return; }
    if (event.voiceSessionId !== this.session.voiceSessionId ||
        event.correlationId !== this.session.correlationId || !event.payload) {
      this.fail("VOICE_PROTOCOL_CORRELATION_FAILED");
      return;
    }
    if (event.eventType === "session.bound" && event.payload.state === "READY") {
      this.applyCredit(event.payload.credit);
      if (this.availableFrames <= 0 || this.availableBytes <= 0) {
        this.fail("VOICE_PROTOCOL_CREDIT_MISSING");
        return;
      }
      const resolve = this.readyResolve;
      this.readyResolve = undefined;
      this.readyReject = undefined;
      resolve?.();
      return;
    }
    if (event.eventType === "audio.ack" || event.eventType === "credit.window") {
      this.applyCredit(event.eventType === "audio.ack" ? event.payload.credit : event.payload);
      return;
    }
    if (event.eventType === "session.completed" && event.payload.state === "COMPLETED") {
      this.terminal = true;
      this.completionListener?.();
      return;
    }
    if (event.eventType === "enrollment.progress") {
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      const acceptedUtteranceCount = event.payload.acceptedUtteranceCount;
      const capturedSampleMs = event.payload.capturedSampleMs;
      const maximumSampleMs = event.payload.maximumSampleMs;
      const minimumSampleMs = event.payload.minimumSampleMs;
      const qualityState = event.payload.qualityState;
      const voiceActivity = event.payload.voiceActivity;
      if (typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) || utteranceOrdinal < 1 ||
          typeof acceptedUtteranceCount !== "number" || !Number.isInteger(acceptedUtteranceCount) ||
          acceptedUtteranceCount < 0 || acceptedUtteranceCount > utteranceOrdinal ||
          typeof capturedSampleMs !== "number" || !Number.isInteger(capturedSampleMs) ||
          typeof maximumSampleMs !== "number" || !Number.isInteger(maximumSampleMs) ||
          typeof minimumSampleMs !== "number" || !Number.isInteger(minimumSampleMs) ||
          minimumSampleMs < 5000 || maximumSampleMs < minimumSampleMs || maximumSampleMs > 30000 ||
          capturedSampleMs < 0 || capturedSampleMs > maximumSampleMs ||
          !["WAITING", "ACCEPTED", "SILENCE", "REJECTED", "DEGRADED"].includes(String(qualityState)) ||
          !["SILENCE", "SPEECH", "AWAITING_PAUSE"].includes(String(voiceActivity))) {
        this.fail("VOICE_PROTOCOL_ENROLLMENT_PROGRESS_INVALID");
        return;
      }
      this.enrollmentProgressListener?.({
        utteranceOrdinal,
        acceptedUtteranceCount,
        capturedSampleMs,
        maximumSampleMs,
        minimumSampleMs,
        qualityState: qualityState as EnrollmentProgressUpdate["qualityState"],
        voiceActivity: voiceActivity as EnrollmentProgressUpdate["voiceActivity"]
      });
      return;
    }
    if (event.eventType === "enrollment.state" && event.payload.state === "WAITING") {
      this.waitingListener?.();
      return;
    }
    if (event.eventType === "capture.quality") {
      const state = event.payload.state;
      if (state !== "GOOD" && state !== "NOISY") {
        this.fail("VOICE_PROTOCOL_CAPTURE_QUALITY_INVALID");
        return;
      }
      this.captureQualityListener?.({ state });
      return;
    }
    if (event.eventType === "transcript.partial" || event.eventType === "transcript.final") {
      const revision = event.payload.revision;
      const text = event.payload.text;
      const startAudioSequence = event.payload.startAudioSequence;
      const endAudioSequence = event.payload.endAudioSequence;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 ||
          typeof text !== "string" || text.length > 20_000 ||
          typeof startAudioSequence !== "number" || startAudioSequence < 1 ||
          typeof endAudioSequence !== "number" || endAudioSequence < startAudioSequence) {
        this.fail("VOICE_PROTOCOL_TRANSCRIPT_INVALID");
        return;
      }
      this.transcriptListener?.({
        utteranceId: event.utteranceId,
        revision,
        text,
        final: event.eventType === "transcript.final",
        startAudioSequence,
        endAudioSequence
      });
      return;
    }
    if (event.eventType === "utterance.started" || event.eventType === "utterance.discarded") {
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      const startAudioSequence = event.payload.startAudioSequence;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) || utteranceOrdinal < 1 ||
          typeof startAudioSequence !== "number" || !Number.isInteger(startAudioSequence) || startAudioSequence < 1) {
        this.fail("VOICE_PROTOCOL_UTTERANCE_LIFECYCLE_INVALID");
        return;
      }
      const update = { utteranceId: event.utteranceId, utteranceOrdinal, startAudioSequence };
      if (event.eventType === "utterance.started") this.utteranceStartedListener?.(update);
      else this.utteranceDiscardedListener?.(update);
      return;
    }
    if (event.eventType === "utterance.sealed") {
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      const startAudioSequence = event.payload.startAudioSequence;
      const endAudioSequence = event.payload.endAudioSequence;
      const detectedSpeechMs = event.payload.detectedSpeechMs;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) || utteranceOrdinal < 1 ||
          typeof startAudioSequence !== "number" || !Number.isInteger(startAudioSequence) || startAudioSequence < 1 ||
          typeof endAudioSequence !== "number" || !Number.isInteger(endAudioSequence) || endAudioSequence < startAudioSequence ||
          typeof detectedSpeechMs !== "number" || !Number.isInteger(detectedSpeechMs) || detectedSpeechMs < 0) {
        this.fail("VOICE_PROTOCOL_UTTERANCE_SEALED_INVALID");
        return;
      }
      this.utteranceSealedListener?.({
        utteranceId: event.utteranceId, utteranceOrdinal, startAudioSequence,
        endAudioSequence, detectedSpeechMs
      });
      return;
    }
    if (event.eventType === "transcript.failed") {
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      const code = event.payload.code;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) || utteranceOrdinal < 1 ||
          typeof code !== "string" || code.length === 0 || event.payload.terminal !== false) {
        this.fail("VOICE_PROTOCOL_TRANSCRIPT_FAILURE_INVALID");
        return;
      }
      this.transcriptFailureListener?.({ utteranceId: event.utteranceId, utteranceOrdinal, code });
      return;
    }
    if (event.eventType === "assurance.result") {
      const outcome = event.payload.outcome;
      const completedAt = event.payload.completedAt;
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) ||
          utteranceOrdinal < 1 ||
          !["MATCH", "MISMATCH", "INCONCLUSIVE"].includes(String(outcome)) ||
          typeof completedAt !== "string" || completedAt.length === 0) {
        this.fail("VOICE_PROTOCOL_ASSURANCE_INVALID");
        return;
      }
      this.assuranceListener?.({
        utteranceId: event.utteranceId,
        utteranceOrdinal,
        outcome: outcome as AssuranceUpdate["outcome"],
        completedAt
      });
      return;
    }
    if (event.eventType === "assurance.failed") {
      const utteranceOrdinal = event.payload.utteranceOrdinal;
      const code = event.payload.code;
      if (typeof event.utteranceId !== "string" || event.utteranceId.length === 0 ||
          typeof utteranceOrdinal !== "number" || !Number.isInteger(utteranceOrdinal) ||
          utteranceOrdinal < 1 || typeof code !== "string" || code.length === 0 ||
          event.payload.terminal !== false) {
        this.fail("VOICE_PROTOCOL_ASSURANCE_FAILURE_INVALID");
        return;
      }
      this.assuranceFailureListener?.({ utteranceId: event.utteranceId, utteranceOrdinal, code });
      return;
    }
    if (event.eventType === "error" && event.payload.terminal === true) {
      this.fail(typeof event.payload.code === "string" ? event.payload.code : "VOICE_SESSION_FAILED");
    }
  }

  private applyCredit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const credit = value as Record<string, unknown>;
    if (typeof credit.availableFrames === "number" && typeof credit.availableBytes === "number" &&
        credit.maxFrameBytes === 640) {
      this.availableFrames = Math.max(0, Math.min(50, credit.availableFrames));
      this.availableBytes = Math.max(0, Math.min(32000, credit.availableBytes));
    }
  }

  private sendCommand(eventType: string, payload: Record<string, unknown>): void {
    if (!this.socket || !this.session || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("VOICE_SOCKET_NOT_OPEN");
    }
    this.sequence += 1;
    this.socket.send(JSON.stringify({
      protocolVersion: "1.0",
      eventId: this.id(),
      eventType,
      voiceSessionId: this.session.voiceSessionId,
      correlationId: this.session.correlationId,
      clientSequence: this.sequence,
      occurredAt: new Date().toISOString(),
      payload
    }));
  }

  private fail(code: string): void {
    if (this.terminal) return;
    this.terminal = true;
    const reject = this.readyReject;
    this.readyResolve = undefined;
    this.readyReject = undefined;
    if (reject) reject(new Error(code));
    else this.terminalFailureListener?.(code);
  }

  private id(): string {
    return typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "_")
      : `event_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
