import { VoiceSocket } from "./voice-socket";
import type { VoiceSession } from "../types/application-contracts";

class FakeWebSocket {
  static readonly OPEN = 1;
  readonly sent: unknown[] = [];
  binaryType = "blob";
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  send(value: unknown) { this.sent.push(value); }
  close() { this.onclose?.(); }
}

const SESSION: VoiceSession = {
  protocolVersion: "1.0",
  correlationId: "correlation-1234567890",
  voiceSessionId: "voice-session-1234567890",
  purpose: "ENROLLMENT",
  state: "PREAUTHORIZED",
  websocketPath: "/ws/v1/voice",
  bindExpiresAt: "2026-09-02T00:00:05Z",
  audioProfile: {
    encoding: "PCM_SIGNED", sampleRateHz: 16000, channels: 1,
    sampleSizeBits: 16, byteOrder: "LITTLE_ENDIAN", nominalFrameMs: 20
  }
};

describe("VoiceSocket", () => {
  it("binds first, waits for READY credit, then sends canonical binary audio", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    expect(JSON.parse(String(socket.sent[0])).eventType).toBe("session.bind");

    socket.onmessage?.({ data: JSON.stringify({
      protocolVersion: "1.0", eventId: "event-1234567890123456", eventType: "session.bound",
      source: "APPLICATION", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId, eventSequence: 1,
      occurredAt: "2026-09-02T00:00:01Z", emittedAt: "2026-09-02T00:00:01Z",
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    client.startCapture();
    client.sendAudio(new ArrayBuffer(640));
    expect(JSON.parse(String(socket.sent[1])).eventType).toBe("capture.start");
    expect(socket.sent[2]).toBeInstanceOf(ArrayBuffer);
  });

  it("rejects readiness when the backend reports provider failure", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      protocolVersion: "1.0", eventType: "error", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { code: "VOICE_DEPENDENCIES_UNAVAILABLE", terminal: true }
    }) } as MessageEvent);
    await expect(connected).rejects.toThrow("VOICE_DEPENDENCIES_UNAVAILABLE");
  });

  it("reports a terminal ABIS failure after the socket was ready", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const failure = jest.fn();
    client.onTerminalFailure(failure);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "error", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { code: "ABIS_REGISTRATION_FAILED", terminal: true }
    }) } as MessageEvent);
    expect(failure).toHaveBeenCalledWith("ABIS_REGISTRATION_FAILED");
  });

  it("keeps the socket open after capture end and reports provider completion", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const completed = jest.fn();
    client.onCompleted(completed);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    client.endCapture(400);
    expect(JSON.parse(String(socket.sent[socket.sent.length - 1])).eventType).toBe("capture.end");
    expect(completed).not.toHaveBeenCalled();

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.completed", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "COMPLETED", purpose: "ENROLLMENT" }
    }) } as MessageEvent);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("ignores queued events after completion or explicit close", async () => {
    for (const terminal of ["complete", "close"]) {
      const socket = new FakeWebSocket();
      const client = new VoiceSocket(() => socket as unknown as WebSocket);
      const transcript = jest.fn();
      const completed = jest.fn();
      client.onTranscript(transcript);
      client.onCompleted(completed);
      const send = (eventType: string, payload: object) => socket.onmessage?.({ data: JSON.stringify({
        eventType, voiceSessionId: SESSION.voiceSessionId, correlationId: SESSION.correlationId,
        utteranceId: "one", payload
      }) } as MessageEvent);
      const connected = client.connect(SESSION);
      socket.onopen?.();
      send("session.bound", { state: "READY", credit: {
        availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640
      } });
      await connected;
      if (terminal === "complete") send("session.completed", { state: "COMPLETED" });
      else client.close();
      send("transcript.partial", { revision: 2, text: "Late text", startAudioSequence: 1, endAudioSequence: 50 });
      send("session.completed", { state: "COMPLETED" });
      expect(transcript).not.toHaveBeenCalled();
      expect(completed).toHaveBeenCalledTimes(terminal === "complete" ? 1 : 0);
    }
  });

  it("reports the ABIS WAIT action without closing the enrollment socket", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const waiting = jest.fn();
    client.onWaiting(waiting);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "enrollment.state", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "WAITING", action: "WAIT", safeCode: "ABIS_PROCESSING" }
    }) } as MessageEvent);

    expect(waiting).toHaveBeenCalledTimes(1);
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);
  });

  it("delivers validated enrollment speech progress", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const progress = jest.fn();
    client.onEnrollmentProgress(progress);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "enrollment.progress", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: {
        utteranceOrdinal: 2,
        acceptedUtteranceCount: 1,
        capturedSampleMs: 4200,
        maximumSampleMs: 10000, minimumSampleMs: 7000,
        qualityState: "ACCEPTED",
        voiceActivity: "SPEECH"
      }
    }) } as MessageEvent);

    expect(progress).toHaveBeenCalledWith({
      utteranceOrdinal: 2,
      acceptedUtteranceCount: 1,
      capturedSampleMs: 4200,
      maximumSampleMs: 10000, minimumSampleMs: 7000,
      qualityState: "ACCEPTED",
      voiceActivity: "SPEECH"
    });
  });

  it("delivers coarse capture quality without exposing detector measurements", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const quality = jest.fn();
    client.onCaptureQuality(quality);
    const connected = client.connect({ ...SESSION, purpose: "VERIFICATION" });
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "capture.quality", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId, payload: { state: "NOISY" }
    }) } as MessageEvent);

    expect(quality).toHaveBeenCalledWith({ state: "NOISY" });
  });

  it("rejects enrollment progress missing the minimum/maximum range", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const failure = jest.fn();
    client.onTerminalFailure(failure);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "enrollment.progress", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: {
        utteranceOrdinal: 1,
        acceptedUtteranceCount: 0,
        capturedSampleMs: 4200,
        maximumSampleMs: 10000,
        qualityState: "ACCEPTED",
        voiceActivity: "SPEECH"
      }
    }) } as MessageEvent);

    expect(failure).toHaveBeenCalledWith("VOICE_PROTOCOL_ENROLLMENT_PROGRESS_INVALID");
  });

  it("sends pause and resume controls on the existing verification socket", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const connected = client.connect({ ...SESSION, purpose: "VERIFICATION" });
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    client.startCapture();
    client.pauseCapture();
    client.resumeCapture();

    expect(socket.sent.slice(1).map((message) => JSON.parse(String(message)).eventType))
      .toEqual(["capture.start", "capture.pause", "capture.resume"]);
  });

  it("delivers correlated partial and final transcript revisions over the same socket", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const transcript = jest.fn();
    client.onTranscript(transcript);
    const connected = client.connect(SESSION);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    for (const [eventType, revision, text] of [
      ["transcript.partial", 1, "The speaker"],
      ["transcript.final", 2, "The speaker reports fatigue."]
    ] as const) {
      socket.onmessage?.({ data: JSON.stringify({
        eventType, utteranceId: "utterance-1", voiceSessionId: SESSION.voiceSessionId,
        correlationId: SESSION.correlationId,
        payload: { revision, text, startAudioSequence: 1, endAudioSequence: 50 }
      }) } as MessageEvent);
    }

    expect(transcript).toHaveBeenNthCalledWith(1, expect.objectContaining({
      revision: 1, text: "The speaker", final: false
    }));
    expect(transcript).toHaveBeenNthCalledWith(2, expect.objectContaining({
      revision: 2, text: "The speaker reports fatigue.", final: true
    }));
  });

  it("delivers a verification assurance result independently of authentication", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const assurance = jest.fn();
    client.onAssurance(assurance);
    const connected = client.connect({ ...SESSION, purpose: "VERIFICATION" });
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "assurance.result", utteranceId: "verification-utterance-1",
      voiceSessionId: SESSION.voiceSessionId, correlationId: SESSION.correlationId,
      payload: { utteranceOrdinal: 1, outcome: "MATCH", completedAt: "2026-09-04T00:00:00Z" }
    }) } as MessageEvent);

    expect(assurance).toHaveBeenCalledWith({
      utteranceId: "verification-utterance-1", outcome: "MATCH",
      utteranceOrdinal: 1,
      completedAt: "2026-09-04T00:00:00Z"
    });
  });

  it("delivers utterance processing failure without terminating the socket", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const assuranceFailure = jest.fn();
    const terminalFailure = jest.fn();
    client.onAssuranceFailure(assuranceFailure);
    client.onTerminalFailure(terminalFailure);
    const connected = client.connect({ ...SESSION, purpose: "VERIFICATION" });
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    socket.onmessage?.({ data: JSON.stringify({
      eventType: "assurance.failed", utteranceId: "failed-sample",
      voiceSessionId: SESSION.voiceSessionId, correlationId: SESSION.correlationId,
      payload: {
        utteranceOrdinal: 2, code: "VOICE_UTTERANCE_REJECTED",
        processingState: "FAILED", failureKind: "QUALITY", retryable: true, terminal: false
      }
    }) } as MessageEvent);

    expect(assuranceFailure).toHaveBeenCalledWith({
      utteranceId: "failed-sample", utteranceOrdinal: 2, code: "VOICE_UTTERANCE_REJECTED"
    });
    expect(terminalFailure).not.toHaveBeenCalled();
  });

  it("delivers the canonical utterance lifecycle and row-scoped transcript failure", async () => {
    const socket = new FakeWebSocket();
    const client = new VoiceSocket(() => socket as unknown as WebSocket);
    const started = jest.fn();
    const sealed = jest.fn();
    const discarded = jest.fn();
    const transcriptFailure = jest.fn();
    client.onUtteranceStarted(started);
    client.onUtteranceSealed(sealed);
    client.onUtteranceDiscarded(discarded);
    client.onTranscriptFailure(transcriptFailure);
    const connected = client.connect({ ...SESSION, purpose: "VERIFICATION" });
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({
      eventType: "session.bound", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId,
      payload: { state: "READY", credit: { availableFrames: 50, availableBytes: 32000, maxFrameBytes: 640 } }
    }) } as MessageEvent);
    await connected;

    const base = {
      utteranceId: "canonical-window-1", voiceSessionId: SESSION.voiceSessionId,
      correlationId: SESSION.correlationId
    };
    socket.onmessage?.({ data: JSON.stringify({
      ...base, eventType: "utterance.started",
      payload: { utteranceOrdinal: 1, startAudioSequence: 4 }
    }) } as MessageEvent);
    socket.onmessage?.({ data: JSON.stringify({
      ...base, eventType: "utterance.sealed",
      payload: { utteranceOrdinal: 1, startAudioSequence: 4, endAudioSequence: 269, detectedSpeechMs: 2000 }
    }) } as MessageEvent);
    socket.onmessage?.({ data: JSON.stringify({
      ...base, eventType: "transcript.failed",
      payload: { utteranceOrdinal: 1, code: "SPEECH_TRANSCRIPT_CORRELATION_FAILED", terminal: false }
    }) } as MessageEvent);
    socket.onmessage?.({ data: JSON.stringify({
      ...base, eventType: "utterance.discarded",
      payload: { utteranceOrdinal: 1, startAudioSequence: 4 }
    }) } as MessageEvent);

    expect(started).toHaveBeenCalledWith({
      utteranceId: "canonical-window-1", utteranceOrdinal: 1, startAudioSequence: 4
    });
    expect(sealed).toHaveBeenCalledWith(expect.objectContaining({
      utteranceId: "canonical-window-1", endAudioSequence: 269, detectedSpeechMs: 2000
    }));
    expect(transcriptFailure).toHaveBeenCalledWith({
      utteranceId: "canonical-window-1", utteranceOrdinal: 1,
      code: "SPEECH_TRANSCRIPT_CORRELATION_FAILED"
    });
    expect(discarded).toHaveBeenCalledTimes(1);
  });
});
