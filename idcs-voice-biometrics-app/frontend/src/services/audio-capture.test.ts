import { AudioCapture } from "./audio-capture";

function microphone(readyState = "live") {
  const stop = jest.fn();
  const stream = { getAudioTracks: () => [{ readyState, stop }] } as unknown as MediaStream;
  const getUserMedia = jest.fn().mockResolvedValue(stream);
  return { stop, stream, getUserMedia, mediaDevices: { getUserMedia } as unknown as MediaDevices };
}

function audioContext(initialState: AudioContextState = "running") {
  const source = { connect: jest.fn(), disconnect: jest.fn() };
  const state = { value: initialState };
  const context = {
    get state() { return state.value; },
    audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) },
    resume: jest.fn().mockImplementation(async () => { state.value = "running"; }),
    close: jest.fn().mockImplementation(async () => { state.value = "closed"; }),
    createMediaStreamSource: jest.fn().mockReturnValue(source),
    destination: {}
  };
  return { context, state, source, factory: () => context as unknown as AudioContext };
}

describe("AudioCapture", () => {
  const originalWorklet = globalThis.AudioWorkletNode;
  let worklet: { port: { onmessage?: (event: MessageEvent<ArrayBuffer>) => void }; connect: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    worklet = { port: {}, connect: jest.fn(), disconnect: jest.fn() };
    globalThis.AudioWorkletNode = jest.fn().mockImplementation(() => worklet);
  });

  afterEach(() => {
    globalThis.AudioWorkletNode = originalWorklet;
    jest.useRealTimers();
  });

  it("stops every acquired track when microphone preparation is released", async () => {
    const mic = microphone();
    const ctx = audioContext();
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await capture.prepare();
    expect(mic.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ echoCancellation: true, noiseSuppression: true, autoGainControl: false }),
      video: false
    });
    capture.release();
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });

  it("does not retain a stream when the selected input is unavailable", async () => {
    const mic = microphone("ended");
    const ctx = audioContext();
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await expect(capture.prepare()).rejects.toThrow("MICROPHONE_UNAVAILABLE");
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended context during the click before waiting for permission or providers", async () => {
    const mic = microphone();
    let grant!: (stream: MediaStream) => void;
    mic.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve; }));
    const ctx = audioContext("suspended");
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    const prepared = capture.prepare();
    expect(ctx.context.resume).toHaveBeenCalledTimes(1);
    expect(ctx.context.resume.mock.invocationCallOrder[0]!).toBeLessThan(mic.getUserMedia.mock.invocationCallOrder[0]!);
    expect(ctx.context.createMediaStreamSource).not.toHaveBeenCalled();
    grant(mic.stream);
    await prepared;
    // Permission and context activation alone never connect or send microphone audio.
    expect(ctx.context.createMediaStreamSource).not.toHaveBeenCalled();
    const onFrame = jest.fn();
    await capture.start(onFrame);
    expect(ctx.context.audioWorklet.addModule).toHaveBeenCalledWith("/assets/worklets/pcm-capture-processor.js");
    const frame = new ArrayBuffer(640);
    worklet.port.onmessage?.({ data: frame } as MessageEvent<ArrayBuffer>);
    expect(onFrame).toHaveBeenCalledWith(frame);
    capture.release();
    worklet.port.onmessage?.({ data: frame } as MessageEvent<ArrayBuffer>);
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it("fails and releases microphone/context when resume is rejected", async () => {
    const mic = microphone();
    const ctx = audioContext("suspended");
    ctx.context.resume.mockRejectedValue(new Error("NotAllowedError"));
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await expect(capture.prepare()).rejects.toThrow("AUDIO_CONTEXT_NOT_RUNNING");
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });

  it("times out a browser resume that never resolves instead of showing false readiness", async () => {
    jest.useFakeTimers();
    const mic = microphone();
    const ctx = audioContext("suspended");
    ctx.context.resume.mockReturnValue(new Promise(() => undefined));
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    const failed = expect(capture.prepare()).rejects.toThrow("AUDIO_CONTEXT_NOT_RUNNING");
    await jest.advanceTimersByTimeAsync(5000);
    await failed;
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });

  it("releases the context when microphone permission is denied", async () => {
    const mic = microphone();
    mic.getUserMedia.mockRejectedValue(new Error("NotAllowedError"));
    const ctx = audioContext();
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await expect(capture.prepare()).rejects.toThrow("NotAllowedError");
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
    expect(ctx.context.createMediaStreamSource).not.toHaveBeenCalled();
  });

  it("stops a late permission result after the user leaves the page", async () => {
    const mic = microphone();
    let grant!: (stream: MediaStream) => void;
    mic.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve; }));
    const ctx = audioContext();
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    const failed = expect(capture.prepare()).rejects.toThrow("MICROPHONE_UNAVAILABLE");
    capture.release();
    grant(mic.stream);
    await failed;
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.createMediaStreamSource).not.toHaveBeenCalled();
  });

  it("does not reconnect audio after release while the worklet is loading", async () => {
    const mic = microphone();
    const ctx = audioContext();
    let loaded!: () => void;
    ctx.context.audioWorklet.addModule.mockReturnValue(new Promise<void>((resolve) => { loaded = resolve; }));
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await capture.prepare();
    const failed = expect(capture.start(jest.fn())).rejects.toThrow("MICROPHONE_NOT_PREPARED");
    await Promise.resolve();
    capture.release();
    loaded();
    await failed;
    expect(ctx.context.createMediaStreamSource).not.toHaveBeenCalled();
  });

  it("releases local input if the worklet cannot load", async () => {
    const mic = microphone();
    const ctx = audioContext();
    ctx.context.audioWorklet.addModule.mockRejectedValue(new Error("module unavailable"));
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await capture.prepare();
    await expect(capture.start(jest.fn())).rejects.toThrow("module unavailable");
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });

  it("refuses capture when AudioWorklet is unavailable and releases the local track", async () => {
    const mic = microphone();
    const ctx = audioContext();
    const capture = new AudioCapture(mic.mediaDevices, ctx.factory);
    await capture.prepare();
    globalThis.AudioWorkletNode = undefined as unknown as typeof AudioWorkletNode;
    await expect(capture.start(jest.fn())).rejects.toThrow("AUDIO_WORKLET_UNAVAILABLE");
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(ctx.context.close).toHaveBeenCalledTimes(1);
  });
});
