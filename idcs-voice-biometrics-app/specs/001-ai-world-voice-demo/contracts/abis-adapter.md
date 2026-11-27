# ABIS SDK Adapter Boundary

## Purpose

The ABIS adapter isolates the existing Java ABIS SDK and its WebSocket protocol from the
application domain. The Java session coordinator owns the application voice session, accepted
audio order, canonical identifiers, Speech correlation, flow control and browser events. The
reviewed internal SDK's deterministic VAD is the sole verification-window boundary authority and
the adapter projects that lifecycle into the application. The adapter also owns ABIS-specific
connection setup, authentication, framing, callbacks and error translation.

T002 reviewed `com.oracle.voicebiometrics:voice-biometrics:1.0.0` at source commit
`c045dc1560a4430fdc8b658ee512cb2ad6e0a7d0`. It compiles on Java 21 and confirms raw 16-kHz mono
signed little-endian PCM plus protobuf provider frames. The artifact is not approved unchanged:
its trust-all TLS, filesystem audio writes, unreviewed combined VAD/speaker processing, unbounded buffers,
incomplete protocol handling and collapsed result model are blocking defects. A reviewed internal
fork is therefore part of this adapter boundary.

## Connection and Ownership Model

- The browser-facing profile never selects or configures ABIS. `SECURE_DEMO` uses a browser
  `wss://` application socket; `LOOPBACK_HTTP_TEST` uses exactly one same-origin
  `ws://127.0.0.1:8080/ws/v1/voice` socket. Java opens the separate ABIS branch only through
  certificate-validating WSS in both profiles.
- ABIS authorization is bound to the authenticated application session, purpose, IAM request, and
  doctor subject. In `LOOPBACK_HTTP_TEST`, that subject must be the sole configured disposable test
  account. A profile/account/purpose mismatch opens no ABIS connection.
- One application voice session owns one logical ABIS processing branch and one ABIS WebSocket.
  Verification may have multiple outstanding utterances. Enrollment is deliberately serial: only
  one requested sample may be collecting or awaiting acknowledgement at a time, and ABIS—not Java
  or the browser—decides how many samples are required. Provider-wide sample-count, TTL, and
  concurrency limits remain gates.
- The configured ABIS endpoint and IAM-created token material remain inside Java and are passed
  directly to the adapter through a sensitive server-only value object.
- Verification always appends `sendVerificationResults=true` to the tokenized ABIS WebSocket
  target. Enrollment and verification independently append `storeAudio=true` only under their
  server-side debug flags, which default off and are never browser-selectable.
- Java supplies the canonical PCM stream and accepted audio sequence for each frame.
- Enrollment starts with `SESSION_READY/START_VOICE_CAPTURE`, then client
  `VOICE_CAPTURE_STARTED`. `VOICE_CAPTURE_STARTED_ACK/RECORD_UTTERANCE` requests the first sample.
  Each sample targets eight seconds of detected speech and is sent as one `UTTERANCE`.
- `UTTERANCE_ACCEPTED/RECORD_UTTERANCE` acknowledges the correlated outbound client sequence and
  requests exactly one next sample. `UTTERANCE_ACCEPTED/WAIT` acknowledges the current sample,
  prohibits another, and causes exactly one client `VOICE_CAPTURE_ENDED` with reason `COMPLETED`.
  The SDK then requires `VOICE_CAPTURE_ENDED_ACK/WAIT` and a terminal `REGISTRATION_SUCCEEDED` or
  `REGISTRATION_FAILED`. It never derives completion from a duration or local sample count.
- The SDK publishes `UTTERANCE_STARTED` when VAD confirms speech and `UTTERANCE_SEALED` for the
  exact PCM window sent to ABIS after either the normal five-second/300-ms boundary or the
  configured 5,000-ms prolonged-pause boundary for non-empty shorter speech. The adapter
  mints the stable application `utteranceId` at start and preserves it by SDK ordinal/client
  sequence through result or failure. No speaker detector is used.
