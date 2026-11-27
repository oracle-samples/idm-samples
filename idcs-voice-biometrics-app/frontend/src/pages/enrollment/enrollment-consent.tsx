import { h } from "preact";
import type { EnrollmentAttempt } from "../../types/application-contracts";
import { ConsentMarkdown } from "./consent-markdown";

export interface EnrollmentConsentProps {
  readonly attempt: EnrollmentAttempt;
  readonly busy: boolean;
  readonly onDecision: (decision: "ACCEPT" | "DECLINE") => void;
}

export function EnrollmentConsent({ attempt, busy, onDecision }: EnrollmentConsentProps) {
  const hasConsentText = attempt.consent.text.trim().length > 0;
  return (
    <section class="consent-card" aria-labelledby="consent-title">
      <p class="eyebrow">VOICE ENROLLMENT CONSENT</p>
      <h2 id="consent-title">Review voice enrollment consent</h2>
      <div
        class="consent-statement"
        lang={attempt.consent.locale}
        role="region"
        aria-label="Voice enrollment consent statement"
        tabIndex={0}
      >
        {hasConsentText
          ? <ConsentMarkdown text={attempt.consent.text} />
          : <p role="alert">Consent details are unavailable. Please try again.</p>}
      </div>
      <p class="consent-note">
        Your choice applies only to this enrollment attempt. Microphone access begins only when
        you continue to voice recording.
      </p>
      <div class="consent-actions">
        <button class="secondary-button" type="button" disabled={busy} onClick={() => onDecision("DECLINE")}>
          Decline
        </button>
        <button class="primary-button" type="button" disabled={busy || !hasConsentText} onClick={() => onDecision("ACCEPT")}>
          {busy ? "Saving…" : "Accept and continue"}
        </button>
      </div>
    </section>
  );
}
