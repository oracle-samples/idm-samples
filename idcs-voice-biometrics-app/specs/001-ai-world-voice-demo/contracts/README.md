> SDK integration update: fork-specific capture/progress details are superseded by [feature002](../../002-reviewed-sdk-integration/contracts/sdk-handoff.md). The existing IAM, authentication and Speech ownership contracts remain.

# AI World Voice Identity Contracts

This directory defines the proposed application-facing contracts and adapter boundaries for the
AI World Voice Identity demo. The browser contracts are **DRAFT** while the following recorded
gates remain open. These drafts do not expose IAM, ABIS, or OCI Speech credentials or private
endpoints to the browser.

| Gate | Current status | Approval blocker |
| --- | --- | --- |
| T001 | **PARTIAL** | The IDCS password-grant contract, IAM source inconsistencies, verification cancellation semantics, and exact assurance-event binding contract remain unresolved. The documented successful verification-completion request is implemented. |
| T002 | **REMEDIATION PENDING** | The supplied ABIS SDK must pass the recorded security and application-contract remediation gate. |
| T003 | **LIVE VALIDATION PENDING** | OCI Speech session-token authentication and real-time streaming require a live local smoke test. |
| Loopback profile | **BLOCKED BEFORE ENABLEMENT** | The exact boundary, sole-account, cookie, JWE, microphone, one-socket, downstream-security, warning, cleanup, and evidence-exclusion tests require review. |

## Contract Set

| File | Scope |
| --- | --- |
| `openapi.yaml` | Same-origin browser HTTP API under `/api/v1` |
| `asyncapi.yaml` | One browser-to-Java WebSocket at `/ws/v1/voice` |
| `iam-adapter.md` | Java-to-IDCS/IAM semantic adapter boundary |
| `abis-adapter.md` | Java-to-ABIS SDK and WebSocket adapter boundary |
| `speech-adapter.md` | Java-to-OCI Speech real-time adapter boundary |

## Server-Owned Runtime Profiles

The browser can read, but cannot select or modify, the active profile through the no-store
`GET /api/v1/runtime-context` projection. That projection uses the exact fields
`transportProfile`, `browserTransport`, `evidenceClassification`, `warningRequired`, and optional
`warningText` defined by OpenAPI.

