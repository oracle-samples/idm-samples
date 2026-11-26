'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const { after, before, test, mock } = require('node:test');

const USER_ID = 'user-guid-fixture';
const FINGERPRINT_EXTENSION =
  'urn:ietf:params:scim:schemas:oracle:idcs:extension:fingerprint:mfa';
const PIN = '123456';

let appServer;
let appBaseUrl;
let bridgeServer;
let iamServer;
let iamBaseUrl;
let sessionCookie;
let captureCount = 0;
let behavior;
let mfaCalls = [];
let mfaAuthorizationHeaders = [];
let serviceTokenGrants = [];

before(async () => {
  bridgeServer = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/capture') {
      return sendJson(res, 404, { error: 'Not found' });
    }
    const payload = await readBody(req);
    captureCount += 1;
    if (behavior.capture) return sendBehavior(res, behavior.capture);
    return sendJson(res, 200, {
      reader: payload.reader,
      readerIdentity: 'mock',
      quality: 95,
      livenessPassed: true,
      rawImageBytes: 512,
      template: 'stable-fake-template',
    });
  });
  await listen(bridgeServer);

  iamServer = http.createServer(async (req, res) => {
    const raw = await readRawBody(req);
    const payload = raw && req.headers['content-type']?.includes('application/json')
      ? JSON.parse(raw)
      : undefined;

    if (req.url === '/oauth2/v1/token' && req.method === 'POST') {
      return sendJson(res, 200, { access_token: fakeAccessToken() });
    }
    if (req.url === '/oauth2/v1/userinfo' && req.method === 'GET') {
      return sendJson(res, 200, {
        name: 'IAM Flow Test User',
        email: 'iam-flow-test@example.invalid',
      });
    }
    if (req.url === '/token' && req.method === 'POST') {
      serviceTokenGrants.push(Object.fromEntries(new URLSearchParams(raw)));
      return sendJson(res, 200, {
        access_token: 'service-token-fixture',
        expires_in: 3600,
      });
    }

    if (req.url.startsWith('/mfa/v1/')) {
      mfaCalls.push({ method: req.method, url: req.url, body: payload });
      mfaAuthorizationHeaders.push(req.headers.authorization);
    }

    if (req.url === `/mfa/v1/users/${USER_ID}/factors`) {
      if (req.method === 'GET') {
        if (behavior.factorLookup) return sendBehavior(res, behavior.factorLookup);
        return sendJson(res, 200, { factors: behavior.factors });
      }
      if (req.method === 'POST') {
        return sendBehavior(res, behavior.enrollmentInitiation);
      }
    }

    const factorMatch = req.url.match(
      new RegExp(`^/mfa/v1/users/${USER_ID}/factors/([^/?#]+)$`),
    );
    if (factorMatch && req.method === 'PATCH') {
      return sendBehavior(
        res,
        payload && payload.action === 'DECLINED'
          ? behavior.enrollmentDecline
          : behavior.enrollmentCompletion,
      );
    }
    if (factorMatch && req.method === 'DELETE') {
      if (behavior.unenrollmentDelete) {
        return sendBehavior(res, behavior.unenrollmentDelete);
      }
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/mfa/v1/requests' && req.method === 'POST') {
      return sendBehavior(res, behavior.verificationInitiation);
    }
    if (/^\/mfa\/v1\/requests\/[^/?#]+$/.test(req.url) && req.method === 'PATCH') {
      if (behavior.verificationCompletion.hang) {
        return;
      }
      return sendBehavior(res, behavior.verificationCompletion);
    }

    return sendJson(res, 404, { error: 'Unexpected fake IAM request' });
  });
  await listen(iamServer);
  iamBaseUrl = serverUrl(iamServer);

  const originalHttpsRequest = https.request;
  mock.method(https, 'request', function fakeUserinfoRequest(...args) {
    const target = requestUrl(args[0]);
    if (target && target.origin === iamBaseUrl && target.pathname === '/oauth2/v1/userinfo') {
      return http.request(...args);
    }
    return originalHttpsRequest.apply(this, args);
  });

  // Loopback HTTP keeps this suite hermetic. Readable fixture paths satisfy the
  // production config checks; TLS certificate exchange itself is not exercised.
  Object.assign(process.env, {
    IAM_MOCK_MODE: 'false',
    IAM_DEBUG_LOGGING: 'false',
    WEB_PORT: '0',
    BRIDGE_URL: serverUrl(bridgeServer),
    BRIDGE_REQUEST_TIMEOUT_MS: '500',
    IAM_REQUEST_TIMEOUT_MS: '400',
    OIDC_ISSUER: iamBaseUrl,
    OIDC_CLIENT_ID: 'oidc-client-fixture',
    OIDC_CLIENT_SECRET: 'oidc-secret-fixture',
    OIDC_REDIRECT_URI: 'http://127.0.0.1/oauth/callback',
    OIDC_SCOPES: 'openid profile email',
    IAM_TOKEN_URL: `${iamBaseUrl}/token`,
    IAM_CLIENT_ID: 'mtls-client-fixture',
    IAM_CLIENT_CERT: __filename,
    IAM_CLIENT_KEY: __filename,
    IAM_MFA_BASE_URL: `${iamBaseUrl}/mfa/v1`,
    IAM_SERVICE_SCOPE: 'urn:test:fingerprint',
    IAM_BTP_CLIENT_VERSION: 'test-btp-1.0',
    IAM_BIOMETRIC_DATA_OVERRIDE: ' ',
    FINGERPRINT_DEVICE_MAPPING_1:
      'mock -> model=Reference Reader;version=1;padLevel=L1',
  });

  resetBehavior();
  ({ server: appServer } = require('../src/server'));
  await listen(appServer);
  appBaseUrl = serverUrl(appServer);
  sessionCookie = await login();
});

