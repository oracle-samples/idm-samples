# OCI Speech Real-time Adapter Boundary

## Purpose

The Speech adapter isolates OCI provider authentication and the Live Transcribe WebSocket from the
application domain. Local execution uses an OCI CLI session-token profile; OCI compute deployment
uses an instance principal. Java owns the application voice session, accepted audio order,
canonical utterance IDs, flow control and browser event ordering; the reviewed SDK VAD supplies
the canonical verification windows. OCI Speech supplies model-dependent real-time text and
provider timing; Oracle ASR may supply partial/final results while Whisper supplies final results
only. It does not define speaker identity, canonical
turns, biometric outcomes or authorization.

OCI Java SDK 3.95.0 confirms the server-side connection shape: `RealtimeSpeechClient` accepts a
`BasicAuthenticationDetailsProvider`, signs the WebSocket authentication message, and appends
`/ws/transcribe/stream` to the configured or derived real-time base endpoint. Target-tenancy model
availability, policy, limits, timing and provider error behavior remain implementation gates.

## Connection and Ownership Model

- The browser-facing profile never selects or configures OCI Speech. `SECURE_DEMO` uses one
  same-origin browser `wss://` application socket; `LOOPBACK_HTTP_TEST` uses one same-origin
  `ws://127.0.0.1:8080/ws/v1/voice` application socket. Java opens the independent Speech branch
  only through certificate-validating WSS in both profiles.
- Speech work remains bound to the authenticated application session and voice purpose. Under
  `LOOPBACK_HTTP_TEST`, the application session must belong to the sole configured disposable test
  account before Java opens Speech.
- One preauthorized application voice session creates at most one active OCI Speech real-time
  WebSocket at a time. A replacement attempt is permitted only during pre-capture readiness and
  only with fresh authorization.
- In local mode, Java loads an explicitly configured OCI CLI session-token profile inside the
  server trust boundary and closes that provider with the Speech client. In OCI deployment mode,
  Java obtains an instance-principal provider from instance metadata and uses no local OCI config,
  token, or key file. Neither mode calls a separate Speech session-token-creation operation.
- Java takes region (and, for session-token mode, tenancy) from the selected authentication
  provider. Optional configured values are fail-closed validation guards. The Speech compartment
  remains explicit because it is request scope rather than authentication-profile state.
- The browser never receives the Speech token or endpoint and never connects directly to Speech.
- Java sends the same accepted canonical PCM stream to Speech and ABIS through independent bounded
  branch queues.
- Java owns `utteranceId`; SDK VAD start/seal metadata defines its canonical ABIS window. Speech
  token timestamps map text onto that accepted range and cannot redefine its boundary.
- Speech and ABIS results can arrive independently and out of order. Speech state cannot overwrite
  assurance or audit state.

## Semantic Application Port

| Operation | Contract |
| --- | --- |
| `loadAuthentication(context)` | Load the configured session-token profile or OCI instance principal, derive region/provider identity, apply optional tenancy/region guards, and return no token, key, config fields, or endpoint to the browser. |
| `openSession(context)` | Start the Jetty client and open one `RealtimeSpeechClient` WebSocket for the application voice session and negotiated audio profile; readiness occurs only after the authenticated service connect message. |
| `acceptAudio(frame)` | Accept one Java-sequenced canonical frame subject to Speech branch credit; never persist or silently drop audio. |
| `endInput(deadline)` | End new Speech input and allow final results only until the application drain deadline. |
| `cancel(reason)` | Close the Speech session and discard transient audio without fabricating transcript completion. |

These are application semantics, not assumed OCI SDK methods or service paths.

On graceful end, the adapter requests the final result, drains within the application deadline,
then closes `RealtimeSpeechClient`, Jetty `WebSocketClient`, and any closeable authentication
resource.

## Normalized Adapter Events