| Profile | Browser origin and socket | Session cookie | Permitted evidence |
| --- | --- | --- | --- |
| `SECURE_DEMO` | Same-origin HTTPS and `wss://`; approved origin supplied by deployment configuration | `__Host-AIWORLD_SESSION`; host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, bounded | May contribute to release/live evidence only after all independent gates pass |
| `LOOPBACK_HTTP_TEST` | Exactly `http://127.0.0.1:8080` and at most one same-origin `ws://127.0.0.1:8080/ws/v1/voice` per capture | `AIWORLD_LOOPBACK_SESSION`; host-only, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Secure`, bounded | `LOCAL_DEVELOPMENT_ONLY`; never remote-browser, transport-security, deployment, timed final-demo, or go/no-go evidence |

For `LOOPBACK_HTTP_TEST`, Java binds only to `127.0.0.1` and rejects `localhost`, alternate
loopback aliases, non-loopback peers, unexpected Host/Origin/port values, `Origin: null`, and any
`Forwarded` or `X-Forwarded-*` header before credential processing or provider access. It accepts
exactly one externally provisioned, explicitly allowlisted, disposable, non-privileged IDCS
account. The submitted username must match before IDCS; the validated subject, provider-approved
username representation, and identity-domain claim must match the same ignored record before
session creation. The record contains no password or token.

The two no-store, read-only bootstrap GETs—`/api/v1/runtime-context` and
`/api/v1/auth/login-context`—may omit `Origin` only when exact peer/Host, same-origin Fetch
Metadata, and no-forwarding checks pass; any supplied Origin must match exactly. Credential login,
sign-out, every other state-changing request, and WebSocket upgrade require the exact Origin.

The two cookie names and server registries are profile-isolated. Each profile rejects the other's
cookie. Sign-out expires the active cookie, and process termination destroys server session state,
making any remaining loopback cookie unusable.

## Server-Owned IDCS Authentication Modes

The IDCS authentication mode is immutable server configuration and is independent of the runtime
transport profile. It is never accepted from or projected to the browser.

| Mode | Identity source after the fixed password grant | Evidence status |
| --- | --- | --- |
| `STRICT_JWT` (default) | Locally validated JWT signature, issuer, audience, time, domain, subject, username, and user-GUID claims | May become release-capable after T001/T006 approval |
| `DEMO_PROFILE` | One certificate-validating HTTPS `GET /admin/v1/Me` with exact attributes `id,ocid,displayName,userName,name,emails`; required `id` and `userName` | Local progress only; never release/provider-contract evidence |

`DEMO_PROFILE` requires the IDCS client application's **Me** role but not issuer, audience, JWKS,
domain-claim, claim-name, or approved-doctors-file configuration. Java requires the returned
normalized username to equal the submitted username, uses `id` as the local subject and
provisional IAM user GUID, ignores any refresh token, and keeps the access token only behind a
bounded server-side `SecretHandle`. The exact subject-to-IAM-user-GUID mapping remains a T001 gate.

After the approval gate is satisfied, the reviewed OpenAPI and AsyncAPI documents become normative
for the Oracle JET browser and Java backend, and the reviewed adapter documents become normative at
the Java application-port boundary. Until then they are design proposals. They intentionally do
not invent provider endpoint paths, SDK classes, callback signatures, claims, or tenant values
that are not present in an approved provider contract.

## Versioning

- The initial application contract version is `1.0.0`; the additive voice-unenrollment HTTP
  resource advances the draft contract document to `1.1.0` without changing WebSocket protocol
  version `1.0`.
- HTTP resources are rooted at `/api/v1`.
- Every WebSocket JSON command and event carries `protocolVersion: "1.0"`.
- Verification adds `utterance.started`, `utterance.sealed`, and the subminimum cleanup event
  `utterance.discarded` under protocol `1.0`. Older consumers ignore these additive event types;
  current consumers use their one opaque `utteranceId` to combine Speech text and ABIS outcomes
  in the same chronological row.
- Before approval of this still-draft protocol, enrollment progress is reconciled to require
  `utteranceOrdinal` and `acceptedUtteranceCount` and to use a 8,000-ms per-sample target. Producer
  and consumer ship together under protocol `1.0`; this draft change is not represented as
  backward-compatible with an already deployed consumer.
- Additive optional fields and new event types require a reviewed minor-version contract update and
  coordinated producer/consumer rollout before they are sent.
- Removing fields, changing required-field semantics, changing an enum meaning, or changing binary
  audio framing requires a new major HTTP/protocol version.
- Under a negotiated contract version, unknown fields inside strict HTTP request objects,
  WebSocket command payloads, and event payloads are rejected with a typed
  `protocol.unsupported_field` error where the schema declares `additionalProperties: false`.
  Unknown optional fields at the extensible top-level WebSocket envelope are ignored after all
  known envelope fields validate, enabling coordinated minor-version additions. Unknown event
  types produce `protocol.unsupported_event`; no unknown field or event is interpreted as a known
  one.

## Lifecycle Projection Mapping

- OpenAPI `VoiceSessionState` is the complete server lifecycle. `AUTHORIZING` and `PREAUTHORIZED`
  occur before the browser opens a WebSocket.
- A successful `POST /api/v1/voice-session` response is constrained to `PREAUTHORIZED`.
- AsyncAPI `VoiceSessionState` starts at `BINDING` and is the exact socket-visible subset:
  `BINDING`, `READY`, `CAPTURING`, `PAUSED_BACKPRESSURE`, `DRAINING`, `COMPLETED`, `FAILED`,
  `CANCELLED`, `EXPIRED`, and `DISCONNECTED`.
- After `session.bind`, Java enters `BINDING`; it emits `session.bound` only when both logical
  streaming branches are `READY`, and that event is constrained to session state `READY`.
- Streaming-readiness resources, voice-session arrays, and WebSocket branch arrays contain exactly
  the two streaming branches, `ABIS` and `SPEECH`. IAM authorization and audit are HTTP control
  operations modeled separately and never a streaming readiness branch.
- Both OpenAPI and AsyncAPI use the same branch processing states: `NOT_STARTED`, `CONNECTING`,
  `READY`, `PROCESSING`, `DRAINING`, `COMPLETED`, `FAILED`, and `TIMED_OUT`.

## Trust and Transport Boundary

- Browser traffic follows the active server-owned profile above. `SECURE_DEMO` uses same-origin
  HTTPS/WSS. The only HTTP exception is exact `LOOPBACK_HTTP_TEST`; it cannot be proxied, widened to
  another address/account, or called release-ready.
- The custom Oracle JET login page first calls the no-store same-origin
  `GET /api/v1/auth/login-context` operation to receive a one-time, short-lived anti-forgery token
  held only in memory. In `LOOPBACK_HTTP_TEST` the context additionally supplies a public JWK and
  `kid`. Java stores only bounded context/key state for at most two minutes, allows at most 1,000
  outstanding contexts per instance, and atomically consumes the context before any IDCS call.
  `SECURE_DEMO` sends a strict plaintext `username`/`password` JSON object over HTTPS.
  `LOOPBACK_HTTP_TEST` sends plaintext normalized `username` plus a compact write-only
  `passwordEnvelope`; the JWE protected header must use exactly `RSA-OAEP-256` and `A256GCM`, and
  its encrypted plaintext contains only the password and login-context binding. Raw-password fields
  in the loopback request, wrong/missing key or context, expiry, wrong algorithms, tag failure, and
  replay are rejected before IDCS. The safe login-context GET requires exact same-origin Fetch Metadata
  and rejects a mismatched `Origin` when the browser supplies one; the runtime-context safe GET has
  the same rule because the Fetch standard does not reliably include `Origin` on same-origin
  GET/HEAD requests. The credential-bearing POST requires
  the exact configured `Origin`, exact Fetch Metadata, the consumed token, and the approved login
  rate limit before credentials are forwarded.
- JWE wrapping is mandatory for `LOOPBACK_HTTP_TEST` as defense in depth, not TLS, transport
  integrity, or Java-server authentication. HTTP-delivered JavaScript and the public key are
  replaceable by an active intermediary. JWE never permits remote HTTP, another account, or weaker
  downstream transport.
- Java makes exactly one IDCS token request with the server-configured endpoint, fixed
  `grant_type=password`, approved scope and confidential-client authentication. Those controls are
  neither accepted from nor returned to the browser, and the authentication request is never
  automatically retried.
- After secure-profile HTTPS request parsing or loopback request-scoped JWE decryption, the
  submitted password is sent only in that one
  certificate-validating TLS-protected IDCS token request and is made
  unreachable immediately afterward. It never appears in browser storage, responses, URLs,
  cookies, application sessions, logs, traces, metrics, errors, crash diagnostics, or packaged
  artifacts.
- `STRICT_JWT` validates the approved returned-token profile before session creation.
  `DEMO_PROFILE` instead requires a successful fixed `/admin/v1/Me` response and exact
  submitted/profile username equality, with no application doctor allowlist. Both paths issue only the active transport
  profile's opaque application cookie and keep provider tokens server-side.
- The browser never receives IDCS access/refresh tokens, client credentials, scopes, provider
  endpoints, IAM service tokens, or downstream credentials. Only approved local compatible IDCS
  accounts are supported; external/federated login is out of scope, and MFA compatibility remains
  an explicit gate.
- Java keeps IDCS tokens, the mTLS-bound IAM service token, and ABIS `securityToken` plus private
  `baseUrl` material only in a bounded server-side secret registry. Application code receives an
  opaque, expiring `SecretHandle`; neither its referenced value nor private endpoint is
  serializable into browser, evidence, log, metric, trace, or error DTOs.
- Login rejection is generic and does not disclose whether a user exists or an account is
  disabled, incompatible, locked, federated or MFA-bound. Provider unavailability is returned only
  as a safe dependency failure without raw IDCS detail.
- Sign-out immediately invalidates local access. Java retains any revocation input only long enough
  to make the approved bounded provider-revocation attempt and then discards all server-side token
  material regardless of the outcome; no browser SSO redirect is used.
- Authenticated state-changing HTTP operations require the application's CSRF header, except the
  naturally idempotent sign-out endpoint. Sign-out is callable with or without a usable session,
  can only end local state and expire the cookie, and always requires exact Origin/Fetch-Metadata
  validation.
- Successful login and the authenticated, no-store `GET /api/v1/me` response supply a session-bound
  `X-CSRF-Token`, so sign-out remains callable even if enrollment-status retrieval is unavailable.
  Oracle JET keeps it in memory only, sends it on mutations, and fetches a fresh value after application-session
  rotation. The token is never placed in a URL, readable cookie, browser storage, analytics, or
  log.
- If IAM enrollment status is unavailable, `/me` still returns the validated username with
  `UNKNOWN`, `TEMPORARILY_UNAVAILABLE`, and only `SIGN_OUT`; the separate status endpoint supplies
  the retry path. Enroll and Verify never become available from stale or failed status.
- `DELETE /api/v1/voice/enrollment` accepts no request body or provider identifier. It requires the
  authenticated session, exact same-origin mutation checks, CSRF, and an idempotency key. Java
  derives the current IAM user, resolves exactly one `VOICE_BIOMETRIC` factor from a fresh factor
  list, attempts its provider DELETE at most once, and returns success only after a second factor
  list proves absence. Zero matches is already unenrolled; ambiguous or malformed matches delete
  nothing. The response exposes only a normalized outcome and refreshed status/actions.
- A Java response filter applies `Cache-Control: no-store` to every authentication and
  authenticated response, including identity, consent, session, evidence, and problem responses.
- HTTP resource URLs are identifier-free and resolve the one current active or most recent journey
  for the authenticated application session. `enrollmentAttemptId`, `voiceSessionId`, and
  `utteranceId` appear only in no-store JSON bodies/events, never in a URL, `Location` header,
  access-log target, or analytics route.
- The WebSocket upgrade validates the active profile's cookie, exact allowed `Origin`, peer/Host
  boundary, and voice-session ownership. `LOOPBACK_HTTP_TEST` also rejects every forwarding header.
- `/ws/v1/voice` is constant. Tokens, downstream endpoints, and downstream identifiers never
  appear in its URL.
- A successful HTTP voice-session creation preauthorizes one `voiceSessionId` for the current
  application session. The first WebSocket JSON command must be `session.bind` for that identifier.
- A voice session can be bound to only one active browser WebSocket. A second bind is rejected.
- The browser never connects directly to IDCS/IAM, ABIS, or OCI Speech and never receives an IAM
  service token, ABIS session token, OCI Speech token, mTLS material, or private endpoint.

## Microphone Preflight Boundary

- Enrollment `ACCEPT` records only local browser intent against the exact displayed consent. It
  does not yet bind IAM consent or obtain ABIS authorization. `DECLINE` is terminal locally and
  sends no IAM request.
- After accepted local intent, the browser obtains microphone permission, confirms that the
  selected input is still available, and verifies that it can produce the supported application
  audio profile before calling `POST /api/v1/voice-session`.
- Under `LOOPBACK_HTTP_TEST`, the browser must first confirm that the exact
  `http://127.0.0.1:8080` origin is microphone-capable. Failure of that capability check is treated
  like permission or format failure and occurs before any IAM mutation, voice session, application
  socket, ABIS connection, or Speech connection.
