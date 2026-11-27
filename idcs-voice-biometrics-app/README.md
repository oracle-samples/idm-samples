# IDCS Voice Biometrics Sample App

This sample implements a sample app for voice enrollment and voice verification. It consists of a Java backend and browser UI. The backend uses the Voice Biometrics SDK for ABIS audio sessions and the OCI Realtime Speech SDK for optional transcription. Provider credentials stay on the backend.

## What you need

- JDK 21, Maven, Node.js 20 or newer, npm and Bash on macOS/Linux.
- The matching **Voice Biometrics integration SDK 1.2.5-SNAPSHOT JAR and its POM**, supplied
  separately. Its Maven coordinate is `com.oracle.voicebiometrics:voice-biometrics:1.2.5-SNAPSHOT`.
- Access to an existing configured OCI IAM/IDCS and ABIS environment, an ordinary test-user
  account, and the private files listed in [configuration](docs/CONFIGURATION.md).
- Access to the configured services and Maven/npm registries.

The OCI Realtime Speech dependency is declared in `backend/pom.xml` as
`com.oracle.oci.sdk:oci-java-sdk-addons-aispeech-realtime:3.95.0`. Maven downloads it and embeds
it in the built app; no separate Speech JAR is required.

## Configure

From this directory:

```bash
umask 077
cp .env.example .env
```

Edit `.env` using your environment owner's values. Every supported setting has a one-line
comment. The template has consistent local browser defaults:

```ini
VOICE_BIOMETRIC_BIND_ADDRESS=127.0.0.1
VOICE_BIOMETRIC_PUBLIC_ORIGIN=http://127.0.0.1:8080
VOICE_BIOMETRIC_BACKEND_PORT=8080
VOICE_BIOMETRIC_TLS_ENABLED=false
```

The provider features are disabled until configured. Complete the IDCS, IAM and ABIS sections,
then enable `VOICE_BIOMETRIC_IDCS_ENABLED`, `VOICE_BIOMETRIC_IAM_STATUS_ENABLED`,
`VOICE_BIOMETRIC_IAM_FACTOR_MAPPING_APPROVED` and `VOICE_BIOMETRIC_ABIS_ENABLED`. Enable enrollment
and deletion only when you intend to test those account changes. See [CONFIGURATION.md](docs/CONFIGURATION.md) for identity modes, files and access requirements.

**Transcription is optional.** Leave `VOICE_BIOMETRIC_OCI_SPEECH_ENABLED=false` for biometric-only
tests; no OCI Speech tenancy, profile or session is needed. This switch also hides transcript
panels/statuses and keeps voice-only per-utterance results. If enabled, supply an authorized OCI Speech
identity, region and compartment. An expired/missing Speech credential can prevent voice
session startup while Speech is enabled; there is no automatic fallback.

## Build

Select your JDK/Node installations and supply the exact SDK **files**:

```bash
export JAVA_HOME=/absolute/path/to/jdk-21
export PATH="/absolute/path/to/node-20/bin:$JAVA_HOME/bin:$PATH"
export MAVEN_SKIP_RC=1
export VOICE_SDK_JAR=/absolute/path/to/VoiceBiometrics.jar
export VOICE_SDK_POM=/absolute/path/to/pom.xml

java -version
node --version
mvn -version
bash scripts/prepare-sdk.sh
bash scripts/build-demo.sh
```

`prepare-sdk.sh` installs the supplied SDK JAR with its POM into the selected local Maven
repository. `build-demo.sh` installs frontend dependencies with `npm ci` when needed, runs
TypeScript checks and frontend/backend tests, builds the UI and packages the app as
`backend/target/ai-world-backend-0.1.0-SNAPSHOT.jar`. Use the same `VOICE_MAVEN_REPOSITORY`
setting for both commands if selecting a separate Maven cache. The existing internal Java
package and Maven artifact names are retained in this focused update.

## Run

```bash
bash scripts/run-demo.sh
```

The launcher reads this directory's trusted shell-format `.env` file and starts the built
app. To select a different file:

```bash
VOICE_BIOMETRIC_ENV_FILE=/absolute/path/to/preprod.env bash scripts/run-demo.sh
```

With the local defaults, open **http://127.0.0.1:8080/login**. Use the exact configured origin;
do not switch between `localhost` and `127.0.0.1`. Sign in with the configured identity
domain's test-user credentials. This is separate from any OCI identity used for Speech.

Press Ctrl+C in the server terminal to stop the app. Restart after changing configuration.
End session in the browser ends only the voice attempt. Remote browser use requires trusted
HTTPS/WSS and matching origin/listener or ingress settings; see CONFIGURATION.md.

## Check it

```bash
curl --fail http://127.0.0.1:8080/actuator/health
```

An `UP` response checks app health, not live provider authorization. Follow
[TESTING.md](docs/TESTING.md) for enrollment, microphone and repeated-session checks.

## Troubleshooting

| Symptom | Check |
|---|---|
| Environment file missing | Copy/configure `.env.example` as `.env`, or set `VOICE_BIOMETRIC_ENV_FILE` to an existing file. |
| Application JAR missing | Run both build commands above first. |
| SDK cannot resolve / handoff classes missing | Obtain matching integration SDK 1.2.5-SNAPSHOT JAR and POM; use file paths, not directories. |
| Dependency download fails | Check registry access, authentication and VPN. Offline builds need an already populated cache. |
| Port already in use | Change both listener port and public origin, or stop the old demo. |
| Login/status unavailable | Check enabled flags, client IDs/scopes, private files, user access, factor mapping and registered client certificate. |
| Session fails after sign-in | Check the failing provider in sanitized server output. If Speech is enabled, refresh its authorized OCI session or disable Speech and restart for biometric-only tests. |
| Permission granted but waveform stays flat | Keep the tab active, check the selected OS/browser microphone and input level/mute, then retry. The app activates browser audio before waiting for providers. If unresolved, capture browser/version, the UI message and sanitized console/network errors. |
| Browser audio could not start | Retry from the Enroll voice/Start session button. Check browser audio settings and use the configured loopback or trusted HTTPS origin. |
| Transcript finishing after Stop | Allow the configured final-result drain. Missing finals are marked incomplete while received text remains visible. |
| Mixed biometric outcomes | Inspect per-utterance provider reasons. Short duration alone does not establish why a sample failed. |

Do not publish private environment files, keys, tokens, recordings or real-account logs.
