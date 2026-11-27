export type MicrophonePreparation = "IDLE" | "PREPARING" | "READY" | "FAILED";

export function audioCaptureFailureMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  if (error.message === "AUDIO_CONTEXT_NOT_RUNNING") {
    return "Browser audio could not start. Keep this tab active, check browser audio permissions and try again.";
  }
  if (error.message === "AUDIO_WORKLET_UNAVAILABLE") {
    return "Microphone processing is unavailable. Use a supported browser on the configured local or HTTPS address.";
  }
  return undefined;
}

export class AudioCapture {
  private stream?: MediaStream;
  private readonly mediaDevices: MediaDevices | undefined;
  private readonly createAudioContext: (() => AudioContext) | undefined;
  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private worklet?: AudioWorkletNode;
  private generation = 0;

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
    const generation = this.generation;
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error("MICROPHONE_UNAVAILABLE");
    }
    try {
      if (!this.createAudioContext) throw new Error("AUDIO_WORKLET_UNAVAILABLE");
      const context = this.createAudioContext();
      this.audioContext = context;
      if (!context?.audioWorklet) throw new Error("AUDIO_WORKLET_UNAVAILABLE");
      // Run resume synchronously from the user's click, before permission/provider awaits
      // lose transient browser activation. Preparing does not connect or send any audio.
      const resumed = context.state === "running"
        ? Promise.resolve(true)
        : context.resume().then(() => true, () => false);
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
      if (generation !== this.generation || tracks.length !== 1 || tracks[0]?.readyState !== "live") {
        tracks.forEach((track) => track.stop());
        throw new Error("MICROPHONE_UNAVAILABLE");
      }
      this.stream = stream;
      await this.requireRunning(context, resumed);
      if (generation !== this.generation) throw new Error("MICROPHONE_NOT_PREPARED");
    } catch (error) {
      if (generation === this.generation) this.release();
      throw error;
    }
  }

  async start(onFrame: (frame: ArrayBuffer) => void): Promise<void> {
    if (!this.stream) throw new Error("MICROPHONE_NOT_PREPARED");
    const generation = this.generation;
    const context = this.audioContext;
    try {
      if (!context?.audioWorklet || typeof AudioWorkletNode === "undefined") {
        throw new Error("AUDIO_WORKLET_UNAVAILABLE");
      }
      await this.requireRunning(context, context.state === "running"
        ? Promise.resolve(true) : context.resume().then(() => true, () => false));
      await context.audioWorklet.addModule("/assets/worklets/pcm-capture-processor.js");
      if (generation !== this.generation || !this.stream) throw new Error("MICROPHONE_NOT_PREPARED");
      const source = context.createMediaStreamSource(this.stream);
      this.source = source;
      const worklet = new AudioWorkletNode(context, "ai-world-pcm-capture", {
        processorOptions: { targetSampleRate: 16000, frameSamples: 320 }
      });
      this.worklet = worklet;
      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (generation === this.generation && event.data instanceof ArrayBuffer && event.data.byteLength === 640) {
          onFrame(event.data);
        }
      };
      source.connect(worklet);
      worklet.connect(context.destination);
    } catch (error) {
      if (generation === this.generation) this.release();
      throw error;
    }
  }

  release(): void {
    this.generation += 1;
    this.worklet?.disconnect();
    this.source?.disconnect();
    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => undefined);
    }
    this.worklet = undefined;
    this.source = undefined;
    this.audioContext = undefined;
    this.stream?.getAudioTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }

  private isRunning(context: AudioContext): boolean {
    return context.state === "running";
  }

  private async requireRunning(context: AudioContext, resumed: Promise<boolean>): Promise<void> {
    if (this.isRunning(context)) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([
        resumed,
        new Promise<boolean>((resolve) => { timeout = setTimeout(() => resolve(false), 5000); })
      ]);
      if (!ready || !this.isRunning(context)) throw new Error("AUDIO_CONTEXT_NOT_RUNNING");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}