- The creation request carries only a positive preflight assertion and the supported audio
  profile. It carries no device identifier, label, hardware fingerprint, or permission metadata.
- Permission denial, device loss, or format incompatibility is handled locally with actionable
  guidance. In those cases the browser sends no voice-session request, opens no application
  WebSocket, and therefore causes no IAM voice authorization, ABIS connection, or OCI Speech
  connection.
- After a successful enrollment preflight, Java makes exactly one confirmed IAM secure request
  with `action=ACCEPTED`. That single provider request both binds IAM consent and creates
  `requestState` plus `securityToken` for ABIS; Java combines these with the ABIS base URL loaded
  from ignored environment configuration. There is no separate provider enrollment-authorization call.
- For verification, successful preflight precedes the confirmed IAM authentication-initiation
  semantic. IAM HTTP authorization must complete before `PREAUTHORIZED`; only ABIS and Speech then
  participate in WebSocket streaming readiness.

## WebSocket Framing

- JSON text frames carry commands and events defined by `asyncapi.yaml`.
- Binary frames contain only negotiated PCM audio bytes. They contain no JSON, token, session ID,
  or provider-specific header.
- WebSocket frame order is the browser audio order. Java assigns a monotonic `audioSequence` after
  accepting a frame.
- The negotiated baseline is mono, signed 16-bit little-endian PCM at 16 kHz with nominal 20 ms
  frames. ABIS SDK validation remains an implementation gate; a contract change is required if
  the canonical profile changes.
