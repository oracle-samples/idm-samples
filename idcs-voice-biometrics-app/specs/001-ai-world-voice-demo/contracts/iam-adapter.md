# IDCS and IAM Adapter Boundary

## Purpose

The Java IDCS identity adapter is the only boundary allowed to perform IDCS authentication/token
lifecycle calls, and the Java IAM Voice adapter is the only boundary allowed to call IAM Voice
Support capabilities. Both map reviewed provider contracts into application-domain values and do
not expose provider tokens, certificates, private endpoints, raw claims, or raw error payloads to
the browser.

This document defines semantic Java application ports. The IAM mTLS OAuth and secure-MFA details
explicitly recorded below are confirmed by the reviewed source. The custom doctor IDCS sign-in
contract, the source inconsistencies called out below, and every provider behavior not explicitly
listed remain implementation gates. No semantic port name creates a new provider route or field.

## Owned Authority

IDCS remains authoritative for:

- the authenticated subject and identity, supplied either by the locally validated strict JWT
  profile or by the fixed `/admin/v1/Me` response in local-only `DEMO_PROFILE`;

IAM remains authoritative for:

- voice-factor listing, enrollment status, and deletion;
- consent text and the provider-bound accepted state;
- creation and authorization of enrollment and verification voice requests;
- ABIS session token material delivered only to Java; the endpoint is server environment
  configuration and any provider `baseUrl` is ignored;
- enrollment completion and resulting factor status;
- assurance-event audit binding.

The application owns its opaque browser session, safe application IDs, UI state, correlation,
the browser's pending consent intent before provider binding, and a bounded server-only secret
registry. A `SecretHandle` is an opaque, non-serializable application reference into that registry;
it is never a token value, certificate, private endpoint, or browser field.

## Authentication Port

| Semantic operation | Required behavior |
| --- | --- |
| `authenticateWithPassword(credentials)` | Accept a normalized plaintext username in both transport profiles. Apply the active transport policy, then make exactly one Java-to-IDCS HTTPS token request using the configured token endpoint, server-fixed `grant_type=password`, scope, and confidential-client authentication. In default `STRICT_JWT`, validate signature/issuer/audience/subject/time/domain/required claims and the approved-doctor authorization. In local-only `DEMO_PROFILE`, make exactly one fixed HTTPS `GET /admin/v1/Me?attributes=id,ocid,displayName,userName,name,emails`, require `id` and `userName`, and require submitted/profile username equality without an application doctor allowlist. Return a normalized doctor identity plus a `SecretHandle` referencing bounded server-only access-token material. Discard the password immediately; do not retain a demo refresh token. |
| `signOut(applicationSession)` | Atomically make the application session unusable and stop capture/downstream sessions; when approved, resolve its `SecretHandle` only for one bounded server-to-server revocation attempt, then destroy the handle and referenced IDCS token material regardless of outcome. Local sign-out remains effective if revocation is unavailable or fails. |
| `validateApplicationSession()` | Return the normalized authenticated subject or an expired/invalid state without returning IDCS tokens. |

A successful credential exchange sets only the active profile's opaque cookie. `SECURE_DEMO` uses
`__Host-AIWORLD_SESSION` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
`LOOPBACK_HTTP_TEST` uses the distinct host-only `AIWORLD_LOOPBACK_SESSION` with `HttpOnly`,
`SameSite=Strict`, `Path=/`, no `Domain`, no `Secure`, and bounded lifetime. Each profile rejects
the other's cookie; sign-out expires the active cookie, and a Java restart makes any remaining
local cookie unusable. The browser never receives IDCS access/refresh tokens, the confidential-
client credential, provider endpoint, approved scope, or grant controls.

### Password-grant boundary

