# OCI IAM Fingerprint Reference App

This sample implements consent-gated fingerprint enrollment and 1:1 verification: authenticated user binding, reader readiness, IAM enrollment initiation, explicit consent, capture only after acceptance, local template extraction, state-bound enrollment and verification completion, and unenrollment. It is intended to run on a laptop or VM with **Node.js 18+** and **JDK 17+**, and deliberately uses no npm dependencies.

## Repository layout

~~~text
app/
  src/                          Node.js web service, IAM integration, and request orchestration
    public/                     Browser UI and static assets
  test/                         Dependency-free Node.js tests
bridge/
  src/fingerprint/bridge/       Local Java bridge and capture/extraction orchestration
    extractors/                 Template extractor API and mock/Tech5 implementations
    model/                      Capture and reader data objects
    readers/                    Fingerprint reader manager API and mock/Lumidigm implementations
  run-bridge.bat / .sh          Platform-specific Java bridge launchers
.env.example                    Documented configuration template
package.json                    Node.js package metadata and test/start commands
start.bat / start.sh            Platform-specific full-application launchers
~~~

## Security model

- The browser can only call the Node.js app on `127.0.0.1`.
- The Node.js app calls a Java bridge on `127.0.0.1:7071` by default; `BRIDGE_PORT` and the optional `BRIDGE_URL` override must agree. The bridge is the only component permitted to touch a fingerprint SDK.
- Raw image bytes stay in the Java process. They are used to create a template, immediately zeroed, and never included in a response, log, browser storage, or cloud API request.
- The user-entered PIN is sent only to the local bridge as Tech5 protection seed 2. It is redacted from diagnostics and is not sent as a separate value to IAM; IAM receives the resulting protected template.
- The Node.js service uses IAM OIDC Authorization Code + PKCE for the browser user's sign-in. Separately, it gets a service token with an mTLS client certificate, then sends only a template/protected-template plus the server-bound OIDC subject to the configured IAM endpoints.

The Java bridge defaults to a **mock fingerprint reader and mock template extractor**, and also contains optional Lumidigm fingerprint reader and Tech5 template extractor implementations for the Windows hardware path. Mock mode produces a deterministic placeholder image locally, extracts a non-biometric SHA-256 placeholder template, and destroys the image. It does not claim ISO/IEC or BTP compliance.

## Quick start (mock mode)

1. Install Node.js 18+ and a JDK 17+; ensure `node`, `java`, and `javac` are on `PATH`.
2. In this directory, copy `.env.example` to `.env`.
3. macOS/Linux: run `chmod +x start.sh bridge/run-bridge.sh && ./start.sh`.
4. Windows: run `start.bat`.
5. Browse to `http://localhost:8080`. Select a reader, enter a 6-19 digit PIN, choose **Begin enrollment**, review the consent statement, and accept or decline. Capture begins only after acceptance. After enrollment, enter the PIN and capture a fresh fingerprint for verification.

Use Ctrl+C to stop the macOS/Linux launcher. On Windows, close both command windows.

The platform launchers start both the Java bridge and Node app. `npm start` starts only the Node app, so start the bridge separately when using that command. `WEB_PORT` defaults to `8080` and must match the port in `OIDC_REDIRECT_URI`. `BRIDGE_PORT` defaults to `7071`; if `BRIDGE_URL` is explicitly set, configure it with the same port. `BRIDGE_REQUEST_TIMEOUT_MS` defaults to 30 seconds and covers each request from the Node.js app to the local bridge, including capture and template extraction.

The macOS/Linux bridge currently supports only the mock reader and mock extractor. The Lumidigm reader and Tech5 BTP integrations require Windows.

## IAM authentication and biometric API configuration

Create two separate IAM confidential applications:

1. A browser-facing application with the **Authorization Code** grant. Register the exact loopback `OIDC_REDIRECT_URI`, enable the scopes listed in `OIDC_SCOPES` (`openid profile email` by default), and configure its issuer, client ID, and client secret.
2. A service application with the **TLS Client Authentication** grant. Upload the client certificate to its IAM profile, then configure the service client ID, PEM-encoded client certificate and private key, and API scope. `IAM_SERVICE_SCOPE` defaults to `urn:opc:idm:biometrics`.