- The browser performs no VAD, silence trimming, turn splitting, diarization, or speaker labeling.
  The reviewed SDK VAD inside Java is the sole verification-window boundary authority; the
  application mints the canonical ID and the ABIS adapter projects lifecycle and results.

## Identifiers and Correlation

- `applicationSessionId` is server-side and is not returned as a browser credential.
- `voiceSessionId` is an opaque application identifier bound to the authenticated session. It is
  not an IAM, ABIS, or OCI Speech identifier.
- `eventId` uniquely identifies a JSON command/event. Repeating the same `eventId` and body is
  idempotent; reusing it with a different body is a protocol error.
- `clientSequence` is monotonic for client JSON commands on one bound WebSocket.
- `eventSequence` is monotonic for server JSON events on one voice session.
- `audioSequence` is assigned by Java to each accepted binary frame.
- `utteranceId` is minted by Java when SDK VAD confirms speech start. Seal, transcript, assurance,
  and processing events preserve it; a subminimum discarded provisional window is withdrawn.
- `correlationId` is the safe application correlation identifier used across HTTP problems,
  WebSocket events, evidence, and masked logs.
- Speech and ABIS results map to an utterance by accepted audio sequence/time range. Transcript
  text and event arrival order are never correlation keys.
- Downstream identifiers remain adapter metadata and are masked before any evidence is returned.
- Evidence uses named masked doctor, application-session, IAM voice-request, biometric-session,
  Speech-result, and ABIS-result fields rather than a free-form correlation map; required journey
  correlations therefore remain contract-testable.
