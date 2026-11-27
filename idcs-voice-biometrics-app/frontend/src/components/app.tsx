import { Component, h, type ComponentChild } from "preact";
import { customElement, type ExtendGlobalProps } from "ojs/ojvcomponent";
import Context = require("ojs/ojcontext");
import { AppShell } from "./app-shell/index";
import { LiveRegion } from "./live-region/index";
import { LoginPage } from "../pages/login/login-page";
import { LandingPage } from "../pages/landing/landing-page";
import { IdentityStore, type IdentitySnapshot } from "../state/identity-store";
import { EnrollmentStore, type EnrollmentSnapshot } from "../state/enrollment-store";
import { AuthenticationClient } from "../services/authentication";
import { EnrollmentPage } from "../pages/enrollment/enrollment-page";
import { VerificationPage } from "../pages/verification/verification-page";
import { VerificationStore, type VerificationSnapshot } from "../state/verification-store";
import { replaceRoute, routeFor } from "../app-router";
import { VoiceUnenrollmentDialog } from "./voice-unenrollment-dialog/index";

type Props = Record<string, never>;

interface State {
  readonly identity: IdentitySnapshot;
  readonly enrollment: EnrollmentSnapshot;
  readonly verification: VerificationSnapshot;
  readonly liveMessage?: string;
  readonly unenrollmentDialogOpen: boolean;
}

@customElement("app-root")
export class App extends Component<ExtendGlobalProps<Props>, State> {
  private readonly authentication = new AuthenticationClient();
  private readonly identityStore = new IdentityStore(this.authentication);
  private readonly enrollmentStore = new EnrollmentStore(this.authentication);
  private readonly verificationStore = new VerificationStore(this.authentication);
  private unsubscribe?: () => void;
  private unsubscribeEnrollment?: () => void;
  private unsubscribeVerification?: () => void;

  constructor(props: ExtendGlobalProps<Props>) {
    super(props);
    this.state = {
      identity: this.identityStore.value,
      enrollment: this.enrollmentStore.value,
      verification: this.verificationStore.value,
      unenrollmentDialogOpen: false
    };
  }

  componentDidMount(): void {
    this.unsubscribe = this.identityStore.subscribe((identity) => {
      this.setState(identity.phase === "AUTHENTICATED"
        ? { identity }
        : { identity, unenrollmentDialogOpen: false });
      if (identity.phase !== "AUTHENTICATED") {
        this.enrollmentStore.reset();
        this.verificationStore.reset();
        replaceRoute("LOGIN");
      } else if (!this.enrollmentStore.value.active && !this.verificationStore.value.active) {
        replaceRoute("LANDING");
      }
    });
    this.unsubscribeVerification = this.verificationStore.subscribe((verification) =>
      this.setState({ verification }));
    this.unsubscribeEnrollment = this.enrollmentStore.subscribe((enrollment) => {
      const newlyCompleted = enrollment.voiceState === "COMPLETED" &&
        this.state.enrollment.voiceState !== "COMPLETED";
      this.setState({ enrollment });
      if (newlyCompleted) void this.refreshAfterEnrollment();
    });
    window.addEventListener("popstate", this.onPopState);
    void this.identityStore.restore().finally(() => {
      Context.getPageContext().getBusyContext().applicationBootstrapComplete();
    });
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
    this.unsubscribeEnrollment?.();
    this.unsubscribeVerification?.();
    this.enrollmentStore.reset();
    this.verificationStore.reset();
    window.removeEventListener("popstate", this.onPopState);
  }