after(async () => {
  mock.restoreAll();
  await close(appServer);
  await close(bridgeServer);
  await close(iamServer);
});

test('real adapter sends the exact enrollment and verification POST/PATCH contracts', async () => {
  resetBehavior({ enrolled: false });

  const initiated = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX',
    reader: '0',
    seed2: PIN,
  });
  assert.equal(initiated.statusCode, 200);
  assert.equal(initiated.body.status, 'CONSENT_REQUIRED');
  assert.ok(initiated.body.flowId);
  assert.equal(initiated.body.factorId, undefined);
  assert.equal(initiated.body.requestState, undefined);
  assert.equal(JSON.stringify(initiated.body).includes('enrollment-state-secret'), false);
  assert.equal(captureCount, 0);

  assert.deepEqual(mfaCalls[0], {
    method: 'GET',
    url: `/mfa/v1/users/${USER_ID}/factors`,
    body: undefined,
  });
  assert.deepEqual(mfaCalls[1], {
    method: 'POST',
    url: `/mfa/v1/users/${USER_ID}/factors`,
    body: { method: 'FINGERPRINT_BIOMETRIC' },
  });

  const enrolled = await post('/api/enroll/continue', {
    flowId: initiated.body.flowId,
    action: 'ACCEPTED',
    seed2: PIN,
  });
  assert.equal(enrolled.statusCode, 200);
  assert.equal(enrolled.body.status, 'ENROLLED');
  assert.equal(enrolled.body.requestState, undefined);
  assert.equal(captureCount, 1);

  const enrollPatch = mfaCalls.find(
    (call) => call.method === 'PATCH' && call.url.endsWith('/factors/factor-enroll'),
  );
  assert.ok(enrollPatch);
  assert.deepEqual(Object.keys(enrollPatch.body).sort(), [
    FINGERPRINT_EXTENSION,
    'action',
    'requestState',
  ].sort());
  assert.equal(enrollPatch.body.action, 'ACCEPTED');
  assert.equal(enrollPatch.body.requestState, 'enrollment-state-secret');
  assertFingerprintExtension(enrollPatch.body[FINGERPRINT_EXTENSION], 'RIGHT_INDEX');

  behavior.factors = [fingerprintFactor('factor-enroll')];
  const verified = await post('/api/verify', {
    finger: 'LEFT_THUMB',
    reader: '0',
    seed2: PIN,
  });
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.body.status, 'MATCH');
  assert.equal(verified.body.requestState, undefined);
  assert.equal(captureCount, 2);

  const factorLookup = mfaCalls.find(
    (call) => call.method === 'GET' && call.url.endsWith('/factors'),
  );
  assert.ok(factorLookup);
  const verificationPost = mfaCalls.find(
    (call) => call.method === 'POST' && call.url === '/mfa/v1/requests',
  );
  assert.deepEqual(verificationPost.body, {
    userId: USER_ID,
    userIdType: 'USER_GUID',
    factorId: 'factor-enroll',
    method: 'FINGERPRINT_BIOMETRIC',
  });
  const verificationPatch = mfaCalls.find(
    (call) => call.method === 'PATCH' && call.url === '/mfa/v1/requests/request-verify',
  );
  assert.ok(verificationPatch);
  assert.deepEqual(Object.keys(verificationPatch.body).sort(), [
    FINGERPRINT_EXTENSION,
    'requestState',
  ].sort());
  assert.equal(verificationPatch.body.requestState, 'verification-state-secret');
  assertFingerprintExtension(
    verificationPatch.body[FINGERPRINT_EXTENSION],
    'LEFT_THUMB',
  );
  assert.equal(
    mfaCalls.some((call) => call.url.includes('/secure/requests')),
    false,
  );
  assert.ok(mfaAuthorizationHeaders.length > 0);
  assert.equal(
    mfaAuthorizationHeaders.every(
      (authorization) => authorization === 'Bearer service-token-fixture',
    ),
    true,
    'MFA calls must use the mTLS service token, never the OIDC user token',
  );
  assert.equal(
    serviceTokenGrants.length,
    1,
    'one valid mTLS service token should be reused across IAM requests',
  );
  for (const grant of serviceTokenGrants) {
    assert.deepEqual(grant, {
      grant_type: 'tls_client_auth',
      client_id: 'mtls-client-fixture',
      scope: 'urn:test:fingerprint',
    });
  }
});

