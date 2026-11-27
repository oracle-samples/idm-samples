import { h } from "preact";
import type { CurrentUser } from "../../types/application-contracts";
import { EnrollmentStatusCard } from "../../components/enrollment-status/index";

export interface LandingPageProps {
  readonly currentUser: CurrentUser;
  readonly busy: boolean;
  readonly message?: string;
  readonly onRetryStatus: () => void;
  readonly onJourneyAction: (action: "ENROLL" | "VERIFY") => void;
  readonly onDeleteVoiceEnrollment: () => void;
}

export function LandingPage({
  currentUser,
  busy,
  message,
  onRetryStatus,
  onJourneyAction,
  onDeleteVoiceEnrollment
}: LandingPageProps) {
  return (
    <div class="landing-layout">
      <section class="landing-heading">
        <p class="eyebrow">VOICE VERIFICATION DEMO</p>
        <h1>Welcome, {currentUser.displayName ?? currentUser.username}</h1>
        <p>Your account is ready. Continue with voice enrollment or a voice check.</p>
      </section>
      <div class="identity-summary">
        <section class="identity-card" aria-labelledby="identity-title">
          <p class="eyebrow">SIGNED-IN ACCOUNT</p>
          <h2 id="identity-title">Account session active</h2>
          <dl>
            <div><dt>Username</dt><dd>{currentUser.username}</dd></div>
            {currentUser.organization
              ? <div><dt>Organization</dt><dd>{currentUser.organization}</dd></div>
              : null}
            <div><dt>Session</dt><dd><span class="inline-success">●</span> Active</dd></div>
          </dl>
          <p class="protected-note">
            <span aria-hidden="true">◇</span>
            <span><strong>Voice profile</strong><br />Your voice profile supports audit-oriented voice checks while you are signed in.</span>
          </p>
        </section>
        <EnrollmentStatusCard
          currentUser={currentUser}
          busy={busy}
          onRetry={onRetryStatus}
          onJourneyAction={onJourneyAction}
          onDeleteVoiceEnrollment={onDeleteVoiceEnrollment}
        />
      </div>
      {message ? <p class="page-message" role="status">{message}</p> : null}
    </div>
  );
}
