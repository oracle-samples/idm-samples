import { AudioCapture } from "./audio-capture";

describe("AudioCapture", () => {
  it("stops every acquired track when microphone preparation is released", async () => {
    const stop = jest.fn();
    const stream = { getAudioTracks: () => [{ readyState: "live", stop }] } as unknown as MediaStream;
    const mediaDevices = { getUserMedia: jest.fn().mockResolvedValue(stream) } as unknown as MediaDevices;
    const capture = new AudioCapture(mediaDevices);
    await capture.prepare();
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      }),
      video: false
    });
    capture.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not retain a stream when the selected input is unavailable", async () => {
    const stop = jest.fn();
    const stream = { getAudioTracks: () => [{ readyState: "ended", stop }] } as unknown as MediaStream;
    const mediaDevices = { getUserMedia: jest.fn().mockResolvedValue(stream) } as unknown as MediaDevices;
    const capture = new AudioCapture(mediaDevices);
    await expect(capture.prepare()).rejects.toThrow("MICROPHONE_UNAVAILABLE");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("refuses capture when AudioWorklet is unavailable and releases the local track", async () => {
    const stop = jest.fn();
    const stream = { getAudioTracks: () => [{ readyState: "live", stop }] } as unknown as MediaStream;
    const mediaDevices = { getUserMedia: jest.fn().mockResolvedValue(stream) } as unknown as MediaDevices;
    const capture = new AudioCapture(mediaDevices, undefined);
    await capture.prepare();
    await expect(capture.start(jest.fn())).rejects.toThrow("AUDIO_WORKLET_UNAVAILABLE");
    capture.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
