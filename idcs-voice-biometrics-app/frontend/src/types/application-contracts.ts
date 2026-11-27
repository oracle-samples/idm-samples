export type EnrollmentStatus = "UNKNOWN" | "NOT_ENROLLED" | "ENROLLED";

export type EnrollmentStatusLookupState =
  | "AVAILABLE"
  | "TEMPORARILY_UNAVAILABLE";

export type AllowedAction =
  | "ENROLL"
  | "VERIFY"
  | "DELETE_VOICE_ENROLLMENT"
  | "SIGN_OUT";

export interface SecureLoginContext {
  readonly protocolVersion: "1.0";
  readonly loginContextToken: string;
}

export interface CurrentUser {
  readonly protocolVersion: "1.0";
  readonly correlationId: string;
  readonly username: string;
  readonly displayName?: string;
  readonly organization?: string;
  readonly enrollmentStatus: EnrollmentStatus;
  readonly enrollmentStatusLookupState: EnrollmentStatusLookupState;
  readonly statusObservedAt?: string;
  readonly allowedActions: readonly AllowedAction[];
}

export interface EnrollmentStatusResponse {
  readonly correlationId: string;
  readonly status: Exclude<EnrollmentStatus, "UNKNOWN">;
  readonly observedAt: string;
  readonly allowedActions: readonly AllowedAction[];
}

export interface VoiceUnenrollmentResponse {
  readonly protocolVersion: "1.0";
  readonly correlationId: string;
  readonly outcome: "DELETED" | "ALREADY_NOT_ENROLLED";
  readonly enrollmentStatus: "NOT_ENROLLED";
  readonly enrollmentStatusLookupState: "AVAILABLE";
  readonly statusObservedAt: string;
  readonly allowedActions: readonly ["ENROLL", "SIGN_OUT"];
}

export type EnrollmentAttemptState =
  | "CONSENT_PENDING"
  | "CONSENT_ACCEPT_INTENT_RECORDED"
  | "CONSENT_DECLINED";

export interface ConsentText {
  readonly version: string;
  readonly locale: string;
  readonly text: string;
}

export interface EnrollmentAttempt {
  readonly enrollmentAttemptId: string;
  readonly correlationId: string;
  readonly state: EnrollmentAttemptState;
  readonly consent: ConsentText;
  readonly expiresAt: string;
}

export interface AudioProfile {
  readonly encoding: "PCM_SIGNED";
  readonly sampleRateHz: 16000;
  readonly channels: 1;
  readonly sampleSizeBits: 16;
  readonly byteOrder: "LITTLE_ENDIAN";
  readonly nominalFrameMs: 20;
}

export interface VoiceSession {
  readonly protocolVersion: "1.0";
  readonly correlationId: string;
  readonly voiceSessionId: string;
  readonly purpose: "ENROLLMENT" | "VERIFICATION";
  readonly state: "PREAUTHORIZED";
  readonly websocketPath: "/ws/v1/voice";
  readonly bindExpiresAt: string;
  readonly audioProfile: AudioProfile;
}

export const CANONICAL_AUDIO_PROFILE: AudioProfile = {
  encoding: "PCM_SIGNED",
  sampleRateHz: 16000,
  channels: 1,
  sampleSizeBits: 16,
  byteOrder: "LITTLE_ENDIAN",
  nominalFrameMs: 20
};

export interface ApplicationProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code?: string;
  readonly stage?: string;
  readonly failureKind?: string;
  readonly retryable?: boolean;
  readonly terminal?: boolean;
  readonly detail?: string;
  readonly instance?: string;
  readonly correlationId?: string;
  readonly safeCode?: string;
  readonly retryAfterSeconds?: number;
}

const ACTIONS = new Set<AllowedAction>([
  "ENROLL",
  "VERIFY",
  "DELETE_VOICE_ENROLLMENT",
  "SIGN_OUT"
]);

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseSecureLoginContext(value: unknown): SecureLoginContext {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid secure login-context response");
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const token = candidate.loginContextToken;
  if (
    keys.length !== 2 ||
    !keys.includes("protocolVersion") ||
    !keys.includes("loginContextToken") ||
    candidate.protocolVersion !== "1.0" ||
    typeof token !== "string" ||
    token.length < 32 ||
    token.length > 512 ||
    !/^[A-Za-z0-9._~-]+$/.test(token)
  ) {
    throw new TypeError("Invalid secure login-context response");
  }
  return { protocolVersion: "1.0", loginContextToken: token };
}