Copy `.env.example` to `.env` and set `IAM_MOCK_MODE=false`. The following values are required for the complete IAM integration:

~~~text
OIDC_ISSUER
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
OIDC_REDIRECT_URI
IAM_TOKEN_URL
IAM_CLIENT_ID
IAM_CLIENT_CERT
IAM_CLIENT_KEY
IAM_MFA_BASE_URL
IAM_BTP_CLIENT_VERSION
FINGERPRINT_DEVICE_MAPPING_1
~~~

Use the regular `https://idcs-<guid>.identity.oraclecloud.com` hostname for `OIDC_ISSUER`. Because the service application uses mTLS, `IAM_TOKEN_URL` and `IAM_MFA_BASE_URL` must use the `https://idcs-<guid>.secure.identity.oraclecloud.com` hostname. Keep the token URL separate from the MFA API base URL.

`/login` creates server-side state and PKCE values; exchanges the authorization code; calls IAM userinfo; and creates an opaque HttpOnly local session cookie. Each biometric action derives the user id from that server-side session. `/logout` clears the local session and pending enrollment state only; it does not terminate the IAM SSO session.

After login, the app decodes the IAM JWT access-token payload and uses its `user_id` claim as the user GUID in IAM endpoint templates.

`app/src/server.js` requests the service token using `grant_type=tls_client_auth`, `client_id`, and `scope`, with the configured certificate and private key in the TLS handshake. This follows Oracle's [TLS Client Authentication grant flow](https://docs.oracle.com/en/cloud/paas/identity-cloud/idcsa/TLSAuthFlow.html). Keep private keys readable only by the service account.

Configure `IAM_MFA_BASE_URL` as the approved standard MFA base URL, for example `https://idcs-<guid>.secure.identity.oraclecloud.com/mfa/v1`. The server URL-encodes the IAM `user_id` bound to the signed-in session and derives all enrollment, verification, factor-list, and factor-delete routes from this base.

The service token must be authorized for these standard MFA routes. Before live testing, also confirm that the fingerprint feature is enabled and the fingerprint biometric store is provisioned.

Enrollment first checks `GET /users/{userId}/factors`. If a fingerprint factor exists, the app shows **Already enrolled** without initiating enrollment or capturing a fingerprint. Verify the existing factor, or explicitly use **Unenroll fingerprint** before trying a new enrollment; the app never removes an enrollment automatically. This check avoids IAM's duplicate-enrollment rejection, which some deployments expose as a generic `401 AUTH-1007`. A generic 401 without factor-list evidence remains a technical error, not proof of duplicate enrollment.

For an unenrolled user, `POST /users/{userId}/factors` obtains consent, followed by one `PATCH /users/{userId}/factors/{factorId}` after the user accepts or declines. Verification remains one browser action, but the server first lists factors, starts a transaction with `POST /requests`, captures only after a usable fingerprint factor and transaction are confirmed, and completes with one `PATCH /requests/{requestId}`. If no fingerprint factor exists, verification stops before capture.

IAM's `requestState` is opaque transaction state. It is held only on the app server, bound to the signed-in user and pending operation, never returned to the browser, and never logged. The app's pending enrollment flow has a five-minute local lifetime; an earlier IAM rejection or expiry remains authoritative. A completion PATCH is not replayed automatically after an uncertain response; a user-requested verification retry starts a new IAM transaction and captures a fresh sample. An explicit enrollment decline is sent to IAM without capture, and the UI distinguishes an acknowledged decline from an unconfirmed network result.

Enrollment and verification completion use the fingerprint extension `urn:ietf:params:scim:schemas:oracle:idcs:extension:fingerprint:mfa` with `biometricData`, `fingerPosition`, `btpClientVersion`, `deviceModel`, `deviceVersion`, and `devicePadLevel`. `clientReferenceId` is retained for safe correlation. A valid final completion response may contain only `status: "success"`; initiation success is never shown as completed enrollment or a fingerprint match.

Configure `IAM_BTP_CLIENT_VERSION` and at least one fingerprint device mapping for the approved BTP client and fingerprint reader. Configuring these values does not make the bundled SHA-256 placeholder BTP-compliant.

