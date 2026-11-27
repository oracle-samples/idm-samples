import { fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { h } from "preact";
import { AppShell } from "./index";
import type { CurrentUser } from "../../types/application-contracts";

const USER: CurrentUser = {
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

describe("AppShell", () => {
  it("does not expose sign-out for an anonymous route", () => {
    render(<AppShell><h1>Sign in</h1></AppShell>);

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByText("Non-production demo")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Voice identity journey" })).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("moves focus to the main landmark when the skip link is activated", () => {
    render(<AppShell><h1>Page content</h1></AppShell>);

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("exposes sign-out only for an authenticated user and supports keyboard activation", async () => {
    const user = userEvent.setup();
    const onSignOut = jest.fn();
    render(
      <AppShell currentUser={USER} onSignOut={onSignOut} signOutBusy={false}>
        <h1>Landing</h1>
      </AppShell>
    );

    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(screen.queryByRole("note")).toBeNull();
    signOut.focus();
    await user.keyboard("{Enter}");
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate sign-out while the request is active", () => {
    const onSignOut = jest.fn();
    render(
      <AppShell currentUser={USER} onSignOut={onSignOut} signOutBusy={true}>
        <h1>Landing</h1>
      </AppShell>
    );

    const signOut = screen.getByRole("button", { name: "Sign out" }) as HTMLButtonElement;
    expect(signOut.disabled).toBe(true);
    fireEvent.click(signOut);
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
