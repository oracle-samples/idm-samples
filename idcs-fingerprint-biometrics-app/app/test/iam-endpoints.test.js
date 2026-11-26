'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createMfaEndpoints } = require('../src/iam-endpoints');

const base =
  'https://idcs-0123456789abcdef0123456789abcdef.secure.identity.oraclecloud.com/mfa/v1';

test('derives exact standard MFA endpoints and encodes identifiers', () => {
  const endpoints = createMfaEndpoints(`${base}/`);

  assert.equal(
    endpoints.factors('user/id with spaces'),
    `${base}/users/user%2Fid%20with%20spaces/factors`,
  );
  assert.equal(
    endpoints.factor('user/id with spaces', 'factor/id'),
    `${base}/users/user%2Fid%20with%20spaces/factors/factor%2Fid`,
  );
  assert.equal(endpoints.requests(), `${base}/requests`);
  assert.equal(
    endpoints.request('request/id'),
    `${base}/requests/request%2Fid`,
  );
  assert.equal(Object.isFrozen(endpoints), true);
});

test('allows HTTP only for loopback test servers', () => {
  assert.equal(
    createMfaEndpoints('http://127.0.0.1:18080/mfa/v1').requests(),
    'http://127.0.0.1:18080/mfa/v1/requests',
  );
  assert.equal(
    createMfaEndpoints('http://localhost:18080/mfa/v1').requests(),
    'http://localhost:18080/mfa/v1/requests',
  );
  assert.throws(
    () => createMfaEndpoints('http://example.test/mfa/v1'),
    (error) => error.code === 'IAM_MFA_BASE_URL_INSECURE',
  );
});

test('rejects missing, legacy, and malformed MFA base URLs', () => {
  assert.throws(
    () => createMfaEndpoints(''),
    (error) => error.code === 'IAM_MFA_BASE_URL_NOT_CONFIGURED',
  );
  assert.throws(
    () => createMfaEndpoints(`${base}/secure/requests`),
    (error) => error.code === 'IAM_MFA_BASE_URL_LEGACY',
  );

  for (const value of [
    'https://user:password@example.test/mfa/v1',
    'https://example.test/mfa/v1?tenant=other',
    'https://example.test/mfa/v1#fragment',
    'https://example.test/mfa/v2',
    'https://example.test/mfa/v1/%2e',
    'not-a-url',
  ]) {
    assert.throws(
      () => createMfaEndpoints(value),
      (error) => error.code === 'IAM_MFA_BASE_URL_INVALID',
      value,
    );
  }
});

test('rejects path segments that could change URL structure', () => {
  const endpoints = createMfaEndpoints(base);

  for (const value of [
    '.',
    '..',
    'user/../admin',
    'value?query=1',
    'value#fragment',
    '//other-host.test/path',
    'https://other-host.test/path',
    'value\\path',
  ]) {
    assert.throws(
      () => endpoints.factor(value, 'factor-1'),
      (error) => error.code === 'IAM_MFA_PATH_SEGMENT_INVALID',
      value,
    );
  }
});