- A subminimum provisional window discarded at a mute/end boundary emits
  `UTTERANCE_DISCARDED`; it is not sent to ABIS and cannot acquire an assurance outcome.
- The adapter performs ABIS protocol/frame chunking but may not create an alternative browser or
  application utterance identity.
- ABIS callbacks are mapped to the canonical utterance through an application-provided correlation
  handle or accepted audio sequence/time range. Arrival order and transcript text are never keys.
- The adapter never exposes its WebSocket, token, endpoint, voice reference or raw response to the
  browser.
- The adapter must accept the server-configured ABIS base URL plus IAM-created security-token
  authorization and must not create a separate session from a developer's `~/.oci/config` profile.

### Canonical three-sample enrollment example

Sequence values below illustrate the owner-provided flow. Implementations validate monotonic
sender sequences and explicit acknowledgement correlation rather than assuming exactly three
samples.

| Direction | Message type | Sequence | Acknowledges | Action / reason |
| --- | --- | ---: | ---: | --- |
| Server to client | `SESSION_READY` | 1 | 0 | `START_VOICE_CAPTURE` |
| Client to server | `VOICE_CAPTURE_STARTED` | 1 | — | Declares audio/capture metadata |
| Server to client | `VOICE_CAPTURE_STARTED_ACK` | 2 | 1 | `RECORD_UTTERANCE` |
| Client to server | `UTTERANCE` | 2 | — | First VAD-selected sample |
| Server to client | `UTTERANCE_ACCEPTED` | 3 | 2 | `RECORD_UTTERANCE` |
| Client to server | `UTTERANCE` | 3 | — | Second VAD-selected sample |
| Server to client | `UTTERANCE_ACCEPTED` | 4 | 3 | `RECORD_UTTERANCE` |
| Client to server | `UTTERANCE` | 4 | — | Third VAD-selected sample |
| Server to client | `UTTERANCE_ACCEPTED` | 5 | 4 | `WAIT` |
| Client to server | `VOICE_CAPTURE_ENDED` | 5 | — | `COMPLETED` |
| Server to client | `VOICE_CAPTURE_ENDED_ACK` | 6 | 5 | `WAIT` |
| Server to client | `REGISTRATION_SUCCEEDED` | 7 | 4 | `SHOW_SUCCESS`; session closes |

The terminal event may acknowledge the last utterance rather than the capture-ended message, as in
the supplied example. `VOICE_CAPTURE_ENDED_ACK` remains the correlation proof for the client end
message; terminal success or failure is validated by message type and session lifecycle.

## Semantic Application Port

| Operation | Contract |
| --- | --- |
| `openSession(context)` | Open the reviewed ABIS SDK processing context from server-only IAM authorization and the approved audio profile. Provider connection/session cardinality is supplied by the gated SDK contract. |
| `acceptAudio(frame)` | Accept one Java-sequenced canonical frame subject to adapter credit; never persist or silently drop audio. |
| `utteranceStarted(lifecycle)` | Project the SDK ordinal and capture start so Java can mint one opaque application identifier. |
| `utteranceSealed(lifecycle)` | Project the exact capture/voice ranges, detected-speech duration and outbound client sequence for the PCM already dispatched by the SDK. |
| `utteranceDiscarded(lifecycle)` | Withdraw a provisional subminimum window without claiming an ABIS submission or result. |
| `endInput(deadline)` | Stop accepting audio, finalize permitted SDK work and surface remaining results until the application drain deadline. |
| `cancel(reason)` | Close the ABIS session and discard transient audio without reporting successful completion. |

The SDK may require a different internal call sequence, but the adapter must preserve these
application semantics. Any incompatibility requires contract and plan review before implementation.

## Normalized Adapter Events

The adapter emits internal Java events; the session coordinator assigns browser `eventSequence`
and maps them to AsyncAPI events.

