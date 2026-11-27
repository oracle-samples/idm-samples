# Browser checks

Start/configure the app as in the root README. Use an authorized ordinary test account and
the intended enrolled speaker. No live provider result is implied by application health.

1. Sign in and confirm identity/enrollment status. If no voice factor exists, review consent.
   Decline and confirm the microphone never opens. Retry and accept before recording.
2. Select Enroll voice, allow microphone access and read the passage. Confirm the waveform
   reacts and sample progress advances, then wait for enrollment/status completion. ABIS may
   request additional samples. Do not delete someone else's factor to test this.
3. Verify natural speech for 5–10 seconds. End the session and check per-utterance outcomes.
   With Speech enabled check live/final transcript; disabled Speech has no transcript.
4. Try continuous speech beyond 20 seconds, pauses, short replies, mute/resume and a final tail.
   Review actual provider reasons; short duration alone does not establish a mismatch's cause.
5. Stop immediately, then retry. Run two separate short sessions; old results must not enter
   the new attempt. Allow final results to settle after End session.
6. Deny microphone permission, restore it and retry. Sign out/in; session results clear while
   voice enrollment persists. Test deletion/re-enrollment only on an explicitly chosen account.

If permission succeeds but no waveform appears, check that the intended physical input is
selected/unmuted and has an OS input level. Keep the browser tab active and retry. Record the
browser/version, page state/message, whether capture frames are sent, and sanitized browser
console/network/server errors. Never include passwords, tokens, raw audio or private keys.

## Transcription switch

With `VOICE_BIOMETRIC_OCI_SPEECH_ENABLED=false`, restart/sign in and repeat enrollment/verification
without any OCI Speech profile, token or tenancy access. Transcript panels/status labels must
be absent; voice-result rows, mute/resume and Stop/restart must still work. Completion must
not warn about absent transcript text. With true and authorized Speech settings, confirm live
and final transcripts return. Enabling transcription makes Speech readiness required again.