The browser-facing operation is `POST /api/v1/auth/login`. `SECURE_DEMO` preserves the reviewed
strict JSON object containing normalized `username` and write-only plaintext `password`, sent over
HTTPS. `LOOPBACK_HTTP_TEST` uses a strict object containing the same plaintext normalized
`username` and write-only `passwordEnvelope`; its `GET /api/v1/auth/login-context` response also
returns an ephemeral or rotating public JWK and `kid`. The compact JWE protected header must use
exactly `RSA-OAEP-256` and `A256GCM`; its encrypted plaintext contains only the password and the
same login-context binding. Before the request body reaches the adapter,
the application validates the active profile's exact Origin, Fetch Metadata, and network boundary,
atomically consumes the login context, validates key/context/expiry/algorithm/tag, and applies the
approved login rate limit. Raw-password JSON fields are rejected only by the loopback request
schema. The `grant_type`, identity-domain/token endpoint,
scope, and confidential-client authentication are fixed server configuration and MUST NOT be
accepted from any browser field, header, cookie, URL, or query parameter.

The loopback envelope is defense in depth only. HTTP-delivered JavaScript and the
public key are replaceable by an active intermediary, so JWE is not TLS, transport integrity, or
Java-server authentication and cannot justify a non-loopback origin or additional account.

`LOOPBACK_HTTP_TEST` is fixed to `http://127.0.0.1:8080` and authorizes exactly one externally
provisioned disposable, non-privileged account. The submitted username is rejected before IDCS
unless it exactly matches the provider-approved representation in the ignored single-account
record. After token validation, subject, provider-approved username representation, and identity-
domain claim must match that same record before a session is created. The account's no-production/
admin-entitlement and no-reuse status is an external owner attestation, not a browser claim.

This demo supports only approved local compatible IDCS accounts. External/federated identity
provider authentication is out of scope. Resource Owner Password Credentials enablement, local
account eligibility, MFA compatibility, exact token endpoint, scope, confidential-client
authentication, token claims, refresh-token behavior, logout/revocation behavior, and account
lockout/rate-limit behavior are implementation gates. No value may be guessed or browser-selected.

The server-owned IDCS authentication mode is distinct from the transport profile. `STRICT_JWT` is
the default and only release-capable choice. `DEMO_PROFILE` is a local progress shortcut based on
the supplied Python POC: it requires the client application's **Me** role, does not require
issuer/audience/JWKS/domain/claim-name settings, uses required `/Me.id` as subject and provisional
IAM `userGuid`, and never qualifies as provider-contract or release evidence. The exact
subject-to-IAM-user-GUID mapping remains gated.

## Confirmed IAM service contract

The IAM service credential is distinct from the doctor's IDCS login state. Java obtains an
mTLS-bound OAuth bearer token with the same client certificate that it presents to secure-MFA:

```http
POST https://<tenant>.secure.identity.oraclecloud.com/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=tls_client_auth
client_id=<configured-client-id>
scope=urn:opc:idm:__myscopes__
```

The documented response fields are `access_token`, `token_type` (`Bearer`), and `expires_in`
(`3600`). The access token contains a certificate-confirmation `cnf` claim. Java stores the token
only behind a bounded `SecretHandle`; secure-MFA requests resolve it transiently and use the same
client certificate/key. No browser or application-domain DTO contains the token or mTLS material.

The reviewed OCI IAM Voice Support **version 14** contract confirms `VOICE_BIOMETRIC` and these
resource-specific secure-MFA operations:

- enrollment-status lookup: `GET
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/users/{userId}/factors`;
- current-user voice-factor deletion: `DELETE
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/users/{userId}/factors/{factorId}`;
- enrollment initiation: `POST
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/users/{userId}/factors`;
- enrollment consent acceptance/session authorization and completion: `PATCH
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/users/{userId}/factors/{factorId}`;
- verification initiation: `POST
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/requests`;
- verification completion: `PATCH
  https://<tenant>.secure.identity.oraclecloud.com/mfa/v1/requests/{requestId}`.

Enrollment initiation sends only `method=VOICE_BIOMETRIC`. Its response supplies `factorId`,
`factorStatus=CONSENT_REQUIRED`, `requestState`, and localized consent; enrollment has no
`requestId`. Consent acceptance sends `action=ACCEPTED` plus the current `requestState` to the
factor item. Enrollment completion sends `status=COMPLETED` plus the current `requestState` to that
same factor item. Verification initiation sends `userId`, `userIdType=USER_GUID`, the freshly
resolved voice `factorId`, and `method=VOICE_BIOMETRIC`; its response supplies `requestId`,
`requestState`, and `securityToken`. Verification completion sends `status=COMPLETED` and
`requestState` to the request item. Both completion responses are acknowledgement-only
`{status:"success"}` responses. The demo consumes `securityToken` and `requestState` from IAM but
continues to source the ABIS base URL from ignored server environment configuration; the browser
receives neither token nor endpoint.

