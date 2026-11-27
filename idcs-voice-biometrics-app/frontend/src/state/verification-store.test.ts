import { VerificationStore } from "./verification-store";
import type { AuthenticationClient } from "../services/authentication";
import type { AudioCapture } from "../services/audio-capture";
import type {
  AssuranceFailureUpdate, AssuranceUpdate, CaptureQualityUpdate, TranscriptFailureUpdate, TranscriptUpdate,
  UtteranceSealedUpdate, UtteranceStartedUpdate, VoiceSocket
} from "../services/voice-socket";

const SESSION = {
  protocolVersion: "1.0" as const, correlationId: "correlation-1234567890",
  voiceSessionId: "voice-session-1234567890", purpose: "VERIFICATION" as const,
  state: "PREAUTHORIZED" as const, websocketPath: "/ws/v1/voice" as const,
  bindExpiresAt: "2026-09-04T00:00:05Z",
  audioProfile: {
    encoding: "PCM_SIGNED" as const, sampleRateHz: 16000 as const, channels: 1 as const,
    sampleSizeBits: 16 as const, byteOrder: "LITTLE_ENDIAN" as const, nominalFrameMs: 20 as const
  }
};

class FakeVoiceSocket {
  assurance?: (value: AssuranceUpdate) => void;
  assuranceFailure?: (value: AssuranceFailureUpdate) => void;
  completed?: () => void;
  failure?: (code: string) => void;
  transcript?: (value: TranscriptUpdate) => void;
  transcriptFailure?: (value: TranscriptFailureUpdate) => void;
  utteranceStarted?: (value: UtteranceStartedUpdate) => void;
  utteranceDiscarded?: (value: UtteranceStartedUpdate) => void;
  utteranceSealed?: (value: UtteranceSealedUpdate) => void;
  captureQuality?: (value: CaptureQualityUpdate) => void;
  pauseCapture = jest.fn();
  resumeCapture = jest.fn();
  onTerminalFailure(listener: (code: string) => void) { this.failure = listener; }
  onTranscript(listener: (value: TranscriptUpdate) => void) { this.transcript = listener; }
  onTranscriptFailure(listener: (value: TranscriptFailureUpdate) => void) { this.transcriptFailure = listener; }
  onUtteranceStarted(listener: (value: UtteranceStartedUpdate) => void) { this.utteranceStarted = listener; }
  onUtteranceDiscarded(listener: (value: UtteranceStartedUpdate) => void) { this.utteranceDiscarded = listener; }
  onUtteranceSealed(listener: (value: UtteranceSealedUpdate) => void) { this.utteranceSealed = listener; }
  onAssurance(listener: (value: AssuranceUpdate) => void) { this.assurance = listener; }
  onAssuranceFailure(listener: (value: AssuranceFailureUpdate) => void) { this.assuranceFailure = listener; }
  onCaptureQuality(listener: (value: CaptureQualityUpdate) => void) { this.captureQuality = listener; }
  onCompleted(listener: () => void) { this.completed = listener; }
  async connect() { /* ready */ }
  startCapture() { /* ready */ }
  sendAudio() { return true; }
  endCapture = jest.fn();
  close() { /* closed */ }
}