| Adapter event | Required fields/meaning |
| --- | --- |
| `AbisReady` | Provider session established and able to accept the negotiated profile. |
| `AbisCreditChanged` | Bounded frame/byte capacity available to the coordinator. |
| `EnrollmentProgress` | Current positive `utteranceOrdinal`, non-negative `acceptedUtteranceCount`, current-sample accepted speech duration, fixed 8,000-ms required duration, quality state and safe reason. |
| `EnrollmentCompleted` | ABIS enrollment accepted; IAM completion is still required before UI status becomes ENROLLED. |
| `EnrollmentRejected` | Safe quality/rejection state; doctor remains not enrolled. |
| `UtteranceStarted` | Non-terminal SDK ordinal and capture start used to open one provisional verification timeline row. |
| `UtteranceSealed` | Same ordinal plus outbound client sequence, exact capture/voice ranges and detected-speech duration for the PCM sent to ABIS. |
| `UtteranceDiscarded` | Withdraws a provisional subminimum row; no ABIS utterance was sent. |
| `AssuranceResult` | For a verification utterance only, opaque application `utteranceId`, session-local `utteranceOrdinal`, and exactly one of MATCH, MISMATCH or INCONCLUSIVE. This event is non-terminal; later utterances continue on the same session. Enrollment emits progress/completion events, never assurance outcomes. |
| `AbisProcessingFailed` | Canonical utterance correlation when available plus FAILED or TIMED_OUT processing state, normalized failure kind and safe code; no biometric outcome. |
| `AbisSessionState` | Ready, processing, draining, completed, failed or timed out. |

ABIS must reach readiness within 10 seconds, and capture cannot start until both ABIS and Speech
are READY. A readiness failure may be retried only before capture with fresh authorization. Once
capture starts, loss of the active SDK transport or processing context is terminal for this branch
and a new attempt requires fresh authorization and a fresh application voice session. The Java
coordinator immediately stops accepting new browser audio and permits Speech to finish only audio
accepted before the failure during the bounded drain.

`FAILED` and `TIMED_OUT` are never converted to `MISMATCH`. ABIS output is identity-assurance
evidence only and cannot authenticate, authorize, prove liveness/presence, or identify the second
participant.

## Correlation and Idempotency

- Java `voiceSessionId` and `utteranceId` are canonical. Provider identifiers remain adapter
  metadata and are masked in evidence.
- Each accepted frame supplies `audioSequence`, acceptance time and payload bytes. The adapter
  records the approved mapping to SDK frames/chunks in bounded memory.
- Each callback must resolve to exactly one canonical utterance by an SDK correlation handle or
  accepted audio range. An unresolved or ambiguous callback becomes a contract error; it is not
  attached by arrival order.
- Provider callback identity/revision is deduplicated before emission. Reusing a provider event ID
  with conflicting content preserves the first terminal value and emits an adapter-contract fault.
- A terminal MATCH/MISMATCH/INCONCLUSIVE result never regresses or changes.
- Enrollment `UTTERANCE_ACCEPTED.ack_client_sequence` must identify the one outstanding enrollment
  `UTTERANCE`. An exact duplicate is idempotent; missing, unknown, stale, or conflicting
  correlation fails the enrollment branch without replay. The action must be
  `RECORD_UTTERANCE` or `WAIT`; any other or conflicting action is a protocol failure.
- The current enrollment ordinal is allocated only after a valid `RECORD_UTTERANCE` directive.
  `acceptedUtteranceCount` increases only after correlated acceptance. Audio received while an
  enrollment acknowledgement is pending is not accumulated into a speculative next sample, but
  the continuous application/Speech stream remains independently governed by the coordinator.
- ABIS `UTTERANCE_VERIFICATION_RESULT` (message type 14) correlates to the dispatched utterance by
  `ack_client_sequence`; arrival order is never used. The result also proves provider acceptance,
  so a later `UTTERANCE_ACCEPTED` is an idempotent acknowledgement.
