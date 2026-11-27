import {
  mergeEnrollmentStatus,
  parseCurrentUser,
  parseSecureLoginContext,
  parseVoiceSession
} from "./application-contracts";
import * as Contracts from "./application-contracts";

const user = {
  protocolVersion: "1.0",
  correlationId: "correlation-1234567890",
  username: "user@example.test",
  enrollmentStatus: "NOT_ENROLLED",
  enrollmentStatusLookupState: "AVAILABLE",
  statusObservedAt: "2026-09-01T00:00:00Z",
  allowedActions: ["ENROLL", "SIGN_OUT"]
};

describe("application contract guards", () => {
  it("uses only a server boolean to enable transcription and defaults an absent capability off", () => {
    expect(parseCurrentUser(user).transcriptionEnabled).toBe(false);
    expect(parseCurrentUser({ ...user, transcriptionEnabled: false }).transcriptionEnabled).toBe(false);
    expect(parseCurrentUser({ ...user, transcriptionEnabled: true }).transcriptionEnabled).toBe(true);
    expect(() => parseCurrentUser({ ...user, transcriptionEnabled: "false" })).toThrow("Invalid transcription capability");
  });

  it("accepts Delete voice enrollment only for an authoritative enrolled user", () => {
    expect(parseCurrentUser({
      ...user,
      enrollmentStatus: "ENROLLED",
      allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
    })).toMatchObject({
      enrollmentStatus: "ENROLLED",
      allowedActions: ["VERIFY", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
    });

    expect(() => parseCurrentUser({
      ...user,
      allowedActions: ["ENROLL", "DELETE_VOICE_ENROLLMENT", "SIGN_OUT"]
    })).toThrow("Unsafe enrollment action projection");
  });

  it("parses only authoritative identifier-free unenrollment outcomes", () => {
    const parse = (Contracts as unknown as {
      parseVoiceUnenrollmentResponse(value: unknown): unknown;
    }).parseVoiceUnenrollmentResponse;
    expect(typeof parse).toBe("function");

    const response = {
      protocolVersion: "1.0",
      correlationId: "correlation-delete-1",
      outcome: "DELETED",
      enrollmentStatus: "NOT_ENROLLED",
      enrollmentStatusLookupState: "AVAILABLE",
      statusObservedAt: "2026-09-09T00:00:00Z",
      allowedActions: ["ENROLL", "SIGN_OUT"]
    };
    expect(parse(response)).toEqual(response);
    expect(parse({ ...response, outcome: "ALREADY_NOT_ENROLLED" }))
      .toEqual({ ...response, outcome: "ALREADY_NOT_ENROLLED" });
    expect(() => parse({ ...response, factorId: "provider-factor" }))
      .toThrow("Invalid voice-unenrollment response");
    expect(() => parse({ ...response, enrollmentStatus: "ENROLLED" }))
      .toThrow("Invalid voice-unenrollment response");
  });

  it("accepts only the reviewed secure-profile login-context projection", () => {
    expect(parseSecureLoginContext({
      protocolVersion: "1.0",
      loginContextToken: "login-context-token-1234567890abcdef"
    })).toEqual({
      protocolVersion: "1.0",
      loginContextToken: "login-context-token-1234567890abcdef"
    });

    expect(() => parseSecureLoginContext({
      protocolVersion: "1.0",
      loginContextToken: "too-short"
    })).toThrow("Invalid secure login-context response");
    expect(() => parseSecureLoginContext({
      protocolVersion: "1.0",
      loginContextToken: "login-context-token-1234567890abcdef",
      passwordEnvelope: {}
    })).toThrow("Invalid secure login-context response");
  });

  it("rejects an unsafe action/status projection", () => {
    expect(() => parseCurrentUser({ ...user, allowedActions: ["VERIFY", "SIGN_OUT"] }))
      .toThrow("Unsafe enrollment action projection");
  });

  it("accepts only authoritative status refresh values", () => {
    const current = parseCurrentUser(user);
    expect(() => mergeEnrollmentStatus(current, {
      correlationId: "correlation-2",
      status: "UNKNOWN",
      observedAt: "2026-09-01T00:00:01Z",
      allowedActions: ["SIGN_OUT"]
    })).toThrow("Invalid enrollment-status response");
  });

  it("rejects extra, prohibited, or duplicate refresh actions", () => {
    const current = parseCurrentUser(user);
    const response = {
      correlationId: "correlation-2",
      status: "ENROLLED",
      observedAt: "2026-09-01T00:00:01Z"
    };
    expect(() => mergeEnrollmentStatus(current, {
      ...response,
      allowedActions: ["VERIFY", "ENROLL", "SIGN_OUT"]
    })).toThrow("Unsafe enrollment action projection");
    expect(() => mergeEnrollmentStatus(current, {
      ...response,
      allowedActions: ["VERIFY", "SIGN_OUT", "SIGN_OUT"]
    })).toThrow("Invalid enrollment-status response");
  });

  it("accepts both enrollment and verification preauthorized voice sessions", () => {
    const response = {
      protocolVersion: "1.0", correlationId: "correlation-1234567890",
      voiceSessionId: "voice-session-1234567890", state: "PREAUTHORIZED",
      websocketPath: "/ws/v1/voice", bindExpiresAt: "2026-09-04T00:00:05Z",
      audioProfile: {
        encoding: "PCM_SIGNED", sampleRateHz: 16000, channels: 1,
        sampleSizeBits: 16, byteOrder: "LITTLE_ENDIAN", nominalFrameMs: 20
      }
    };
    expect(parseVoiceSession({ ...response, purpose: "ENROLLMENT" }).purpose).toBe("ENROLLMENT");
    expect(parseVoiceSession({ ...response, purpose: "VERIFICATION" }).purpose).toBe("VERIFICATION");
  });
});