test('existing enrollment stops before POST or capture and is never removed automatically', async () => {
  resetBehavior();
  const result = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(result.statusCode, 409);
  assert.equal(result.body.code, 'ALREADY_ENROLLED');
  assert.match(result.body.error, /remove the test enrollment/i);
  assert.equal(result.body.flowId, undefined);
  assert.equal(captureCount, 0);
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET']);
  assert.deepEqual(behavior.factors, [fingerprintFactor('factor-enroll')]);

  // A later user-authorized removal must be observed, not hidden by a cache.
  behavior.factors = [{ factorId: 'email-one', methods: ['EMAIL'] }];
  const retry = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.status, 'CONSENT_REQUIRED');
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET', 'GET', 'POST']);
  assert.equal(captureCount, 0);
});

test('AUTH-1131 noFactorFound lookup proceeds with fingerprint enrollment', async () => {
  resetBehavior({ enrolled: false });
  behavior.factorLookup = {
    statusCode: 401,
    body: {
      status: 'noFactorFound',
      ecId: 'no-factor-ecid',
      userGUID: USER_ID,
      cause: [{
        code: 'AUTH-1131',
        message: "You aren't authorized to perform this action, since you haven't enrolled for any MFA factors.",
      }],
    },
  };

  const result = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'CONSENT_REQUIRED');
  assert.equal(captureCount, 0);
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET', 'POST']);
});

test('failed or malformed factor lookup blocks enrollment without guessing the cause', async (t) => {
  for (const [name, response, expectedStatus, expectedCode] of [
    ['authorization failure', {
      statusCode: 401,
      body: { status: 'failed', cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }] },
    }, 401, 'UPSTREAM_HTTP_ERROR'],
    ['AUTH-1131 with a different response status', {
      statusCode: 401,
      body: { status: 'failed', cause: [{ code: 'AUTH-1131', message: 'Not enrolled.' }] },
    }, 401, 'UPSTREAM_HTTP_ERROR'],
    ['malformed factors', { statusCode: 200, body: { status: 'success' } }, 502, 'IAM_FACTORS_RESPONSE_INVALID'],
  ]) {
    await t.test(name, async () => {
      resetBehavior({ enrolled: false });
      behavior.factorLookup = response;
      const result = await post('/api/enroll/initiate', {
        finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
      });
      assert.equal(result.statusCode, expectedStatus);
      assert.equal(result.body.code, expectedCode);
      assert.equal(captureCount, 0);
      assert.deepEqual(mfaCalls.map((call) => call.method), ['GET']);
    });
  }
});