- An exact duplicate result is ignored. A conflicting duplicate, missing/unknown client sequence,
  absent `result`, or unspecified result code terminates the branch with
  `ABIS_RESULT_PROTOCOL_INVALID`.
- `UTTERANCE_REJECTED` remains an utterance-scoped processing/quality failure in SDK, adapter, and
  browser contracts and is never fabricated as an ABIS MISMATCH or INCONCLUSIVE outcome. The UI
  presents safe code `VOICE_UTTERANCE_REJECTED` with the neutral Inconclusive treatment while
  retaining it in the processing-failure ledger.
- During migration, a legacy terminal action may synthesize one result for the last submitted
  utterance only when no message-type-14 result arrived during the session.
- Recovery never replays accepted raw audio. A lost ABIS processing context is terminal for that
  branch; fresh authorization and a new application voice session are required.

## Backpressure and Memory

- The adapter exposes bounded frame and byte credit to the session coordinator.
- A frame is accepted only when it can be queued without exceeding both branch bounds: 100 frames
  and 64,000 bytes (two seconds of nominal baseline audio).
- When credit reaches zero, the coordinator advertises zero browser credit and pauses capture.
- The adapter never drops, spools to disk, logs, retries or retains raw audio outside the bounded
  live-session queue.
- After capture starts, terminal ABIS failure makes the coordinator advertise zero browser credit,
  stop accepting new audio, finalize the current turn from already-accepted frames, and enter
  bounded drain. Speech may finish only already-accepted work. The ABIS state remains
  FAILED/TIMED_OUT and cannot overwrite transcript state.
- On graceful `capture.end`, the adapter finalizes current SDK work and drains for at most 10
  seconds. Unresolved work becomes explicit FAILED or TIMED_OUT processing state.
- Enrollment capture is capped at 90 seconds; verification capture is capped at 900 seconds. The
  Java coordinator enforces these caps independently of the enrollment sample deadline.
- Each enrollment `RECORD_UTTERANCE` starts a fresh 15-second sample deadline. The SDK seals and
  submits VAD-accepted trailing speech when that deadline expires even if it is shorter than five
  seconds. With no accepted speech for the current request, it sends capture ended with
  `NO_SPEECH_DETECTED` and awaits the terminal provider outcome. Earlier accepted samples are not
  replayed, and a later request receives a new deadline.
- Normalized SDK progress is per sample and authoritative for the browser meter. Reaching 5,000 ms
  seals that sample only. The provider's later `WAIT` action—not progress—moves enrollment into
  processing and bounded drain.

## Security and Data Handling

- Endpoint, session token, SDK credentials, mTLS material and voice references are sensitive
  server-only values.
- ABIS transport is certificate-validating, hostname-verifying WSS in every application profile;
  browser loopback HTTP is never propagated to this downstream boundary.
- Raw audio, biometric templates, complete provider payloads and unmasked provider IDs are excluded
  from logs, traces, metrics, browser messages, crash diagnostics and committed fixtures, except
  that independent explicit local-only settings may print the sanitized ABIS enrollment or
  verification session ID to console logs for provider-side troubleshooting and must remain
  disabled by default, in shared deployments, and in release evidence.
- Every enrollment protocol log retains `sessionIdFp`. When the enrollment-specific local setting is
  enabled, it additionally includes sanitized `sessionId`; control characters and values longer
  than 512 characters remain masked.
- Each verification utterance started, sealed/outbound, acknowledged, result, rejection, duplicate,
  or discarded log includes the stable masked ABIS `sessionIdFp`, request correlation, and ordinal;
  client sequence is included once allocated. When the local troubleshooting setting is enabled,
  these entries additionally include sanitized `sessionId`.
- Only safe quality summaries and masked references may enter browser evidence.
- The application retains no voice template. ABIS remains authoritative for enrolled references.

## Contract Tests

The adapter contract suite must cover:

