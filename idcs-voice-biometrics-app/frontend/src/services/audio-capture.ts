export type MicrophonePreparation = "IDLE" | "PREPARING" | "READY" | "FAILED";

export class AudioCapture {
  private stream?: MediaStream;
  private readonly mediaDevices: MediaDevices | undefined;
  private readonly createAudioContext: (() => AudioContext) | undefined;
  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private worklet?: AudioWorkletNode;

  constructor(mediaDevices: MediaDevices | undefined = navigator.mediaDevices,
              audioContextFactory?: () => AudioContext) {
    this.mediaDevices = mediaDevices;
    this.createAudioContext = arguments.length >= 2 ? audioContextFactory : (() => {
      const Constructor = window.AudioContext;
      return Constructor ? new Constructor() : undefined as never;
    });
  }

  async prepare(): Promise<void> {
    this.release();
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error("MICROPHONE_UNAVAILABLE");
    }
    const stream = await this.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      },
      video: false
    });
    const tracks = stream.getAudioTracks();
    if (tracks.length !== 1 || tracks[0]?.readyState !== "live") {
      tracks.forEach((track) => track.stop());
      throw new Error("MICROPHONE_UNAVAILABLE");
    }
    this.stream = stream;
  }

  async start(onFrame: (frame: ArrayBuffer) => void): Promise<void> {
    if (!this.stream) throw new Error("MICROPHONE_NOT_PREPARED");
    if (!this.createAudioContext || typeof AudioWorkletNode === "undefined") {
      throw new Error("AUDIO_WORKLET_UNAVAILABLE");
    }
    const context = this.createAudioContext();
    if (!context?.audioWorklet) throw new Error("AUDIO_WORKLET_UNAVAILABLE");
    await context.audioWorklet.addModule("/assets/worklets/pcm-capture-processor.js");
    const source = context.createMediaStreamSource(this.stream);
    const worklet = new AudioWorkletNode(context, "ai-world-pcm-capture", {
      processorOptions: { targetSampleRate: 16000, frameSamples: 320 }
    });
    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (event.data instanceof ArrayBuffer && event.data.byteLength === 640) onFrame(event.data);
    };
    source.connect(worklet);
    worklet.connect(context.destination);
    this.audioContext = context;
    this.source = source;
    this.worklet = worklet;
  }

  release(): void {
    this.worklet?.disconnect();
    this.source?.disconnect();
    void this.audioContext?.close();
    this.worklet = undefined;
    this.source = undefined;
    this.audioContext = undefined;
    this.stream?.getAudioTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}
