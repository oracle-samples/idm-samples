import { ApiError } from "../services/api-client";
import { AuthenticationClient } from "../services/authentication";
import {
  mergeVoiceUnenrollment,
  type CurrentUser,
  type VoiceUnenrollmentResponse
} from "../types/application-contracts";

export type IdentityPhase = "CHECKING" | "ANONYMOUS" | "AUTHENTICATED";

export interface IdentitySnapshot {
  readonly phase: IdentityPhase;
  readonly currentUser?: CurrentUser;
  readonly busy: boolean;
  readonly message?: string;
  readonly retryAfterSeconds?: number;
}

type Listener = (snapshot: IdentitySnapshot) => void;

export class IdentityStore {
  private snapshot: IdentitySnapshot = { phase: "CHECKING", busy: false };
  private readonly listeners = new Set<Listener>();
  private readonly authentication: AuthenticationClient;

  constructor(authentication = new AuthenticationClient()) {
    this.authentication = authentication;
    this.authentication.onSessionExpired(() => this.expireSession());
  }

  get value(): IdentitySnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async restore(): Promise<void> {
    this.set({ phase: "CHECKING", busy: true });
    try {
      const currentUser = await this.authentication.currentUser();
      this.set({ phase: "AUTHENTICATED", currentUser, busy: false });
    } catch (error) {
      this.authentication.clear();
      this.set({
        phase: "ANONYMOUS",
        busy: false,
        message: error instanceof ApiError && error.status !== 401
          ? "Sign-in services are temporarily unavailable."
          : undefined
      });
    }
  }

  async signIn(username: string, password: string): Promise<void> {
    if (this.snapshot.busy) return;
    this.set({ phase: "ANONYMOUS", busy: true });
    try {
      const currentUser = await this.authentication.signIn(username, password);
      this.set({ phase: "AUTHENTICATED", currentUser, busy: false });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : undefined;
      const passwordChangeRequired = apiError?.problem?.code === "PASSWORD_CHANGE_REQUIRED";
      this.set({
        phase: "ANONYMOUS",
        busy: false,
        message: apiError?.status === 429
          ? "Too many sign-in attempts. Wait, then submit again."
          : passwordChangeRequired
            ? "Your password must be changed before you can sign in. Change it through your organization's account page, then try again."
          : "Sign-in was not successful. Check your credentials or contact your administrator.",
        retryAfterSeconds: apiError?.retryAfterSeconds
      });
      throw error;
    }
  }

  async retryStatus(): Promise<void> {
    const currentUser = this.snapshot.currentUser;
    if (this.snapshot.busy || !currentUser) return;
    this.set({ ...this.snapshot, busy: true, message: undefined });
    try {
      const refreshed = await this.authentication.refreshEnrollmentStatus(currentUser);
      this.set({ phase: "AUTHENTICATED", currentUser: refreshed, busy: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.expireSession();
        return;
      }
      this.set({
        phase: "AUTHENTICATED",
        currentUser: {
          ...currentUser,
          enrollmentStatus: "UNKNOWN",
          enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
          statusObservedAt: undefined,
          allowedActions: ["SIGN_OUT"]
        },
        busy: false,
        message: "Voice enrollment status is temporarily unavailable."
      });
    }
  }

  async deleteVoiceEnrollment(): Promise<void> {
    const currentUser = this.snapshot.currentUser;
    if (
      this.snapshot.busy ||
      !currentUser ||
      currentUser.enrollmentStatus !== "ENROLLED" ||
      !currentUser.allowedActions.includes("DELETE_VOICE_ENROLLMENT")
    ) return;
    this.set({ ...this.snapshot, busy: true, message: undefined });
    try {
      const response = await this.authentication.deleteVoiceEnrollment();
      this.set({
        phase: "AUTHENTICATED",
        currentUser: mergeVoiceUnenrollment(
          currentUser,
          response as VoiceUnenrollmentResponse
        ),
        busy: false,
        message: "Voice enrollment deleted."
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.expireSession();
        return;
      }
      if (
        error instanceof ApiError &&
        error.problem?.code === "VOICE_UNENROLLMENT_REQUIRES_ANOTHER_FACTOR"
      ) {
        this.set({
          phase: "AUTHENTICATED",
          currentUser,
          busy: false,
          message: "Add another 2-Step Verification method before deleting your voice enrollment."
        });
        return;
      }
      this.set({
        phase: "AUTHENTICATED",
        currentUser: {
          ...currentUser,
          enrollmentStatus: "UNKNOWN",
          enrollmentStatusLookupState: "TEMPORARILY_UNAVAILABLE",
          statusObservedAt: undefined,
          allowedActions: ["SIGN_OUT"]
        },
        busy: false,
        message: "Voice enrollment status is temporarily unavailable."
      });
    }
  }

  async signOut(): Promise<void> {
    if (this.snapshot.busy) return;
    this.set({ ...this.snapshot, busy: true });
    try {
      await this.authentication.signOut();
    } finally {
      this.set({ phase: "ANONYMOUS", busy: false });
    }
  }

  clearMessage(): void {
    this.set({ ...this.snapshot, message: undefined, retryAfterSeconds: undefined });
  }

  private expireSession(): void {
    this.authentication.clear();
    this.set({ phase: "ANONYMOUS", busy: false });
  }

  private set(snapshot: IdentitySnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