describe("VerificationStore", () => {
  it("does not authorize IAM until microphone preflight has succeeded", async () => {
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: createSession } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);

    store.begin();
    expect(createSession).not.toHaveBeenCalled();
    await store.prepareMicrophone();
    await store.start();

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(store.value.voiceState).toBe("RECORDING");
  });

  it("starts microphone preparation and verification as one user flow", async () => {
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: createSession } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);

    store.begin();
    await store.startFlow();

    expect(audio.prepare).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(store.value.microphone).toBe("READY");
    expect(store.value.voiceState).toBe("RECORDING");
  });

  it("reports a transcription connection failure without starting audio capture", async () => {
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    jest.spyOn(socket, "connect").mockRejectedValue(new Error("SPEECH_CONNECT_FAILED"));
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture, () => socket as unknown as VoiceSocket);
    store.begin();

    await expect(store.startFlow()).rejects.toThrow("SPEECH_CONNECT_FAILED");

    expect(audio.start).not.toHaveBeenCalled();
    expect(audio.release).toHaveBeenCalled();
    expect(store.value.voiceState).toBe("FAILED");
    expect(store.value.transcriptState).toBe("FAILED");
    expect(store.value.sentFrameCount).toBe(0);
    expect(store.value.message).toBe("Transcription could not connect. Please try again.");
  });

  it("publishes a live waveform from accepted outgoing PCM frames", async () => {
    let onFrame: ((frame: ArrayBuffer) => void) | undefined;
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockImplementation(async (listener: (frame: ArrayBuffer) => void) => {
        onFrame = listener;
      }),
      release: jest.fn()
    };
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => new FakeVoiceSocket() as unknown as VoiceSocket);
    const frame = new ArrayBuffer(640);
    const view = new DataView(frame);
    for (let offset = 0; offset < frame.byteLength; offset += 2) view.setInt16(offset, 6000, true);

    store.begin();
    await store.startFlow();
    for (let index = 0; index < 4; index += 1) onFrame?.(frame);

    expect(store.value.sentFrameCount).toBe(4);
    expect(store.value.waveform).toHaveLength(1);
    expect(store.value.waveform[0]).toBeGreaterThan(0.5);
  });

  it("shows real-audio background-noise guidance without ending verification", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      {
        prepare: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);

    store.begin();
    await store.startFlow();
    socket.captureQuality?.({ state: "NOISY" });

    expect(store.value.captureQuality).toBe("NOISY");
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.message).toContain("Background noise detected");
  });

  it("accumulates ordered outcomes without stopping continuous verification", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      {
        prepare: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.prepareMicrophone();
    await store.start();

    socket.assurance?.({
      utteranceId: "verification-utterance-2", utteranceOrdinal: 2, outcome: "MISMATCH",
      completedAt: "2026-09-04T00:00:00Z"
    });
    socket.assurance?.({
      utteranceId: "verification-utterance-1", utteranceOrdinal: 1, outcome: "MATCH",
      completedAt: "2026-09-03T23:59:55Z"
    });
    socket.assurance?.({
      utteranceId: "verification-utterance-2", utteranceOrdinal: 2, outcome: "MISMATCH",
      completedAt: "2026-09-04T00:00:00Z"
    });

    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.microphone).toBe("READY");
    expect(store.value.assurances.map((item) => item.outcome)).toEqual(["MATCH", "MISMATCH"]);
    expect(store.value.message).toBe("Did not match enrolled voice. Audit voice check continues.");

    socket.completed?.();
    expect(store.value.voiceState).toBe("COMPLETED");
    expect(store.value.assurances).toHaveLength(2);
  });

  it("builds one live timeline row from transcript and assurance events sharing an utterance id", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();

    socket.utteranceStarted?.({
      utteranceId: "canonical-one", utteranceOrdinal: 1, startAudioSequence: 1
    });
    socket.transcript?.({
      utteranceId: "canonical-one", revision: 1, text: "Please take a deep breath",
      final: false, startAudioSequence: 1, endAudioSequence: 120
    });
    socket.utteranceSealed?.({
      utteranceId: "canonical-one", utteranceOrdinal: 1, startAudioSequence: 1,
      endAudioSequence: 265, detectedSpeechMs: 5000
    });

    expect(store.value.timeline).toHaveLength(1);
    expect(store.value.timeline[0]).toMatchObject({
      utteranceId: "canonical-one", lifecycle: "SEALED", transcriptState: "PARTIAL",
      text: "Please take a deep breath", voiceCheckState: "CHECKING"
    });

    socket.transcript?.({
      utteranceId: "canonical-one", revision: 2, text: "Please take a deep breath and hold it.",
      final: true, startAudioSequence: 1, endAudioSequence: 265
    });
    socket.assurance?.({
      utteranceId: "canonical-one", utteranceOrdinal: 1, outcome: "MATCH",
      completedAt: "2026-09-11T00:00:00Z"
    });
    expect(store.value.timeline[0]).toMatchObject({
      transcriptState: "FINAL", text: "Please take a deep breath and hold it.",
      voiceCheckState: "MATCH"
    });
    expect(store.value.voiceState).toBe("RECORDING");
  });

  it("removes a provisional row when mute discards a sub-minimum utterance", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    const lifecycle = { utteranceId: "short-one", utteranceOrdinal: 1, startAudioSequence: 1 };
    socket.utteranceStarted?.(lifecycle);
    expect(store.value.timeline).toHaveLength(1);

    socket.utteranceDiscarded?.(lifecycle);
    expect(store.value.timeline).toEqual([]);
  });

  it("sends no audio while muted and resumes on the same session", async () => {
    let onFrame: ((frame: ArrayBuffer) => void) | undefined;
    const socket = new FakeVoiceSocket();
    const sendAudio = jest.spyOn(socket, "sendAudio");
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      {
        prepare: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockImplementation(async (listener: (frame: ArrayBuffer) => void) => { onFrame = listener; }),
        release: jest.fn()
      } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    onFrame?.(new ArrayBuffer(640));
    store.toggleMute();
    onFrame?.(new ArrayBuffer(640));

    expect(socket.pauseCapture).toHaveBeenCalledTimes(1);
    expect(sendAudio).toHaveBeenCalledTimes(1);
    expect(store.value.muted).toBe(true);

    store.toggleMute();
    onFrame?.(new ArrayBuffer(640));
    expect(socket.resumeCapture).toHaveBeenCalledTimes(1);
    expect(sendAudio).toHaveBeenCalledTimes(2);
    expect(store.value.muted).toBe(false);
  });

  it("keeps utterance processing failure separate and continues capture", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    socket.assuranceFailure?.({
      utteranceId: "failed-sample", utteranceOrdinal: 1, code: "VOICE_UTTERANCE_REJECTED"
    });

    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.assurances).toEqual([]);
    expect(store.value.assuranceFailures).toHaveLength(1);
    expect(store.value.timeline[0]?.voiceCheckState).toBe("INCONCLUSIVE");
    expect(store.value.message).toBe("Inconclusive. Audit voice check continues.");

    socket.assuranceFailure?.({
      utteranceId: "failed-processing", utteranceOrdinal: 2, code: "VOICE_PROCESSING_FAILED"
    });
    expect(store.value.timeline[1]?.voiceCheckState).toBe("UNAVAILABLE");
    expect(store.value.message).toBe("Voice sample could not be processed. Audit voice check continues.");
  });

  it("can end the existing verification session while audio is muted", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    store.toggleMute();
    store.stop();

    expect(socket.endCapture).toHaveBeenCalledTimes(1);
    expect(store.value.voiceState).toBe("PROCESSING");
  });

  it("replaces pending voice-check spinners when a backend failure closes the session", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();

    socket.utteranceStarted?.({
      utteranceId: "awaiting-result", utteranceOrdinal: 1, startAudioSequence: 1
    });
    socket.utteranceSealed?.({
      utteranceId: "awaiting-result", utteranceOrdinal: 1, startAudioSequence: 1,
      endAudioSequence: 265, detectedSpeechMs: 5000
    });
    socket.utteranceStarted?.({
      utteranceId: "being-recorded", utteranceOrdinal: 2, startAudioSequence: 266
    });
    socket.assurance?.({
      utteranceId: "completed", utteranceOrdinal: 3, outcome: "MATCH",
      completedAt: "2026-09-04T00:00:00Z"
    });

    socket.failure?.("ABIS_CONNECT_FAILED");

    expect(store.value.voiceState).toBe("FAILED");
    expect(store.value.timeline.map((item) => item.voiceCheckState)).toEqual([
      "UNAVAILABLE", "UNAVAILABLE", "MATCH"
    ]);
  });

  it("retains finalized transcript segments until reset", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    socket.transcript?.({ utteranceId: "one", revision: 1, text: "First", final: true, startAudioSequence: 1, endAudioSequence: 10 });
    socket.transcript?.({ utteranceId: "two", revision: 2, text: "Second", final: true, startAudioSequence: 11, endAudioSequence: 20 });
    expect(store.value.transcriptSegments.map((item) => item.text)).toEqual(["First", "Second"]);
    store.reset();
    expect(store.value.transcriptSegments).toEqual([]);
  });

  it("settles unfinished transcript rows at session end without inventing final text", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    socket.transcript?.({ utteranceId: "one", revision: 1, text: "Confirmed", final: true, startAudioSequence: 1, endAudioSequence: 50 });
    socket.transcript?.({ utteranceId: "two", revision: 2, text: "Unfinished text", final: false, startAudioSequence: 51, endAudioSequence: 100 });
    socket.assurance?.({ utteranceId: "two", utteranceOrdinal: 2, outcome: "MATCH", completedAt: "2026-09-04T00:00:01Z" });
    socket.completed?.();

    expect(store.value.voiceState).toBe("COMPLETED");
    expect(store.value.timeline.map((item) => item.transcriptState)).toEqual(["FINAL", "FAILED"]);
    expect(store.value.timeline[1]?.text).toBe("Unfinished text");
    expect(store.value.timeline[1]?.voiceCheckState).toBe("MATCH");
    expect(store.value.transcriptSegments[1]?.final).toBe(false);
    expect(store.value.message).toContain("could not be finalized");
  });
  it("ignores late results from a completed or previous session", async () => {
    const first = new FakeVoiceSocket();
    const second = new FakeVoiceSocket();
    const createSocket = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      createSocket);
    store.begin();
    await store.startFlow();
    first.transcript?.({ utteranceId: "old", revision: 1, text: "Saved text", final: false, startAudioSequence: 1, endAudioSequence: 50 });
    first.completed?.();
    first.transcript?.({ utteranceId: "old", revision: 2, text: "Late text", final: false, startAudioSequence: 1, endAudioSequence: 60 });
    expect(store.value.timeline[0]?.transcriptState).toBe("FAILED");
    expect(store.value.timeline[0]?.text).toBe("Saved text");

    store.begin();
    await store.startFlow();
    first.utteranceStarted?.({ utteranceId: "old", utteranceOrdinal: 1, startAudioSequence: 1 });
    first.failure?.("VOICE_SOCKET_CLOSED");
    first.completed?.();
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.timeline).toEqual([]);
    second.assurance?.({ utteranceId: "new", utteranceOrdinal: 1, outcome: "MATCH", completedAt: "2026-09-04T00:00:01Z" });
    store.stop();
    second.assurance?.({ utteranceId: "tail", utteranceOrdinal: 2, outcome: "MATCH", completedAt: "2026-09-04T00:00:02Z" });
    expect(store.value.message).toContain("Capture has stopped");
    expect(store.value.message).not.toContain("continues");
    second.completed?.();
    expect(store.value.voiceState).toBe("COMPLETED");
  });

  it("keeps per-utterance results when IAM completion is not successful", async () => {
    const socket = new FakeVoiceSocket();
    const store = new VerificationStore(
      { createVerificationVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    store.begin();
    await store.startFlow();
    socket.assurance?.({ utteranceId: "one", utteranceOrdinal: 1, outcome: "MATCH", completedAt: "2026-09-04T00:00:01Z" });
    store.stop();
    socket.failure?.("IAM_VERIFICATION_COMPLETION_FAILED");
    expect(store.value.voiceState).toBe("FAILED");
    expect(store.value.message).toContain("Authentication was not completed");
    expect(store.value.timeline[0]?.voiceCheckState).toBe("MATCH");
  });

});
