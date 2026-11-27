# IDCS Voice Biometrics Sample App

## Prerequisites
- Install JDK 21, Node.js 20, Maven
- Obtain Voice Biometrics SDK from Oracle

## Quick Start
### App Configuration
Copy `.env.example` to `.env` and update the environment properties.

Configure the following browser transport values in your environment file:

```bash
AI_WORLD_BIND_ADDRESS=127.0.0.1
AI_WORLD_PUBLIC_ORIGIN=http://127.0.0.1:8080
AI_WORLD_BACKEND_PORT=8080
AI_WORLD_TLS_ENABLED=false
```

Use that exact origin; do not switch between `127.0.0.1` and `localhost`. For remote browser
use, configure trusted HTTPS and its matching public origin instead. With embedded Java
HTTPS, enable `AI_WORLD_TLS_ENABLED` and supply both PEM files. The template's HTTPS origin
does not enable the Java HTTPS listener by itself.

The template disables app features until configured. An unedited copy is not a working
login/verification profile. After filling their settings, enable `AI_WORLD_IDCS_ENABLED`,
`AI_WORLD_IAM_STATUS_ENABLED`, `AI_WORLD_IAM_FACTOR_MAPPING_APPROVED` and `AI_WORLD_ABIS_ENABLED`.
Enable enrollment/deletion only for intended account actions, and enable `AI_WORLD_OCI_SPEECH_ENABLED` when transcription is configured.

| Area | Supply |
|---|---|
| Browser transport | Exact public HTTPS origin; either Java HTTPS with PEM chain/key references, or TLS termination at a trusted ingress with Java listening on its private upstream address/port. |
| IDCS sign-in | Customer identity-domain HTTPS origin, confidential-client ID, secret-file reference and approved scope. Enable IDCS only after completing its fields. |
| Identity validation | For release validation use `STRICT_JWT` with the owner-approved issuer, audience, JWKS URL, identity-domain/username/user-GUID claim mappings and approved-user file. `DEMO_PROFILE` is an isolated local test mode and does not validate the release configuration. |
| IAM voice | Secure-domain origin, service client/scopes, mTLS keystore, server-CA truststore and restricted password-file references. Configure the approved factor mapping before enabling status and enrollment. |
| ABIS | Owner-confirmed WSS base URL associated with the existing store. Enable the adapter when configured. Authorization is obtained freshly through IAM for each attempt. |
| Speech | OCI region and Speech compartment, plus either an authorized local `SESSION_TOKEN` profile or `INSTANCE_PRINCIPAL` on OCI Compute. A local employee OCI session is separate from the user's app login. |
| Account changes | Enable enrollment/deletion only for authorized test users. Deletion requires the explicit in-app confirmation and resolves the current user's factor server-side. |

The client private key stays in a backend-owned keystore. Register its corresponding public
certificate in the IAM application. The browser-facing HTTPS certificate is a separate
certificate. Keep server certificate/hostname checks enabled for deployment validation.

### Build the app
```bash
export JAVA_HOME=/absolute/path/to/jdk-21
export PATH="/absolute/path/to/node-20/bin:$JAVA_HOME/bin:$PATH"
export MAVEN_SKIP_RC=1
export VOICE_SDK_JAR=/absolute/path/to/voice/sdk
export VOICE_SDK_POM=/abolute/path/to/voice/sdk/pom

bash scripts/prepare-sdk.sh
bash scripts/build-demo.sh
```
### Start the app
```bash
AI_WORLD_ENV_FILE=/absolute/path/to/.env bash scripts/run-demo.sh
```

The sample app runs as one Java backend with its browser UI included. The backend uses the Voice
Biometrics SDK JAR for capture and ABIS sessions, OCI Realtime Speech for transcription, and
the OCI IAM APIs for login, consent and voice factor operations.


Check `/actuator/health`, then open `/login` on the configured origin.
For example:

```bash
curl --fail http://127.0.0.1:8080/actuator/health
```

Press Ctrl+C in the terminal to stop the server. Run the same launch command to restart;
configuration changes require a restart and a new sign-in. In-page End session ends the
voice attempt without stopping the Java server.

## Acceptance and operations

1. Check login, current enrollment status, microphone permission denial/recovery and sign-out.
2. Verify ordinary speech, pauses, short replies, mute/resume, Stop and repeated sessions.
   Confirm that transcript rows settle and old attempts do not populate new attempts.
3. On an authorized unenrolled account, decline consent and confirm no capture; then accept,
   enroll with the required 7–10-second samples, refresh status and verify the new profile.
4. Validate the target OS/architecture, trusted browser HTTPS/WSS path, strict identity settings,
   private-file permissions and provider connectivity using the customer's configuration.

`/actuator/health` checks application health; an `UP` response does not certify live IAM, ABIS
or Speech access. Capture requires all enabled providers to be ready. Allow final results to
drain after Stop. A missing final transcript is shown as incomplete while preserving received
text; biometric outcomes remain distinct from IAM completion.

## Troubleshooting

| Symptom | Check |
|---|---|
| Application JAR missing | Build the source code first. |
| SDK artifact cannot resolve / handoff classes missing | Supply the matching integration JAR and POM. |
| Maven/npm dependency download fails | Check the approved registry, network/VPN and registry authentication. Offline builds require a populated cache. |
| Port already in use | Stop your existing demo process, or change both the listener port and matching public origin before restarting. |
| HTTPS error / cannot connect | Match the URL scheme to the listener or ingress. Check certificate trust, hostname and validity. |
| Login/status unavailable | Fill and enable the corresponding provider. Ask the IAM owner to confirm client grants/scopes, factor mapping and public certificate registration. |
| Session cannot start after app login | Check server output for the failing provider. Speech OCI authorization is separate from app sign-in; renew an expired selected profile with your normal approved OCI sign-in, then retry. |
| No microphone capture | Use the exact configured loopback or trusted HTTPS origin, allow the microphone in browser/OS settings and select an available input. Retry after restoring permission. |
| Transcript finishing after Stop | Allow the configured Speech drain interval (10 seconds by default). Received text is retained; missing finals are marked incomplete. |
| Mixed MATCH/MISMATCH/INCONCLUSIVE | Inspect the actual per-utterance provider outcomes and enrolled speaker. A short duration alone does not establish the reason. |