- HTTP utterance-evidence resources are verification-only because only verification creates an
  `AssuranceResult`. Enrollment progress and live transcript events remain available on the active
  WebSocket but are never projected as a not-eligible biometric result.
- Browser WebSocket envelopes do not expose provider event IDs or provider sequence numbers.
  Provider deduplication and raw correlation remain server-side; browser ordering uses only
  application-minted `eventId`, `eventSequence`, and `correlationId`.
- Every verification `assurance.result` includes a required positive `utteranceOrdinal` and an
  opaque `utteranceId`. Results accumulate throughout capture and do not complete the voice
  session; only terminal ABIS completion (followed by IAM completion) emits `session.completed`.
- Every enrollment `enrollment.progress` includes the current positive `utteranceOrdinal`, the
  number of already accepted samples, and progress from 0 through the fixed 8,000-ms target for
  that sample. A later ordinal may reset progress; the total required sample count is unknown and
  absent from the browser contract.

## Idempotency and Monotonic State

- Voice, local consent-intent, and evidence mutations use `Idempotency-Key`. Same key plus same
  request returns the original semantic result. Same key plus a different request returns
  `409 Conflict`.
- Voice unenrollment additionally allows only one in-flight mutation per application session.
  Provider DELETE is never automatically retried after timeout or ambiguous completion; read-only
  factor reconciliation is the only recovery path.
- Sign-out instead has naturally idempotent local semantics: with or without an already-ended local
  session it returns `204` and an expired cookie after Origin/Fetch-Metadata validation.
- Duplicate JSON commands/events are ignored after their original result is replayed or retained.
- Partial transcript revisions increase monotonically. A final transcript cannot return to
  partial.
- Assurance outcomes are only `MATCH`, `MISMATCH`, and `INCONCLUSIVE`.
- `FAILED` and `TIMED_OUT` are processing states/events, never biometric outcomes and never mapped
  to `MISMATCH`.
- Every safe failure carries a separate normalized `failureKind` (for example `QUALITY`,
  `TRANSPORT`, or `TIMEOUT`) plus stage and safe code. Raw provider error detail never crosses the
  adapter boundary.
- Terminal branch/session states never regress. A conflicting second terminal result raises a
  typed contract error and preserves the first accepted result for evidence.
- Until the exact assurance-event binding contract is approved, Java makes no binding call or
  retry. Any later approved retry may repeat only that semantic control call; it never replays
  audio or changes the ABIS outcome.

## Credit Window and Bounded Queues

- Java sends a `credit.window` event after binding and whenever capacity changes.
- The HTTP voice-session response authorizes binding but grants no audio credit. Initial positive
  credit exists only in `session.bound` after both downstream branches are READY.
