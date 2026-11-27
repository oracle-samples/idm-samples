# Configuration and existing-environment access

Use the root README for build/run commands. The commented `.env.example` is a template,
not a provisioned environment. The launcher sources the chosen trusted shell-format file;
paths can use `$HOME` or an explicitly set private directory variable.

## Required private inputs

Obtain these from the existing environment owner through an authorized private channel:

| Setting | File contents |
|---|---|
| `VOICE_BIOMETRIC_IDCS_CLIENT_SECRET_FILE` | Sign-in OAuth application's client secret. |
| `VOICE_BIOMETRIC_IAM_MTLS_KEYSTORE_FILE` | Client certificate/private-key keystore matching the public certificate registered in IAM confiedential application. |
| `VOICE_BIOMETRIC_IAM_MTLS_KEYSTORE_PASSWORD_FILE` | Keystore password. |
| `VOICE_BIOMETRIC_IAM_MTLS_TRUSTSTORE_FILE` | Trusted IAM server CA store. |
| `VOICE_BIOMETRIC_IAM_MTLS_TRUSTSTORE_PASSWORD_FILE` | Truststore password. |

Reference the files' absolute paths in `.env`. Restrict them to the backend's user. A
folder permission command does not create these files. No private material is included here.
The user's password is entered in the browser and is separate from all five inputs.

## Environment settings

- **IDCS:** identity-domain HTTPS origin, sign-in client ID, scope and secret-file path.
- **Identity:** `STRICT_JWT` validates issuer/audience/JWKS, domain and user claim mappings,
  plus an approved-user file. `DEMO_PROFILE` is an isolated internal demo mode using a
  successful password grant and matching `/admin/v1/Me` profile. It does not use the
  strict-mode approved-user file. The domain owner must authorize the user's access.
- **IAM:** secure HTTPS origin, service client/scopes, the five relevant file references,
  and owner-confirmed voice-factor response mapping. Keep TLS verification enabled for
  deployment validation; internal test exceptions are not customer deployment defaults.
- **ABIS:** WSS endpoint for the existing IAM-linked voice store. Authorization is obtained
  through IAM per attempt; there is no store-ID selection/provisioning UI on this route.
- **Speech (optional):** set `VOICE_BIOMETRIC_OCI_SPEECH_ENABLED=true` only when configured. Use
  `SESSION_TOKEN` with your own readable OCI config/profile and valid referenced key/token
  files, or `INSTANCE_PRINCIPAL` on an authorized OCI instance. The identity needs Speech
  access in the specified region/compartment. `VOICE_BIOMETRIC_OCI_PROFILE` is an existing OCI
  profile name (default `DEFAULT`); it is not created by the app. No manual OCI session is
  needed while Speech is disabled. Disabled mode bypasses Speech connections/authentication,
  hides transcript panels/statuses, and shows voice-only results with no transcript-final wait.
  Restart and sign in again after changing the flag. The Speech SDK may remain bundled but is
  not used for disabled-mode sessions.

## Browser transport

The local template uses `http://127.0.0.1:8080`. For a remote browser use a trusted HTTPS
origin and WSS. Either enable Java HTTPS with the PEM chain/private-key fields, or terminate
TLS at a trusted ingress and configure the backend's private listener accordingly. Merely
changing PUBLIC_ORIGIN does not enable the HTTPS listener. The browser HTTPS certificate is
separate from the IAM client mTLS certificate.
