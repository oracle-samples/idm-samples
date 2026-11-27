const PCM_MAX = 32768;
const NOISE_FLOOR_DB = -50;
const DISPLAY_RANGE_DB = 40;

export function calculatePcm16Level(frame: ArrayBuffer): number {
  if (frame.byteLength < 2) return 0;
  const view = new DataView(frame);
  const sampleCount = Math.floor(frame.byteLength / 2);
  let squareSum = 0;
  for (let offset = 0; offset + 1 < frame.byteLength; offset += 2) {
    const sample = view.getInt16(offset, true) / PCM_MAX;
    squareSum += sample * sample;
  }
  const rms = Math.sqrt(squareSum / sampleCount);
  if (rms === 0) return 0;
  const decibels = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (decibels - NOISE_FLOOR_DB) / DISPLAY_RANGE_DB));
}

export function appendWaveformLevel(
  history: readonly number[],
  level: number,
  size = 36
): readonly number[] {
  const previous = history[history.length - 1] ?? 0;
  const smoothed = Math.min(1, Math.max(level, previous * 0.62));
  return [...history, smoothed].slice(-size);
}