test('generic enrollment AUTH-1007 is not labeled already enrolled without factor evidence', async () => {
  resetBehavior({ enrolled: false });
  behavior.enrollmentInitiation = {
    statusCode: 401,
    body: { status: 'failed', ecId: 'fixture-ecid', cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }] },
  };
  const result = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(result.statusCode, 401);
  assert.equal(result.body.code, 'UPSTREAM_HTTP_ERROR');
  assert.equal(result.body.ecId, 'fixture-ecid');
  assert.deepEqual(result.body.causeCodes, ['AUTH-1007']);
  assert.equal(captureCount, 0);
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET', 'POST']);
});

test('reader rejection after a successful verification challenge never submits a template to IAM', async () => {
  resetBehavior();
  behavior.capture = { statusCode: 400, body: { error: 'Capture could not complete.' } };
  const result = await post('/api/verify', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'BRIDGE_REQUEST_FAILED');
  assert.equal(result.body.retryable, false);
  assert.equal(captureCount, 1);
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET', 'POST']);
  assert.equal(mfaCalls.some((call) => call.method === 'PATCH'), false);
});

test('invalid enrollment or verification challenges never prompt the reader', async (t) => {
  await t.test('missing enrollment requestState', async () => {
    resetBehavior({ enrolled: false });
    delete behavior.enrollmentInitiation.body.requestState;
    const result = await post('/api/enroll/initiate', {
      finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
    });
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.code, 'IAM_CONSENT_RESPONSE_INVALID');
    assert.equal(captureCount, 0);
  });

  await t.test('missing verification requestState', async () => {
    resetBehavior();
    delete behavior.verificationInitiation.body.requestState;
    const result = await post('/api/verify', {
      finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
    });
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.code, 'IAM_VERIFICATION_CHALLENGE_INVALID');
    assert.equal(captureCount, 0);
  });

  await t.test('verification challenge for another user', async () => {
    resetBehavior();
    behavior.verificationInitiation.body.userGUID = 'different-user';
    const result = await post('/api/verify', {
      finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
    });
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.code, 'IAM_VERIFICATION_CHALLENGE_INVALID');
    assert.equal(captureCount, 0);
  });
});

test('zero or ambiguous fingerprint factors stop before initiation and capture', async (t) => {
  await t.test('no fingerprint factor', async () => {
    resetBehavior();
    behavior.factors = [];
    const result = await post('/api/verify', {
      finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.status, 'NOT_ENROLLED');
    assert.equal(captureCount, 0);
    assert.equal(mfaCalls.some((call) => call.url === '/mfa/v1/requests'), false);
  });

  await t.test('ambiguous fingerprint factors', async () => {
    resetBehavior();
    behavior.factors = [fingerprintFactor('factor-a'), fingerprintFactor('factor-b')];
    const result = await post('/api/verify', {
      finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
    });
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.code, 'FINGERPRINT_FACTOR_AMBIGUOUS');
    assert.equal(captureCount, 0);
    assert.equal(mfaCalls.some((call) => call.url === '/mfa/v1/requests'), false);
  });
});

test('AUTH-1007 from final verification is returned as a biometric no-match', async () => {
  resetBehavior();
  behavior.verificationCompletion = {
    statusCode: 401,
    body: {
      status: 'failed',
      factorStatus: 'FAILURE',
      cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }],
    },
  };

  const result = await post('/api/verify', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'NO_MATCH');
  assert.match(result.body.message, /fingerprint or PIN number did not match/i);
  assert.equal(captureCount, 1);
});