function actions(value: unknown): readonly AllowedAction[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => ACTIONS.has(item as AllowedAction))) {
    return undefined;
  }
  const unique = new Set(value as AllowedAction[]);
  return unique.size === value.length ? [...unique] : undefined;
}

export function parseCurrentUser(value: unknown): CurrentUser {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Invalid current-user response");
  }
  const candidate = value as Record<string, unknown>;
  const allowedActions = actions(candidate.allowedActions);
  const status = candidate.enrollmentStatus;
  const lookup = candidate.enrollmentStatusLookupState;
  if (
    candidate.protocolVersion !== "1.0" ||
    !isString(candidate.correlationId) ||
    !isString(candidate.username) ||
    !allowedActions ||
    !["UNKNOWN", "NOT_ENROLLED", "ENROLLED"].includes(String(status)) ||
    !["AVAILABLE", "TEMPORARILY_UNAVAILABLE"].includes(String(lookup))
  ) {
    throw new TypeError("Invalid current-user response");
  }
  if (
    lookup === "TEMPORARILY_UNAVAILABLE" &&
    (status !== "UNKNOWN" || allowedActions.length !== 1 || allowedActions[0] !== "SIGN_OUT")
  ) {
    throw new TypeError("Unsafe enrollment-status projection");
  }
  if (lookup === "AVAILABLE" && !["NOT_ENROLLED", "ENROLLED"].includes(String(status))) {
    throw new TypeError("Invalid authoritative enrollment status");
  }
  if (lookup === "AVAILABLE") {
    const valid = status === "ENROLLED"
      ? allowedActions.length === 3 &&
        allowedActions.includes("VERIFY") &&
        allowedActions.includes("DELETE_VOICE_ENROLLMENT") &&
        allowedActions.includes("SIGN_OUT") &&
        !allowedActions.includes("ENROLL")
      : allowedActions.length === 2 &&
        allowedActions.includes("ENROLL") &&
        allowedActions.includes("SIGN_OUT") &&
        !allowedActions.includes("VERIFY") &&
        !allowedActions.includes("DELETE_VOICE_ENROLLMENT");
    if (!valid) {
      throw new TypeError("Unsafe enrollment action projection");
    }
  }
  return {
    protocolVersion: "1.0",
    correlationId: candidate.correlationId,
    username: candidate.username,
    displayName: typeof candidate.displayName === "string" ? candidate.displayName : undefined,
    organization: typeof candidate.organization === "string" ? candidate.organization : undefined,
    enrollmentStatus: status as EnrollmentStatus,
    enrollmentStatusLookupState: lookup as EnrollmentStatusLookupState,
    statusObservedAt:
      typeof candidate.statusObservedAt === "string" ? candidate.statusObservedAt : undefined,
    allowedActions
  };
}

export function mergeEnrollmentStatus(
  current: CurrentUser,
  value: unknown
): CurrentUser {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Invalid enrollment-status response");
  }
  const candidate = value as Record<string, unknown>;
  const allowedActions = actions(candidate.allowedActions);
  if (
    !isString(candidate.correlationId) ||
    !isString(candidate.observedAt) ||
    !allowedActions ||
    !["NOT_ENROLLED", "ENROLLED"].includes(String(candidate.status))
  ) {
    throw new TypeError("Invalid enrollment-status response");
  }
  const valid = candidate.status === "ENROLLED"
    ? allowedActions.length === 3 &&
      allowedActions.includes("VERIFY") &&
      allowedActions.includes("DELETE_VOICE_ENROLLMENT") &&
      allowedActions.includes("SIGN_OUT") &&
      !allowedActions.includes("ENROLL")
    : allowedActions.length === 2 &&
      allowedActions.includes("ENROLL") &&
      allowedActions.includes("SIGN_OUT") &&
      !allowedActions.includes("VERIFY") &&
      !allowedActions.includes("DELETE_VOICE_ENROLLMENT");
  if (!valid) {
    throw new TypeError("Unsafe enrollment action projection");
  }
  return {
    ...current,
    correlationId: candidate.correlationId,
    enrollmentStatus: candidate.status as "NOT_ENROLLED" | "ENROLLED",
    enrollmentStatusLookupState: "AVAILABLE",
    statusObservedAt: candidate.observedAt,
    allowedActions
  };
}

