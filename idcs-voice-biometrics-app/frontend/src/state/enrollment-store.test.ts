import { EnrollmentStore } from "./enrollment-store";
import type { AuthenticationClient } from "../services/authentication";
import type { AudioCapture } from "../services/audio-capture";
import type { EnrollmentProgressUpdate, TranscriptUpdate, VoiceSocket } from "../services/voice-socket";

const ATTEMPT = {
  enrollmentAttemptId: "attempt-1234567890",
  correlationId: "correlation-1234567890",
  state: "CONSENT_ACCEPT_INTENT_RECORDED" as const,
  consent: { version: "version-123", locale: "en", text: "Current IAM voice consent." },
  expiresAt: "2026-09-05T00:10:00Z"
};

const SESSION = {
  protocolVersion: "1.0" as const,
  correlationId: "correlation-1234567890",
  voiceSessionId: "voice-session-1234567890",
  purpose: "ENROLLMENT" as const,
  state: "PREAUTHORIZED" as const,
  websocketPath: "/ws/v1/voice" as const,
  bindExpiresAt: "2026-09-05T00:00:05Z",
  audioProfile: {
    encoding: "PCM_SIGNED" as const,
    sampleRateHz: 16000 as const,
    channels: 1 as const,
    sampleSizeBits: 16 as const,
    byteOrder: "LITTLE_ENDIAN" as const,
    nominalFrameMs: 20 as const
  }
};

class FakeVoiceSocket {
  failure?: (code: string) => void;
  waiting?: () => void;
  progress?: (update: EnrollmentProgressUpdate) => void;
  transcript?: (update: TranscriptUpdate) => void;
  onTerminalFailure(listener: (code: string) => void) { this.failure = listener; }
  onCompleted() { /* covered by VoiceSocket tests */ }
  onWaiting(listener: () => void) { this.waiting = listener; }
  onEnrollmentProgress(listener: (update: EnrollmentProgressUpdate) => void) { this.progress = listener; }
  onTranscript(listener: (update: TranscriptUpdate) => void) { this.transcript = listener; }
  async connect() { /* ready */ }
  startCapture() { /* started */ }
  sendAudio() { return true; }
  endCapture() { /* sent */ }
  close() { /* closed */ }
}