  render(): ComponentChild {
    const { identity, enrollment, verification, liveMessage, unenrollmentDialogOpen } = this.state;
    const currentUser = identity.phase === "AUTHENTICATED" ? identity.currentUser : undefined;
    return (
      <AppShell
        currentUser={currentUser}
        signOutBusy={identity.busy}
        onSignOut={() => void this.signOut()}
      >
        {identity.phase === "CHECKING" ? (
          <section class="loading-state" aria-busy="true">
            <span class="loading-ring" aria-hidden="true" />
            <h1>Checking your session</h1>
          </section>
        ) : identity.phase === "ANONYMOUS" ? (
          <LoginPage
            busy={identity.busy}
            message={identity.message}
            retryAfterSeconds={identity.retryAfterSeconds}
            onSubmit={(username, password) => this.signIn(username, password)}
          />
        ) : currentUser && enrollment.active && enrollment.attempt ? (
          <EnrollmentPage
            attempt={enrollment.attempt}
            busy={enrollment.busy}
            microphone={enrollment.microphone}
            voiceState={enrollment.voiceState}
            sentFrameCount={enrollment.sentFrameCount}
            utteranceOrdinal={enrollment.utteranceOrdinal}
            acceptedUtteranceCount={enrollment.acceptedUtteranceCount}
            capturedSampleMs={enrollment.capturedSampleMs}
            maximumSampleMs={enrollment.maximumSampleMs}
            minimumSampleMs={enrollment.minimumSampleMs}
            voiceActivity={enrollment.voiceActivity}
            qualityState={enrollment.qualityState}
            waveform={enrollment.waveform}
            transcriptState={enrollment.transcriptState}
            transcriptSegments={enrollment.transcriptSegments}
            message={enrollment.message}
            onConsent={(decision) => void this.decideConsent(decision)}
            onStart={() => void this.startEnrollmentFlow()}
            onContinue={() => this.continueToVerification()}
            onBack={() => this.leaveEnrollment()}
          />
        ) : currentUser && verification.active ? (
          <VerificationPage
            busy={verification.busy}
            microphone={verification.microphone}
            voiceState={verification.voiceState}
            sentFrameCount={verification.sentFrameCount}
            muted={verification.muted}
            waveform={verification.waveform}
            transcriptState={verification.transcriptState}
            timeline={verification.timeline}
            captureQuality={verification.captureQuality}
            message={verification.message}
            onStart={() => void this.startVerificationFlow()}
            onStop={() => this.endVerification()}
            onToggleMute={() => this.toggleVerificationMute()}
            onRestart={() => void this.restartVerification()}
            onBack={() => this.leaveVerification()}
          />
        ) : currentUser ? (
          <LandingPage
            currentUser={currentUser}
            busy={identity.busy}
            message={identity.message}
            onRetryStatus={() => void this.retryStatus()}
            onJourneyAction={(action) => this.journeyAction(action)}
            onDeleteVoiceEnrollment={() => this.setState({ unenrollmentDialogOpen: true })}
          />
        ) : null}
        <VoiceUnenrollmentDialog
          open={unenrollmentDialogOpen && Boolean(currentUser)}
          busy={identity.busy}
          onCancel={() => this.setState({ unenrollmentDialogOpen: false })}
          onConfirm={() => void this.deleteVoiceEnrollment()}
        />
        <LiveRegion message={liveMessage} />
      </AppShell>
    );
  }

  private readonly onPopState = (): void => {
    this.setState({ unenrollmentDialogOpen: false });
    const route = routeFor(window.location.pathname, this.state.identity.phase === "AUTHENTICATED");
    if (route === "ENROLLMENT" && this.state.enrollment.attempt) return;
    if (route === "VERIFICATION" && this.state.verification.active) return;
    this.enrollmentStore.reset();
    this.verificationStore.reset();
    if (this.state.identity.phase === "AUTHENTICATED") replaceRoute("LANDING");
  };

  private async signIn(username: string, password: string): Promise<void> {
    this.setState({ liveMessage: undefined });
    await this.identityStore.signIn(username, password);
    this.setState({ liveMessage: "Sign-in complete." });
  }

  private async retryStatus(): Promise<void> {
    this.setState({ liveMessage: "Checking voice enrollment status." });
    await this.identityStore.retryStatus();
    if (this.identityStore.value.currentUser?.enrollmentStatusLookupState === "AVAILABLE") {
      this.setState({ liveMessage: "Voice enrollment status updated." });
    } else {
      this.setState({ liveMessage: "Voice enrollment status remains unavailable." });
    }
  }

  private async refreshAfterEnrollment(): Promise<void> {
    this.setState({ liveMessage: "Voice enrollment complete. Refreshing account status." });
    await this.identityStore.retryStatus();
    this.setState({
      liveMessage: this.identityStore.value.currentUser?.enrollmentStatus === "ENROLLED"
        ? "Voice enrollment status updated."
        : "Voice enrollment completed, but the account status could not be refreshed."
    });
  }

  private async signOut(): Promise<void> {
    this.setState({ liveMessage: undefined, unenrollmentDialogOpen: false });
    try {
      this.enrollmentStore.reset();
      this.verificationStore.reset();
      await this.identityStore.signOut();
      this.setState({ liveMessage: "Signed out." });
    } catch {
      this.setState({ liveMessage: "Your local session has ended." });
    }
  }

