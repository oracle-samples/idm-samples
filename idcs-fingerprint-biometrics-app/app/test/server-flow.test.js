'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');

let appServer;
let appBaseUrl;
let bridgeServer;
let biometricData;
let normalizeVerificationResult;
let requestJson;
let upstreamHttpError;
let failNextCapture = false;
let captureGate;
const matchingPin = '123456';
const nonMatchingPin = '654321';
const captures = [];

before(async () => {
  bridgeServer = http.createServer(async (req, res) => {
    const payload = await readBody(req);
    if (req.url !== '/capture') {
      return sendJson(res, 404, { error: 'Not found' });
    }

    captures.push(payload);
    if (captureGate) {
      const gate = captureGate;
      captureGate = null;
      gate.entered();
      await gate.wait;
    }
    const quality = failNextCapture ? 20 : 100;
    failNextCapture = false;
    return sendJson(res, 200, {
      reader: payload.reader || 'Fake Reader',
      quality,
      livenessPassed: true,
      readerIdentity: 'mock',
      template:
        payload.seed2 === nonMatchingPin
          ? 'different-mock-template'
          : 'stable-mock-template',
      rawImageBytes: 512,
    });
  });
  await listen(bridgeServer);

  process.env.IAM_MOCK_MODE = 'true';
  process.env.BRIDGE_URL = serverUrl(bridgeServer);
  process.env.BRIDGE_REQUEST_TIMEOUT_MS = '750';
  process.env.IAM_DEBUG_LOGGING = 'false';
  process.env.FINGERPRINT_DEVICE_MAPPING_1 =
    'mock -> model=HID Lumidigm V521-01-01;version=V521;padLevel=L1';

  ({
    server: appServer,
    biometricData,
    normalizeVerificationResult,
    requestJson,
    upstreamHttpError,
  } = require('../src/server'));
  await listen(appServer);
  appBaseUrl = serverUrl(appServer);
});

test('configured biometric override is identical for enrollment and verification requests', () => {
  const sample = { template: 'reader-template' };
  const override = 'fixed-btp-template';
  assert.equal(biometricData(sample, override), override);
  assert.equal(biometricData(sample, `  ${override}  `), override);
  assert.equal(biometricData(sample), sample.template);
});

test('HTTP helper sends bodyless GET and DELETE requests', async () => {
  const observed = [];
  const upstream = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      observed.push({
        method: req.method,
        body,
        contentLength: req.headers['content-length'],
      });
      if (req.method === 'GET') {
        return sendJson(res, 200, { factors: [] });
      }
      res.writeHead(204);
      res.end();
    });
  });
  await listen(upstream);

  try {
    const endpoint = `${serverUrl(upstream)}/mfa/v1/users/user-1/factors`;
    assert.deepEqual(
      await requestJson(endpoint, undefined, {}, {}, 1000, 'GET'),
      { factors: [] },
    );
    assert.deepEqual(
      await requestJson(`${endpoint}/factor-1`, undefined, {}, {}, 1000, 'DELETE'),
      {},
    );
  } finally {
    await close(upstream);
  }

  assert.deepEqual(observed, [
    { method: 'GET', body: '', contentLength: undefined },
    { method: 'DELETE', body: '', contentLength: undefined },
  ]);
});

after(async () => {
  await close(appServer);
  await close(bridgeServer);
});

