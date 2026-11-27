import { h } from "preact";
import type { EnrollmentStatus } from "../../types/application-contracts";

export interface JourneyStepperProps {
  readonly authenticated: boolean;
  readonly enrollmentStatus?: EnrollmentStatus;
}

export function JourneyStepper({ authenticated, enrollmentStatus }: JourneyStepperProps) {
  const enrolled = enrollmentStatus === "ENROLLED";
  const enrollmentActive = authenticated && !enrolled;
  return (
    <nav class="journey-stepper" aria-label="Voice identity journey">
      <ol>
        <li class={authenticated ? "step complete" : "step active"}>
          <span class="step-marker" aria-hidden="true">{authenticated ? "✓" : "1"}</span>
          <span><strong>Sign in</strong><small>Oracle account</small></span>
        </li>
        <li class={enrolled ? "step complete" : enrollmentActive ? "step active" : "step pending"}>
          <span class="step-marker" aria-hidden="true">{enrolled ? "✓" : "2"}</span>
          <span><strong>Register voice</strong><small>8 sec per sample</small></span>
        </li>
        <li class={enrolled ? "step active" : "step pending"}>
          <span class="step-marker" aria-hidden="true">3</span>
          <span><strong>Audit check</strong><small>Live session</small></span>
        </li>
      </ol>
    </nav>
  );
}
