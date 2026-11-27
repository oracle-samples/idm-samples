import { fireEvent, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { EnrollmentPage } from "./enrollment-page";
import type { EnrollmentAttempt } from "../../types/application-contracts";

const ATTEMPT: EnrollmentAttempt = {
  enrollmentAttemptId: "attempt-1234567890",
  correlationId: "correlation-1234567890",
  state: "CONSENT_PENDING",
  consent: { version: "version-123", locale: "en", text: "Current IAM voice consent." },
  expiresAt: "2026-09-02T00:10:00Z"
};

describe("EnrollmentPage", () => {
  it("keeps enrollment controls and waveform without a transcript panel when disabled", () => {
    render(<EnrollmentPage attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false} transcriptionEnabled={false} onConsent={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Enroll voice" })).toBeTruthy();
    expect(screen.getByLabelText("Enrollment microphone waveform waiting for capture")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Live transcription" })).toBeNull();
    expect(screen.queryByText("SESSION TRANSCRIPT")).toBeNull();
  });

  it("shows current IAM consent before microphone controls", () => {
    render(<EnrollmentPage attempt={ATTEMPT} busy={false} onConsent={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByText("Current IAM voice consent.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enroll voice/ })).toBeNull();
    expect(screen.getByText(/Microphone access begins only/i)).toBeTruthy();
  });

  it("emits explicit accept or decline decisions", () => {
    const onConsent = jest.fn();
    render(<EnrollmentPage attempt={ATTEMPT} busy={false} onConsent={onConsent} onBack={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
    expect(onConsent).toHaveBeenCalledWith("ACCEPT");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onConsent).toHaveBeenCalledWith("DECLINE");
  });

  it("prevents acceptance when IAM consent text is empty", () => {
    render(<EnrollmentPage
      attempt={{ ...ATTEMPT, consent: { ...ATTEMPT.consent, text: "  " } }}
      busy={false}
      onConsent={jest.fn()}
      onBack={jest.fn()}
    />);
    expect(screen.getByRole("alert").textContent).toMatch(/Consent details are unavailable/i);
    expect((screen.getByRole("button", { name: "Accept and continue" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows one action after accepted local consent intent", () => {
    const onStart = jest.fn();
    render(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      onConsent={jest.fn()}
      onStart={onStart}
      onBack={jest.fn()}
    />);
    expect(screen.getByRole("heading", { name: "Ready when you are" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Read this text aloud" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How your voice is protected" })).toBeTruthy();
    expect(screen.getByText(/linked to your signed-in account/i)).toBeTruthy();
    expect(screen.getByText(/does not retain your raw voice recordings/i)).toBeTruthy();
    expect(screen.getByText(/not used for voice search, AI model training, granting access, or approving high-risk actions/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enroll voice" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("does not render a second enrollment action after capture starts", () => {
    render(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      microphone="READY"
      voiceState="RECORDING"
      onConsent={jest.fn()}
      onStart={jest.fn()}
      onBack={jest.fn()}
    />);
    expect(screen.queryByRole("button", { name: "Enroll voice" })).toBeNull();
    expect(screen.queryByRole("button", { name: /End recording/ })).toBeNull();
  });

  it("shows real-audio coaching without backend implementation details", () => {
    render(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      microphone="READY"
      voiceState="RECORDING"
      sentFrameCount={125}
      utteranceOrdinal={2}
      acceptedUtteranceCount={1}
      capturedSampleMs={2000}
      voiceActivity="SPEECH"
      waveform={[0.1, 0.7]}
      onConsent={jest.fn()}
      onBack={jest.fn()}
    />);
    expect(screen.getByText("Recording")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Voice enrollment progress" })
      .getAttribute("aria-valuenow")).toBe("20");
    expect(screen.getByText("Voice sample 2")).toBeTruthy();
    expect(screen.getByText(/2.0 of 10.0 seconds.*1 sample accepted/i)).toBeTruthy();
    expect(screen.getByText(/Keep reading naturally.*8.0 seconds remaining/i)).toBeTruthy();
    expect(screen.getByLabelText("Live enrollment microphone waveform")).toBeTruthy();
    expect(screen.getByText("Voice input detected")).toBeTruthy();
    expect(screen.queryByText(/ABIS|OCI Speech|WebSocket|Java backend/i)).toBeNull();
  });

  it("shows processing, success, and failure enrollment experiences", () => {
    const common = {
      attempt: { ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" as const },
      busy: false,
      onConsent: jest.fn(),
      onBack: jest.fn()
    };
    const { rerender } = render(<EnrollmentPage
      {...common}
      voiceState="PROCESSING"
      capturedSampleMs={8000}
    />);
    expect(screen.getByText("Processing voice samples")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");

    rerender(<EnrollmentPage {...common} voiceState="COMPLETED" capturedSampleMs={8000} />);
    expect(screen.getByText("Voice enrolled")).toBeTruthy();
    expect(screen.getByText("Your voice profile is ready for audit checks")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Continue to Voice Verification/ })).toBeTruthy();

    rerender(<EnrollmentPage {...common} voiceState="FAILED" capturedSampleMs={3500} />);
    expect(screen.getByText("Enrollment unsuccessful")).toBeTruthy();
    expect(screen.getByText("Select Enroll voice to try again")).toBeTruthy();
  });

  it("renders live transcription as read-only partial and final text", () => {
    const { rerender } = render(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      voiceState="RECORDING"
      transcriptState="PARTIAL"
      transcriptSegments={[{
        utteranceId: "one", revision: 1, text: "The speaker reports", final: false,
        startAudioSequence: 1, endAudioSequence: 20
      }]}
      onConsent={jest.fn()}
      onBack={jest.fn()}
    />);
    expect(screen.getByText("Transcribing live")).toBeTruthy();
    expect(screen.getByText("The speaker reports")).toBeTruthy();

    rerender(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      voiceState="PROCESSING"
      transcriptState="FINAL"
      transcriptSegments={[
        { utteranceId: "one", revision: 2, text: "The speaker reports fatigue.", final: true,
          startAudioSequence: 1, endAudioSequence: 20 },
        { utteranceId: "two", revision: 3, text: "I will continue speaking.", final: true,
          startAudioSequence: 21, endAudioSequence: 40 }
      ]}
      onConsent={jest.fn()}
      onBack={jest.fn()}
    />);
    expect(screen.getByText("Final transcript")).toBeTruthy();
    expect(screen.getByText("The speaker reports fatigue.")).toBeTruthy();
    expect(screen.getByText("I will continue speaking.")).toBeTruthy();
  });

  it("keeps each prompt stable within a sample and advances it for the next sample", () => {
    const common = {
      attempt: { ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" as const },
      busy: false, onConsent: jest.fn(), onBack: jest.fn()
    };
    const { container, rerender } = render(<EnrollmentPage {...common} voiceState="IDLE" />);
    const prompt = container.querySelector("blockquote")?.textContent;
    expect(screen.getByRole("heading", { name: "Read this text aloud" })).toBeTruthy();
    expect(screen.getByText(/Select Enroll voice, then speak clearly.*START to END/i)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Text to read aloud for voice enrollment" })).toBeTruthy();
    expect(screen.getByText("START")).toBeTruthy();
    expect(screen.getByText("END")).toBeTruthy();
    rerender(<EnrollmentPage {...common} voiceState="RECORDING" />);
    expect(container.querySelector("blockquote")?.textContent).toBe(prompt);
    expect(screen.getByRole("heading", { name: "Read the text below now" })).toBeTruthy();
    expect(screen.getByText(/Recording is active.*until enrollment starts processing/i)).toBeTruthy();
    expect(screen.getByText(/If you reach END before this sample finishes/i)).toBeTruthy();
    expect(screen.getByText(/YOUR READING SCRIPT.*SAMPLE 1/i)).toBeTruthy();

    rerender(<EnrollmentPage {...common} voiceState="RECORDING" utteranceOrdinal={2} />);
    expect(container.querySelector("blockquote")?.textContent).not.toBe(prompt);
    expect(screen.getByText(/YOUR READING SCRIPT.*SAMPLE 2/i)).toBeTruthy();
    expect(screen.getByText(/new reading script is ready for voice sample 2/i)).toBeTruthy();
  });

  it("shows a completed sample as non-terminal while another decision is pending", () => {
    render(<EnrollmentPage
      attempt={{ ...ATTEMPT, state: "CONSENT_ACCEPT_INTENT_RECORDED" }}
      busy={false}
      microphone="READY"
      voiceState="RECORDING"
      utteranceOrdinal={3}
      acceptedUtteranceCount={2}
      capturedSampleMs={10000}
      maximumSampleMs={10000} minimumSampleMs={7000}
      voiceActivity="SILENCE"
      onConsent={jest.fn()}
      onBack={jest.fn()}
    />);

    expect(screen.getByText("Voice sample 3 collected")).toBeTruthy();
    expect(screen.getAllByText(/checking if another sample is needed/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Recording")).toBeTruthy();
    expect(screen.queryByText("Processing voice samples")).toBeNull();
  });
});