The source documents `AUTH-1034` for missing mTLS confirmation/unauthorized access, `AUTH-3018`
for user-not-found, and `AUTH-1137` for a disabled voice factor or invalid method. The duplicate
enrollment example names a different biometric method, so no voice-specific duplicate code is
asserted here.

The public Oracle Identity Domains factor-list contract supplies root `status`, `userGUID`, and
`factors`, with each enrolled factor exposing a `methods` array. Presence of `VOICE_BIOMETRIC`
therefore maps to `ENROLLED`; absence maps to `NOT_ENROLLED`. The target internal tenant was also
verified to return `401/noFactorFound/AUTH-1131` for an account with no enrolled factors. Only that
exact response is normalized to `NOT_ENROLLED`; other error responses remain unavailable.

For voice unenrollment, the authenticated session supplies `userId` server-side. Java performs a
fresh factor-list lookup and selects exactly one well-formed factor whose `methods` array contains
exact `VOICE_BIOMETRIC`; the factor identifier stays inside this adapter. Zero matches means already
unenrolled and issues no DELETE. Multiple matches, missing identifiers, malformed methods,
cross-user bindings, or display-label-only matches fail closed. Java sends at most one DELETE to the
confirmed factor-specific path. Any 2xx response permits a fresh factor-list reconciliation but does
not itself create application success. Only an authoritative post-delete list without a voice
factor returns `DELETED`; an already absent factor returns `ALREADY_NOT_ENROLLED`. Non-2xx,
ambiguous transport completion, or failed refresh is mapped to a typed safe failure/unknown state
and never triggers an automatic destructive retry.
IAM `400/AUTH-1143` means the voice factor is the user's last active 2-Step Verification factor;
Java maps it to `VOICE_UNENROLLMENT_REQUIRES_ANOTHER_FACTOR`, preserves `ENROLLED`, and performs no
broad MFA reset or automatic retry.

The source still omits the consent version/expiry,
cancellation contract, idempotency/retry rules, and assurance-event binding operation. These gaps remain
unresolved; the confirmed routes above must not be extrapolated into missing provider operations.
The target demo integration owner has explicitly retained the secure mTLS host and environment-
configured ABIS WSS base URL, so IAM response `baseUrl` is ignored if present.

## Voice Lifecycle Port

