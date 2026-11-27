import { ApiError } from "../services/api-client";
import type { AuthenticationClient } from "../services/authentication";
import { IdentityStore, type IdentitySnapshot } from "./identity-store";
import type { CurrentUser, VoiceUnenrollmentResponse } from "../types/application-contracts";

const NOT_ENROLLED: CurrentUser = {
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

const ENROLLED = {
  ...NOT_ENROLLED,
  enrollmentStatus: "ENROLLED",
  allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
} as CurrentUser;

function authentication(overrides: Partial<AuthenticationClient> = {}): AuthenticationClient {
  return {
    currentUser: jest.fn().mockResolvedValue(NOT_ENROLLED),
    signIn: jest.fn().mockResolvedValue(NOT_ENROLLED),
    refreshEnrollmentStatus: jest.fn().mockResolvedValue(NOT_ENROLLED),
    deleteVoiceEnrollment: jest.fn().mockResolvedValue(NOT_ENROLLED),
    signOut: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
    onSessionExpired: jest.fn().mockReturnValue(() => undefined),
    ...overrides
  } as unknown as AuthenticationClient;
}

describe("IdentityStore", () => {
  it("allows only one confirmed voice-unenrollment request and replaces actions after success", async () => {
    let resolveDelete: (response: VoiceUnenrollmentResponse) => void = () => undefined;
    const deleteVoiceEnrollment = jest.fn(() => new Promise<VoiceUnenrollmentResponse>((resolve) => {
      resolveDelete = resolve;
    }));
    const client = authentication({
      signIn: jest.fn().mockResolvedValue(ENROLLED),
      deleteVoiceEnrollment
    } as Partial<AuthenticationClient>);
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");
    const remove = (store as unknown as { deleteVoiceEnrollment(): Promise<void> })
      .deleteVoiceEnrollment;

    expect(typeof remove).toBe("function");
    const first = remove.call(store);
    await remove.call(store);
    expect(deleteVoiceEnrollment).toHaveBeenCalledTimes(1);

    resolveDelete({
      protocolVersion: "1.0",
      correlationId: "correlation-delete-1",
      outcome: "DELETED",
      enrollmentStatus: "NOT_ENROLLED",
      enrollmentStatusLookupState: "AVAILABLE",
      statusObservedAt: "2026-09-09T00:00:00Z",
      allowedActions: ["ENROLL", "SIGN_OUT"]
    });
    await first;
    expect(store.value).toMatchObject({
      phase: "AUTHENTICATED",
      busy: false,
      currentUser: {
        enrollmentStatus: "NOT_ENROLLED",
        allowedActions: ["ENROLL", "SIGN_OUT"]
      }
    });
  });

  it("expires the route when confirmed deletion returns 401", async () => {
    const client = authentication({
      signIn: jest.fn().mockResolvedValue(ENROLLED),
      deleteVoiceEnrollment: jest.fn().mockRejectedValue(new ApiError(401))
    } as Partial<AuthenticationClient>);
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");
    const remove = (store as unknown as { deleteVoiceEnrollment(): Promise<void> })
      .deleteVoiceEnrollment;

    expect(typeof remove).toBe("function");
    await remove.call(store);
    expect(store.value).toEqual({ phase: "ANONYMOUS", busy: false });
  });

  it("does not fabricate unenrolled state when deletion cannot be reconciled", async () => {
    const client = authentication({
      signIn: jest.fn().mockResolvedValue(ENROLLED),
      deleteVoiceEnrollment: jest.fn().mockRejectedValue(new ApiError(503))
    } as Partial<AuthenticationClient>);
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");
    const remove = (store as unknown as { deleteVoiceEnrollment(): Promise<void> })
      .deleteVoiceEnrollment;

    expect(typeof remove).toBe("function");
    await remove.call(store);
    expect(store.value).toMatchObject({
      phase: "AUTHENTICATED",
      busy: false,
      currentUser: { enrollmentStatus: "UNKNOWN", allowedActions: ["SIGN_OUT"] }
    });

    await store.retryStatus();
    expect(client.refreshEnrollmentStatus).toHaveBeenCalledTimes(1);
    expect(store.value).toMatchObject({
      currentUser: { enrollmentStatus: "NOT_ENROLLED", allowedActions: ["ENROLL", "SIGN_OUT"] }
    });
  });

  it("preserves enrolled state when IAM requires another verification factor", async () => {
    const client = authentication({
      signIn: jest.fn().mockResolvedValue(ENROLLED),
      deleteVoiceEnrollment: jest.fn().mockRejectedValue(new ApiError(409, {
        type: "urn:ai-world:problem:voice_unenrollment_requires_another_factor",
        title: "Request conflicts with current state",
        status: 409,
        code: "VOICE_UNENROLLMENT_REQUIRES_ANOTHER_FACTOR",
        stage: "IAM",
        failureKind: "STATE_CONFLICT",
        retryable: false,
        terminal: true,
        correlationId: "correlation-delete-2"
      }))
    } as Partial<AuthenticationClient>);
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");

    await store.deleteVoiceEnrollment();

    expect(store.value).toMatchObject({
      phase: "AUTHENTICATED",
      busy: false,
      currentUser: { enrollmentStatus: "ENROLLED" },
      message: "Add another 2-Step Verification method before deleting your voice enrollment."
    });
  });

  it("restores a valid opaque application session before exposing authenticated state", async () => {
    const client = authentication();
    const store = new IdentityStore(client);
    const snapshots: IdentitySnapshot[] = [];
    store.subscribe((snapshot) => snapshots.push(snapshot));

    await store.restore();

    expect(client.currentUser).toHaveBeenCalledTimes(1);
    expect(snapshots).toEqual([
      { phase: "CHECKING", busy: false },
      { phase: "CHECKING", busy: true },
      { phase: "AUTHENTICATED", currentUser: NOT_ENROLLED, busy: false }
    ]);
  });

  it("fails closed for a stale session and does not disclose an authentication detail", async () => {
    const client = authentication({
      currentUser: jest.fn().mockRejectedValue(new ApiError(401))
    });
    const store = new IdentityStore(client);

    await store.restore();

    expect(client.clear).toHaveBeenCalledTimes(1);
    expect(store.value).toEqual({ phase: "ANONYMOUS", busy: false, message: undefined });
  });

  it("projects a generic recovery message when session restoration is unavailable", async () => {
    const client = authentication({
      currentUser: jest.fn().mockRejectedValue(new ApiError(503))
    });
    const store = new IdentityStore(client);

    await store.restore();

    expect(store.value).toEqual({
      phase: "ANONYMOUS",
      busy: false,
      message: "Sign-in services are temporarily unavailable."
    });
  });

  it("does not duplicate an in-flight explicit sign-in", async () => {
    let resolveSignIn: (user: CurrentUser) => void = () => undefined;
    const signIn = jest.fn(() => new Promise<CurrentUser>((resolve) => {
      resolveSignIn = resolve;
    }));
    const store = new IdentityStore(authentication({ signIn }));

    const first = store.signIn("user@example.test", "first-secret");
    await store.signIn("user@example.test", "second-secret");

    expect(signIn).toHaveBeenCalledTimes(1);
    resolveSignIn(NOT_ENROLLED);
    await first;
    expect(store.value.phase).toBe("AUTHENTICATED");
  });

  it("shows actionable guidance when IDCS requires a password change", async () => {
    const signIn = jest.fn().mockRejectedValue(new ApiError(401, {
      type: "urn:ai-world:problem:password_change_required",
      title: "Password change required",
      status: 401,
      code: "PASSWORD_CHANGE_REQUIRED",
      stage: "AUTH",
      failureKind: "ACTION_REQUIRED",
      retryable: false,
      terminal: true,
      correlationId: "correlation-password-change"
    }));
    const store = new IdentityStore(authentication({ signIn }));

    await expect(store.signIn("user@example.test", "temporary-password"))
      .rejects.toBeInstanceOf(ApiError);

    expect(store.value).toEqual({
      phase: "ANONYMOUS",
      busy: false,
      message: "Your password must be changed before you can sign in. Change it through your organization's account page, then try again.",
      retryAfterSeconds: undefined
    });
    expect(store.value.message).not.toContain("temporary-password");
  });

  it("requires an explicit retry after throttling and preserves only safe guidance", async () => {
    const signIn = jest.fn()
      .mockRejectedValueOnce(new ApiError(429, undefined, 30))
      .mockResolvedValueOnce(NOT_ENROLLED);
    const store = new IdentityStore(authentication({ signIn }));

    await expect(store.signIn("user@example.test", "first-secret")).rejects.toBeInstanceOf(ApiError);
    expect(store.value).toEqual({
      phase: "ANONYMOUS",
      busy: false,
      message: "Too many sign-in attempts. Wait, then submit again.",
      retryAfterSeconds: 30
    });
    expect(signIn).toHaveBeenCalledTimes(1);

    await store.signIn("user@example.test", "second-secret");
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(store.value.phase).toBe("AUTHENTICATED");
  });

  it("removes both journey actions when an enrollment-status retry fails", async () => {
    const client = authentication({
      refreshEnrollmentStatus: jest.fn().mockRejectedValue(new ApiError(503))
    });
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");

    await store.retryStatus();

    expect(store.value).toMatchObject({
      phase: "AUTHENTICATED",
      busy: false,
      message: "Voice enrollment status is temporarily unavailable.",
      currentUser: {
        username: "user@example.test",
        enrollmentStatus: "UNKNOWN",
        enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
        allowedActions: ["SIGN_OUT"]
      }
    });
  });

  it("ends authenticated state when an enrollment-status retry reports an expired session", async () => {
    const client = authentication({
      refreshEnrollmentStatus: jest.fn().mockRejectedValue(new ApiError(401))
    });
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");

    await store.retryStatus();

    expect(client.clear).toHaveBeenCalled();
    expect(store.value).toEqual({ phase: "ANONYMOUS", busy: false });
  });

  it("replaces an unavailable projection with fresh authoritative status on retry", async () => {
    const unavailable: CurrentUser = {
      ...NOT_ENROLLED,
      enrollmentStatus: "UNKNOWN",
      enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
      statusObservedAt: undefined,
      allowedActions: ["SIGN_OUT"]
    };
    const enrolled: CurrentUser = {
      ...NOT_ENROLLED,
      correlationId: "correlation-2",
      enrollmentStatus: "ENROLLED",
      allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
    };
    const client = authentication({
      signIn: jest.fn().mockResolvedValue(unavailable),
      refreshEnrollmentStatus: jest.fn().mockResolvedValue(enrolled)
    });
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");

    await store.retryStatus();

    expect(store.value).toEqual({
      phase: "AUTHENTICATED",
      currentUser: enrolled,
      busy: false
    });
  });

  it("ends local authenticated state even when remote sign-out reports a failure", async () => {
    const client = authentication({
      signOut: jest.fn().mockRejectedValue(new ApiError(503))
    });
    const store = new IdentityStore(client);
    await store.signIn("user@example.test", "not-a-real-secret");

    await expect(store.signOut()).rejects.toBeInstanceOf(ApiError);
    expect(store.value).toEqual({ phase: "ANONYMOUS", busy: false });
  });
});