| Adapter event | Required fields/meaning |
| --- | --- |
| `SpeechReady` | The service's authenticated connect message was received for the canonical profile; a raw socket `onConnect` callback alone is not readiness. |
| `SpeechCreditChanged` | Bounded frame/byte capacity available to the coordinator. |
| `TranscriptPartial` | Provider event identity, monotonic revision, text, confidence/tokens when supplied, and accepted audio/time coverage. |
| `TranscriptFinal` | Provider event identity, final revision, text, confidence/tokens when supplied, and accepted audio/time coverage. |
| `SpeechAcknowledgement` | Provider packet number, byte offset, and length used only as reviewed correlation/flow evidence. |
| `SpeechProcessingFailed` | FAILED or TIMED_OUT plus normalized failure kind, safe code, retryability and terminality; no assurance outcome. |
| `SpeechSessionState` | Ready, processing, draining, completed, failed or timed out. |

## Model-dependent connection parameters

| Setting | Oracle ASR rollback | OCI realtime Whisper |
| --- | --- | --- |
| `modelType` | `ORACLE` | `WHISPER` |
| `modelDomain` | `GENERIC` or `MEDICAL` | `GENERIC` |
| English language | Locale-specific, for example `en-US` | Locale-independent `en` (`auto` is also valid) |
| Partial results | Supported | Not supported; the application must not fabricate them |
| `partialSilenceThresholdInMs` | May be sent | MUST be absent |
| `finalSilenceThresholdInMs` | May be sent | MUST be absent |
| `stabilizePartialResults` | May be sent | MUST be absent |
| Customizations | Model/tenancy dependent | MUST be absent from this demo connection |

The enabled adapter fails startup for an incompatible model/domain/language combination. The
default demo profile is `WHISPER`/`GENERIC`/`en`; rollback uses environment configuration only.
OCI Live Transcribe exposes `WHISPER`, not a selectable `WHISPER_LARGE` real-time value.

Speech must reach readiness within 10 seconds, and capture cannot start until both Speech and ABIS
are READY. A readiness failure may be retried only before capture with fresh authorization. Once
capture starts, loss of the Speech WebSocket is terminal for this branch and reconnecting requires
a fresh application voice session. The Java coordinator immediately stops accepting new browser
audio and permits ABIS to finish only audio accepted before the failure during bounded drain.

Transcript text is read-only presentation data. It never determines utterance identity, ABIS
correlation, MATCH/MISMATCH/INCONCLUSIVE, IAM audit outcome or access.

## Mapping to Canonical Utterances

- Java assigns `audioSequence` and acceptance time before a frame enters the Speech branch.
- The adapter retains a bounded mapping between canonical sequences/times and the approved Speech
  input acknowledgement/timing model.
- Provider tokens map by start/end timestamp (normalized to accepted audio sequences) into the
  canonical ABIS window; their midpoint selects one window. Results are never mapped by transcript
  text or arrival order.
- Several provider fragments/finals may contribute tokens to one canonical window. When tokens are
  unavailable, a complete provider result may map only if its whole range intersects exactly one
  window; multiple intersections produce a row-scoped transcript correlation failure.
- Boundary revisions preserve `utteranceId`; normalized transcript revisions increase and update
  the same utterance.
- An ambiguous result that cannot be mapped deterministically becomes a typed correlation failure.
  It must not be attached to the most recent utterance by arrival order.

## Deduplication and Finality

- The adapter deduplicates by approved provider session/event/revision identity.
- Repeating the same provider event and content is idempotent.
- Reusing provider identity/revision with conflicting content emits an adapter-contract fault and
  preserves the first accepted value.
- For Oracle ASR, a higher partial revision replaces only the earlier partial value for the same
  canonical range. Whisper ignores non-final provider events defensively and publishes no
  fabricated partial text.
- A final transcript is terminal for that mapped utterance/range and cannot regress to partial.
- Oracle ASR final-silence may be configured to 300 ms to reduce latency relative to the SDK VAD
  pause. Whisper omits this Oracle-only field; timestamp correlation remains authoritative.
- Late events after the voice session drain deadline are recorded only as safe diagnostics when
  permitted; they cannot change the closed browser state.
- Reconnection requires a new application voice session and fresh authorization. Raw audio is
  never replayed.

## Backpressure and Branch Independence

- The Speech adapter exposes bounded frame/byte credit to the session coordinator.
- A frame is accepted only when it fits within both branch bounds: 100 frames and 64,000 bytes
  (two seconds of nominal baseline audio).
- Transient high water causes browser credit to reach zero and capture to pause; audio is not
  silently dropped or spooled.