| Semantic operation | Normalized result |
| --- | --- |
| `getVoiceFactorStatus(subject)` | `NOT_ENROLLED`, `ENROLLED`, or a typed unavailable/error state with observation time. |
| `deleteCurrentVoiceFactor(subject, idempotencyKey)` | Derive `userId` from the authenticated subject mapping, list current factors, resolve exactly one `VOICE_BIOMETRIC` factor, issue at most one DELETE for that server-confined factor, and re-list factors. Return `DELETED` or `ALREADY_NOT_ENROLLED` only when the final authoritative list contains no voice factor; otherwise return a typed safe failure. |
| `beginEnrollment(subject, locale, idempotencyKey)` | POST `method=VOICE_BIOMETRIC` to the authenticated user's factor collection and return the new `factorId`, `requestState`, and exact localized consent text. Enrollment has no `requestId`. Any application display-integrity version/expiry is explicitly local metadata because the provider does not document those fields. |
| `recordConsentIntent(attempt, decision, displayedConsentDigest, idempotencyKey)` | Record only the browser's local intent. `DECLINE` is terminal and sends no IAM request. `ACCEPT` does not bind IAM consent and does not authorize ABIS yet. |
| `bindEnrollmentConsentAndCreateSession(attempt, capturePreflight, idempotencyKey)` | Only after accepted local intent and positive microphone/canonical-format preflight, PATCH the factor item with `action=ACCEPTED` and its current `requestState`. That provider request binds consent and returns an updated `requestState` plus `securityToken`; combine these with the server-configured ABIS base URL. |
| `authorizeVerification(subject, capturePreflight, idempotencyKey)` | For an enrolled subject and successful preflight, refresh the factor list, resolve exactly one voice factor, then POST `userId`, `userIdType=USER_GUID`, `factorId`, and `method=VOICE_BIOMETRIC` to the verification request collection. Return request correlation plus a fresh server-only handle for `securityToken`; combine it with the configured ABIS base URL. |
| `completeEnrollment(request, terminalAbisResult, idempotencyKey)` | After ABIS returns terminal enrollment success, rejection, or processing failure, PATCH the factor item with `status=COMPLETED` and the latest `requestState` exactly once. Treat `{status:"success"}` only as lifecycle acknowledgement, then refresh factor status; report enrollment success only when ABIS succeeded and the factor list confirms `ENROLLED`. |
| `completeVerification(request, terminalAbisResult, idempotencyKey)` | After ABIS returns a terminal verification outcome or terminal processing failure, move the normalized request from `RESULT_AVAILABLE` to `COMPLETION_PENDING` and PATCH the request item with `status=COMPLETED` and the latest `requestState`. Treat `{status:"success"}` as lifecycle acknowledgement. Do not include the ABIS outcome or failure, and never change the application-visible ABIS result. |
| `cancelVerification(request, reason, idempotencyKey)` | Move the normalized request to `CANCELLATION_PENDING`, stop application/ABIS/Speech work, and return `CANCELLED` only according to the approved IAM cancellation semantics. The reviewed source defines no cancellation route or payload, so this provider action remains blocked rather than being guessed. |
| `bindAssuranceEvent(result, idempotencyKey)` | Declared application semantic only. The exact IAM route, authentication, request/response fields, result mapping, errors, retry, and idempotency contract must be approved before T101 or T106 can implement or call it. Its eventual `ACCEPTED`, `PENDING`, or typed `FAILED` result never alters the biometric outcome. |

These names describe application semantics, not provider SDK methods or HTTP paths.

Browser consent acceptance is local intent, not IAM-bound consent and not authorization to create
a voice session. `capturePreflight` is an application-bound assertion accepted only after the
browser has confirmed microphone permission, input availability, and the exact canonical audio
profile. A missing, denied, unavailable, stale, or incompatible preflight fails before the single
IAM `action=ACCEPTED` enrollment request and opens no ABIS or OCI Speech connection. The assertion
is not forwarded to IAM. After successful preflight, the one `action=ACCEPTED` request both binds
IAM consent and returns ABIS authorization; there is no second provider authorization operation.

### Normalized verification request states

The application state machine is `ELIGIBILITY_CONFIRMED -> AUTHORIZATION_PENDING -> AUTHORIZED ->
STREAMING -> RESULT_AVAILABLE -> COMPLETION_PENDING -> COMPLETED`. Cancellation from any live state
after authorization follows `CANCELLATION_PENDING -> CANCELLED`; terminal processing or contract
errors follow `FAILED`. These are application states, not claims about undocumented IAM
`requestState` values. IAM authorization completes over HTTP before `PREAUTHORIZED`; only ABIS and
OCI Speech participate in streaming readiness and WebSocket branch state.

## Security Boundary

- The Java confidential client owns the one-use password exchange, token validation and bounded
  server-side token state. It makes no automatic retry of an authentication request.
- `SECURE_DEMO` accepts only HTTPS/WSS. `LOOPBACK_HTTP_TEST` accepts only exact
  `http://127.0.0.1:8080` and rejects non-loopback peers, `localhost`, unexpected Host/Origin/port,
  and all forwarded/proxy headers before credential decryption or provider access.
- Java sends the supplied password only in the body of that single TLS-protected IDCS token
  request. Request-body logging, tracing, metrics capture, caching, exception serialization, heap
  diagnostics in the demo environment, and credential-bearing retries are disabled or redacted.
  Application references to the password are dropped immediately after the request finishes.
