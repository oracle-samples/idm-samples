'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const publicDirectory = path.resolve(__dirname, '../src/public');
const html = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(publicDirectory, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(publicDirectory, 'styles.css'), 'utf8');

test('UI describes BTP without exposing the template protection vendor', () => {
  assert.match(html, /Biometric Template Protection \(BTP\)/);
  assert.doesNotMatch(html, /Tech5/i);
});

test('consent UI clearly separates initiation from capture', () => {
  assert.match(html, /id="beginEnrollment"/);
  assert.match(html, /id="enrollmentConsent"[^>]*aria-labelledby="consentTitle"/);
  assert.match(html, /Your fingerprint will not be captured unless you agree/);
  assert.match(script, /api\('\/api\/enroll\/initiate'/);
  assert.match(script, /api\('\/api\/enroll\/continue'/);
  assert.match(script, /api\('\/api\/enroll\/cancel'/);
  assert.match(script, /finger:\s*enrollFingerEl\.value[\s\S]*reader:\s*readerSelectEl\.value/);
  assert.doesNotMatch(script, /api\('\/api\/enroll'/);
  assert.match(script, /result\.iamAcknowledged === true/);
  assert.match(script, /IAM recorded the declined consent/);
  assert.match(script, /No fingerprint data was submitted for enrollment/);
  assert.match(script, /Decline did not submit fingerprint data/);
  assert.match(script, /could not confirm that IAM recorded the decline/);
  assert.doesNotMatch(script, /No fingerprint was captured or submitted for enrollment/);
  assert.doesNotMatch(script, /requestState/i);
});

test('terminal outcomes use a focused accessible screen', () => {
  assert.match(html, /id="outcomeScreen"[^>]*aria-labelledby="outcomeTitle"/);
  assert.match(html, /id="outcomeTitle"[^>]*tabindex="-1"/);
  assert.match(script, /Fingerprint enrolled successfully/);
  assert.match(script, /A fingerprint is already enrolled/);
  assert.match(script, /Fingerprint or PIN number did not match/);
  assert.match(script, /Fingerprint enrollment was not continued/);
  assert.match(script, /outcomeTitleEl\.focus\(\)/);
  assert.match(styles, /\.outcome-screen\s*\{/);
  assert.match(script, /source\.clientReferenceId \?\?\s*source\.ecId/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
});

test('verification uses one browser call and handles factor selection before capture', () => {
  assert.match(html, /id="verifyFinger"/);
  assert.match(script, /api\('\/api\/verify'[\s\S]*finger:\s*verifyFingerEl\.value/);
  assert.match(script, /Preparing and verifying fingerprint/);
  assert.doesNotMatch(script, /Capturing a fresh fingerprint and requesting verification/);
  assert.match(script, /Fingerprint verified/);
  assert.match(script, /Fingerprint or PIN number did not match/);
  assert.match(script, /A usable fingerprint was not captured/);
  assert.match(script, /IAM verification timed out/);
  assert.match(script, /status === 'NOT_ENROLLED'/);
  assert.match(script, /Verification stopped before fingerprint capture/);
  assert.match(script, /FINGERPRINT_FACTOR_AMBIGUOUS/);
  assert.match(script, /the app did not choose one or capture a fingerprint/);
  assert.match(script, /Unenroll test fingerprints/);
  assert.match(script, /error\.code !== 'SIGN_IN_REQUIRED'/);
  assert.doesNotMatch(script, /error\.httpStatus !== 401/);
  assert.doesNotMatch(
    script,
    /api\('\/api\/verify'[\s\S]*finger:\s*enrollFingerEl\.value/,
  );
});

test('only an explicit local sign-in error expires the browser session', () => {
  const handler = script.match(
    /function handleSessionError\(error\) \{[\s\S]*?\n\}/,
  );
  assert.ok(handler, 'handleSessionError must remain defined');
  assert.match(handler[0], /error\.code !== 'SIGN_IN_REQUIRED'/);
  assert.match(handler[0], /showSignedOut\(\{ expired: hadAuthenticatedSession, focus: true \}\)/);
  assert.doesNotMatch(handler[0], /httpStatus/);
  assert.match(script, /error\.code = json\.code/);
});

test('unenrollment has distinct removed, not-enrolled, and failure outcomes', () => {
  assert.match(script, /api\('\/api\/unenroll'/);
  assert.match(script, /Fingerprint enrollment removed/);
  assert.match(script, /No fingerprint enrollment found/);
  assert.match(script, /Fingerprint could not be unenrolled/);
  assert.match(script, /status === 'NOT_ENROLLED'/);
  assert.match(script, /showUnenrollmentFailure\(error\)/);
});

test('unenrollment failure displays the IAM API error and reference', () => {
  const { context, outcomes } = outcomeHarness();
  context.showUnenrollmentFailure({
    message: "AUTH-1143: You can't delete the factor. You must have at least one active factor for 2-Step Verification.",
    reference: 'unenrollment-ecid',
  });

  assert.equal(outcomes.length, 1);
  assert.match(outcomes[0].message, /AUTH-1143/);
  assert.match(outcomes[0].message, /at least one active factor/);
  assert.equal(outcomes[0].reference, 'unenrollment-ecid');
});

test('enrollment and verification failures display IAM API errors', () => {
  const { context, outcomes } = outcomeHarness();
  const error = {
    message: 'FACTOR_OPERATION_DENIED: The operation is not permitted by policy.',
    reference: 'iam-error-ecid',
  };

  context.showEnrollmentFailure(error);
  context.showVerificationFailure(error);

  assert.equal(outcomes.length, 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.message, error.message);
    assert.equal(outcome.reference, 'iam-error-ecid');
  }
});

test('retryable capture failures remain in the consent dialog', () => {
  assert.match(script, /if \(error\.retryable\)/);
  assert.match(script, /Agree and retry capture/);
  assert.match(script, /setConsentError\(message\)/);
});

test('already-enrolled guidance requires an explicit unenrollment action', () => {
  const { context, outcomes } = outcomeHarness();
  context.showEnrollmentAlready({ message: 'A fingerprint is already enrolled.' });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].primaryAction, 'verify');
  assert.match(outcomes[0].message, /Verify the existing fingerprint/);
  assert.match(outcomes[0].message, /Back and then Unenroll fingerprint to remove the test enrollment/);
  assert.match(outcomes[0].message, /Nothing has been removed automatically/);
});

test('capture failures are not presented as IAM failures regardless of retryability', () => {
  for (const code of ['BRIDGE_REQUEST_FAILED', 'BRIDGE_TIMEOUT', 'CAPTURE_QUALITY_LOW']) {
    for (const retryable of [true, false]) {
      const { context, outcomes } = outcomeHarness();
      const error = { code, retryable, httpStatus: 400, message: 'The fingerprint bridge could not complete the request.' };
      context.showVerificationFailure(error);
      context.showEnrollmentFailure(error);
      assert.equal(outcomes.length, 2);
      for (const outcome of outcomes) {
        assert.equal(outcome.eyebrow, 'CAPTURE NEEDS ATTENTION');
        assert.match(outcome.message, /fingerprint bridge/);
        assert.doesNotMatch(outcome.message, /IAM/);
      }
      assert.equal(outcomes[0].primaryAction, 'verify');
      assert.equal(outcomes[1].primaryAction, 'enroll');
    }
  }
});

test('upstream authentication errors remain technical errors without signing out', () => {
  const { context, outcomes, signOuts } = outcomeHarness();
  const error = { code: 'UPSTREAM_HTTP_ERROR', httpStatus: 401, retryable: false };
  assert.equal(context.handleSessionError(error), false);
  context.showVerificationFailure(error);
  context.showEnrollmentFailure(error);
  assert.equal(signOuts.length, 0);
  assert.equal(outcomes[0].eyebrow, 'VERIFICATION ERROR');
  assert.equal(outcomes[1].eyebrow, 'ENROLLMENT FAILED');
  assert.equal(context.handleSessionError({ code: 'SIGN_IN_REQUIRED', httpStatus: 401 }), true);
  assert.equal(signOuts.length, 1);
});

test('retryable IAM failures are not labelled as capture problems in the consent dialog', () => {
  assert.match(script, /const captureFailed = isCaptureFailure\(error\)/);
  assert.match(script, /captureFailed \? 'Agree and retry capture' : 'Agree and retry enrollment'/);
  assert.match(script, /safeResultMessage\(\s*error && error\.message,[\s\S]*IAM could not complete the request/);
});

test('HTML ids are unique and every direct id selector exists', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);

  const selectedIds = [...script.matchAll(/querySelector\('#([^']+)'\)/g)]
    .map((match) => match[1]);
  for (const id of selectedIds) {
    assert.ok(ids.includes(id), `Missing HTML element #${id}`);
  }
});

function outcomeHarness() {
  const outcomes = [];
  const signOuts = [];
  const context = vm.createContext({
    showOutcome: (outcome) => outcomes.push(outcome),
    showSignedOut: (options) => signOuts.push(options),
    hadAuthenticatedSession: true,
    api: () => assert.fail('Outcome rendering must not call an API'),
  });
  for (const name of [
    'safeReference',
    'safeResultMessage',
    'safeCaptureError',
    'isCaptureFailure',
    'handleSessionError',
    'showEnrollmentAlready',
    'showEnrollmentFailure',
    'showVerificationFailure',
    'showUnenrollmentFailure',
  ]) {
    const source = script.match(new RegExp(`^function ${name}\\([^]*?^\\}`, 'm'));
    assert.ok(source, `Missing function ${name}`);
    vm.runInContext(source[0], context);
  }
  return { context, outcomes, signOuts };
}