  private async deleteVoiceEnrollment(): Promise<void> {
    if (this.state.identity.busy) return;
    this.setState({ liveMessage: "Deleting voice enrollment." });
    await this.identityStore.deleteVoiceEnrollment();
    const snapshot = this.identityStore.value;
    if (snapshot.phase !== "AUTHENTICATED") {
      this.setState({ unenrollmentDialogOpen: false, liveMessage: "Your session has ended." });
      return;
    }
    if (snapshot.currentUser?.enrollmentStatus === "NOT_ENROLLED") {
      this.setState({
        unenrollmentDialogOpen: false,
        liveMessage: "Voice enrollment deleted."
      });
      return;
    }
    this.setState({
      unenrollmentDialogOpen: false,
      liveMessage: snapshot.message
        ?? "Voice enrollment status could not be confirmed. Retry status before continuing."
    });
  }

  private journeyAction(action: "ENROLL" | "VERIFY"): void {
    if (action === "ENROLL") {
      void this.beginEnrollment();
      return;
    }
    this.enrollmentStore.reset();
    this.verificationStore.begin();
    replaceRoute("VERIFICATION");
    this.setState({ liveMessage: "Audit voice check screen opened. Start when you are ready." });
  }

  private async beginEnrollment(): Promise<void> {
    this.setState({ liveMessage: "Starting voice enrollment." });
    try {
      await this.enrollmentStore.begin();
      replaceRoute("ENROLLMENT");
      this.setState({ liveMessage: "Review the voice enrollment consent statement." });
    } catch {
      this.setState({ liveMessage: "Voice enrollment could not be started." });
    }
  }

  private async decideConsent(decision: "ACCEPT" | "DECLINE"): Promise<void> {
    try {
      await this.enrollmentStore.decide(decision);
      this.setState({ liveMessage: decision === "ACCEPT"
        ? "Consent intent recorded. Prepare your microphone next."
        : "Voice enrollment ended without opening the microphone." });
    } catch {
      this.setState({ liveMessage: "The consent decision could not be recorded." });
    }
  }

  private async startEnrollmentFlow(): Promise<void> {
    this.setState({ liveMessage: "Preparing the microphone and starting voice enrollment." });
    try {
      await this.enrollmentStore.startFlow();
      if (this.enrollmentStore.value.voiceState === "RECORDING") {
        this.setState({ liveMessage: "Voice enrollment and transcription are live." });
      } else if (this.enrollmentStore.value.attempt?.state === "CONSENT_PENDING") {
        this.setState({ liveMessage: "A fresh enrollment attempt is ready. Review the consent statement." });
      } else if (this.enrollmentStore.value.microphone === "FAILED") {
        this.setState({ liveMessage: "Microphone preparation failed." });
      }
    } catch {
      this.setState({ liveMessage: "Voice recording could not start." });
    }
  }

  private leaveEnrollment(): void {
    this.enrollmentStore.reset();
    if (this.state.identity.phase === "AUTHENTICATED") replaceRoute("LANDING");
  }

  private continueToVerification(): void {
    this.enrollmentStore.reset();
    this.verificationStore.begin();
    replaceRoute("VERIFICATION");
    this.setState({ liveMessage: "Audit voice check is ready to start." });
  }

  private async startVerificationFlow(): Promise<void> {
    this.setState({ liveMessage: "Preparing the microphone and starting audit voice check." });
    try {
      await this.verificationStore.startFlow();
      if (this.verificationStore.value.voiceState === "RECORDING") {
        this.setState({ liveMessage: "Audit voice check and transcription are live." });
      } else if (this.verificationStore.value.microphone === "FAILED") {
        this.setState({ liveMessage: this.verificationStore.value.message ?? "Microphone preparation failed." });
      }
    } catch {
      this.setState({ liveMessage: this.verificationStore.value.message ?? "Audit voice check could not start." });
    }
  }

  private endVerification(): void {
    this.verificationStore.stop();
    this.setState({ liveMessage: "Audit voice check capture ended. Waiting for the final voice result." });
  }

  private toggleVerificationMute(): void {
    this.verificationStore.toggleMute();
    this.setState({ liveMessage: this.verificationStore.value.muted
      ? "Audio muted. Nothing new is being sent."
      : "Audio resumed." });
  }

  private async restartVerification(): Promise<void> {
    this.verificationStore.begin();
    this.setState({ liveMessage: "Restarting audit voice check with a new session." });
    await this.startVerificationFlow();
  }

  private leaveVerification(): void {
    this.verificationStore.reset();
    if (this.state.identity.phase === "AUTHENTICATED") replaceRoute("LANDING");
  }
}

declare global {
  namespace preact.JSX {
    interface IntrinsicElements {
      "app-root": ExtendGlobalProps<Props>;
    }
  }
}
