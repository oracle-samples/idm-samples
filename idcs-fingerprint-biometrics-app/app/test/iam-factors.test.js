'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  chooseFingerprintFactor,
  fingerprintFactorIds,
} = require('../src/iam-factors');

test('selects only fingerprint factor IDs from supported IAM list shapes', () => {
  const response = {
    factors: [
      { factorId: 'fingerprint-1', methods: ['FINGERPRINT_BIOMETRIC'] },
      { factorId: 'totp-1', methods: ['TOTP'] },
      { id: 'fingerprint-2', factorType: 'fingerprint_biometric' },
      { value: 'fingerprint-1', type: { value: 'FINGERPRINT_BIOMETRIC' } },
      {
        factorId: 'fingerprint-3',
        methods: ['FIDO_AUTHENTICATOR', 'FINGERPRINT_BIOMETRIC'],
      },
    ],
  };
  assert.deepEqual(fingerprintFactorIds(response), [
    'fingerprint-1',
    'fingerprint-2',
    'fingerprint-3',
  ]);
  assert.deepEqual(
    fingerprintFactorIds({ Resources: response.factors }),
    ['fingerprint-1', 'fingerprint-2', 'fingerprint-3'],
  );
});

test('chooses preferred fingerprint factor only when returned by IAM', () => {
  const response = {
    factors: [
      { factorId: 'fingerprint-1', methods: ['FINGERPRINT_BIOMETRIC'] },
      { factorId: 'fingerprint-2', methods: ['FINGERPRINT_BIOMETRIC'] },
    ],
  };

  assert.equal(
    chooseFingerprintFactor(response, 'fingerprint-2'),
    'fingerprint-2',
  );
  assert.throws(
    () => chooseFingerprintFactor(response, 'not-returned'),
    (error) =>
      error.code === 'FINGERPRINT_FACTOR_AMBIGUOUS' &&
      error.statusCode === 409 &&
      typeof error.publicMessage === 'string',
  );
});

test('chooses the sole fingerprint factor and returns null for none', () => {
  assert.equal(
    chooseFingerprintFactor({
      factors: [
        { factorId: 'fingerprint-1', methods: ['FINGERPRINT_BIOMETRIC'] },
      ],
    }),
    'fingerprint-1',
  );
  assert.equal(
    chooseFingerprintFactor({
      factors: [{ factorId: 'email-1', methods: ['EMAIL'] }],
    }),
    null,
  );
  assert.equal(
    chooseFingerprintFactor({ totalResults: 0, Resources: [] }),
    null,
  );
});

test('rejects ambiguous responses and fingerprint factors without an ID', () => {
  assert.throws(
    () => fingerprintFactorIds({ status: 'success' }),
    (error) => error.code === 'IAM_FACTORS_RESPONSE_INVALID',
  );
  assert.throws(
    () => fingerprintFactorIds({
      factors: [{ methods: ['FINGERPRINT_BIOMETRIC'] }],
    }),
    (error) => error.code === 'IAM_FACTORS_RESPONSE_INVALID',
  );
});