test('a timed-out final verification PATCH is not replayed', async () => {
  resetBehavior();
  behavior.verificationCompletion = { hang: true };

  const result = await post('/api/verify', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(result.statusCode, 504);
  assert.equal(result.body.code, 'UPSTREAM_TIMEOUT');
  assert.equal(captureCount, 1);
  assert.equal(
    mfaCalls.filter(
      (call) => call.method === 'PATCH' && call.url === '/mfa/v1/requests/request-verify',
    ).length,
    1,
  );
});

test('a timed-out enrollment completion consumes the one-shot flow', async () => {
  resetBehavior({ enrolled: false });
  behavior.enrollmentCompletion = { hang: true };
  const initiated = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });

  const first = await post('/api/enroll/continue', {
    flowId: initiated.body.flowId,
    action: 'ACCEPTED',
    seed2: PIN,
  });
  assert.equal(first.statusCode, 504);
  assert.equal(first.body.code, 'UPSTREAM_TIMEOUT');
  assert.equal(first.body.retryable, false);
  assert.equal(captureCount, 1);

  const replay = await post('/api/enroll/continue', {
    flowId: initiated.body.flowId,
    action: 'ACCEPTED',
    seed2: PIN,
  });
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.body.code, 'ENROLLMENT_FLOW_EXPIRED');
  assert.equal(captureCount, 1, 'a consumed flow must not capture again');
  assert.equal(
    mfaCalls.filter(
      (call) => call.method === 'PATCH' && call.url.endsWith('/factors/factor-enroll'),
    ).length,
    1,
  );
});

test('explicit DECLINED consent uses PATCH, accepts the documented 401, and never captures', async () => {
  resetBehavior({ enrolled: false });
  behavior.enrollmentDecline = {
    statusCode: 401,
    body: { status: 'failed', factorStatus: 'FAILURE' },
  };
  const initiated = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  assert.equal(initiated.statusCode, 200);

  const result = await post('/api/enroll/cancel', { flowId: initiated.body.flowId });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'DECLINED');
  assert.equal(result.body.iamAcknowledged, true);
  assert.equal(captureCount, 0);

  const declinePatch = mfaCalls.find(
    (call) => call.method === 'PATCH' && call.url.endsWith('/factors/factor-enroll'),
  );
  assert.deepEqual(declinePatch.body, {
    action: 'DECLINED',
    requestState: 'enrollment-state-secret',
  });
});

test('a generic decline 401 is not mistaken for the documented acknowledgement', async () => {
  resetBehavior({ enrolled: false });
  behavior.enrollmentDecline = {
    statusCode: 401,
    body: {
      status: 'failed',
      factorStatus: 'FAILURE',
      cause: [{ code: 'AUTH-9999', message: 'Cancellation could not be completed.' }],
    },
  };
  const initiated = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX', reader: '0', seed2: PIN,
  });
  const result = await post('/api/enroll/cancel', { flowId: initiated.body.flowId });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'DECLINED');
  assert.equal(result.body.iamAcknowledged, false);
  assert.equal(result.body.upstreamStatus, 401);
  assert.equal(captureCount, 0);
});

test('unenrollment deletes only fingerprint factors and leaves other MFA factors', async () => {
  resetBehavior();
  behavior.factors = [
    fingerprintFactor('fingerprint-one'),
    { factorId: 'totp-one', method: 'TOTP' },
    fingerprintFactor('fingerprint-two'),
  ];

  const result = await post('/api/unenroll', {});
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'UNENROLLED');
  assert.equal(result.body.removedFactorCount, 2);
  assert.deepEqual(
    mfaCalls
      .filter((call) => call.method === 'DELETE')
      .map((call) => call.url),
    [
      `/mfa/v1/users/${USER_ID}/factors/fingerprint-one`,
      `/mfa/v1/users/${USER_ID}/factors/fingerprint-two`,
    ],
  );
  assert.equal(mfaCalls.some((call) => call.url.endsWith('/totp-one')), false);
  assert.equal(captureCount, 0);
});

test('unenrollment exposes a validated IAM delete error and reference', async () => {
  resetBehavior();
  behavior.unenrollmentDelete = {
    statusCode: 400,
    body: {
      status: 'failed',
      ecId: 'f3d82d510ef8ab39a7664aa5bc81c928',
      cause: [{
        code: 'AUTH-1143',
        message: "You can't delete the factor. You must have at least one active factor for 2-Step Verification.",
      }],
    },
  };

  const result = await post('/api/unenroll', {});

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'UPSTREAM_HTTP_ERROR');
  assert.equal(
    result.body.error,
    "AUTH-1143: You can't delete the factor. You must have at least one active factor for 2-Step Verification.",
  );
  assert.equal(result.body.ecId, 'f3d82d510ef8ab39a7664aa5bc81c928');
  assert.deepEqual(result.body.causeCodes, ['AUTH-1143']);
  assert.deepEqual(mfaCalls.map((call) => call.method), ['GET', 'DELETE']);
});

