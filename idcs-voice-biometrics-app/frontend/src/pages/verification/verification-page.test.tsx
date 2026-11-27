import { fireEvent, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { VerificationPage } from "./verification-page";

const BASE = {
  busy: false, microphone: "IDLE" as const, voiceState: "IDLE" as const,
  sentFrameCount: 0, transcriptState: "NOT_STARTED" as const,
  onStart: jest.fn(), onStop: jest.fn(), onToggleMute: jest.fn(), onRestart: jest.fn(), onBack: jest.fn()
};

describe("VerificationPage", () => {
  it("shows voice results with no transcript controls or placeholders when transcription is disabled", () => {
    render(<VerificationPage {...BASE} transcriptionEnabled={false} timeline={[{
      utteranceId: "voice-only", utteranceOrdinal: 1, startAudioSequence: 1,
      lifecycle: "SEALED", transcriptState: "NOT_STARTED", voiceCheckState: "MATCH"
    }]} />);
    expect(screen.getByRole("heading", { name: "Voice check results" })).toBeTruthy();
    expect(screen.getByText("Matched enrolled voice for audit")).toBeTruthy();
    expect(screen.queryByText("LIVE TRANSCRIPT")).toBeNull();
    expect(screen.queryByText("Audit session transcript")).toBeNull();
    expect(screen.queryByText(/Your words will appear/)).toBeNull();
    expect(screen.queryByText(/Transcription unavailable/)).toBeNull();
  });

  it("starts audit voice check from the verification screen", () => {
    render(<VerificationPage {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(BASE.onStart).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Speak naturally/i)).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "How verification uses your voice" })).toBeNull();
  });

  it("ends an active audit voice check from the verification screen", () => {
    render(<VerificationPage {...BASE} microphone="READY" voiceState="RECORDING" waveform={[0.1, 0.8]} />);
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(BASE.onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Live audit voice check microphone waveform")).toBeTruthy();
    expect(screen.getByText("Voice input detected")).toBeTruthy();
  });

  it("shows an explicit finishing state until the session can restart", () => {
    const { rerender } = render(<VerificationPage {...BASE} voiceState="PROCESSING" sentFrameCount={400} />);
    expect(screen.getByRole("heading", { name: "Waiting for final results" })).toBeTruthy();
    expect(screen.getByText(/The microphone is off/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finishing session…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("READY TO BEGIN")).toBeNull();
    rerender(<VerificationPage {...BASE} voiceState="COMPLETED" sentFrameCount={400} />);
    expect(screen.getByRole("button", { name: "Start another session" }).hasAttribute("disabled")).toBe(false);
  });

  it("restarts a completed audit voice check from the verification screen", () => {
    render(<VerificationPage {...BASE} voiceState="COMPLETED" />);
    fireEvent.click(screen.getByRole("button", { name: "Start another session" }));
    expect(BASE.onRestart).toHaveBeenCalledTimes(1);
  });

  it("shows a failed start and its recovery message instead of looking ready", () => {
    const onRestart = jest.fn();
    render(<VerificationPage {...BASE} microphone="FAILED" voiceState="FAILED"
      transcriptState="FAILED" onRestart={onRestart}
      message="Transcription could not connect. Please try again." />);

    expect(screen.getByRole("alert").textContent).toBe(
      "Transcription could not connect. Please try again.");
    expect(screen.getByRole("heading", { name: "Session could not start" })).toBeTruthy();
    expect(screen.queryByText("READY TO BEGIN")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start another session" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("shows microphone preparation failures before a session is created", () => {
    render(<VerificationPage {...BASE} microphone="FAILED"
      message="Microphone permission or an available audio input is required." />);
    expect(screen.getByRole("alert").textContent).toContain("Microphone permission");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows live transcription and neutral biometric outcome", () => {
    render(<VerificationPage {...BASE} voiceState="COMPLETED" transcriptState="FINAL"
      timeline={[
        { utteranceId: "utterance-1", utteranceOrdinal: 1, startAudioSequence: 1,
          endAudioSequence: 265, lifecycle: "SEALED", transcriptState: "FINAL",
          text: "Please take a deep breath.", voiceCheckState: "MATCH" },
        { utteranceId: "utterance-2", utteranceOrdinal: 2, startAudioSequence: 266,
          endAudioSequence: 530, lifecycle: "SEALED", transcriptState: "FINAL",
          text: "Now breathe normally.", voiceCheckState: "MISMATCH" }
      ]} />);
    expect(screen.getByText("Please take a deep breath.")).toBeTruthy();
    expect(screen.getByText("Now breathe normally.")).toBeTruthy();
    expect(screen.getByTitle("Did not match enrolled voice")).toBeTruthy();
    expect(screen.getByTitle("Matched enrolled voice for audit")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Audit session transcript" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Voice checks during this session" })).toBeNull();
  });

  it("mutes and resumes audio while keeping the session controls visible", () => {
    const onToggleMute = jest.fn();
    const { rerender } = render(<VerificationPage {...BASE} microphone="READY"
      voiceState="RECORDING" onToggleMute={onToggleMute} />);
    fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    rerender(<VerificationPage {...BASE} microphone="READY" voiceState="RECORDING"
      muted={true} onToggleMute={onToggleMute} />);
    expect(screen.getByText("Audio is not being sent")).toBeTruthy();
    expect(screen.getByLabelText("Audit voice check microphone muted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume audio" }));
    expect(onToggleMute).toHaveBeenCalledTimes(2);
  });

  it("uses provider-neutral wording for every result and processing failure", () => {
    render(<VerificationPage {...BASE} microphone="READY" voiceState="RECORDING"
      assurances={[
        { utteranceId: "one", utteranceOrdinal: 1, outcome: "MATCH", completedAt: "2026-09-04T00:00:01Z" },
        { utteranceId: "two", utteranceOrdinal: 2, outcome: "MISMATCH", completedAt: "2026-09-04T00:00:02Z" },
        { utteranceId: "three", utteranceOrdinal: 3, outcome: "INCONCLUSIVE", completedAt: "2026-09-04T00:00:03Z" }
      ]}
      assuranceFailures={[
        { utteranceId: "four", utteranceOrdinal: 4, code: "VOICE_UTTERANCE_REJECTED" }
      ]} />);

    expect(screen.getByTitle("Matched enrolled voice for audit")).toBeTruthy();
    expect(screen.getByTitle("Did not match enrolled voice")).toBeTruthy();
    expect(screen.getAllByTitle("Inconclusive")).toHaveLength(2);
    expect(screen.queryByTitle("Voice check unavailable")).toBeNull();
    expect(screen.getByRole("button", { name: "End session" })).toBeTruthy();
  });

  it("does not expose backend provider or protocol details", () => {
    const { container } = render(<VerificationPage {...BASE} />);
    expect(container.textContent).not.toMatch(/ABIS|OCI Speech|WebSocket|Java backend|correlation/i);
    expect(container.textContent).not.toMatch(/Patient speaker|Other speaker|authenticated|liveness|physical presence/i);
  });
});
