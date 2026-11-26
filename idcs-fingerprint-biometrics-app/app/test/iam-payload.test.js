'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  FINGERPRINT_EXTENSION,
  enrollmentContinuationPayload,
  enrollmentInitiationPayload,
  verificationCompletionPayload,
  verificationInitiationPayload,
} = require('../src/iam-payload');

const request = Object.freeze({
  userId: 'user-guid-fixture',
  factorId: 'factor-1',
  finger: 'RIGHT_INDEX',
  template: 'dummy-template',
  transactionId: 'fp-test-1',
});
const biometric = Object.freeze({
  btpClientVersion: '1.0.0',
  deviceModel: 'HID Lumidigm V521-01-01',
  deviceVersion: 'V521',
  devicePadLevel: 'L1',
  minexStd: 'legacy-value-must-not-be-sent',
  format: 'legacy-value-must-not-be-sent',
});
const fingerprint = Object.freeze({
  biometricData: 'dummy-template',
  fingerPosition: 'RIGHT_INDEX',
  btpClientVersion: '1.0.0',
  clientReferenceId: 'fp-test-1',
  deviceModel: 'HID Lumidigm V521-01-01',
  deviceVersion: 'V521',
  devicePadLevel: 'L1',
});

test('uses the public fingerprint MFA extension URN', () => {
  assert.equal(
    FINGERPRINT_EXTENSION,
    'urn:ietf:params:scim:schemas:oracle:idcs:extension:fingerprint:mfa',
  );
});

test('enrollment initiation sends only the factor method', () => {
  assert.deepEqual(enrollmentInitiationPayload(), {
    method: 'FINGERPRINT_BIOMETRIC',
  });
});

test('accepted enrollment continuation sends state and fingerprint extension', () => {
  assert.deepEqual(
    enrollmentContinuationPayload(request, biometric, {
      action: 'ACCEPTED',
      requestState: 'opaque-enrollment-state',
    }),
    {
      action: 'ACCEPTED',
      requestState: 'opaque-enrollment-state',
      [FINGERPRINT_EXTENSION]: fingerprint,
    },
  );
});

test('declined enrollment continuation sends no biometric material', () => {
  const payload = enrollmentContinuationPayload(request, biometric, {
    action: 'DECLINED',
    requestState: 'opaque-enrollment-state',
  });

  assert.deepEqual(payload, {
    action: 'DECLINED',
    requestState: 'opaque-enrollment-state',
  });
  assert.equal(payload[FINGERPRINT_EXTENSION], undefined);
});

test('verification initiation sends user, selected factor, and method only', () => {
  assert.deepEqual(verificationInitiationPayload(request), {
    userId: 'user-guid-fixture',
    userIdType: 'USER_GUID',
    factorId: 'factor-1',
    method: 'FINGERPRINT_BIOMETRIC',
  });
});

test('verification completion sends state and fingerprint extension only', () => {
  assert.deepEqual(
    verificationCompletionPayload(request, biometric, {
      requestState: 'opaque-verification-state',
    }),
    {
      requestState: 'opaque-verification-state',
      [FINGERPRINT_EXTENSION]: fingerprint,
    },
  );
});

test('request state, identifiers, and enrollment actions are validated locally', () => {
  assert.throws(
    () => enrollmentContinuationPayload(request, biometric, {
      action: 'ACCEPTED',
      requestState: '',
    }),
    /requestState/,
  );
  assert.throws(
    () => enrollmentContinuationPayload(undefined, undefined, {
      action: 'UNKNOWN',
      requestState: 'opaque-state',
    }),
    /ACCEPTED or DECLINED/,
  );
  assert.throws(
    () => verificationInitiationPayload({ factorId: 'factor-1' }),
    /user GUID/,
  );
  assert.throws(
    () => verificationInitiationPayload({ userId: 'user-1' }),
    /factor identifier/,
  );
  assert.throws(
    () => verificationCompletionPayload(request, biometric, {}),
    /requestState/,
  );
});

test('accepted and verification fingerprint metadata is mandatory', () => {
  assert.throws(
    () => verificationCompletionPayload(
      { ...request, template: '' },
      biometric,
      { requestState: 'opaque-state' },
    ),
    /biometricData/,
  );
  assert.throws(
    () => verificationCompletionPayload(
      { ...request, finger: 'NOT_A_FINGER' },
      biometric,
      { requestState: 'opaque-state' },
    ),
    /Unsupported finger position/,
  );
  assert.throws(
    () => verificationCompletionPayload(
      { ...request, transactionId: '' },
      biometric,
      { requestState: 'opaque-state' },
    ),
    /clientReferenceId/,
  );
  for (const [field, setting] of [
    ['btpClientVersion', 'IAM_BTP_CLIENT_VERSION'],
    ['deviceModel', 'fingerprint device mapping model'],
    ['deviceVersion', 'fingerprint device mapping version'],
    ['devicePadLevel', 'fingerprint device mapping padLevel'],
  ]) {
    assert.throws(
      () => verificationCompletionPayload(
        request,
        { ...biometric, [field]: '' },
        { requestState: 'opaque-state' },
      ),
      new RegExp(setting),
    );
  }
});
