# Changes from the trimmed sample

## Configuration and instructions

- Renamed application environment variables from the earlier prefixes to `VOICE_BIOMETRIC_` in the template,
  Spring environment mappings, launcher, relevant test/e2e configuration and error messages.
  The launcher selector is now `VOICE_BIOMETRIC_ENV_FILE`. Old names are not compatibility aliases.
- Added `scripts/migrate-env.sh` to rename existing assignment keys while preserving values,
  selected OCI profile names and private-file paths. It does not source or display the file
  and refuses to overwrite an existing destination.
- The template's public origin/listener now agree on `http://127.0.0.1:8080` with TLS disabled
  for local use. The default OCI profile name is now `DEFAULT`; migrated values are preserved.
- The launcher reads the app-root `.env` by default or the explicit environment-file selector,
  with a clear error if the file is missing. The file is trusted shell-format input.
- Rewrote the README and added configuration/migration/test guides, precise SDK JAR/POM build
  inputs, optional Speech behavior, private-input requirements and the new-environment setup gap.

## Browser audio startup

Previously the AudioContext was created only after microphone permission and provider/socket
setup. It was never explicitly resumed. A browser-suspended context could therefore leave
permission granted but no PCM frames or moving waveform.

AudioCapture now creates/requests resume during microphone preparation, before permission and
provider waits. Preparation still does not connect the microphone graph or send audio. Actual
capture starts after the existing consent/provider checks. A context that cannot run fails
preflight with a bounded wait and a clear audio-specific message. Failure/cancellation closes
the context and stops tracks; late permission/module completions cannot reconnect stale capture.
Enrollment and verification use this same capture implementation.

## Validation

- TypeScript checks and release UI build; 159 frontend tests across 24 suites passed.
- Maven packaging; 142 backend tests passed, including all documented environment mappings.
- Real headless Chrome with simulated input and an explicitly suspended audio context:
  original capture produced 0 frames and remained suspended; updated capture produced 40
  frames (16 non-silent) and ran normally during the 800 ms observation.
- Built-app health UP, login HTTP 200 and packaged worklet HTTP 200 with JavaScript content type,
  using the new environment names and live providers disabled.
- Migration preserves values/profile/paths, creates a private destination and refuses overwrite.

These checks do not reproduce the recipient's physical microphone/browser setup and do not
perform a fresh live IAM enrollment. Retry enrollment and verification on that machine to
confirm whether this startup gap caused the reported issue.

## Separate follow-ups

- Password-grant sign-in is unchanged; standard OIDC migration still needs implementation.
- Internal Java packages, Maven artifact names and the remaining internal branding are unchanged.
- Public source-only publication still needs an agreed delivery location for the matching
  integration SDK source/artifact. This package intentionally contains no SDK binaries/source.
- New-customer store/app/user provisioning remains outside the demo; see CONFIGURATION.md.

## Complete transcription feature switch

`VOICE_BIOMETRIC_OCI_SPEECH_ENABLED=false` now also hides enrollment/verification transcript UI,
labels and placeholders, while preserving per-utterance voice results. `/api/v1/me` exposes
the server's boolean capability so the browser follows the same switch. Biometric-only
sessions do not subscribe to transcript updates or mark absent transcripts incomplete.
The existing backend bypass means no Speech auth/config/client connection is required.
Set true with authorized Speech configuration to restore transcription; restart/sign in again.

## Final environment prefix

All active app environment settings, launcher overrides and test/browser selectors now use
`VOICE_BIOMETRIC_`. Existing private env files can be migrated from either earlier prefix
using `scripts/migrate-env.sh`; values, credentials paths and OCI profile names are preserved.