For an isolated integration test, `IAM_BIOMETRIC_DATA_OVERRIDE` can supply one fixed template to both enrollment and verification. Store its value only in the ignored `.env` file, remove the setting before reader testing, and never commit biometric material.

`IAM_REQUEST_TIMEOUT_MS` controls how long the app waits for each IAM enrollment, verification, and factor-management API response. The default is 30 seconds. A timeout after a completion PATCH is treated as inconclusive and is not retried automatically.

Set `IAM_DEBUG_LOGGING=true` only when integration diagnostics are needed. IAM request and response structure is logged, while authorization values, OAuth credentials, cookies, IAM request state, seed values, and biometric material are redacted.

## Fingerprint reader integration

### HID Lumidigm reader (Windows)

The Lumidigm integration enables capture from a physical reader and enforces the reader's PAD/liveness result. Install these prerequisites on the Windows machine that hosts the reader:

1. [V-Series and M-Series Embedded Driver](https://www.hidglobal.com/drivers/30506)
2. [HID Lumidigm SDK 9.6 for Windows](https://developers.hidglobal.com/), which includes the vCOM Integration Kit, Java API sources, and native-library source projects

#### Building the vCOM native libraries

Follow the build instructions in the Lumidigm SDK documentation. For this Java bridge, build `build\VS2019\04_VCOMExampleJNIWrapper_C++.sln` from the vCOM Integration Kit. The solution builds the native vCOM library and its JNI wrapper, producing `VCOMExample.dll` and `VCOMExampleJNIWrapper.dll`. Build them for the same architecture as the Java process, and set `VCOM_LIBRARY_DIR` to the directory containing both DLLs.

Configure the reader capability in `.env`:

```env
FINGERPRINT_READER=lumidigm
VCOM_JAVA_API_DIR=C:\path\to\VCOM_Integration_Kit_v9.6.41389\SampleCode\GUI_Apps\Java\JNI\VCOMExampleJavaAPI
VCOM_LIBRARY_DIR=C:\path\to\VCOM_Integration_Kit_v9.6.41389\bin
```

`VCOM_JAVA_API_DIR` is the `VCOMExampleJavaAPI` directory within the Lumidigm SDK's vCOM Integration Kit. `VCOM_LIBRARY_DIR` must contain `VCOMExample.dll` and `VCOMExampleJNIWrapper.dll`.

The included `LumidigmFingerprintReaderManager` uses HID's vCOM Java/JNI API to enumerate readers and capture a 500-dpi composite image. During reader initialization it fails closed unless the device advertises PAD capability, enables the vCOM spoof model when necessary, and verifies the setting by reading it back. It returns the raw image only in memory; the bridge passes it to whichever template extractor is configured and then zeroes it.

At startup, the bridge attempts to prepare the first discovered reader. After sign-in, the page automatically loads the reader list and prepares its initial selection. Use **Refresh readers** after connecting or disconnecting hardware, then select the intended reader and wait for it to be prepared before enrolling or verifying. The bridge opens the selected reader in exclusive mode for headless capture. Missing or unloadable reader libraries are reported as safe diagnostics; the bridge remains available and reports no connected reader so the configuration can be corrected without a process crash.

Set `FINGERPRINT_READER=mock` to use the development reader instead of physical hardware.

### Device metadata mapping

Each captured reader must map to the device metadata expected by IAM. Use one numbered variable per mapping:

```env
FINGERPRINT_DEVICE_MAPPING_1=mock -> model=Reference mock reader;version=1.0;padLevel=TEST_ONLY
# Replace every placeholder before enabling IAM-connected hardware testing.
# FINGERPRINT_DEVICE_MAPPING_2=vendorId=8110;productId=1312;serial=<device-serial> -> model=<approved-model>;version=<approved-version>;padLevel=<certified-pad-level>
# For example:
# FINGERPRINT_DEVICE_MAPPING_3=vendorId=8110;productId=1312;serial=36918 -> model=HID Lumidigm V521-01-01;version=V521;padLevel=L1
```

The left side of `->` identifies the reader; the right side supplies its IAM metadata. Lumidigm vCOM reports `vendorId=8110;productId=1312` for the Lumidigm V52X family, while `serial` is the `deviceSerial` value returned by `V100GetConfig`. The server uses the identity attached to the actual capture rather than browser-supplied metadata and rejects an unmapped reader before submitting biometric data to IAM.

You are responsible for ensuring that every mapping identifies the actual reader being used and supplies the correct `model`, `version`, and `padLevel` values expected by IAM. In particular, `padLevel` must correspond to the **ISO/IEC 30107-3 PAD Level** certification of that device.

## Tech5 BTP

The Tech5 integration enables Biometric Template Protection (BTP) for an image captured by the configured reader. It is independent of the Lumidigm reader integration. As prerequisites, obtain **Tech5 OmniMatch SDK 6.10.0 for Windows** and the required license directly from Tech5 Support, then generate the license file by following the SDK's licensing instructions. The integration also requires the SDK's native dependencies and models.

Configure the template-extraction capability in `.env`:

```env
FINGERPRINT_TEMPLATE_EXTRACTOR=tech5
TECH5_SDK_DIR=C:\path\to\Tech5\sdk
TECH5_BTP_DIR=C:\path\to\Tech5\btp
TECH5_LICENSE_FILE=C:\path\to\Tech5\btp\t5omnimatchsdk.lic
TECH5_BTP_SEED1=<deployment-secret-positive-integer>
```

`TECH5_SDK_DIR` is the SDK directory that directly contains `Tech5OmniMatchJavaWrapper-6.10.0.jar` and the Tech5 native libraries. `TECH5_BTP_DIR` is the BTP runtime directory containing the `models` subdirectory. `TECH5_LICENSE_FILE` must identify a readable license file directly within `TECH5_BTP_DIR`.

`TECH5_BTP_SEED1` is a deployment-secret positive integer within the signed 64-bit range. It should be unique to your tenancy and application. The user enters the 6-19 digit seed-2 PIN during enrollment and verification; it is request data, not an `.env` value. The Tech5 extractor combines both seeds when producing the protected template.

Set `FINGERPRINT_TEMPLATE_EXTRACTOR=mock` to use the non-biometric development extractor instead of Tech5 BTP.

## Tests

Run `npm test` from the `idcs-fingerprint-biometrics-app` directory. Tests are stored in `app/test` and cover the phase-specific standard MFA payloads and routes, consent-before-capture sequencing, server-only request state, selected-reader binding, accepted and declined completion, retryable local capture failure, two-step verification behind one browser action, zero/one/ambiguous fingerprint factors, minimal final success, factor deletion, unenrollment UI outcomes, and log redaction. They use local fake IAM and bridge servers; they do not contact real IAM or require reader hardware.

For a manual real-reader test, first verify login and reader readiness. Decline one enrollment and confirm no capture occurs. Start a fresh enrollment, accept, capture, and confirm that only the final PATCH produces the enrollment-success screen. Read the factor list, then verify with the same seed-2 PIN and confirm initiation precedes fresh capture and completion. Finally unenroll, confirm the factor is absent, and verify that another verification attempt reports not enrolled without capture. A successful factor DELETE does not by itself prove downstream ABIS cleanup; use backend logs when that assurance is required.

## Components

| Component | Responsibility |
| --- | --- |
| Browser UI | Shows signed-in identity, reader state, capture quality, and result; never receives biometric material. |
| Node.js server | Binds request to authenticated user, calls bridge, obtains mTLS token, and invokes IAM. |
| Java bridge | Owns vendor Java SDK integration, local raw capture, PAD/quality checks, and template extraction/disposal. |
| IAM / ABIS | OAuth mTLS authentication, biometric orchestration, template storage and 1:1 matching. |

## Production checklist

- For production, use a vetted OIDC library or gateway and cryptographically validate the token used for user binding. Enforce the applicable signature, issuer, audience, nonce, and expiry checks instead of trusting a decoded JWT payload.
- Use a supported/accredited fingerprint reader and a certified extraction/protection flow.
- Use the official IAM endpoints and minimum scopes; never put mTLS private keys in a browser or repository.
- Add tenant-approved audit events with transaction and session correlation IDs, but no templates or raw biometric data.
- Bind to loopback or protect the local service with OS controls; deploy behind TLS and secrets management when used on a VM.
- Treat this as a reference app, not a production biometric SDK or a compliance assertion.