- Both branches are readiness prerequisites before capture. After capture starts, terminal Speech
  failure makes the coordinator advertise zero browser credit, stop accepting new audio, finalize
  the current turn from already-accepted frames, and enter bounded drain.
- ABIS may finish already-accepted work and publish its resulting assurance during that drain.
  Speech failure cannot become MISMATCH and cannot remove a valid ABIS result.
- On graceful `capture.end`, the adapter drains for at most 10 seconds and then emits explicit
  final or FAILED/TIMED_OUT state.
- Enrollment capture is capped at 90 seconds and verification capture at 900 seconds by the Java
  coordinator; accepted audio is never retried or replayed.

## Security and Data Handling

- OCI credentials, session tokens, private endpoints and raw provider payloads remain in Java.
- The configured real-time endpoint must be `wss://` with certificate and hostname validation;
  `ws://` is permitted only on the exact browser-to-Java loopback edge.
- Raw audio and transcript text are excluded from logs, traces, metrics, crash diagnostics and
  committed fixtures.
- Transcript text is held only for the active application session/evidence view and is cleared on
  session expiry or sign-out according to the plan.
- Logs and metrics may include masked application correlation, revision, character count, latency,
  queue depth and safe failure code, but not transcript text.

## Contract Tests

The adapter contract suite must cover:

1. One Speech connection per application voice session and no direct browser connection.
2. Approved audio-profile negotiation and explicit incompatible-format failure.
3. Bounded credit, pause at high water and zero silent audio loss.
4. Oracle partial revisions plus final result, and Whisper final-only delivery, including
   duplicate delivery for one canonical utterance.
5. One provider result spanning turns and several provider fragments mapping to one turn.
6. Delayed/out-of-order results resolved by audio range rather than arrival order.
7. Ambiguous/unmappable provider result produces correlation failure rather than false mapping.
8. Speech failure while ABIS stays healthy stops new browser audio immediately; ABIS drains only
   already-accepted work and no cross-branch state is overwritten.
9. Graceful drain, timeout, cancellation and disconnect without replay.
10. No transcript text or token in logs, browser storage or diagnostics.
11. Both browser-facing profiles use at most one application socket while Java alone fans accepted
    audio to the independent secure Speech branch; there is no browser-to-Speech connection.
12. `LOOPBACK_HTTP_TEST` profile/account/purpose mismatch and every non-WSS Speech endpoint fail
    before provider connection, with no audio persistence or fallback transcript.

Automated contract tests may use test-scope OCI Speech WebSocket fixtures to exercise Oracle
partials, model-independent finals, revisions, duplicates, reordering, multi-turn spans, latency, queue pressure, timeout and
disconnect. Those fixtures are not runtime adapters, selectable configuration, or packaged
application code, and they retain no raw audio fixture.

## Implementation Gates

Adapter/config scaffolding may use the reviewed SDK shape, but the live adapter cannot be approved
until the target tenancy establishes:

- actual session-token config path/profile, expected tenancy, policy, compartment, region and base
  real-time endpoint;
- `WHISPER`, `GENERIC`, `en`, automatic-punctuation and acknowledgement availability in that
  region and tenancy, with Oracle `MEDICAL`/`en-US` retained only as an explicit rollback profile;
- acceptance of 16-kHz signed mono little-endian PCM in the application's proposed 20-ms/640-byte
  frames and the exact acknowledgement behavior;
- handshake/subprotocol and close semantics not abstracted by the addon;
- provider Whisper final schemas, event IDs, revisions, time offsets and acknowledgement mapping;
- maximum session duration, audio volume, message size and the tenancy's allocation within the
  documented ten-concurrent-session service limit;
- heartbeat, idle timeout, backpressure and throttling behavior;
- error taxonomy, retryability and reconnect rules;
- whether provider timing is sufficient to map results deterministically to Java audio ranges; and
- least-privilege OCI policy and successful Spring Boot 4 dependency convergence with the addon's
  Jetty WebSocket 9.4.58 dependency.

If the approved service cannot provide deterministic timing/range correlation or the canonical
audio profile, the data model and AsyncAPI contract must be reviewed. The adapter must not infer
utterance ownership from text or arrival order.
