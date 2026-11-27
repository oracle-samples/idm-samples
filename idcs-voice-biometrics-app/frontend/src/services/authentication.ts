import { ApiClient, ApiError } from "./api-client";
import {
  mergeEnrollmentStatus,
  parseCurrentUser,
  parseEnrollmentAttempt,
  parseVoiceSession,
  parseSecureLoginContext,
  parseVoiceUnenrollmentResponse,
  type CurrentUser,
  type EnrollmentAttempt,
  type VoiceSession,
  type VoiceUnenrollmentResponse,
  CANONICAL_AUDIO_PROFILE
} from "../types/application-contracts";

export class AuthenticationClient {
  private sessionCsrfToken?: string;
  private readonly api: ApiClient;
  private readonly sessionExpiredListeners = new Set<() => void>();

  constructor(api?: ApiClient) {
    this.api = api ?? new ApiClient(() => this.expireSession());
  }

  onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.add(listener);
    return () => this.sessionExpiredListeners.delete(listener);
  }

  async signIn(username: string, password: string): Promise<CurrentUser> {
    let loginContext: string | undefined;
    try {
      const response = await this.api.request<unknown>("/api/v1/auth/login-context", {
        method: "GET"
      });
      const context = parseSecureLoginContext(response.value);
      loginContext = context.loginContextToken;
      if (!response.csrfToken || response.csrfToken !== loginContext) {
        throw new ApiError(502);
      }
      const login = await this.api.request<void>("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": loginContext
        },
        body: JSON.stringify({ username, password })
      });
      this.sessionCsrfToken = login.csrfToken;
      return await this.currentUser();
    } finally {
      loginContext = undefined;
      username = "";
      password = "";
    }
  }

  async currentUser(): Promise<CurrentUser> {
    const response = await this.api.request<unknown>("/api/v1/me", { method: "GET" });
    if (!response.csrfToken) {
      throw new ApiError(502);
    }
    this.sessionCsrfToken = response.csrfToken;
    return parseCurrentUser(response.value);
  }

  async refreshEnrollmentStatus(current: CurrentUser): Promise<CurrentUser> {
    const response = await this.api.request<unknown>("/api/v1/voice/enrollment-status", {
      method: "GET"
    });
    return mergeEnrollmentStatus(current, response.value);
  }

  async beginEnrollment(): Promise<EnrollmentAttempt> {
    const response = await this.api.request<unknown>("/api/v1/voice/enrollment-attempt", {
      method: "POST",
      headers: this.mutationHeaders(),
      body: JSON.stringify({ factor: "VOICE", locale: "en" })
    });
    return parseEnrollmentAttempt(response.value);
  }

  async recordEnrollmentConsent(
    attempt: EnrollmentAttempt,
    decision: "ACCEPT" | "DECLINE"
  ): Promise<EnrollmentAttempt> {
    const response = await this.api.request<unknown>("/api/v1/voice/enrollment-attempt/consent", {
      method: "PUT",
      headers: this.mutationHeaders(),
      body: JSON.stringify({
        enrollmentAttemptId: attempt.enrollmentAttemptId,
        decision,
        consentVersion: attempt.consent.version
      })
    });
    return parseEnrollmentAttempt(response.value);
  }

  async createEnrollmentVoiceSession(attempt: EnrollmentAttempt): Promise<VoiceSession> {
    const response = await this.api.request<unknown>("/api/v1/voice-session", {
      method: "POST",
      headers: this.mutationHeaders(),
      body: JSON.stringify({
        purpose: "ENROLLMENT",
        enrollmentAttemptId: attempt.enrollmentAttemptId,
        capturePreflight: {
          originMicrophoneCapable: true,
          microphonePermission: "GRANTED",
          audioProfileSupported: true
        },
        audioProfile: CANONICAL_AUDIO_PROFILE
      })
    });
    return parseVoiceSession(response.value);
  }

  async createVerificationVoiceSession(): Promise<VoiceSession> {
    const response = await this.api.request<unknown>("/api/v1/voice-session", {
      method: "POST",
      headers: this.mutationHeaders(),
      body: JSON.stringify({
        purpose: "VERIFICATION",
        capturePreflight: {
          originMicrophoneCapable: true,
          microphonePermission: "GRANTED",
          audioProfileSupported: true
        },
        audioProfile: CANONICAL_AUDIO_PROFILE
      })
    });
    return parseVoiceSession(response.value);
  }

  async deleteVoiceEnrollment(idempotencyKey = crypto.randomUUID()): Promise<VoiceUnenrollmentResponse> {
    if (!this.sessionCsrfToken) throw new ApiError(401);
    const response = await this.api.request<unknown>("/api/v1/voice/enrollment", {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": this.sessionCsrfToken,
        "Idempotency-Key": idempotencyKey
      }
    });
    return parseVoiceUnenrollmentResponse(response.value);
  }

  async signOut(): Promise<void> {
    try {
      await this.api.request<void>("/api/v1/auth/sign-out", { method: "POST" });
    } finally {
      this.sessionCsrfToken = undefined;
    }
  }

  clear(): void {
    this.sessionCsrfToken = undefined;
  }

  private expireSession(): void {
    this.clear();
    this.sessionExpiredListeners.forEach((listener) => listener());
  }

  private mutationHeaders(): Record<string, string> {
    if (!this.sessionCsrfToken) throw new ApiError(401);
    return {
      "Content-Type": "application/json",
      "X-CSRF-Token": this.sessionCsrfToken,
      "Idempotency-Key": crypto.randomUUID()
    };
  }
}