export function parseVoiceUnenrollmentResponse(value: unknown): VoiceUnenrollmentResponse {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid voice-unenrollment response");
  }
  const candidate = value as Record<string, unknown>;
  const expectedKeys = new Set([
    "protocolVersion",
    "correlationId",
    "outcome",
    "enrollmentStatus",
    "enrollmentStatusLookupState",
    "statusObservedAt",
    "allowedActions"
  ]);
  const allowedActions = actions(candidate.allowedActions);
  if (
    Object.keys(candidate).length !== expectedKeys.size ||
    Object.keys(candidate).some((key) => !expectedKeys.has(key)) ||
    candidate.protocolVersion !== "1.0" ||
    !isString(candidate.correlationId) ||
    !["DELETED", "ALREADY_NOT_ENROLLED"].includes(String(candidate.outcome)) ||
    candidate.enrollmentStatus !== "NOT_ENROLLED" ||
    candidate.enrollmentStatusLookupState !== "AVAILABLE" ||
    !isString(candidate.statusObservedAt) ||
    !allowedActions ||
    allowedActions.length !== 2 ||
    !allowedActions.includes("ENROLL") ||
    !allowedActions.includes("SIGN_OUT")
  ) {
    throw new TypeError("Invalid voice-unenrollment response");
  }
  return {
    protocolVersion: "1.0",
    correlationId: candidate.correlationId,
    outcome: candidate.outcome as "DELETED" | "ALREADY_NOT_ENROLLED",
    enrollmentStatus: "NOT_ENROLLED",
    enrollmentStatusLookupState: "AVAILABLE",
    statusObservedAt: candidate.statusObservedAt,
    allowedActions: ["ENROLL", "SIGN_OUT"]
  };
}

export function mergeVoiceUnenrollment(
  current: CurrentUser,
  response: VoiceUnenrollmentResponse
): CurrentUser {
  return {
    ...current,
    correlationId: response.correlationId,
    enrollmentStatus: response.enrollmentStatus,
    enrollmentStatusLookupState: response.enrollmentStatusLookupState,
    statusObservedAt: response.statusObservedAt,
    allowedActions: response.allowedActions
  };
}

export function parseEnrollmentAttempt(value: unknown): EnrollmentAttempt {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid enrollment-attempt response");
  }
  const candidate = value as Record<string, unknown>;
  const consent = candidate.consent;
  if (
    !isString(candidate.enrollmentAttemptId) ||
    !isString(candidate.correlationId) ||
    !["CONSENT_PENDING", "CONSENT_ACCEPT_INTENT_RECORDED", "CONSENT_DECLINED"].includes(String(candidate.state)) ||
    !isString(candidate.expiresAt) ||
    consent === null || typeof consent !== "object" || Array.isArray(consent)
  ) {
    throw new TypeError("Invalid enrollment-attempt response");
  }
  const current = consent as Record<string, unknown>;
  if (!isString(current.version) || !isString(current.locale) || !isString(current.text)) {
    throw new TypeError("Invalid enrollment consent response");
  }
  return {
    enrollmentAttemptId: candidate.enrollmentAttemptId,
    correlationId: candidate.correlationId,
    state: candidate.state as EnrollmentAttemptState,
    consent: { version: current.version, locale: current.locale, text: current.text },
    expiresAt: candidate.expiresAt
  };
}

export function parseVoiceSession(value: unknown): VoiceSession {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid voice-session response");
  }
  const candidate = value as Record<string, unknown>;
  const profile = candidate.audioProfile as Record<string, unknown> | undefined;
  if (
    candidate.protocolVersion !== "1.0" || !isString(candidate.correlationId) ||
    !isString(candidate.voiceSessionId) ||
    !["ENROLLMENT", "VERIFICATION"].includes(String(candidate.purpose)) ||
    candidate.state !== "PREAUTHORIZED" || candidate.websocketPath !== "/ws/v1/voice" ||
    !isString(candidate.bindExpiresAt) || !profile ||
    profile.encoding !== "PCM_SIGNED" || profile.sampleRateHz !== 16000 ||
    profile.channels !== 1 || profile.sampleSizeBits !== 16 ||
    profile.byteOrder !== "LITTLE_ENDIAN" || profile.nominalFrameMs !== 20
  ) {
    throw new TypeError("Invalid voice-session response");
  }
  return {
    protocolVersion: "1.0",
    correlationId: candidate.correlationId,
    voiceSessionId: candidate.voiceSessionId,
    purpose: candidate.purpose as "ENROLLMENT" | "VERIFICATION",
    state: "PREAUTHORIZED",
    websocketPath: "/ws/v1/voice",
    bindExpiresAt: candidate.bindExpiresAt,
    audioProfile: CANONICAL_AUDIO_PROFILE
  };
}