1. One logical ABIS branch per application voice session and no direct browser connection.
2. Canonical audio profile acceptance and explicit rejection of incompatible formats.
3. Bounded credit, pause at high water, and zero silent frame loss.
4. SDK VAD lifecycle mapped to one Java-owned utterance ID from confirmed speech start through
   seal, result/failure, including withdrawal of subminimum muted windows.
5. A serial enrollment sequence with at least three samples: one utterance per
   `RECORD_UTTERANCE`, no speculative sample while acknowledgement is pending, increasing
   ordinals/accepted counts, per-sample progress reset, and no fixed total count.
6. Duplicate, delayed and out-of-order callbacks updating exactly one utterance.
7. MATCH, MISMATCH and INCONCLUSIVE as the only assurance outcomes.
8. Rejection, transport failure and timeout as processing/quality states rather than MISMATCH.
9. ABIS failure with Speech healthy stops new browser audio immediately; Speech drains only
   already-accepted work and no cross-branch state is overwritten.
10. Graceful drain, forced timeout, cancellation and disconnect without audio replay.
11. Enrollment completion remains provisional until IAM confirms ENROLLED.
12. Every finalized non-empty, quality-eligible verification utterance is submitted automatically
    for doctor-reference comparison, without manual speaker marking, speaker identity, or
    diarization.
13. Enrollment utterances produce enrollment progress/completion only and never produce or require
    MATCH, MISMATCH, INCONCLUSIVE, assurance eligibility, or IAM assurance-event binding.
14. Both browser-facing profiles use at most one application socket; Java alone fans accepted
    audio to the secure ABIS branch, and no browser-to-ABIS connection or endpoint disclosure
    occurs.
15. `LOOPBACK_HTTP_TEST` profile/account/purpose mismatch and any non-WSS ABIS endpoint fail before
    provider connection; bounded transient audio and cleanup behavior remain unchanged.
16. Enrollment `WAIT` sends exactly one `VOICE_CAPTURE_ENDED`, validates its acknowledgement, and
    awaits the terminal result; duplicate or wrong sequence/action correlation fails safely.
17. A fresh 15-second deadline applies to every requested enrollment sample, including trailing
    sub-eight-second speech and zero-speech termination, without replaying earlier audio.

Automated contract tests may wrap the reviewed SDK with test-scope callback/WebSocket fixtures to
exercise progress, the three outcomes, rejection, duplicates, reordering, latency, queue pressure,
timeout, and disconnect. Those fixtures are not runtime adapters, selectable configuration, or
packaged application code.

## Implementation Gates

The live adapter cannot be implemented or approved until the T002 fork/remediation establishes:

- approved artifact coordinates, version, provenance/license and supported Java runtime;
- supported audio encodings, sample rates, channels, frame sizes and timing requirements;
- SDK ownership of WebSocket creation, token use, framing, chunking and close behavior;
- provider-wide maximum enrollment sample count, session TTL, and concurrent-session limits (the
  serial `RECORD_UTTERANCE`/`WAIT` enrollment behavior itself is defined by this contract);
- exact calls/callbacks for enrollment progress, enrollment completion and per-utterance assurance;
- callback identifiers, audio offsets/time ranges and revision/deduplication semantics;
- thread-safety, blocking/nonblocking behavior, buffering and backpressure capability;
- error/rejection taxonomy, retryability, heartbeat, timeout and disconnect semantics;
- limits on session duration, utterances, concurrent sessions and payload size;
- confirmation that the reviewed SDK VAD is the sole canonical verification-window detector and
  supplies exact capture/voice ranges, stable ordinals, the five-second target, 300-ms normal
  trailing pause, and configurable prolonged-pause behavior; Java must not introduce a second
  boundary authority. Enrollment uses the eight-second target but remains acknowledgement-gated
  and serial rather than using verification's multi-outstanding dispatch policy.
- validating TLS/hostname verification, zero raw-audio/provider-payload disk writes, bounded
  queues, explicit deadlines, all applicable terminal/error messages, and typed
  MATCH/MISMATCH/INCONCLUSIVE/processing-failure callbacks.
