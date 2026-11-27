import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { TranscriptPanel } from "./index";

describe("TranscriptPanel", () => {
  it("shows partial and final provider text without an editing control", () => {
    const partial = { utteranceId: "one", revision: 1, text: "The speaker reports", final: false,
      startAudioSequence: 1, endAudioSequence: 20 };
    const { rerender } = render(<TranscriptPanel state="PARTIAL" segments={[partial]} />);
    expect(screen.getByText("Transcribing live")).toBeTruthy();
    expect(screen.getByText("The speaker reports")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();

    rerender(<TranscriptPanel state="FINAL" segments={[
      { ...partial, revision: 2, text: "The speaker reports fatigue.", final: true },
      { utteranceId: "two", revision: 3, text: "Please take a deep breath.", final: true,
        startAudioSequence: 21, endAudioSequence: 40 }
    ]} />);
    expect(screen.getByText("Final transcript")).toBeTruthy();
    expect(screen.getByText("The speaker reports fatigue.")).toBeTruthy();
    expect(screen.getByText("Please take a deep breath.")).toBeTruthy();
  });

  it("keeps Speech failure separate from transcript content", () => {
    render(<TranscriptPanel state="FAILED" />);
    expect(screen.getByText("Transcription unavailable")).toBeTruthy();
    expect(screen.getByText("Live transcription is currently unavailable.")).toBeTruthy();
  });
});
