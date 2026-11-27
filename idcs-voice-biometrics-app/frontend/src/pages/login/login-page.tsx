import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface LoginPageProps {
  readonly busy: boolean;
  readonly message?: string;
  readonly retryAfterSeconds?: number;
  readonly onSubmit: (username: string, password: string) => Promise<void>;
}

export function LoginPage({ busy, message, retryAfterSeconds, onSubmit }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const inactive = busy || submitting;

  useEffect(() => {
    if (!inactive) {
      usernameRef.current?.focus();
    }
  }, []);

  async function submit(event: Event) {
    event.preventDefault();
    if (busy || submittingRef.current || !username.trim() || !password) return;
    const submittedUsername = username;
    const submittedPassword = password;
    submittingRef.current = true;
    setSubmitting(true);
    let failed = false;
    try {
      await onSubmit(submittedUsername, submittedPassword);
    } catch {
      failed = true;
    } finally {
      setPassword("");
      if (!failed) setUsername("");
      submittingRef.current = false;
      setSubmitting(false);
      if (failed) {
        window.setTimeout(() => usernameRef.current?.focus(), 0);
      }
    }
  }

  return (
    <div class="login-layout">
      <section class="login-intro" aria-labelledby="login-hero-title">
        <p class="eyebrow">VOICE VERIFICATION DEMO</p>
        <h1 id="login-hero-title">Voice checks<br />start with your<br />Oracle account.</h1>
        <p>
          Sign in before registering a voice profile or running a voice check.<br />
          Voice matching is used for audit support, not to grant access.
        </p>
      </section>

      <section class="login-card" aria-labelledby="sign-in-title">
        <div class="login-card-brand">
          <span class="oracle-wordmark">ORACLE</span>
          <span>Demo sign-in</span>
        </div>
        <div class="card-rule" />
        <h2 id="sign-in-title">Sign in</h2>
        <p>Use your organization credentials to continue.</p>
        <form onSubmit={submit} noValidate>
          <label for="voice-username">Username</label>
          <input
            ref={usernameRef}
            id="voice-username"
            name="username"
            type="text"
            autoComplete="username"
            maxLength={254}
            value={username}
            onInput={(event) => setUsername(event.currentTarget.value)}
            disabled={inactive}
            required
          />
          <div class="password-label"><label for="voice-password">Password</label></div>
          <div class="password-field">
            <input
              id="voice-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={1024}
              value={password}
              onInput={(event) => setPassword(event.currentTarget.value)}
              disabled={inactive}
              required
            />
            <button
              type="button"
              class="show-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
              disabled={inactive}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div class="login-message" role="alert" aria-live="assertive">
            {message}{retryAfterSeconds ? ` Try again in about ${retryAfterSeconds} seconds.` : ""}
          </div>
          <button
            class="primary-button sign-in-button"
            type="submit"
            aria-busy={inactive}
            disabled={inactive || !username.trim() || !password}
          >
            {inactive ? <><span class="button-spinner" aria-hidden="true" /> Signing in…</> : "Sign in"}
          </button>
        </form>
        <div class="card-rule" />
        <div class="login-card-footer"><span>Help</span><span>Privacy</span><span>© 2026 Oracle</span></div>
      </section>
    </div>
  );
}