- Token endpoint, `grant_type=password`, scope, domain and confidential-client authentication are
  server-controlled. The browser cannot override, select or observe them.
- Secure IAM Voice calls use the reviewed mTLS-bound service-token mechanism and required
  client-certificate binding.
- Java-to-IDCS is certificate-validating HTTPS and Java-to-IAM is certificate-validating
  HTTPS/mTLS in both browser-facing profiles. No loopback setting may weaken provider TLS.
- Private keys, client secrets and certificates come from the approved secret source or read-only
  mount and are never packaged into the application artifact.
- IAM service tokens, IDCS tokens, ABIS session tokens and private endpoints remain behind typed,
  bounded `SecretHandle` references in server memory for the minimum required lifetime. Handles
  are destroyed on terminal completion, cancellation, expiry, sign-out, or dependency failure.
- Provider identifiers included in evidence are masked application references.
- Application journey identifiers are never placed in browser URLs or `Location` headers. The
  browser carries the minimum opaque identifier only in no-store JSON bodies/events; provider IDs
  remain adapter-side or are replaced with application-minted masked references.
- Raw provider errors are translated to stable stage-specific codes before crossing the adapter.
- Authentication and voice transactions use separate correlation namespaces and cannot be
  confused with authorization decisions derived from voice assurance.

## Idempotency and Ordering

- Credential login is intentionally non-idempotent and is never automatically retried. Each
  explicit user submission produces at most one IDCS password-grant request. A timeout or ambiguous
  transport failure returns a safe failure and creates no application session.
- The configured identity domain is fixed. In `STRICT_JWT`, an unexpected issuer, audience,
  signature, subject, expiry, or required claim fails closed. In `DEMO_PROFILE`, a failed or
  malformed `/admin/v1/Me`, missing `id`/`userName`, or submitted/profile mismatch fails
  closed. Neither path creates an application session on failure.
- Local consent intent is bound to subject, factor, attempt and the digest of the exact displayed
  text. Reuse with a different decision or digest is a conflict. Only the post-preflight
  `action=ACCEPTED` request creates provider-bound consent and ABIS authorization.
- Enrollment consent binding/authorization requires accepted local intent and successful capture
  preflight for the same active attempt. Verification authorization requires successful preflight
  for the authenticated, enrolled subject. Neither operation may be invoked on intent or
  eligibility alone.
- Enrollment/verification authorization, completion, and assurance binding accept an
  application idempotency key. The adapter maps it to the reviewed provider mechanism when one
  exists and otherwise enforces bounded application-side deduplication.
- Voice-factor deletion accepts an application idempotency key and serializes one active mutation
  per application session. Same key replays only the normalized semantic result. Java never retries
  provider DELETE after timeout or ambiguous completion; it uses the read-only factor list to
  reconcile whether the voice factor remains.
- A future approved assurance-event idempotency key will be derived from canonical voice session,
  utterance, and terminal ABIS result. Until its exact provider contract is approved, Java makes
  no assurance-binding call or retry. Any later approved retry must never replay audio or change
  the result.
- Enrollment completion cannot precede successful ABIS enrollment completion; final UI status is
  refreshed from IAM after completion. Verification completion cannot precede a terminal ABIS
  result and cannot be implemented until the result-to-IAM mapping is approved.

## Timeouts and Retry Policy

- Every IAM connection attempt has a 3-second connect deadline and a 10-second response deadline.
- A credential authentication exchange has one attempt only. Java never automatically resends a
  username or password after rejection, timeout, connection failure, or ambiguous response.
- Only operations whose approved provider contract classifies them as safely idempotent/retryable
  may use at most three total attempts. Delay is exponential from 250 ms with 20% jitter, subject
  to the operation deadline and provider retryability classification. An unresolved operation,
  including assurance binding and verification cancellation, receives no provider retry.
- Credential authentication, token validation failures, and other non-idempotent or ambiguous
  provider operations are not retried automatically.
- IAM retries repeat only the semantic control/audit call with the same application idempotency
  key. They never reopen capture, reconnect a streaming branch, replay audio, or alter a terminal
  MATCH/MISMATCH/INCONCLUSIVE result.

