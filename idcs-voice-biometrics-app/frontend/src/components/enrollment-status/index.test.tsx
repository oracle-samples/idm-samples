import { fireEvent, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { EnrollmentStatusCard } from "./index";
import type { CurrentUser } from "../../types/application-contracts";

const ENROLLED = {
  protocolVersion: "1.0",
  correlationId: "correlation-1",
  username: "user@example.test",
  enrollmentStatus: "ENROLLED",
  enrollmentStatusLookupState: "AVAILABLE",
  statusObservedAt: "2026-09-09T00:00:00Z",
  allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
} as CurrentUser;

describe("EnrollmentStatusCard voice unenrollment action", () => {
  it("keeps audit check primary and exposes deletion only as a secondary enrolled action", () => {
    const onDeleteVoiceEnrollment = jest.fn();
    render(h(EnrollmentStatusCard as never, {
      currentUser: ENROLLED,
      busy: false,
      onRetry: jest.fn(),
      onJourneyAction: jest.fn(),
      onDeleteVoiceEnrollment
    }));

    const verify = screen.getByRole("button", { name: /Voice Verification/i });
    const remove = screen.getByRole("button", { name: /Delete voice enrollment/i });
    expect(verify.className).toContain("primary-button");
    expect(remove.className).not.toContain("primary-button");
    fireEvent.click(remove);
    expect(onDeleteVoiceEnrollment).toHaveBeenCalledTimes(1);
  });

  it("does not expose deletion for not-enrolled or unavailable state", () => {
    const { rerender } = render(h(EnrollmentStatusCard as never, {
      currentUser: {
        ...ENROLLED,
        enrollmentStatus: "NOT_ENROLLED",
        allowedActions: ["ENROLL", "SIGN_OUT"]
      },
      busy: false,
      onRetry: jest.fn(),
      onJourneyAction: jest.fn(),
      onDeleteVoiceEnrollment: jest.fn()
    }));
    expect(screen.queryByRole("button", { name: /Delete voice enrollment/i })).toBeNull();

    rerender(h(EnrollmentStatusCard as never, {
      currentUser: {
        ...ENROLLED,
        enrollmentStatus: "UNKNOWN",
        enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
        statusObservedAt: undefined,
        allowedActions: ["SIGN_OUT"]
      },
      busy: false,
      onRetry: jest.fn(),
      onJourneyAction: jest.fn(),
      onDeleteVoiceEnrollment: jest.fn()
    }));
    expect(screen.queryByRole("button", { name: /Delete voice enrollment/i })).toBeNull();
  });
});