describe("EnrollmentStore", () => {
  it("starts biometric-only enrollment without subscribing to transcript events", async () => {
    const socket = new FakeVoiceSocket();
    const store = new EnrollmentStore(
      { beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT), createEnrollmentVoiceSession: jest.fn().mockResolvedValue(SESSION) } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    await store.begin();
    await store.startFlow(false);
    expect(store.value.voiceState).toBe("RECORDING");
    expect(socket.transcript).toBeUndefined();
  });

  it("shows an audio activation error without authorizing a provider session", async () => {
    const createSession = jest.fn();
    const audio = {
      prepare: jest.fn().mockRejectedValue(new Error("AUDIO_CONTEXT_NOT_RUNNING")),
      start: jest.fn(), release: jest.fn()
    };
    const store = new EnrollmentStore(
      { beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT), createEnrollmentVoiceSession: createSession } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => new FakeVoiceSocket() as unknown as VoiceSocket);
    await store.begin();
    await store.startFlow();
    expect(store.value.message).toContain("Browser audio could not start");
    expect(store.value.microphone).toBe("FAILED");
    expect(createSession).not.toHaveBeenCalled();
    expect(audio.start).not.toHaveBeenCalled();
  });

  it("prepares the microphone and starts enrollment with one action", async () => {
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const authentication = {
      beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT),
      createEnrollmentVoiceSession: createSession
    } as unknown as AuthenticationClient;
    const store = new EnrollmentStore(
      authentication,
      audio as unknown as AudioCapture,
      () => new FakeVoiceSocket() as unknown as VoiceSocket);

    await store.begin();
    await store.startFlow();

    expect(audio.prepare).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith(ATTEMPT);
    expect(audio.start).toHaveBeenCalledTimes(1);
    expect(store.value.microphone).toBe("READY");
    expect(store.value.voiceState).toBe("RECORDING");
  });

  it("does not request an enrollment session when microphone preparation fails", async () => {
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockRejectedValue(new Error("permission denied")),
      start: jest.fn(),
      release: jest.fn()
    };
    const store = new EnrollmentStore(
      {
        beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT),
        createEnrollmentVoiceSession: createSession
      } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => new FakeVoiceSocket() as unknown as VoiceSocket);

    await store.begin();
    await store.startFlow();

    expect(createSession).not.toHaveBeenCalled();
    expect(audio.start).not.toHaveBeenCalled();
    expect(store.value.microphone).toBe("FAILED");
    expect(store.value.voiceState).toBe("IDLE");
  });

  it("keeps recording across server-directed eight-second samples and processes only after WAIT", async () => {
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    const store = new EnrollmentStore(
      {
        beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT),
        createEnrollmentVoiceSession: jest.fn().mockResolvedValue(SESSION)
      } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);

    await store.begin();
    await store.startFlow();
    socket.progress?.({
      utteranceOrdinal: 1, acceptedUtteranceCount: 0,
      capturedSampleMs: 3200, maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "ACCEPTED", voiceActivity: "SPEECH"
    });

    expect(store.value.capturedSampleMs).toBe(3200);
    expect(store.value.utteranceOrdinal).toBe(1);
    expect(store.value.acceptedUtteranceCount).toBe(0);
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.voiceActivity).toBe("SPEECH");
    expect(audio.release).not.toHaveBeenCalled();

    socket.progress?.({
      utteranceOrdinal: 1, acceptedUtteranceCount: 0,
      capturedSampleMs: 8000, maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "ACCEPTED", voiceActivity: "AWAITING_PAUSE"
    });
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.voiceActivity).toBe("AWAITING_PAUSE");
    expect(store.value.microphone).toBe("READY");
    expect(audio.release).not.toHaveBeenCalled();

    socket.progress?.({
      utteranceOrdinal: 2, acceptedUtteranceCount: 1,
      capturedSampleMs: 0, maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "WAITING", voiceActivity: "SILENCE"
    });

    expect(store.value.utteranceOrdinal).toBe(2);
    expect(store.value.acceptedUtteranceCount).toBe(1);
    expect(store.value.capturedSampleMs).toBe(0);
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.microphone).toBe("READY");

    socket.progress?.({
      utteranceOrdinal: 1, acceptedUtteranceCount: 0,
      capturedSampleMs: 8000, maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "ACCEPTED", voiceActivity: "SILENCE"
    });
    expect(store.value.utteranceOrdinal).toBe(2);
    expect(store.value.capturedSampleMs).toBe(0);

    socket.progress?.({
      utteranceOrdinal: 2, acceptedUtteranceCount: 1,
      capturedSampleMs: 8000, maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "ACCEPTED", voiceActivity: "SILENCE"
    });
    expect(store.value.voiceState).toBe("RECORDING");
    expect(audio.release).not.toHaveBeenCalled();

    socket.waiting?.();
    expect(store.value.voiceState).toBe("PROCESSING");
    expect(store.value.microphone).toBe("IDLE");
    expect(audio.release).toHaveBeenCalledTimes(1);
  });

  it("reuses identical accepted consent while starting a fresh attempt after failure", async () => {
    const freshAttempt = {
      ...ATTEMPT,
      enrollmentAttemptId: "attempt-abcdefghij",
      correlationId: "correlation-abcdefghij",
      state: "CONSENT_PENDING" as const
    };
    const acceptedFreshAttempt = {
      ...freshAttempt,
      state: "CONSENT_ACCEPT_INTENT_RECORDED" as const
    };
    const beginEnrollment = jest.fn()
      .mockResolvedValueOnce(ATTEMPT)
      .mockResolvedValueOnce(freshAttempt);
    const recordEnrollmentConsent = jest.fn().mockResolvedValue(acceptedFreshAttempt);
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    const store = new EnrollmentStore(
      { beginEnrollment, recordEnrollmentConsent,
        createEnrollmentVoiceSession: createSession } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    const snapshots: Array<{ active: boolean; hasAttempt: boolean; busy: boolean; voiceState: string }> = [];
    store.subscribe((snapshot) => snapshots.push({
      active: snapshot.active,
      hasAttempt: Boolean(snapshot.attempt),
      busy: snapshot.busy,
      voiceState: snapshot.voiceState
    }));

    await store.begin();
    await store.startFlow();
    socket.failure?.("ABIS_REGISTRATION_FAILED");
    expect(store.value.voiceState).toBe("FAILED");
    const retryStartIndex = snapshots.length;

    await store.startFlow();

    const retrySnapshots = snapshots.slice(retryStartIndex);
    expect(retrySnapshots.every((snapshot) => snapshot.active && snapshot.hasAttempt)).toBe(true);
    expect(retrySnapshots.some((snapshot) => snapshot.busy && snapshot.voiceState === "FAILED")).toBe(true);
    expect(beginEnrollment).toHaveBeenCalledTimes(2);
    expect(recordEnrollmentConsent).toHaveBeenCalledWith(freshAttempt, "ACCEPT");
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(store.value.attempt).toEqual(acceptedFreshAttempt);
    expect(store.value.voiceState).toBe("RECORDING");
    expect(store.value.microphone).toBe("READY");
  });

  it("requires review again when IAM returns different consent for the retry", async () => {
    const changedConsentAttempt = {
      ...ATTEMPT,
      enrollmentAttemptId: "attempt-changed123",
      correlationId: "correlation-changed123",
      state: "CONSENT_PENDING" as const,
      consent: { version: "version-456", locale: "en", text: "Updated IAM voice consent." }
    };
    const beginEnrollment = jest.fn()
      .mockResolvedValueOnce(ATTEMPT)
      .mockResolvedValueOnce(changedConsentAttempt);
    const recordEnrollmentConsent = jest.fn();
    const createSession = jest.fn().mockResolvedValue(SESSION);
    const audio = {
      prepare: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    const socket = new FakeVoiceSocket();
    const store = new EnrollmentStore(
      { beginEnrollment, recordEnrollmentConsent,
        createEnrollmentVoiceSession: createSession } as unknown as AuthenticationClient,
      audio as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);

    const snapshots: Array<{ active: boolean; hasAttempt: boolean }> = [];
    store.subscribe((snapshot) => snapshots.push({ active: snapshot.active, hasAttempt: Boolean(snapshot.attempt) }));

    await store.begin();
    await store.startFlow();
    socket.failure?.("ABIS_REGISTRATION_FAILED");
    const retryStartIndex = snapshots.length;
    await store.startFlow();

    expect(snapshots.slice(retryStartIndex).every((snapshot) => snapshot.active && snapshot.hasAttempt)).toBe(true);
    expect(recordEnrollmentConsent).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(store.value.attempt).toEqual(changedConsentAttempt);
    expect(store.value.voiceState).toBe("IDLE");
    expect(store.value.microphone).toBe("IDLE");
  });

  it("retains every finalized enrollment transcript segment until reset", async () => {
    const socket = new FakeVoiceSocket();
    const store = new EnrollmentStore(
      {
        beginEnrollment: jest.fn().mockResolvedValue(ATTEMPT),
        createEnrollmentVoiceSession: jest.fn().mockResolvedValue(SESSION)
      } as unknown as AuthenticationClient,
      { prepare: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), release: jest.fn() } as unknown as AudioCapture,
      () => socket as unknown as VoiceSocket);
    await store.begin();
    await store.startFlow();
    socket.transcript?.({ utteranceId: "one", revision: 1, text: "First", final: true, startAudioSequence: 1, endAudioSequence: 10 });
    socket.transcript?.({ utteranceId: "two", revision: 2, text: "Second", final: true, startAudioSequence: 11, endAudioSequence: 20 });

    expect(store.value.transcriptSegments.map((item) => item.text)).toEqual(["First", "Second"]);
    store.reset();
    expect(store.value.transcriptSegments).toEqual([]);
  });
});