test('mock backend enforces consent sequencing, stored reader, retry, and one-shot verify', async () => {
  const initiated = await post('/api/enroll/initiate', {
    finger: 'RIGHT_INDEX',
    reader: 'Stored Reader',
    seed2: matchingPin,
  });
  assert.equal(initiated.statusCode, 200);
  assert.equal(initiated.body.status, 'CONSENT_REQUIRED');
  assert.ok(initiated.body.flowId);
  assert.ok(initiated.body.consentText);
  assert.equal(initiated.body.factorId, undefined);
  assert.equal(initiated.body.requestId, undefined);
  assert.equal(initiated.body.requestState, undefined);
  assert.equal(captures.length, 0, 'initiation must not capture');

  const implicitDecline = await post('/api/enroll/continue', {
    flowId: initiated.body.flowId,
    action: 'DECLINED',
  });
  assert.equal(implicitDecline.statusCode, 400);
  assert.equal(implicitDecline.body.code, 'INVALID_ENROLLMENT_ACTION');
  assert.equal(typeof implicitDecline.body.error, 'string');
  assert.equal(captures.length, 0);

  const enrolled = await post('/api/enroll/continue', {
    flowId: initiated.body.flowId,
    action: 'ACCEPTED',
    finger: 'LEFT_INDEX',
    reader: 'Untrusted Replacement Reader',
    seed2: matchingPin,
  });
  assert.equal(enrolled.statusCode, 200);
  assert.equal(enrolled.body.status, 'ENROLLED');
  assert.equal(enrolled.body.capture.readerIdentity, undefined);
  assert.equal(enrolled.body.capture.deviceMetadata, undefined);
  assert.equal(captures.length, 1);
  assert.equal(captures[0].reader, 'Stored Reader');
  assert.equal(captures[0].seed2, matchingPin);

  const beforeVerify = captures.length;
  const verified = await post('/api/verify', {
    finger: 'RIGHT_INDEX',
    scenario: 'MATCH',
    reader: 'Verification Reader',
    seed2: matchingPin,
  });
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.body.status, 'MATCH');
  assert.equal(captures.length, beforeVerify + 1);
  assert.equal(captures.at(-1).reader, 'Verification Reader');

  const noMatch = await post('/api/verify', {
    finger: 'RIGHT_INDEX',
    scenario: 'NO_MATCH',
    reader: 'Verification Reader',
    seed2: nonMatchingPin,
  });
  assert.equal(noMatch.statusCode, 200);
  assert.equal(noMatch.body.status, 'NO_MATCH');

  const declinedFlow = await post('/api/enroll/initiate', {
    finger: 'LEFT_THUMB',
    reader: 'Decline Reader',
    seed2: matchingPin,
  });
  const beforeDecline = captures.length;
  const declined = await post('/api/enroll/cancel', {
    flowId: declinedFlow.body.flowId,
  });
  assert.equal(declined.statusCode, 200);
  assert.equal(declined.body.status, 'DECLINED');
  assert.equal(declined.body.iamAcknowledged, true);
  assert.equal(captures.length, beforeDecline, 'decline must never capture');

  const removed = await post('/api/unenroll', {});
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.body.status, 'UNENROLLED');
  assert.equal(removed.body.removedFactorCount, 1);
  const alreadyRemoved = await post('/api/unenroll', {});
  assert.equal(alreadyRemoved.statusCode, 200);
  assert.equal(alreadyRemoved.body.status, 'NOT_ENROLLED');
  assert.equal(alreadyRemoved.body.removedFactorCount, 0);
  const beforeNotEnrolled = captures.length;
  const notEnrolled = await post('/api/verify', {
    finger: 'RIGHT_INDEX',
    scenario: 'MATCH',
    reader: 'Verification Reader',
    seed2: matchingPin,
  });
  assert.equal(notEnrolled.statusCode, 200);
  assert.equal(notEnrolled.body.status, 'NOT_ENROLLED');
  assert.equal(captures.length, beforeNotEnrolled, 'no factor means no capture');

  const retryFlow = await post('/api/enroll/initiate', {
    finger: 'RIGHT_MIDDLE',
    reader: 'Retry Reader',
    seed2: matchingPin,
  });
  failNextCapture = true;
  const failedCapture = await post('/api/enroll/continue', {
    flowId: retryFlow.body.flowId,
    action: 'ACCEPTED',
    seed2: matchingPin,
  });
  assert.equal(failedCapture.statusCode, 422);
  assert.equal(failedCapture.body.code, 'CAPTURE_QUALITY_LOW');
  assert.equal(failedCapture.body.retryable, true);
  assert.equal(captures.at(-1).reader, 'Retry Reader');

  const retried = await post('/api/enroll/continue', {
    flowId: retryFlow.body.flowId,
    action: 'ACCEPTED',
    seed2: matchingPin,
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.status, 'ENROLLED');
  assert.equal(captures.at(-1).reader, 'Retry Reader');
});