## Error Mapping

At minimum the adapter must distinguish:

- generic credential rejection without disclosing whether the username exists or whether an
  account is disabled, incompatible, federated, MFA-bound or locked;
- rejected login Origin/CSRF/rate limit at the application boundary;
- malformed, untrusted, expired, wrong-issuer, wrong-audience or wrong-subject IDCS token in
  `STRICT_JWT`, or a failed/malformed/mismatched `/admin/v1/Me` projection in `DEMO_PROFILE`;
- password-grant transport/dependency failure with no raw IDCS response detail;
- unauthenticated or expired application session;
- voice factor disabled or unavailable;
- user not found or not an approved demo identity;
- already enrolled / not enrolled state conflict;
- consent missing, declined, stale or version-conflicted;
- mTLS or token acquisition/validation failure;
- voice authorization expired, wrong-subject or wrong-scope;
- enrollment completion conflict/failure;
- verification completion or cancellation contract/state failure;
- assurance binding retryable/final failure.

Every mapping declares stage, normalized `failureKind`, safe code, retryability and terminality.
The kind structurally distinguishes authentication, authorization, transport, timeout, protocol,
dependency and internal failures. No mapped error may reveal a token, certificate, private URL,
raw claim set or provider payload.

## Contract Tests

The adapter contract suite must cover:

1. Successful local-account password grant uses the configured endpoint, fixed
   `grant_type=password`, approved scope and configured client authentication exactly once;
   `STRICT_JWT` validation or the exact one-call `/admin/v1/Me` profile projection precedes opaque
   application-session creation.
2. Unknown user, wrong password, disabled/incompatible account and other credential rejection use
   the same safe `401` status/body shape/wording and create no application session or identity
   display.
3. Runtime-context and login-context require exact peer/Host and same-origin Fetch Metadata,
   accept an absent `Origin` only for those safe no-store GETs, and reject `Origin: null` or any
   mismatched supplied `Origin`; credential login rejects a
   wrong/missing exact `Origin` or Fetch Metadata and a
   missing, expired, reused, or otherwise invalid one-time anti-forgery token, with safe
   `403`, enforces the approved rate limit with safe `429`, and never forwards credentials on
   either path.
4. Authentication is never automatically retried. Passwords and IDCS tokens are absent from
   browser storage, responses, URLs, logs, traces, metrics, error bodies, crash diagnostics and
   packaged artifacts; only the opaque cookie reaches the browser.
5. Wrong JWT issuer, audience, signature, subject, time or required claim in `STRICT_JWT`, or a
   rejected/malformed `/admin/v1/Me`, missing required profile field, username mismatch, or absent
   **Me** application role in `DEMO_PROFILE`, fails closed. Approved
   local-account behavior passes; federated and MFA-bound behavior matches the reviewed gate and
   is never guessed.
6. Sign-out clears local state and server tokens even when remote revocation is unavailable or
   fails.
7. Enrollment status gates Enroll, Verify, and Delete voice enrollment correctly.
8. The exact consent text and application display-integrity digest are displayed; decline creates
   no IAM call or voice authorization, and Accept records local intent only.
9. Accepted local intent plus successful microphone/canonical-format preflight causes exactly one
   IAM `action=ACCEPTED` request that both binds provider consent and produces a server-only
   `SecretHandle` for enrollment authorization. Accepted intent alone, denied permission, a
   missing device, or an unsupported format produces no IAM acceptance/authorization request or
   downstream connection; no second provider authorize call exists.
10. Enrollment is reported only after ABIS completion and IAM confirmation.
11. Duplicate completion and assurance binding are idempotent.
12. Assurance-binding failure changes audit state only, never biometric outcome.
13. Successful verification preflight produces fresh server-only authorization for the enrolled
    subject; failed preflight produces no IAM voice-session authorization.
14. Verification completion follows `RESULT_AVAILABLE -> COMPLETION_PENDING -> COMPLETED` only
    under the approved ABIS-result mapping; verification cancellation follows
    `CANCELLATION_PENDING -> CANCELLED` only under the approved IAM cancellation contract.