function resetBehavior({ enrolled = true } = {}) {
  captureCount = 0;
  mfaCalls = [];
  mfaAuthorizationHeaders = [];
  serviceTokenGrants = [];
  behavior = {
    factors: enrolled ? [fingerprintFactor('factor-enroll')] : [],
    enrollmentInitiation: {
      statusCode: 200,
      body: {
        status: 'success',
        factorStatus: 'CONSENT_REQUIRED',
        factorId: 'factor-enroll',
        requestState: 'enrollment-state-secret',
        consent: {
          consentStatement: 'I consent to this fingerprint enrollment test.',
          locale: 'en',
        },
      },
    },
    enrollmentCompletion: { statusCode: 200, body: { status: 'success' } },
    enrollmentDecline: { statusCode: 200, body: { status: 'success' } },
    verificationInitiation: {
      statusCode: 200,
      body: {
        status: 'success',
        userGUID: USER_ID,
        factorId: 'factor-enroll',
        method: 'FINGERPRINT_BIOMETRIC',
        requestId: 'request-verify',
        requestState: 'verification-state-secret',
      },
    },
    verificationCompletion: { statusCode: 200, body: { status: 'success' } },
  };
}

function fingerprintFactor(factorId) {
  return {
    factorId,
    displayName: 'Fingerprint',
    methods: ['FINGERPRINT_BIOMETRIC'],
  };
}

function assertFingerprintExtension(extension, fingerPosition) {
  assert.deepEqual(Object.keys(extension).sort(), [
    'biometricData',
    'btpClientVersion',
    'clientReferenceId',
    'deviceModel',
    'devicePadLevel',
    'deviceVersion',
    'fingerPosition',
  ].sort());
  assert.equal(extension.biometricData, 'stable-fake-template');
  assert.equal(extension.fingerPosition, fingerPosition);
  assert.equal(extension.btpClientVersion, 'test-btp-1.0');
  assert.match(extension.clientReferenceId, /^fp-/);
  assert.equal(extension.deviceModel, 'Reference Reader');
  assert.equal(extension.deviceVersion, '1');
  assert.equal(extension.devicePadLevel, 'L1');
}

async function login() {
  const start = await appRequest('GET', '/login');
  assert.equal(start.statusCode, 302);
  const authorization = new URL(start.headers.location);
  assert.equal(authorization.origin, iamBaseUrl);
  const state = authorization.searchParams.get('state');
  assert.ok(state);

  const callback = await appRequest(
    'GET',
    `/oauth/callback?state=${encodeURIComponent(state)}&code=fixture-code`,
  );
  assert.equal(callback.statusCode, 302);
  const cookies = callback.headers['set-cookie'];
  assert.ok(Array.isArray(cookies) && cookies[0]);
  return cookies[0].split(';', 1)[0];
}

function post(route, payload) {
  return appRequest('POST', route, payload, sessionCookie);
}

function appRequest(method, route, payload, cookie) {
  const data = payload === undefined ? '' : JSON.stringify(payload);
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(data);
  }
  return request(http, new URL(route, appBaseUrl), { method, headers }, data);
}

function request(client, target, options, data = '') {
  return new Promise((resolve, reject) => {
    const req = client.request(target, options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = raw;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sendBehavior(res, selected) {
  if (!selected || selected.hang) return;
  return sendJson(res, selected.statusCode, selected.body);
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function readBody(req) {
  const raw = await readRawBody(req);
  return raw ? JSON.parse(raw) : {};
}

function fakeAccessToken() {
  return [
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
    Buffer.from(JSON.stringify({ user_id: USER_ID })).toString('base64url'),
    'fixture-signature',
  ].join('.');
}

function requestUrl(input) {
  try {
    if (input instanceof URL) return input;
    if (typeof input === 'string') return new URL(input);
    if (input && input.href) return new URL(input.href);
  } catch {
    return null;
  }
  return null;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function close(server) {
  if (!server || !server.listening) return Promise.resolve();
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

function serverUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