test('diagnostic sanitizer redacts IAM secrets and biometric material', () => {
  const { debugBody, debugResponseBody, sanitizeForLog } = require('../src/server');
  const logged = sanitizeForLog({
    headers: { Authorization: 'Bearer secret-token' },
    body: {
      biometricData: 'template-data',
      factorId: 'factor-1',
      requestState: 'opaque-state-secret',
      nested: { requestState: 'nested-state-secret', seed1: 'secret-seed' },
      cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }],
      code: 'AUTH-1007',
    },
  });
  const form = sanitizeForLog(
    debugBody('client_id=c1&code=secret&code_verifier=verifier', {
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
  );

  assert.equal(logged.headers.Authorization, '[REDACTED]');
  assert.match(logged.body.biometricData, /^\[REDACTED biometric material;/);
  assert.equal(logged.body.factorId, 'factor-1');
  assert.equal(logged.body.requestState, '[REDACTED]');
  assert.equal(logged.body.nested.requestState, '[REDACTED]');
  assert.match(logged.body.nested.seed1, /^\[REDACTED/);
  assert.equal(logged.body.cause[0].code, 'AUTH-1007');
  assert.equal(logged.body.code, '[REDACTED]', 'an OAuth code is still private even when it resembles an error code');
  assert.equal(form.code, '[REDACTED]');
  assert.equal(form.code_verifier, '[REDACTED]');
  assert.equal(
    debugResponseBody('not-json secret material'),
    '[non-JSON response body; 24 bytes]',
  );
});

test('IAM already-enrolled response maps to the enrollment outcome screen', () => {
  const error = upstreamHttpError(
    400,
    JSON.stringify({
      status: 'failed',
      method: 'FINGERPRINT_BIOMETRIC',
      scenario: 'ENROLLMENT',
      cause: [
        {
          code: 'AUTH-EXAMPLE',
          message: 'You have already enrolled for FINGERPRINT_BIOMETRIC factor.',
        },
      ],
    }),
  );

  assert.equal(error.code, 'ALREADY_ENROLLED');
  assert.equal(error.statusCode, 409);
  assert.equal(error.upstreamStatus, 400);
  assert.match(error.publicMessage, /already enrolled/i);
});

test('biometric operations expose IAM cause messages without requiring an AUTH-number code', () => {
  const response = JSON.stringify({
    status: 'failed',
    cause: [{
      code: 'FACTOR_OPERATION_DENIED',
      message: 'The factor operation is not permitted by the current policy.',
    }],
  });

  for (const phase of [
    'enrollment-factor-lookup',
    'enrollment-initiate',
    'enrollment-complete',
    'enrollment-decline',
    'verification-factor-lookup',
    'verification-initiate',
    'verification-complete',
    'unenrollment-delete',
  ]) {
    assert.equal(
      upstreamHttpError(400, response, phase).publicMessage,
      'FACTOR_OPERATION_DENIED: The factor operation is not permitted by the current policy.',
    );
  }
  assert.equal(
    upstreamHttpError(400, response, 'service-token').publicMessage,
    'The upstream service rejected the request.',
  );
});

test('IAM verification responses are strictly validated and negative matches are outcomes', () => {
  const success = normalizeVerificationResult(
    {
      status: 'success',
      userGUID: 'user-guid-fixture',
      factorId: 'factor-1',
      method: 'FINGERPRINT_BIOMETRIC',
      scenario: 'AUTHENTICATION',
    },
    'user-guid-fixture',
  );
  assert.equal(success.status, 'MATCH');
  assert.equal(normalizeVerificationResult({ status: 'success' }, 'user-guid-fixture').status, 'MATCH');
  for (const contradiction of [
    { factorStatus: 'FAILURE' }, { factorStatus: 'PENDING' },
    { consent: {} }, { requestId: 'pending-request' }, { verified: false },
    { cause: [{ code: 'AUTH-1007' }] },
  ]) {
    assert.throws(() => normalizeVerificationResult({ status: 'success', ...contradiction }),
      (error) => error.code === 'IAM_VERIFICATION_RESPONSE_INVALID');
  }
  assert.throws(() => normalizeVerificationResult({ status: 'success', requestState: 'initiation-not-match' }),
    (error) => error.code === 'IAM_VERIFICATION_RESPONSE_INVALID');

  assert.throws(
    () =>
      normalizeVerificationResult(
        {
          status: 'success',
          userGUID: 'different-user',
          method: 'FINGERPRINT_BIOMETRIC',
          scenario: 'AUTHENTICATION',
        },
        'user-guid-fixture',
      ),
    (error) => error.code === 'IAM_VERIFICATION_RESPONSE_INVALID',
  );

  const noMatch = upstreamHttpError(
    400,
    JSON.stringify({
      status: 'failed',
      method: 'FINGERPRINT_BIOMETRIC',
      scenario: 'AUTHENTICATION',
      cause: [{ message: 'Fingerprint verification failed: no match.' }],
    }),
  );
  assert.equal(noMatch.code, 'FINGERPRINT_NO_MATCH');
  assert.equal(noMatch.verificationOutcome, 'NO_MATCH');

  const tenantNoMatch = upstreamHttpError(
    401,
    JSON.stringify({
      status: 'failed',
      userGUID: 'user-guid-fixture',
      factorId: 'factor-1',
      method: 'FINGERPRINT_BIOMETRIC',
      scenario: 'AUTHENTICATION',
      cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }],
    }),
    'verification-complete',
  );
  assert.equal(tenantNoMatch.code, 'FINGERPRINT_NO_MATCH');
  assert.equal(tenantNoMatch.statusCode, 401);
  assert.equal(tenantNoMatch.verificationOutcome, 'NO_MATCH');
  assert.deepEqual(tenantNoMatch.causeCodes, ['AUTH-1007']);
  const initiationAuthenticationFailure = upstreamHttpError(
    401,
    JSON.stringify({
      status: 'failed',
      cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }],
    }),
    'verification-initiate',
  );
  assert.equal(initiationAuthenticationFailure.code, 'UPSTREAM_HTTP_ERROR');
  assert.equal(initiationAuthenticationFailure.verificationOutcome, undefined);
  const certificateFailure = upstreamHttpError(401, JSON.stringify({ status: 'failed', cause: [{ message: 'No matching client certificate found' }] }), 'verification-complete');
  assert.equal(certificateFailure.code, 'UPSTREAM_HTTP_ERROR');
  assert.equal(certificateFailure.verificationOutcome, undefined);
  assert.equal(upstreamHttpError(500, 'null').code, 'UPSTREAM_HTTP_ERROR');
  assert.equal(upstreamHttpError(400, '[]').code, 'UPSTREAM_HTTP_ERROR');
});

