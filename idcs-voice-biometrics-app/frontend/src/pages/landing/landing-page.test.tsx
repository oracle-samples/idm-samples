import { fireEvent, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { LandingPage } from "./landing-page";
import type { CurrentUser } from "../../types/application-contracts";

const BASE: CurrentUser = {
  protocolVersion: "1.0",
  correlationId: "correlation-1234567890",
  username: "user@example.test",
  displayName: "Alex Morgan",
  organization: "Demo Organization",
  enrollmentStatus: "NOT_ENROLLED",
  enrollmentStatusLookupState: "AVAILABLE",
  statusObservedAt: "2026-09-01T00:00:00Z",
  allowedActions: ["ENROLL", "SIGN_OUT"]
};

function renderPage(currentUser: CurrentUser) {
  const onJourneyAction = jest.fn();
  const onRetryStatus = jest.fn();
  render(
    <LandingPage
      currentUser={currentUser}
      busy={false}
      onJourneyAction={onJourneyAction}
      onRetryStatus={onRetryStatus}
      onDeleteVoiceEnrollment={jest.fn()}
    />
  );
  return { onJourneyAction, onRetryStatus };
}

describe("LandingPage", () => {
  it("shows only Enroll for an authoritative not-enrolled user", () => {
    const { onJourneyAction } = renderPage(BASE);
    expect(screen.getByText("user@example.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Enroll voice/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Voice Verification/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enroll voice/ }));
    expect(onJourneyAction).toHaveBeenCalledWith("ENROLL");
  });

  it("shows only Verify for an authoritative enrolled user", () => {
    const enrolled: CurrentUser = {
      ...BASE,
      enrollmentStatus: "ENROLLED",
      allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
    };
    const { onJourneyAction } = renderPage(enrolled);
    expect(screen.getByRole("button", { name: /Voice Verification/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enroll voice/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voice Verification/ }));
    expect(onJourneyAction).toHaveBeenCalledWith("VERIFY");
  });

  it("shows Retry and no journey action when status is unavailable", () => {
    const unavailable: CurrentUser = {
      ...BASE,
      enrollmentStatus: "UNKNOWN",
      enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
      statusObservedAt: undefined,
      allowedActions: ["SIGN_OUT"]
    };
    const { onRetryStatus } = renderPage(unavailable);
    expect(screen.queryByRole("button", { name: /Enroll voice/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Voice Verification/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry status" }));
    expect(onRetryStatus).toHaveBeenCalledTimes(1);
  });

  it("disables the allowed journey action while identity state is being refreshed", () => {
    const onJourneyAction = jest.fn();
    render(
      <LandingPage
        currentUser={BASE}
        busy={true}
        onJourneyAction={onJourneyAction}
        onRetryStatus={jest.fn()}
        onDeleteVoiceEnrollment={jest.fn()}
      />
    );

    const enroll = screen.getByRole("button", { name: /Enroll voice/ }) as HTMLButtonElement;
    expect(enroll.disabled).toBe(true);
    fireEvent.click(enroll);
    expect(onJourneyAction).not.toHaveBeenCalled();
  });

  it("announces a status lookup failure and disables retry while it is in flight", () => {
    const unavailable: CurrentUser = {
      ...BASE,
      enrollmentStatus: "UNKNOWN",
      enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
      statusObservedAt: undefined,
      allowedActions: ["SIGN_OUT"]
    };
    render(
      <LandingPage
        currentUser={unavailable}
        busy={true}
        message="Voice enrollment status is temporarily unavailable."
        onJourneyAction={jest.fn()}
        onRetryStatus={jest.fn()}
        onDeleteVoiceEnrollment={jest.fn()}
      />
    );

    expect(screen.getByRole("status").textContent).toContain("temporarily unavailable");
    expect((screen.getByRole("button", { name: "Checking…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
