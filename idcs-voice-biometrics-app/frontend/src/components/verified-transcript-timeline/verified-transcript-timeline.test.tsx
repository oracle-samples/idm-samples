import { render, screen } from "@testing-library/preact";
import { h } from "preact";
import { VerifiedTranscriptTimeline } from "./index";

describe("VerifiedTranscriptTimeline", () => {
  it("preserves unfinished text with a truthful terminal label", () => {
    render(<VerifiedTranscriptTimeline items={[{
      utteranceId: "pending", utteranceOrdinal: 1, startAudioSequence: 1,
      lifecycle: "SEALED", transcriptState: "FAILED", text: "Last available words",
      voiceCheckState: "MATCH"
    }]} />);
    expect(screen.getByText("Last available words")).toBeTruthy();
    expect(screen.getByText("Transcript incomplete")).toBeTruthy();
    expect(screen.queryByText("Transcribing…")).toBeNull();
    expect(screen.getByTitle("Matched enrolled voice for audit")).toBeTruthy();
  });
  it("shows transcript and voice state together for every canonical audio window", () => {
    render(<VerifiedTranscriptTimeline items={[
      {
        utteranceId: "one", utteranceOrdinal: 1, startAudioSequence: 1,
        lifecycle: "OPEN", transcriptState: "PARTIAL", text: "Please take a deep breath",
        voiceCheckState: "COLLECTING"
      },
      {
        utteranceId: "two", utteranceOrdinal: 2, startAudioSequence: 266, endAudioSequence: 530,
        lifecycle: "SEALED", transcriptState: "FINAL", text: "Now breathe normally.",
        voiceCheckState: "MATCH"
      },
      {
        utteranceId: "three", utteranceOrdinal: 3, startAudioSequence: 531, endAudioSequence: 795,
        lifecycle: "SEALED", transcriptState: "FINAL", text: "I have felt tired this week.",
        voiceCheckState: "MISMATCH"
      },
      {
        utteranceId: "four", utteranceOrdinal: 4, startAudioSequence: 796, endAudioSequence: 1060,
        lifecycle: "SEALED", transcriptState: "FINAL", text: "The symptoms started yesterday.",
        voiceCheckState: "INCONCLUSIVE"
      }
    ]} />);

    expect(screen.getByRole("heading", { name: "Audit session transcript" })).toBeTruthy();
    expect(screen.getByText("Latest audit voice check appears first")).toBeTruthy();
    expect(screen.getAllByText(/^Audit voice check \d+$/).map((element) => element.textContent)).toEqual([
      "Audit voice check 4", "Audit voice check 3", "Audit voice check 2", "Audit voice check 1"
    ]);
    expect(screen.getByText("Please take a deep breath")).toBeTruthy();
    const processing = screen.getByTitle("Listening for voice");
    expect(processing).toBeTruthy();
    expect(processing.closest(".voice-collecting")).toBeTruthy();
    expect(processing.querySelector(".verified-transcript-icon")?.textContent).toBe("");
    expect(screen.getByTitle("Matched enrolled voice for audit")).toBeTruthy();
    const mismatch = screen.getByLabelText("Did not match enrolled voice");
    expect(mismatch).toBeTruthy();
    expect(mismatch.getAttribute("title")).toBe("Did not match enrolled voice");
    expect(mismatch.querySelector(".verified-transcript-icon")?.textContent).toBe("×");
    expect(screen.getByTitle("Inconclusive")).toBeTruthy();
    expect(screen.queryByText("Did not match enrolled voice")).toBeNull();
  });

  it("keeps the processing indicator while a sealed utterance awaits its result", () => {
    render(<VerifiedTranscriptTimeline items={[{
      utteranceId: "waiting", utteranceOrdinal: 1, startAudioSequence: 1,
      endAudioSequence: 265, lifecycle: "SEALED", transcriptState: "FINAL",
      text: "A completed utterance", voiceCheckState: "CHECKING"
    }]} />);

    const processing = screen.getByTitle("Checking voice");
    expect(processing.closest(".voice-checking")).toBeTruthy();
    expect(processing.querySelector(".verified-transcript-icon")?.textContent).toBe("");
  });

  it("keeps transcript and voice-processing failures independent", () => {
    render(<VerifiedTranscriptTimeline items={[
      {
        utteranceId: "one", utteranceOrdinal: 1, startAudioSequence: 1, endAudioSequence: 265,
        lifecycle: "SEALED", transcriptState: "FAILED", voiceCheckState: "MATCH"
      },
      {
        utteranceId: "two", utteranceOrdinal: 2, startAudioSequence: 266, endAudioSequence: 530,
        lifecycle: "SEALED", transcriptState: "FINAL", text: "Visible transcript",
        voiceCheckState: "UNAVAILABLE"
      }
    ]} />);

    expect(screen.getByText("Transcription unavailable for this audit voice check.")).toBeTruthy();
    expect(screen.getByText("Visible transcript")).toBeTruthy();
    expect(screen.getByTitle("Voice check unavailable")).toBeTruthy();
    expect(screen.getByTitle("Matched enrolled voice for audit")).toBeTruthy();
  });
});
