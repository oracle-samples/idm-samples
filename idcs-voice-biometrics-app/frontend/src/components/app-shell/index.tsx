import { h, type ComponentChildren } from "preact";
import type { CurrentUser } from "../../types/application-contracts";

export interface AppShellProps {
  readonly currentUser?: CurrentUser;
  readonly onSignOut?: () => void;
  readonly signOutBusy?: boolean;
  readonly children: ComponentChildren;
}

function initials(user: CurrentUser): string {
  const source = user.displayName ?? user.username;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`
    : source.slice(0, 2)).toUpperCase();
}

export function AppShell({ currentUser, onSignOut, signOutBusy, children }: AppShellProps) {
  return (
    <div class="app-frame">
      <header class="app-header">
        <a class="brand" href={currentUser ? "/" : "/login"} aria-label="Oracle Voice Verification Demo home">
          <span class="oracle-wordmark">ORACLE</span>
          <span class="brand-divider" aria-hidden="true" />
          <span class="product-name"><strong>Voice Verification</strong><small>DEMO · AUDIT SUPPORT</small></span>
        </a>
        <span class="environment-pill">Non-production demo</span>
        {currentUser ? (
          <div class="user-menu">
            <span class="avatar" aria-hidden="true">{initials(currentUser)}</span>
            <span class="user-copy">
              <strong>{currentUser.displayName ?? currentUser.username}</strong>
              <small>{currentUser.organization ?? currentUser.username}</small>
            </span>
            <button
              class="text-button sign-out"
              type="button"
              onClick={() => {
                if (!signOutBusy) onSignOut?.();
              }}
              disabled={signOutBusy}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>
      <a
        class="skip-link"
        href="#main-content"
        onClick={() => document.getElementById("main-content")?.focus()}
      >
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer class="app-footer">
        <span>Oracle Voice Verification Demo</span>
        <nav aria-label="Footer"><span>Accessibility</span><span>Privacy</span><span>Support</span></nav>
      </footer>
    </div>
  );
}
