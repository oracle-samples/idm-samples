import { AuthenticationClient } from "./authentication";
import type { ApiClient, ApiResponse } from "./api-client";

const USER = {
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

const LOGIN_CONTEXT_TOKEN = "login-context-token-1234567890abcdef";

function apiWithResponses(...responses: ApiResponse<unknown>[]) {
  const request = jest.fn<Promise<ApiResponse<unknown>>, [string, RequestInit?]>();
  responses.forEach((response) => request.mockResolvedValueOnce(response));
  return {
    request,
    client: { request } as unknown as ApiClient
  };
}

describe("AuthenticationClient", () => {
  it("deletes voice enrollment once with no body and one confirmation-scoped idempotency key", async () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "22222222-2222-4222-8222-222222222222"
    });
    const api = apiWithResponses({
      value: {
        protocolVersion: "1.0",
        correlationId: "correlation-delete-1",
        outcome: "DELETED",
        enrollmentStatus: "NOT_ENROLLED",
        enrollmentStatusLookupState: "AVAILABLE",
        statusObservedAt: "2026-09-09T00:00:00Z",
        allowedActions: ["ENROLL", "SIGN_OUT"]
      }
    });
    const client = new AuthenticationClient(api.client);
    (client as unknown as { sessionCsrfToken: string }).sessionCsrfToken = "csrf-token";
    const deleteVoiceEnrollment = (client as unknown as {
      deleteVoiceEnrollment(idempotencyKey?: string): Promise<unknown>;
    }).deleteVoiceEnrollment;

    expect(typeof deleteVoiceEnrollment).toBe("function");
    await deleteVoiceEnrollment.call(client);

    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledWith("/api/v1/voice/enrollment", {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": "csrf-token",
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222"
      }
    });
    const [, init] = api.request.mock.calls[0]!;
    expect(init).not.toHaveProperty("body");
    expect(JSON.stringify(init)).not.toMatch(/userId|factorId/);
  });

  it("uses the exact same-origin login-context, credential, and current-user sequence", async () => {
    const api = apiWithResponses(
      {
        value: {
          protocolVersion: "1.0",
          loginContextToken: LOGIN_CONTEXT_TOKEN
        },
        csrfToken: LOGIN_CONTEXT_TOKEN
      },
      { value: undefined, csrfToken: "session-csrf-token" },
      { value: USER, csrfToken: "rotated-session-csrf-token" }
    );
    const client = new AuthenticationClient(api.client);

    await expect(client.signIn("user@example.test", "not-a-real-secret"))
      .resolves.toMatchObject({ username: "user@example.test" });

    expect(api.request).toHaveBeenCalledTimes(3);
    expect(api.request.mock.calls[0]).toEqual([
      "/api/v1/auth/login-context",
      { method: "GET" }
    ]);
    expect(api.request.mock.calls[1]).toEqual([
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": LOGIN_CONTEXT_TOKEN
        },
        body: JSON.stringify({
          username: "user@example.test",
          password: "not-a-real-secret"
        })
      }
    ]);
    expect(api.request.mock.calls[2]).toEqual(["/api/v1/me", { method: "GET" }]);
    for (const [path] of api.request.mock.calls) {
      expect(path).toMatch(/^\/api\/v1\//);
      expect(path).not.toContain("oauth2");
    }
  });

  it("does not submit credentials when the one-time context is missing", async () => {
    const api = apiWithResponses({
      value: {
        protocolVersion: "1.0",
        loginContextToken: LOGIN_CONTEXT_TOKEN
      }
    });
    const client = new AuthenticationClient(api.client);

    await expect(client.signIn("user@example.test", "not-a-real-secret"))
      .rejects.toMatchObject({ status: 502 });
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it("rejects a login context whose JSON token and response header do not match", async () => {
    const api = apiWithResponses({
      value: {
        protocolVersion: "1.0",
        loginContextToken: LOGIN_CONTEXT_TOKEN
      },
      csrfToken: "different-login-context-token-abcdef"
    });
    const client = new AuthenticationClient(api.client);

    await expect(client.signIn("user@example.test", "not-a-real-secret"))
      .rejects.toMatchObject({ status: 502 });
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it("refreshes only through the Java enrollment-status endpoint", async () => {
    const api = apiWithResponses({
      value: {
        correlationId: "correlation-2",
        status: "ENROLLED",
        observedAt: "2026-09-01T00:00:01Z",
        allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
      }
    });
    const client = new AuthenticationClient(api.client);

    const refreshed = await client.refreshEnrollmentStatus(USER as never);

    expect(refreshed.enrollmentStatus).toBe("ENROLLED");
    expect(refreshed.allowedActions).toEqual(["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]);
    expect(api.request).toHaveBeenCalledWith(
      "/api/v1/voice/enrollment-status",
      { method: "GET" }
    );
  });

  it("signs out only through the same-origin Java endpoint", async () => {
    const api = apiWithResponses({ value: undefined });
    const client = new AuthenticationClient(api.client);

    await client.signOut();

    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledWith(
      "/api/v1/auth/sign-out",
      { method: "POST" }
    );
  });

  it("creates a verification voice session without an enrollment attempt", async () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "11111111-1111-4111-8111-111111111111"
    });
    const api = apiWithResponses({
      value: {
        protocolVersion: "1.0", correlationId: "correlation-1234567890",
        voiceSessionId: "voice-session-1234567890", purpose: "VERIFICATION",
        state: "PREAUTHORIZED", websocketPath: "/ws/v1/voice",
        bindExpiresAt: "2026-09-04T00:00:05Z",
        audioProfile: {
          encoding: "PCM_SIGNED", sampleRateHz: 16000, channels: 1,
          sampleSizeBits: 16, byteOrder: "LITTLE_ENDIAN", nominalFrameMs: 20
        }
      }
    });
    const client = new AuthenticationClient(api.client);
    (client as unknown as { sessionCsrfToken: string }).sessionCsrfToken = "csrf-token";

    await client.createVerificationVoiceSession();

    const [, init] = api.request.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      purpose: "VERIFICATION"
    }));
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("enrollmentAttemptId");
  });
});