test('upstream diagnostics retain IDCS trace IDs without admitting unsafe values', () => {
  const diagnostic = (ecId) => upstreamHttpError(401, JSON.stringify({
    status: 'failed', ecId, cause: [{ code: 'AUTH-1007', message: 'Authentication failed.' }],
  }), 'enrollment-initiate');
  for (const ecId of ['X5^Ks18I000000000', 'X5^Ks18I000000000/1:2']) {
    assert.equal(diagnostic(ecId).ecId, ecId);
    assert.deepEqual(diagnostic(ecId).causeCodes, ['AUTH-1007']);
  }
  for (const ecId of ['', null, 123, 'x'.repeat(201), 'trace\r\ninjected', '<script>']) {
    assert.equal(diagnostic(ecId).ecId, undefined);
  }
});

test('concurrent operations are rejected and logout during capture prevents completion', async () => {
  await post('/api/unenroll', {});
  const initiated = await post('/api/enroll/initiate', { reader: 'Reader', seed2: matchingPin });
  let release;
  let entered;
  const captured = new Promise((resolve) => { entered = resolve; });
  captureGate = { entered, wait: new Promise((resolve) => { release = resolve; }) };
  const completion = post('/api/enroll/continue', { flowId: initiated.body.flowId, action: 'ACCEPTED', seed2: matchingPin });
  try {
    await captured;
    const overlap = await post('/api/unenroll', {});
    assert.equal(overlap.statusCode, 409);
    assert.equal(overlap.body.code, 'FINGERPRINT_OPERATION_BUSY');
    await post('/logout', {});
  } finally {
    release();
  }
  const cancelled = await completion;
  assert.equal(cancelled.statusCode, 409);
  assert.equal(cancelled.body.code, 'FINGERPRINT_OPERATION_CANCELLED');
  assert.equal(cancelled.body.retryable, false);
  const replay = await post('/api/enroll/continue', { flowId: initiated.body.flowId, action: 'ACCEPTED', seed2: matchingPin });
  assert.equal(replay.body.code, 'ENROLLMENT_FLOW_EXPIRED');
  const check = await post('/api/verify', { reader: 'Reader', seed2: matchingPin });
  assert.equal(check.body.status, 'NOT_ENROLLED');
});

test('successful unenrollment invalidates outstanding consent flows', async () => {
  const initiated = await post('/api/enroll/initiate', { reader: 'Reader', seed2: matchingPin });
  await post('/api/unenroll', {});
  const replay = await post('/api/enroll/continue', { flowId: initiated.body.flowId, action: 'ACCEPTED', seed2: matchingPin });
  assert.equal(replay.body.code, 'ENROLLMENT_FLOW_EXPIRED');
});

test('expired consent cannot capture or complete', async (t) => {
  const initiated = await post('/api/enroll/initiate', { reader: 'Reader', seed2: matchingPin });
  const beforeCapture = captures.length;
  const expiredTime = Date.now() + 6 * 60 * 1000;
  const clock = t.mock.method(Date, 'now', () => expiredTime);
  try {
    const completion = await post('/api/enroll/continue', { flowId: initiated.body.flowId, action: 'ACCEPTED', seed2: matchingPin });
    assert.equal(completion.body.code, 'ENROLLMENT_FLOW_EXPIRED');
    assert.equal(captures.length, beforeCapture);
  } finally {
    clock.mock.restore();
  }
});

function post(route, payload) {
  const data = JSON.stringify(payload);
  const target = new URL(route, appBaseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: raw ? JSON.parse(raw) : {},
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
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
  if (!server || !server.listening) {
    return Promise.resolve();
  }
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  return new Promise((resolve) => server.close(resolve));
}

function serverUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
