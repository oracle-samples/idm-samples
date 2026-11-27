import { h } from "preact";
import type { CurrentUser } from "../../types/application-contracts";

export interface EnrollmentStatusCardProps {
  readonly currentUser: CurrentUser;
  readonly busy: boolean;
  readonly onRetry: () => void;
  readonly onJourneyAction: (action: "ENROLL" | "VERIFY") => void;
  readonly onDeleteVoiceEnrollment: () => void;
}

export function EnrollmentStatusCard({
  currentUser,
  busy,
  onRetry,
  onJourneyAction,
  onDeleteVoiceEnrollment
}: EnrollmentStatusCardProps) {
  const unavailable = currentUser.enrollmentStatusLookupState === "TEMPORARILY_UNAVAILABLE";
  const enrolled = currentUser.enrollmentStatus === "ENROLLED";
  const canEnroll = currentUser.allowedActions.includes("ENROLL");
  const canVerify = currentUser.allowedActions.includes("VERIFY");
  const canDelete = enrolled && currentUser.allowedActions.includes("DELETE_VOICE_ENROLLMENT");

  if (unavailable) {
    return (
      <section class="status-card status-warning" aria-labelledby="status-title">
        <span class="status-icon warning" aria-hidden="true">!</span>
        <p class="eyebrow">VOICE PROFILE</p>
        <h2 id="status-title">Enrollment status unavailable</h2>
        <p>Your sign-in is active, but the current voice status could not be loaded.</p>
        <button class="primary-button neutral" type="button" onClick={onRetry} disabled={busy}>
          {busy ? "Checking…" : "Retry status"}
        </button>
      </section>
    );
  }

  return (
    <section class={`status-card ${enrolled ? "status-success" : "status-required"}`} aria-labelledby="status-title">
      <span class={`status-icon ${enrolled ? "success" : "required"}`} aria-hidden="true">
        {enrolled ? "✓" : "2"}
      </span>
      <p class="eyebrow">VOICE PROFILE</p>
      <h2 id="status-title">{enrolled ? "Your voice profile is ready" : "Voice enrollment required"}</h2>
      <p>
        {enrolled
          ? "Your enrolled voice can be checked during a live session for audit support."
          : "Register one or more clear voice samples before starting audit voice checks."}
      </p>
      {canEnroll ? (
        <button
          class="primary-button"
          type="button"
          onClick={() => {
            if (!busy) onJourneyAction("ENROLL");
          }}
          disabled={busy}
        >
          Enroll voice <span aria-hidden="true">→</span>
        </button>
      ) : null}
      {canVerify ? (
        <button
          class="primary-button success-button"
          type="button"
          onClick={() => {
            if (!busy) onJourneyAction("VERIFY");
          }}
          disabled={busy}
        >
          Voice Verification <span aria-hidden="true">→</span>
        </button>
      ) : null}
      {canDelete ? (
        <button
          class="secondary-button delete-enrollment-button"
          type="button"
          onClick={() => {
            if (!busy) onDeleteVoiceEnrollment();
          }}
          disabled={busy}
        >
          Delete voice enrollment
        </button>
      ) : null}
    </section>
  );
}
