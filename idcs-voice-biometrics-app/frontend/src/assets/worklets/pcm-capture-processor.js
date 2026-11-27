class AiWorldPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = options.processorOptions.targetSampleRate;
    this.frameSamples = options.processorOptions.frameSamples;
    this.pending = [];
    this.phase = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    const ratio = sampleRate / this.targetRate;
    while (this.phase < input.length) {
      const index = Math.min(input.length - 1, Math.floor(this.phase));
      const next = Math.min(input.length - 1, index + 1);
      const fraction = this.phase - index;
      this.pending.push(input[index] + (input[next] - input[index]) * fraction);
      this.phase += ratio;
    }
    this.phase -= input.length;
    while (this.pending.length >= this.frameSamples) {
      const pcm = new Int16Array(this.frameSamples);
      for (let i = 0; i < this.frameSamples; i += 1) {
        const sample = Math.max(-1, Math.min(1, this.pending[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.pending.splice(0, this.frameSamples);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor("ai-world-pcm-capture", AiWorldPcmCaptureProcessor);