15. Secret token material and private ABIS endpoints are reachable only through expiring
    `SecretHandle` references and cannot be serialized to browser or evidence DTOs.
16. Confirmed self-service voice deletion derives both provider identifiers server-side, selects
    exactly one `VOICE_BIOMETRIC` factor, deletes it at most once, verifies absence with a fresh
    factor list, preserves unrelated factors, and exposes no identifiers or raw provider payload.
    Cancel, zero/multiple/malformed matches, active capture, stale state, expired authentication,
    dependency failure, and duplicate submission delete no alternative factor and fabricate no
    state. Every broader test-account administrative reprovisioning operation remains external.
17. In `LOOPBACK_HTTP_TEST`, the login context supplies a bounded public JWK/`kid`; only one compact
    `passwordEnvelope` JWE using `RSA-OAEP-256` and `A256GCM` is accepted. The normalized username
    remains plaintext, and the encrypted plaintext contains only the password and context binding.
    Wrong/missing key, context, expiry, algorithm or tag, raw-password fields, and replay fail
    before IDCS. `SECURE_DEMO` retains the username/password HTTPS request. Evidence states that
    loopback wrapping is defense in depth and not equivalent to TLS.
18. `LOOPBACK_HTTP_TEST` accepts only exact `127.0.0.1:8080` network/origin invariants and the sole
    configured submitted username; post-token subject, username and domain match the same account.
    Alternate peers, Host/Origin/ports, forwarding headers, usernames and token identities fail
    before the next protected boundary.
19. Profile-cookie tests prove distinct names/attributes, zero cross-profile acceptance, sign-out
    deletion, and server-state invalidation after restart.
20. Positive microphone/canonical-audio preflight precedes every loopback IAM enrollment mutation
    or verification authorization, and one browser `ws://` connection fans out only after IAM HTTP
    preauthorization completes.
21. Java-to-IDCS stays certificate-validating HTTPS and Java-to-IAM stays certificate-validating
    HTTPS/mTLS in both profiles; insecure provider configuration fails closed.

Automated contract tests may use test-scope HTTP fixtures with synthetic provider responses. Those
fixtures are never runtime adapters, selectable application configuration, packaged code, or a
source of deployed identity or enrollment state.

## Implementation Gates

Implementation cannot begin until all of these are reviewed:

- IDCS trusted/confidential application registration and explicit enablement of Resource Owner
  Password Credentials for this demo;
- the exact identity-domain token endpoint, fixed `grant_type=password`, approved scopes and
  confidential-client authentication method;
- approved local compatible demo accounts, explicit external-federation exclusion, MFA
  compatibility, and account lockout/rate-limit behavior;
- approved issuer, audience, subject/username claims, signing keys and clock-skew rules for
  `STRICT_JWT`, or the exact `/admin/v1/Me` role/path/attributes/response/error/lifetime contract
  for any future approved profile-based mode;
- access/refresh-token issuance and lifetime rules, whether refresh is needed, and logout/token
  revocation or disposal behavior;
- session cookie and idle/absolute expiry policy;
- reviewed `SECURE_DEMO`/`LOOPBACK_HTTP_TEST` separation, exact loopback network boundary, sole
  account record and external classification, distinct cookie policy, JWE key/context lifecycle,
  and automated fail-closed evidence;
- exact IAM Voice Support operations, payloads, factor-status values and error taxonomy;
- consent versioning and localization semantics;
- service-token and mTLS certificate-binding requirements;
- ABIS session authorization shape and expiry;
- enrollment completion and assurance-event binding idempotency;
- exact verification cancellation operation and its terminal-state mapping; documented successful
  verification completion is implemented only after an ABIS terminal result;
- exact assurance-event binding route, authentication, request/response fields, error taxonomy,
  retry, and idempotency semantics; T101 and T106 remain blocked until this is approved;
- live tenancy, certificate and policy configuration.

No unreviewed route, grant type, token field, claim, response field, MFA/federation behavior,
client-authentication method, revocation behavior or retry policy may be introduced as an assumed
provider contract.