- The baseline browser window is 50 frames and 32,000 bytes (one second of nominal audio); each
  frame is at most 640 bytes for the negotiated baseline profile.
- The browser may send a binary frame only when both frame and byte credit are available. It
  decrements local credit immediately on send.
- Java sends cumulative `audio.ack` events after frames are accepted into every currently active
  required branch. Acknowledgement replenishes credit.
- Each downstream branch has a bounded queue of 100 frames and 64,000 bytes (two seconds of
  nominal audio). Both limits apply; neither queue may grow without bound.
- When a required queue reaches its high-water mark, Java advertises zero credit and the browser
  pauses capture. Audio is never silently dropped.
- A client that sends beyond credit receives `flow.credit_exceeded`; Java stops accepting audio
  and terminates or drains the session according to its current state.
- ABIS and Speech readiness, queueing, timeout, and failure states are independent. Both must be
  ready before capture. After capture starts, a terminal failure of either branch immediately
  advertises zero credit and stops acceptance of new browser audio. Java finalizes the current turn
  from audio already accepted, enters bounded drain, and lets the healthy branch finish only that
  already-accepted work. A failure cannot overwrite a healthy result, and purpose policy never
  fabricates a missing result.
- A slow browser event consumer causes bounded server output to terminate the connection rather
  than retain unbounded events or raw audio.

## Ending, Cancellation, and Reconnection

- `capture.end` on the WebSocket is the authoritative graceful-end command. It is idempotent.
- The browser never claims enrollment completion. Enrollment accepts exactly one sample after each
  validated `RECORD_UTTERANCE` action. An accepted sample followed by another
  `RECORD_UTTERANCE` starts the next ordinal; an accepted sample followed by `WAIT` stops sample
  collection and makes Java send exactly one provider `VOICE_CAPTURE_ENDED` with `COMPLETED`.
- Java validates the capture-ended acknowledgement and awaits a terminal registration result on
  the same ABIS WebSocket. A full eight-second meter, transcript completion, elapsed time, or local
  sample count never substitutes for `WAIT`.
- A successful enrollment `session.completed` event carries purpose `ENROLLMENT` and MUST include
  IAM-confirmed `enrollmentStatus: ENROLLED`; ABIS completion alone cannot drive the success UI.
- Verification completion is an explicit Java IAM-adapter semantic operation with normalized
  states `RESULT_AVAILABLE -> COMPLETION_PENDING -> COMPLETED`. It runs only after a terminal ABIS
  result. The exact provider mapping for MATCH, MISMATCH, INCONCLUSIVE, timeout, and failure is not
  documented and remains a T001 blocker rather than being guessed.
- After `capture.end`, Java accepts no new binary frames, finalizes the open turn, enters
  `DRAINING`, waits at most 10 seconds, assigns explicit terminal processing states, and closes the
  application, ABIS, and Speech sockets.
- `POST /api/v1/voice-session/cancel` is an idempotent fallback for abrupt UI or
  WebSocket failure. Verification cancellation uses the explicit normalized transition
  `CANCELLATION_PENDING -> CANCELLED` while stopping application, ABIS, and Speech work. The
  reviewed IAM source defines no cancellation route or payload; this application operation does
  not imply one, and exact provider cleanup remains a T001 blocker. Cancellation does not represent
  successful enrollment, successful verification, or graceful completion.
- Disconnect or half-open timeout stops new capture. Reconnection requires fresh authorization
  and a new `voiceSessionId`; raw audio is never resumed or replayed.

## Operational Baseline

- The first `session.bind` command is due within 5 seconds of WebSocket establishment.
- IAM HTTP authorization has its own 10-second response deadline and completes before
  `PREAUTHORIZED`. ABIS and Speech each have a 10-second streaming-readiness deadline; both and
  only those streaming branches must be ready before `capture.start` is accepted.
- Application heartbeats are sent every 15 seconds; 45 seconds without peer progress is treated
  as half-open.
- Enrollment targets eight seconds of accepted speech per server-requested sample and applies a
  fresh 15-second capture/no-speech deadline to each request. The deadline may submit accepted
  trailing speech shorter than eight seconds; zero accepted speech ends capture with
  `NO_SPEECH_DETECTED`. It is not the overall enrollment-session timeout.
