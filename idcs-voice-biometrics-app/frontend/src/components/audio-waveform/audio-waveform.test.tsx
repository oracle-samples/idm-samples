import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { AudioWaveform } from "./index";

describe("AudioWaveform", () => {
  it("renders a stable idle waveform before capture", () => {
    const { container } = render(
      <AudioWaveform levels={[]} active={false} label="Enrollment microphone waveform" />
    );
    expect(screen.getByLabelText("Enrollment microphone waveform")).toBeTruthy();
    expect(screen.getByText("Microphone waveform")).toBeTruthy();
    expect(container.querySelectorAll(".waveform-bars span")).toHaveLength(36);
  });

  it("shows voice detection from the latest real audio level", () => {
    render(<AudioWaveform levels={[0.05, 0.7]} active label="Live verification waveform" />);
    expect(screen.getByText("Voice input detected")).toBeTruthy();
    expect(screen.getByText("Live input")).toBeTruthy();
  });
});
