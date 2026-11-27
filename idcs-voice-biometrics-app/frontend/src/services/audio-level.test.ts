import { appendWaveformLevel, calculatePcm16Level } from "./audio-level";

function pcmFrame(amplitude: number): ArrayBuffer {
  const frame = new ArrayBuffer(640);
  const view = new DataView(frame);
  for (let offset = 0; offset < frame.byteLength; offset += 2) {
    view.setInt16(offset, offset % 4 === 0 ? amplitude : -amplitude, true);
  }
  return frame;
}

describe("audio level", () => {
  it("keeps silence at rest and maps speech amplitude into the visible range", () => {
    expect(calculatePcm16Level(pcmFrame(0))).toBe(0);
    expect(calculatePcm16Level(pcmFrame(5000))).toBeGreaterThan(0.5);
    expect(calculatePcm16Level(pcmFrame(32767))).toBeLessThanOrEqual(1);
  });

  it("keeps a bounded rolling history with a gradual release", () => {
    const history = appendWaveformLevel([0.2, 0.9], 0.1, 3);
    expect(history).toHaveLength(3);
    expect(history[2]).toBeCloseTo(0.558);
    expect(appendWaveformLevel(history, 0.8, 3)).toEqual([0.9, 0.558, 0.8]);
  });
});