- Enrollment capture is capped at 90 seconds and verification capture at 15 minutes.
- IAM connect and response deadlines are 3 and 10 seconds respectively.
- Eligible idempotent control/audit calls use at most three total attempts with exponential delay
  starting at 250 ms and 20% jitter. Audio frames and accepted audio are never retried or replayed.
- Before capture only, a downstream WebSocket readiness failure may be retried with fresh
  authorization. After capture begins, reconnecting either branch requires a fresh application
  voice session; the current session accepts no more audio, and the healthy branch may finish only
  already-accepted work during bounded drain.

## Automated Contract-Test Fixtures

- Automated tests may use process-local stub HTTP/WebSocket providers and generated in-memory audio
  under test source sets to exercise contract errors, ordering, correlation, and branch failures.
- Test doubles are never runtime adapters, selectable application configuration, packaged classes,
  deployed endpoints, or sources of identity, enrollment, transcript, or assurance state in the
  application artifact.
- Browser microphone-denial tests use browser automation or test-only MediaDevices controls and
  assert that no voice-session HTTP request or application WebSocket is created.
- Enrollment fixtures exercise at least three accepted samples, alternating
  `RECORD_UTTERANCE` actions followed by `WAIT`, strict `ack_client_sequence` correlation, exact
  duplicate handling, one capture-ended message, per-sample deadline renewal, and terminal success
  or failure without a locally fixed sample count.
- Profile tests prove literal `127.0.0.1:8080` binding, peer/Host/Origin/forwarded-header rejection,
  exact sole-account pre/post-IDCS matching, distinct cookie isolation, JWE context/key/algorithm/
  replay failures, continuous warning, microphone/audio preflight, one browser socket, bounded
  transient audio, secure downstreams, sign-out/restart cleanup, and local-only evidence labeling.

## Implementation Gates

The OpenAPI and AsyncAPI documents remain DRAFT while T001 is PARTIAL, T002 remediation is pending,
and T003 live validation is pending. Provider adapter implementation and final contract approval
require all of the following:

1. Approved IDCS registration, claims or exact `/admin/v1/Me` contract, scopes, token validation,
   logout/revocation behavior, and
   application-session rules. This includes explicit Resource Owner Password Credentials
   enablement for a trusted/confidential demo client; exact token endpoint, fixed scope and client
   authentication; compatible local accounts; MFA behavior; external-federation exclusion;
   access/refresh-token lifetime; logout/revocation; account lockout; and login rate limits.
2. Reviewed IAM Voice Support request/response/error contracts, mTLS binding, local-intent versus
   provider-bound consent semantics, session authorization, documented verification completion and unresolved cancellation,
   and assurance-event binding. The exact assurance binding route, authentication, request and
   response fields, error taxonomy, retry rules, and idempotency contract MUST be approved before
   T101 or T106 can be implemented or invoked.
3. The exact ABIS Java SDK artifact/version, supported audio profile, callback/error model,
   WebSocket/session lifecycle, framing/chunking rules, canonical-turn compatibility, maximum
   sample/session/concurrency limits, and conformance with the documented serial enrollment
   `RECORD_UTTERANCE`/`WAIT` sequence, followed by review of both browser contracts per FR-030.
4. Approved OCI Speech real-time endpoint/authentication, audio profile, acknowledgement and
   timing semantics, model/domain availability, limits, and error taxonomy.
5. Human approval of `SECURE_DEMO`/`LOOPBACK_HTTP_TEST` separation plus approved fail-first tests
   for every loopback invariant above before implementation. Every invariant test must pass before
   the profile is enabled for any real credential, provider, microphone, or participant. This
   approval does not close provider-live, deployment, remote-browser, or final-demo gates.

No adapter may fill these gaps with guessed routes, payloads, grant types, token fields, claims,
client-authentication methods, MFA/federation behavior, SDK methods, revocation behavior, or retry
behavior.

Test-account reprovisioning is an external administrative responsibility and has no browser or
Java application operation in this contract set.

If the approved IDCS registration cannot support the fixed Resource Owner Password Credentials
flow for the selected local demo accounts, the OpenAPI contract and specification security
requirement must be reviewed. There is no redirect, authorization-code, implicit, federated, or
browser-selected grant fallback.
