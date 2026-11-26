'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const {
  assertFingerPosition,
  enrollmentInitiationPayload,
  enrollmentContinuationPayload,
  verificationInitiationPayload,
  verificationCompletionPayload,
} = require('./iam-payload');
const {
  fingerprintFactorIds,
  chooseFingerprintFactor,
} = require('./iam-factors');
const { createMfaEndpoints } = require('./iam-endpoints');
const {
  parseDeviceMappings,
  resolveDeviceMetadata,
} = require('./device-mappings');

const PENDING_ENROLLMENT_TTL_MS = 5 * 60 * 1000;
const MOCK_CONSENT_STATEMENT =
  'This test application will capture a fingerprint template and use it to enroll biometric data for identity verification. By accepting, you consent to this collection and use for this test.';

const projectRoot = path.resolve(__dirname, '..', '..');
loadEnv(path.join(projectRoot, '.env'));

const config = {
  mock: process.env.IAM_MOCK_MODE !== 'false',
  debugIamLogging: process.env.IAM_DEBUG_LOGGING === 'true',
  port: Number(process.env.WEB_PORT || 8080),
  bridgeUrl:
    process.env.BRIDGE_URL ||
    `http://127.0.0.1:${process.env.BRIDGE_PORT || 7071}`,
  bridgeTimeoutMs: positiveInteger(process.env.BRIDGE_REQUEST_TIMEOUT_MS, 30000),
  iamRequestTimeoutMs: positiveInteger(process.env.IAM_REQUEST_TIMEOUT_MS, 30000),
  oidc: {
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri: process.env.OIDC_REDIRECT_URI,
    scopes: process.env.OIDC_SCOPES || 'openid profile email',
  },
  iam: {
    tokenUrl: process.env.IAM_TOKEN_URL,
    clientId: process.env.IAM_CLIENT_ID,
    cert: process.env.IAM_CLIENT_CERT,
    key: process.env.IAM_CLIENT_KEY,
    baseUrl: process.env.IAM_MFA_BASE_URL,
  },
  biometric: {
    btpClientVersion: process.env.IAM_BTP_CLIENT_VERSION || '1.0.0',
    dataOverride:
      process.env.IAM_MOCK_MODE === 'false'
        ? process.env.IAM_BIOMETRIC_DATA_OVERRIDE
        : undefined,
  },
  deviceMappings: parseDeviceMappings(process.env),
};

const mockUser = {
  id: '00u-demo-alex-morgan',
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
};
const sessions = new Map();
const loginTransactions = new Map();
const mockStore = new Map();
const pendingEnrollments = new Map();
let mtlsTokenCache;
let mtlsTokenRequest;
const activeOperations = new Map();
const preferredFactors = new Map();
const iamEndpoints = config.mock ? null : createMfaEndpoints(config.iam.baseUrl);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      return sendFile(res, 'public/index.html', 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/app.js') {
      return sendFile(res, 'public/app.js', 'application/javascript; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/styles.css') {
      return sendFile(res, 'public/styles.css', 'text/css; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/oracle-logo.svg') {
      return sendFile(res, 'public/oracle-logo.svg', 'image/svg+xml');
    }
    if (req.method === 'GET' && req.url === '/login') {
      return login(res);
    }
    if (req.method === 'GET' && req.url.startsWith('/oauth/callback')) {
      return await callback(req, res);
    }
    if (req.method === 'POST' && req.url === '/logout') {
      return logout(req, res);
    }
    if (req.method === 'GET' && req.url === '/api/session') {
      return sessionInfo(req, res);
    }
    if (req.method === 'GET' && req.url === '/api/reader') {
      return json(res, 200, await bridge('/health'));
    }
    if (req.method === 'GET' && req.url === '/api/bridge') {
      return json(res, 200, await bridge('/status'));
    }
    if (req.method === 'GET' && req.url === '/api/readers') {
      return json(res, 200, await bridge('/readers'));
    }
    if (req.method === 'POST' && req.url === '/api/readers/select') {
      return json(res, 200, await bridge('/select-reader', await body(req)));
    }
    if (req.method === 'POST' && req.url === '/api/enroll/initiate') {
      const input = await body(req);
      return await withUserOperation(req, () => initiateEnrollment(req, res, input));
    }
    if (req.method === 'POST' && req.url === '/api/enroll/continue') {
      const input = await body(req);
      return await withUserOperation(req, () => continueEnrollment(req, res, input));
    }
    if (req.method === 'POST' && req.url === '/api/enroll/cancel') {
      const input = await body(req);
      return await withUserOperation(req, () => cancelEnrollment(req, res, input));
    }
    if (req.method === 'POST' && req.url === '/api/verify') {
      const input = await body(req);
      return await withUserOperation(req, () => verify(req, res, input));
    }
    if (req.method === 'POST' && req.url === '/api/unenroll') {
      return await withUserOperation(req, () => unenroll(req, res));
    }

    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    const safe = safeApiError(error);
    console.error('[safe diagnostic]', {
      timestamp: new Date().toISOString(),
      method: req.method,
      route: req.url.split('?')[0],
      code: safe.code,
      statusCode: safe.statusCode,
      upstreamStatus: safe.upstreamStatus,
      retryable: safe.retryable,
      ecId: safe.ecId,
      causeCodes: safe.causeCodes,
    });
    return json(res, safe.statusCode, {
      error: safe.message,
      code: safe.code,
      retryable: safe.retryable,
      ...(safe.ecId ? { ecId: safe.ecId } : {}),
      ...(safe.causeCodes.length ? { causeCodes: safe.causeCodes } : {}),
      ...(safe.upstreamStatus
        ? { upstreamStatus: safe.upstreamStatus }
        : {}),
    });
  }
});

async function withUserOperation(req, action) {
  const user = requireUser(req);
  if (activeOperations.has(user.id)) {
    throw apiError('Another fingerprint operation is in progress. Wait for it to finish.', 'FINGERPRINT_OPERATION_BUSY', 409);
  }
  const operation = { sessionId: sessionBinding(req, user), expiresAt: Date.now() + PENDING_ENROLLMENT_TTL_MS };
  activeOperations.set(user.id, operation);
  try {
    return await action();
  } finally {
    if (activeOperations.get(user.id) === operation) activeOperations.delete(user.id);
  }
}

function assertOperationCurrent(req, user) {
  const operation = activeOperations.get(user.id);
  const current = currentUser(req);
  if (!current) {
    throw apiError('Sign-in required.', 'SIGN_IN_REQUIRED', 401);
  }
  if (current.id !== user.id || !operation || operation.cancelled || operation.sessionId !== sessionBinding(req, user)) {
    throw apiError('The fingerprint operation was cancelled because the session ended.', 'FINGERPRINT_OPERATION_CANCELLED', 409);
  }
  if (operation.expiresAt <= Date.now()) {
    throw apiError('The fingerprint operation expired. Start again.', 'FINGERPRINT_OPERATION_EXPIRED', 409);
  }
}

async function initiateEnrollment(req, res, input) {
  const user = requireUser(req);
  const finger = assertFingerPosition(input.finger || 'RIGHT_INDEX');
  const reader = readerSelection(input.reader);
  btpSeed2(input.seed2);
  cleanupExpiredEnrollments();

  const request = {
    userId: user.id,
    transactionId: requestId(),
  };
  if (!config.mock) {
    // IAM can mask its factorAlreadyEnrolled error as AUTH-1007. Check the
    // authenticated user's factors instead of guessing from a generic 401.
    const factors = await iamRequest(iamEndpoints.factors(user.id), 'GET', undefined, request, {
      phase: 'enrollment-factor-lookup', beforeSubmit: () => assertOperationCurrent(req, user),
    });
    assertOperationCurrent(req, user);
    if (fingerprintFactorIds(factors).length > 0) {
      throw apiError(
        'A fingerprint is already enrolled for this user. Verify it, or explicitly remove the test enrollment before enrolling again.',
        'ALREADY_ENROLLED',
        409,
      );
    }
  }
  const initiated = config.mock
    ? mockEnrollmentInitiation(request)
    : await iamRequest(iamEndpoints.factors(user.id), 'POST', enrollmentInitiationPayload(), request, {
        phase: 'enrollment-initiate', beforeSubmit: () => assertOperationCurrent(req, user),
      });
  assertOperationCurrent(req, user);
  const consent = consentChallenge(initiated, user.id);
  if (!config.mock) iamEndpoints.factor(user.id, initiated.factorId);

  const flowId = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + PENDING_ENROLLMENT_TTL_MS;
  pendingEnrollments.set(flowId, {
    userId: user.id,
    sessionId: sessionBinding(req, user),
    factorId: initiated.factorId,
    requestState: initiated.requestState,
    finger,
    reader,
    expiresAt,
    state: 'AWAITING_CONSENT',
  });

  json(res, 200, {
    status: 'CONSENT_REQUIRED',
    flowId,
    consentText: consent.statement,
    consentLocale: consent.locale,
    expiresAt: new Date(expiresAt).toISOString(),
    message: 'Review the IAM consent statement before fingerprint capture.',
  });
}

async function continueEnrollment(req, res, input) {
  const user = requireUser(req);
  if (input.action !== 'ACCEPTED') {
    throw apiError(
      'Enrollment continuation requires explicit ACCEPTED consent.',
      'INVALID_ENROLLMENT_ACTION',
      400,
    );
  }

  const pending = pendingEnrollment(req, input.flowId, user);
  ensurePendingState(pending);
  pending.state = 'CAPTURING';

  let sample;
  try {
    sample = await capture(pending.reader, btpSeed2(input.seed2));
    assertOperationCurrent(req, user);
    pendingEnrollment(req, input.flowId, user);
  } catch (error) {
    pending.state = 'AWAITING_CONSENT';
    error.retryable = pendingEnrollments.has(input.flowId) && pending.expiresAt > Date.now() &&
      error.code !== 'SIGN_IN_REQUIRED' && !String(error.code).startsWith('FINGERPRINT_OPERATION_');
    throw error;
  }

  const request = {
    userId: user.id,
    finger: pending.finger,
    template: biometricData(sample, config.biometric.dataOverride),
    deviceMetadata: sample.deviceMetadata,
    transactionId: requestId(),
  };
  const continuation = {
    action: 'ACCEPTED',
    requestState: pending.requestState,
  };

  let rawResult;
  let submitted = false;
  try {
    if (config.mock) {
      rawResult = mockEnroll(request);
      submitted = true;
    } else {
      rawResult = await iamRequest(iamEndpoints.factor(user.id, pending.factorId), 'PATCH',
        enrollmentContinuationPayload(request, { ...config.biometric, ...request.deviceMetadata }, continuation), request, {
        phase: 'enrollment-complete',
        beforeSubmit() {
          assertOperationCurrent(req, user);
          pendingEnrollment(req, input.flowId, user);
        },
        onSubmitted() {
          submitted = true;
          pending.state = 'SUBMITTING';
        },
      });
    }
  } catch (error) {
    if (!submitted) {
      pending.state = 'AWAITING_CONSENT';
    } else {
      error.retryable = false;
    }
    throw error;
  } finally {
    // A submitted continuation is single-use because IAM may have committed it.
    if (submitted) {
      pendingEnrollments.delete(input.flowId);
    }
  }

  const result = normalizeEnrollmentResult(rawResult, user.id, pending.factorId);
  assertOperationCurrent(req, user);
  if (result.status === 'ENROLLED') preferredFactors.set(user.id, pending.factorId);
  json(res, 200, {
    ...result,
    capture: captureSummary(sample),
    transactionId: request.transactionId,
  });
}

async function cancelEnrollment(req, res, input) {
  const user = requireUser(req);
  const pending = pendingEnrollment(req, input.flowId, user);
  ensurePendingState(pending);
  pending.state = 'CANCELLING';

  const transactionId = requestId();
  if (config.mock) {
    pendingEnrollments.delete(input.flowId);
    return json(res, 200, {
      status: 'DECLINED',
      message: 'Consent declined. No fingerprint data was submitted for enrollment.',
      iamAcknowledged: true,
      transactionId,
    });
  }

  let submitted = false;
  let acknowledgementError;
  try {
    const result = await iamRequest(
      iamEndpoints.factor(user.id, pending.factorId), 'PATCH',
      enrollmentContinuationPayload({}, config.biometric, { action: 'DECLINED', requestState: pending.requestState }),
      { userId: user.id, transactionId },
      {
        phase: 'enrollment-decline',
        beforeSubmit() {
          assertOperationCurrent(req, user);
          pendingEnrollment(req, input.flowId, user);
        },
        onSubmitted() {
          submitted = true;
          pending.state = 'SUBMITTING_DECLINE';
        },
      },
    );
    if (String(result.status).toLowerCase() !== 'success') {
      throw apiError('IAM did not acknowledge the cancellation.', 'IAM_DECLINE_NOT_CONFIRMED', 502);
    }
  } catch (error) {
    if (!submitted) {
      pending.state = 'AWAITING_CONSENT';
      throw error;
    }
    // IDCS also acknowledges an explicit decline with a terminal 401 response.
    if (!error.declineAcknowledged) acknowledgementError = safeApiError(error);
  } finally {
    if (submitted) {
      pendingEnrollments.delete(input.flowId);
    }
  }

  json(res, 200, {
    status: 'DECLINED',
    message: acknowledgementError
      ? acknowledgementError.message
      : 'Consent declined. No fingerprint data was submitted for enrollment.',
    iamAcknowledged: !acknowledgementError,
    ...(acknowledgementError && acknowledgementError.upstreamStatus
      ? { upstreamStatus: acknowledgementError.upstreamStatus }
      : {}),
    transactionId,
  });
}

async function verify(req, res, input) {
  const user = requireUser(req);
  const finger = assertFingerPosition(input.finger || 'RIGHT_INDEX');
  const reader = readerSelection(input.reader);
  const seed2 = btpSeed2(input.seed2);
  const transactionId = requestId();
  const context = { userId: user.id, transactionId };
  const beforeSubmit = () => assertOperationCurrent(req, user);
  let initiated;
  let factorId;
  if (config.mock) {
    if (!mockStore.has(user.id)) return json(res, 200, notEnrolledResult(transactionId));
  } else {
    const factors = await iamRequest(iamEndpoints.factors(user.id), 'GET', undefined, context, { phase: 'verification-factor-lookup', beforeSubmit });
    beforeSubmit();
    factorId = chooseFingerprintFactor(factors, preferredFactors.get(user.id));
    if (!factorId) return json(res, 200, notEnrolledResult(transactionId));
    initiated = await iamRequest(iamEndpoints.requests(), 'POST', verificationInitiationPayload({ userId: user.id, factorId }), context, { phase: 'verification-initiate', beforeSubmit });
    validateVerificationChallenge(initiated, user.id, factorId);
    iamEndpoints.request(initiated.requestId);
    beforeSubmit();
  }
  // Do not prompt the reader until IAM has issued a valid verification challenge.
  const sample = await capture(reader, seed2);
  beforeSubmit();
  const request = {
    userId: user.id,
    finger,
    template: biometricData(sample, config.biometric.dataOverride),
    deviceMetadata: sample.deviceMetadata,
    transactionId,
  };
  let rawResult;
  try {
    rawResult = config.mock
      ? mockVerify(request)
      : await iamRequest(iamEndpoints.request(initiated.requestId), 'PATCH',
          verificationCompletionPayload(request, { ...config.biometric, ...request.deviceMetadata }, { requestState: initiated.requestState }),
          request, { phase: 'verification-complete', beforeSubmit });
  } catch (error) {
    beforeSubmit();
    const outcome = verificationOutcomeFromError(error);
    if (!outcome) {
      throw error;
    }
    return json(res, 200, {
      ...outcome,
      capture: captureSummary(sample),
      transactionId: request.transactionId,
    });
  }
  beforeSubmit();
  const result = config.mock
    ? rawResult
    : normalizeVerificationResult(rawResult, request.userId, factorId);

  json(res, 200, {
    ...result,
    capture: captureSummary(sample),
    transactionId: request.transactionId,
  });
}

function notEnrolledResult(transactionId) {
  return { status: 'NOT_ENROLLED', message: 'No fingerprint enrollment exists for this user. Enroll before verifying.', transactionId };
}

function validOpaqueValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateVerificationChallenge(result, userId, factorId) {
  if (!result || String(result.status).toLowerCase() !== 'success' ||
      !validOpaqueValue(result.requestId) || !validOpaqueValue(result.requestState) ||
      !responseMatches(result, userId, factorId, 'AUTHENTICATION') ||
      result.consent !== undefined ||
      /^(FAILURE|FAILED|ERROR|EXPIRED|DECLINED|CONSENT_REQUIRED)$/i.test(String(result.factorStatus || ''))) {
    throw apiError('IAM did not return a complete fingerprint verification challenge.', 'IAM_VERIFICATION_CHALLENGE_INVALID', 502);
  }
}

async function unenroll(req, res) {
  const user = requireUser(req);
  const request = { userId: user.id, transactionId: requestId() };
  const result = config.mock
    ? mockUnenroll(user.id)
    : await iamUnenroll(request, () => assertOperationCurrent(req, user));
  for (const [flowId, pending] of pendingEnrollments) {
    if (pending.userId === user.id) pendingEnrollments.delete(flowId);
  }
  preferredFactors.delete(user.id);
  assertOperationCurrent(req, user);

  json(res, 200, { ...result, transactionId: request.transactionId });
}

function mockUnenroll(userId) {
  const removed = mockStore.delete(userId);
  return removed
    ? {
        status: 'UNENROLLED',
        message: 'Test fingerprint enrollment removed.',
        removedFactorCount: 1,
      }
    : {
        status: 'NOT_ENROLLED',
        message: 'No fingerprint enrollment exists for this user.',
        removedFactorCount: 0,
      };
}

async function capture(reader, seed2) {
  const sample = await bridge('/capture', {
    reader: reader,
    seed2,
  });

  if (!sample.livenessPassed) {
    throw apiError(
      'Reader rejected the presentation (PAD/liveness).',
      'CAPTURE_LIVENESS_FAILED',
      422,
      { retryable: true },
    );
  }
  if (sample.quality < 60) {
    throw apiError(
      'Capture quality is too low. Ask the customer to reposition and retry.',
      'CAPTURE_QUALITY_LOW',
      422,
      { retryable: true },
    );
  }
  if (!sample.template) {
    throw apiError(
      'Reader did not return a fingerprint template.',
      'CAPTURE_TEMPLATE_MISSING',
      502,
      { retryable: true },
    );
  }

  sample.deviceMetadata = mappedDeviceMetadata(sample.readerIdentity);

  return sample;
}

function mockEnroll(request) {
  if (mockStore.has(request.userId)) {
    return {
      status: 'ALREADY_ENROLLED',
      message: 'A fingerprint is already enrolled for this user.',
    };
  }

  mockStore.set(request.userId, request.template);
  return {
    status: 'ENROLLED',
    message: 'Fingerprint enrolled and bound to the signed-in user.',
  };
}

function mockVerify(request) {
  const enrolled = mockStore.get(request.userId);
  if (!enrolled) {
    return {
      status: 'INCONCLUSIVE',
      message: 'No enrolled fingerprint exists for this user.',
    };
  }

  return request.template === enrolled
    ? { status: 'MATCH', message: 'Fingerprint matches the enrolled record.' }
    : { status: 'NO_MATCH', message: 'Fingerprint does not match the enrolled record.' };
}

function mockEnrollmentInitiation(request) {
  return {
    status: 'success',
    factorStatus: 'CONSENT_REQUIRED',
    factorId: `mock-factor-${crypto.randomBytes(8).toString('hex')}`,
    requestState: `mock-state-${request.transactionId}`,
    consent: {
      consentStatement: MOCK_CONSENT_STATEMENT,
      locale: 'en',
    },
  };
}

function consentChallenge(result, expectedUserId) {
  if (
    result &&
    String(result.status || '').toLowerCase() === 'success' &&
    String(result.factorStatus || '').toUpperCase() === 'ENROLLED'
  ) {
    throw apiError(
      'A fingerprint is already enrolled for this user.',
      'ALREADY_ENROLLED',
      409,
    );
  }

  const statement =
    result && result.consent &&
    String(result.consent.consentStatement || '').trim();
  if (
    !result ||
    String(result.status || '').toLowerCase() !== 'success' ||
    String(result.factorStatus || '').toUpperCase() !== 'CONSENT_REQUIRED' ||
    !validOpaqueValue(result.factorId) ||
    !validOpaqueValue(result.requestState) ||
    !responseMatches(result, expectedUserId, undefined, 'ENROLLMENT') ||
    !statement
  ) {
    throw apiError(
      'IAM enrollment initiation did not return a complete consent challenge.',
      'IAM_CONSENT_RESPONSE_INVALID',
      502,
    );
  }

  return {
    statement,
    locale: String(result.consent.locale || 'en'),
  };
}

function normalizeEnrollmentResult(result, expectedUserId, expectedFactorId) {
  if (config.mock) {
    return result;
  }
  if (!terminalSuccess(result, ['ENROLLED']) || !responseMatches(result, expectedUserId, expectedFactorId, 'ENROLLMENT')) {
    throw apiError(
      'IAM did not confirm fingerprint enrollment.',
      'IAM_ENROLLMENT_NOT_CONFIRMED',
      502,
    );
  }

  return {
    status: 'ENROLLED',
    message: 'IAM enrolled the fingerprint for the signed-in user.',
  };
}

function terminalSuccess(result, allowedFactorStatuses) {
  return Boolean(result && typeof result === 'object' && !Array.isArray(result) &&
    String(result.status || '').toLowerCase() === 'success' &&
    (result.factorStatus === undefined || allowedFactorStatuses.includes(String(result.factorStatus).toUpperCase())) &&
    result.requestState === undefined && result.requestId === undefined && result.consent === undefined &&
    result.match !== false && result.verified !== false && !result.error &&
    (result.cause === undefined || (Array.isArray(result.cause) && result.cause.length === 0)));
}

function responseMatches(result, userId, factorId, scenario) {
  return ['userGUID', 'userId'].every((key) => result[key] === undefined || result[key] === userId) &&
    (factorId === undefined || result.factorId === undefined || result.factorId === factorId) &&
    (result.method === undefined || result.method === 'FINGERPRINT_BIOMETRIC') &&
    (result.scenario === undefined || result.scenario === scenario);
}

function normalizeVerificationResult(result, expectedUserId, expectedFactorId) {
  const failure = verificationFailureFromResponse(result, 'verification-complete');
  if (failure) {
    return {
      status: failure.outcome,
      message: failure.message,
    };
  }

  if (
    !terminalSuccess(result, ['SUCCESS', 'VERIFIED']) ||
    !responseMatches(result, expectedUserId, expectedFactorId, 'AUTHENTICATION')
  ) {
    throw apiError(
      'IAM returned an invalid fingerprint verification response.',
      'IAM_VERIFICATION_RESPONSE_INVALID',
      502,
    );
  }

  return {
    status: 'MATCH',
    message: 'IAM verified the fingerprint for the signed-in user.',
  };
}

function verificationOutcomeFromError(error) {
  if (!error || !['NO_MATCH', 'INCONCLUSIVE'].includes(error.verificationOutcome)) {
    return null;
  }

  return {
    status: error.verificationOutcome,
    message: error.publicMessage,
  };
}

function pendingEnrollment(req, flowId, user) {
  if (typeof flowId !== 'string' || !flowId || flowId.length > 128) {
    throw apiError('Enrollment flow id is missing.', 'FLOW_ID_REQUIRED', 400);
  }

  const pending = pendingEnrollments.get(flowId);
  if (!pending || pending.expiresAt <= Date.now()) {
    pendingEnrollments.delete(flowId);
    throw apiError(
      'Enrollment consent has expired. Start again.',
      'ENROLLMENT_FLOW_EXPIRED',
      409,
    );
  }
  if (
    pending.userId !== user.id ||
    pending.sessionId !== sessionBinding(req, user)
  ) {
    throw apiError(
      'Enrollment flow does not belong to this session.',
      'ENROLLMENT_FLOW_FORBIDDEN',
      403,
    );
  }

  return pending;
}

function ensurePendingState(pending) {
  if (pending.state !== 'AWAITING_CONSENT') {
    throw apiError(
      'This enrollment flow is already being processed.',
      'ENROLLMENT_FLOW_BUSY',
      409,
    );
  }
}

function cleanupExpiredEnrollments() {
  const now = Date.now();
  for (const [flowId, pending] of pendingEnrollments) {
    if (pending.expiresAt <= now) {
      pendingEnrollments.delete(flowId);
    }
  }
}

function sessionBinding(req, user) {
  return config.mock ? `mock:${user.id}` : cookie(req, 'fp_session');
}

function readerSelection(reader) {
  if (reader === undefined || reader === null || reader === '') {
    throw apiError(
      'Select a fingerprint reader before continuing.',
      'READER_REQUIRED',
      400,
    );
  }
  if (typeof reader !== 'string' || !reader.trim() || reader.length > 256) {
    throw apiError('Reader selection is invalid.', 'INVALID_READER', 400);
  }

  return reader.trim();
}

function btpSeed2(value) {
  if (typeof value !== 'string' || !/^[0-9]{6,19}$/.test(value)) {
    throw apiError('Enter a numeric PIN number with at least 6 digits.', 'BTP_SEED2_REQUIRED', 400);
  }
  try {
    if (BigInt(value) > 9223372036854775807n) throw new RangeError();
  } catch {
    throw apiError('BTP SEED2 is outside the supported range.', 'BTP_SEED2_INVALID', 400);
  }
  return value;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function biometricData(sample, override) {
  const configured = String(override || '').trim();
  return configured || sample.template;
}

function mappedDeviceMetadata(readerIdentity) {
  try {
    return resolveDeviceMetadata(config.deviceMappings, readerIdentity);
  } catch (error) {
    throw apiError(
      error.message,
      error.code || 'FINGERPRINT_DEVICE_MAPPING_INVALID',
      error.code === 'FINGERPRINT_READER_IDENTITY_INVALID' ? 502 : 500,
    );
  }
}

function apiError(message, code, statusCode, details = {}) {
  const error = new Error(message);
  error.publicMessage = message;
  error.code = code;
  error.statusCode = statusCode;
  error.retryable = Boolean(details.retryable);
  error.upstreamStatus = details.upstreamStatus;
  return error;
}

async function iamRequest(endpoint, method, payload, request, options = {}) {
  const token = await getMtlsToken();
  if (options.beforeSubmit) options.beforeSubmit();
  return requestJson(
    endpoint,
    payload,
    {
      Authorization: `Bearer ${token}`,
      'X-Request-ID': request.transactionId,
    },
    mtls(),
    config.iamRequestTimeoutMs,
    method,
    options,
  );
}

async function iamUnenroll(request, beforeSubmit) {
  const factorsResponse = await iamRequest(iamEndpoints.factors(request.userId), 'GET', undefined, request, { phase: 'unenrollment-factor-lookup', beforeSubmit });
  const factorIds = fingerprintFactorIds(factorsResponse);

  if (factorIds.length === 0) {
    return {
      status: 'NOT_ENROLLED',
      message: 'No fingerprint enrollment exists for this user.',
      removedFactorCount: 0,
    };
  }

  let removedFactorCount = 0;
  for (const factorId of factorIds) {
    try {
      await iamRequest(iamEndpoints.factor(request.userId, factorId), 'DELETE', undefined, request, { phase: 'unenrollment-delete', beforeSubmit });
      removedFactorCount += 1;
    } catch (error) {
      if (error.upstreamStatus !== 404) {
        throw error;
      }
    }
  }

  if (removedFactorCount === 0) {
    return {
      status: 'NOT_ENROLLED',
      message: 'The fingerprint enrollment was already removed.',
      removedFactorCount: 0,
    };
  }

  return {
    status: 'UNENROLLED',
    message:
      removedFactorCount === 1
        ? 'Fingerprint enrollment removed.'
        : `${removedFactorCount} fingerprint enrollments removed.`,
    removedFactorCount,
  };
}

async function getMtlsToken() {
  if (mtlsTokenCache && mtlsTokenCache.usableUntil > Date.now()) {
    return mtlsTokenCache.accessToken;
  }
  mtlsTokenCache = undefined;

  if (mtlsTokenRequest) {
    return mtlsTokenRequest;
  }

  mtlsTokenRequest = requestMtlsToken();
  try {
    return await mtlsTokenRequest;
  } finally {
    mtlsTokenRequest = undefined;
  }
}

async function requestMtlsToken() {
  for (const key of ['tokenUrl', 'clientId', 'cert', 'key']) {
    if (!config.iam[key]) {
      throw apiError(
        'The IAM mTLS client is not fully configured.',
        'IAM_MTLS_NOT_CONFIGURED',
        500,
      );
    }
  }

  const form = new URLSearchParams({
    grant_type: 'tls_client_auth',
    client_id: config.iam.clientId,
    scope: process.env.IAM_SERVICE_SCOPE || 'urn:opc:idm:biometrics',
  }).toString();
  const token = await requestJson(
    config.iam.tokenUrl,
    form,
    { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    mtls(),
    config.iamRequestTimeoutMs,
    'POST',
    { phase: 'service-token' },
  );

  if (!token.access_token) {
    throw apiError(
      'IAM token response did not include an access token.',
      'IAM_TOKEN_RESPONSE_INVALID',
      502,
    );
  }

  const expiresAt = tokenExpiration(token);
  if (expiresAt) {
    const remainingMs = expiresAt - Date.now();
    const refreshMarginMs = Math.min(30000, Math.max(1000, remainingMs * 0.1));
    const usableUntil = expiresAt - refreshMarginMs;
    if (usableUntil > Date.now()) {
      mtlsTokenCache = { accessToken: token.access_token, usableUntil };
    }
  }

  return token.access_token;
}

function tokenExpiration(token) {
  const expiresIn = Number(token.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return Date.now() + expiresIn * 1000;
  }

  const [, payload] = String(token.access_token || '').split('.');
  if (!payload) return 0;
  try {
    const expiration = Number(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp);
    return Number.isFinite(expiration) && expiration > 0 ? expiration * 1000 : 0;
  } catch {
    return 0;
  }
}

function mtls() {
  return {
    cert: config.iam.cert && fs.readFileSync(config.iam.cert),
    key: config.iam.key && fs.readFileSync(config.iam.key),
    rejectUnauthorized: true,
  };
}

function login(res) {
  if (config.mock) {
    return createSession(res, mockUser);
  }
  for (const key of ['issuer', 'clientId', 'clientSecret', 'redirectUri']) {
    if (!config.oidc[key]) {
      throw new Error(`OIDC ${key} is not configured.`);
    }
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  loginTransactions.set(state, { verifier, expires: Date.now() + 600000 });

  const authorizationUrl = new URL('/oauth2/v1/authorize', config.oidc.issuer);
  authorizationUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.oidc.clientId,
    redirect_uri: config.oidc.redirectUri,
    scope: config.oidc.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  redirect(res, authorizationUrl.toString());
}

async function callback(req, res) {
  const callbackUrl = new URL(req.url, 'http://127.0.0.1');
  const state = callbackUrl.searchParams.get('state');
  const code = callbackUrl.searchParams.get('code');
  const transaction = loginTransactions.get(state);
  loginTransactions.delete(state);

  if (!code || !transaction || transaction.expires < Date.now()) {
    throw new Error('OIDC login state is missing or expired.');
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.oidc.redirectUri,
    client_id: config.oidc.clientId,
    code_verifier: transaction.verifier,
  }).toString();
  const basic = Buffer.from(`${config.oidc.clientId}:${config.oidc.clientSecret}`).toString('base64');
  const tokens = await requestJson(
    new URL('/oauth2/v1/token', config.oidc.issuer).toString(),
    form,
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    {},
  );

  if (!tokens.access_token) {
    throw new Error('IAM did not return an access token.');
  }

  const profile = await userinfo(
    new URL('/oauth2/v1/userinfo', config.oidc.issuer).toString(),
    tokens.access_token,
    {},
  );
  const accessToken = decodeJwt(tokens.access_token);
  if (!accessToken.user_id) {
    throw new Error('IAM access token did not include user_id.');
  }

  createSession(res, {
    id: accessToken.user_id,
    name: profile.name || profile.preferred_username || accessToken.user_id,
    email: profile.email || '',
  });
}

function decodeJwt(token) {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('IAM access token is not a JWT.');
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('IAM access token payload is invalid.');
  }
}

function sessionInfo(req, res) {
  const user = currentUser(req);
  if (!user) {
    return json(res, 401, { error: 'Sign-in required.', code: 'SIGN_IN_REQUIRED', login: '/login' });
  }

  json(res, 200, { user, mode: config.mock ? 'mock' : 'IAM OIDC + mTLS' });
}

function createSession(res, user) {
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, { user, expires: Date.now() + 1800000 });
  res.writeHead(302, {
    Location: '/',
    'Set-Cookie': `fp_session=${id}; Max-Age=1800; Path=/; HttpOnly; SameSite=Lax`,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function logout(req, res) {
  const id = cookie(req, 'fp_session');
  if (id) {
    sessions.delete(id);
  }
  clearPendingEnrollments(config.mock ? `mock:${mockUser.id}` : id);
  for (const operation of activeOperations.values()) {
    if (operation.sessionId === (config.mock ? `mock:${mockUser.id}` : id)) operation.cancelled = true;
  }

  res.writeHead(204, {
    'Set-Cookie': 'fp_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
  });
  res.end();
}

function clearPendingEnrollments(sessionId) {
  if (!sessionId) {
    return;
  }
  for (const [flowId, pending] of pendingEnrollments) {
    if (pending.sessionId === sessionId) {
      pendingEnrollments.delete(flowId);
    }
  }
}

function currentUser(req) {
  if (config.mock) {
    return mockUser;
  }

  const session = sessions.get(cookie(req, 'fp_session'));
  return session && session.expires > Date.now() ? session.user : null;
}

function requireUser(req) {
  const user = currentUser(req);
  if (!user) {
    throw apiError('Sign-in required.', 'SIGN_IN_REQUIRED', 401);
  }

  return user;
}

function cookie(req, name) {
  const match = (req.headers.cookie || '').match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );
  return match && match[1];
}

function requestJson(
  address,
  payload,
  headers = {},
  tls = {},
  timeoutMs = 12000,
  method = 'POST',
  options = {},
) {
  return new Promise((resolve, reject) => {
    const url = new URL(address);
    const requestMethod = String(method || 'POST').toUpperCase();
    const hasPayload = payload !== undefined && payload !== null;
    const data = hasPayload
      ? typeof payload === 'string'
        ? payload
        : JSON.stringify(payload)
      : '';
    const client = url.protocol === 'https:' ? https : http;
    const requestHeaders = { ...headers };
    const hasHeader = (name) =>
      Object.keys(requestHeaders).some(
        (header) => header.toLowerCase() === name.toLowerCase(),
      );
    if (hasPayload && !hasHeader('Content-Type')) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    if (hasPayload && !hasHeader('Content-Length')) {
      requestHeaders['Content-Length'] = Buffer.byteLength(data);
    }

    logIamExchange('REQUEST', url, {
      phase: options.phase,
      method: requestMethod,
      headers: requestHeaders,
      body: hasPayload ? debugBody(data, requestHeaders) : undefined,
    });

    const request = client.request(
      url,
      {
        method: requestMethod,
        ...tls,
        headers: requestHeaders,
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (raw += chunk));
        response.on('aborted', () => reject(apiError('The upstream response was interrupted.', 'UPSTREAM_RESPONSE_INTERRUPTED', 502)));
        response.on('error', () => reject(apiError('The upstream response was interrupted.', 'UPSTREAM_RESPONSE_INTERRUPTED', 502)));
        response.on('end', () => {
          logIamExchange('RESPONSE', url, {
            phase: options.phase,
            method: requestMethod,
            statusCode: response.statusCode,
            headers: response.headers,
            body: debugResponseBody(raw),
          });

          const emptyFactors = emptyEnrollmentFactorLookup(
            response.statusCode,
            raw,
            options.phase,
          );
          if (emptyFactors) {
            return resolve(emptyFactors);
          }

          if (response.statusCode < 200 || response.statusCode > 299) {
            return reject(upstreamHttpError(response.statusCode, raw, options.phase));
          }

          try {
            const value = raw ? JSON.parse(raw) : {};
            resolve(value);
          } catch {
            reject(
              apiError(
                'The upstream service returned an invalid response.',
                'UPSTREAM_RESPONSE_INVALID',
                502,
              ),
            );
          }
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      const timeout = new Error('Request timed out.');
      timeout.code = 'ETIMEDOUT';
      request.destroy(timeout);
    });
    request.on('error', (error) => {
      logIamExchange('ERROR', url, {
        phase: options.phase,
        method: requestMethod,
        error: error.code || 'request failed',
      });
      const timedOut = error.code === 'ETIMEDOUT';
      const wrapped = apiError(
        timedOut
          ? 'The upstream request timed out.'
          : 'The upstream service is unavailable.',
        timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REQUEST_FAILED',
        timedOut ? 504 : 502,
        { retryable: true },
      );
      wrapped.networkCode = error.code;
      reject(wrapped);
    });
    try {
      if (options.onSubmitted) options.onSubmitted();
      if (hasPayload) request.write(data);
      request.end();
    } catch (error) {
      request.destroy();
      reject(error);
    }
  });
}

function userinfo(address, token, tls = {}) {
  const url = new URL(address);
  const headers = { Authorization: `Bearer ${token}` };

  logIamExchange('REQUEST', url, { method: 'GET', headers });

  return new Promise((resolve, reject) => {
    const request = https.request(
      address,
      {
        method: 'GET',
        ...tls,
        headers,
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (raw += chunk));
        response.on('end', () => {
          logIamExchange('RESPONSE', url, {
            method: 'GET',
            statusCode: response.statusCode,
            headers: response.headers,
            body: debugResponseBody(raw),
          });
          if (response.statusCode !== 200) {
            return reject(upstreamHttpError(response.statusCode));
          }

          try {
            const value = JSON.parse(raw);
            resolve(value);
          } catch {
            reject(
              apiError(
                'IAM returned an invalid user profile.',
                'IAM_USERINFO_INVALID',
                502,
              ),
            );
          }
        });
      },
    );

    request.on('error', (error) => {
      logIamExchange('ERROR', url, {
        method: 'GET',
        error: error.code || 'request failed',
      });
      reject(
        apiError(
          'IAM user information is unavailable.',
          'IAM_USERINFO_UNAVAILABLE',
          502,
          { retryable: true },
        ),
      );
    });
    request.end();
  });
}

function emptyEnrollmentFactorLookup(statusCode, raw, phase) {
  if (statusCode !== 401 || phase !== 'enrollment-factor-lookup') {
    return null;
  }

  let response;
  try {
    response = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return null;
  }

  const noFactorFound = String(response.status || '').toLowerCase() === 'nofactorfound';
  const hasNoFactorCause = Array.isArray(response.cause) && response.cause.some(
    (cause) => cause && cause.code === 'AUTH-1131',
  );
  return noFactorFound && hasNoFactorCause ? { factors: [] } : null;
}

function upstreamHttpError(statusCode, raw = '', phase = '') {
  let response = {};
  try {
    response = raw ? JSON.parse(raw) : {};
  } catch {
    response = {};
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) response = {};

  const messages = upstreamMessages(response);

  if (
    statusCode === 400 &&
    (phase === 'enrollment-initiate' || String(response.method || '').toUpperCase() === 'FINGERPRINT_BIOMETRIC') &&
    /already enrolled/i.test(messages)
  ) {
    return withUpstreamDiagnostics(apiError(
      'A fingerprint is already enrolled for this user.',
      'ALREADY_ENROLLED',
      409,
      { upstreamStatus: statusCode },
    ), response);
  }

  const verificationFailure = (!phase || phase === 'verification-complete') && verificationFailureFromResponse(response, phase);
  if (verificationFailure) {
    const error = apiError(
      verificationFailure.message,
      verificationFailure.code,
      verificationFailure.statusCode,
      { upstreamStatus: statusCode },
    );
    error.verificationOutcome = verificationFailure.outcome;
    return withUpstreamDiagnostics(error, response);
  }

  const clientStatus =
    statusCode >= 400 && statusCode <= 599 ? statusCode : 502;
  const publicCause = (
    /^(enrollment|verification)-/.test(phase) || phase === 'unenrollment-delete'
  )
    ? publicIamCause(response)
    : '';
  const error = apiError(
    publicCause || 'The upstream service rejected the request.',
    'UPSTREAM_HTTP_ERROR',
    clientStatus,
    { retryable: statusCode >= 500, upstreamStatus: statusCode },
  );
  error.declineAcknowledged = phase === 'enrollment-decline' && statusCode === 401 &&
    String(response.status).toLowerCase() === 'failed' && response.factorStatus === 'FAILURE' &&
    (!response.cause || (Array.isArray(response.cause) && response.cause.length === 0));
  return withUpstreamDiagnostics(error, response);
}

function publicIamCause(response) {
  if (!response || !Array.isArray(response.cause)) {
    return '';
  }

  for (const cause of response.cause) {
    const code = cause && typeof cause.code === 'string'
      ? cause.code.trim()
      : '';
    const message = cause && typeof cause.message === 'string'
      ? cause.message.trim()
      : '';
    if (message && message.length <= 380 && !/[\u0000-\u001f\u007f]/.test(message)) {
      const safeCode = code && code.length <= 100 && !/[\u0000-\u001f\u007f]/.test(code)
        ? code
        : '';
      return safeCode ? `${safeCode}: ${message}` : message;
    }
  }
  return '';
}

function withUpstreamDiagnostics(error, response) {
  error.ecId = typeof response.ecId === 'string' && /^[A-Za-z0-9._:^\/-]{1,200}$/.test(response.ecId) ? response.ecId : undefined;
  error.causeCodes = Array.isArray(response.cause)
    ? response.cause.map((cause) => cause && cause.code).filter((code) => typeof code === 'string' && /^AUTH-[0-9]+$/.test(code))
    : [];
  return error;
}

function verificationFailureFromResponse(response, phase = '') {
  if (
    !response ||
    String(response.status || '').toLowerCase() === 'success' ||
    (phase !== 'verification-complete' && (
      String(response.method || '').toUpperCase() !== 'FINGERPRINT_BIOMETRIC' ||
      String(response.scenario || '').toUpperCase() !== 'AUTHENTICATION'))
  ) {
    return null;
  }

  const messages = upstreamMessages(response);
  const genericIamAuthenticationFailure = phase === 'verification-complete' &&
    Array.isArray(response.cause) && response.cause.some((cause) =>
      cause && cause.code === 'AUTH-1007' &&
      /^Authentication failed\.?$/i.test(String(cause.message || '').trim()),
    );
  if (
    /(not enrolled|no enrolled|has no .*fingerprint|factor .*not found|no .*factor)/i.test(
      messages,
    )
  ) {
    return {
      outcome: 'INCONCLUSIVE',
      code: 'FINGERPRINT_NOT_ENROLLED',
      statusCode: 409,
      message: 'No enrolled fingerprint exists for this user.',
    };
  }

  if (
    response.match === false || response.verified === false || genericIamAuthenticationFailure ||
    /\b(?:fingerprint|biometric)\b[^.]*\b(?:no[ _-]*match|does not match|did not match|mismatch)\b/i.test(
      messages,
    )
  ) {
    return {
      outcome: 'NO_MATCH',
      code: 'FINGERPRINT_NO_MATCH',
      statusCode: 401,
      message: 'The captured fingerprint or PIN number did not match the enrolled reference.',
    };
  }

  return null;
}

function upstreamMessages(response) {
  return [
    response && response.message,
    ...(response && Array.isArray(response.cause)
      ? response.cause.map((cause) => cause && cause.message)
      : []),
  ]
    .filter(Boolean)
    .join(' ');
}

function logIamExchange(direction, url, details) {
  if (!config.debugIamLogging || !isConfiguredIamUrl(url)) {
    return;
  }

  const event = sanitizeForLog({
    timestamp: new Date().toISOString(),
    direction,
    phase: details.phase,
    method: details.method,
    url: `${url.protocol}//${url.host}${url.pathname}`,
    statusCode: details.statusCode,
    headers: details.headers,
    body: details.body,
    error: details.error,
  });
  console.log(`[IAM ${direction}]\n${JSON.stringify(event, null, 2)}`);
}

function isConfiguredIamUrl(url) {
  const addresses = [
    config.iam.tokenUrl,
    config.iam.baseUrl,
    config.oidc.issuer,
  ].filter(Boolean);

  return addresses.some((address) => {
    try {
      return new URL(address).origin === url.origin;
    } catch {
      return false;
    }
  });
}

function debugBody(data, headers) {
  const contentType = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === 'content-type',
  );
  const type = contentType ? String(contentType[1]).toLowerCase() : '';
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(data));
  }

  try {
    return data ? JSON.parse(data) : {};
  } catch {
    return `[non-JSON request body; ${Buffer.byteLength(data)} bytes]`;
  }
}

function debugResponseBody(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return `[non-JSON response body; ${Buffer.byteLength(raw)} bytes]`;
  }
}

function sanitizeForLog(value, key = '', parentKey = '') {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'code' && parentKey === 'cause' && typeof value === 'string' && /^AUTH-[0-9]+$/.test(value)) {
    return value;
  }
  if (normalizedKey === 'biometricdata' || normalizedKey === 'template' || normalizedKey === 'seed2' || normalizedKey === 'seed1') {
    const length = typeof value === 'string' ? value.length : 0;
    return `[REDACTED biometric material; ${length} characters]`;
  }
  if (
    normalizedKey === 'authorization' ||
    normalizedKey === 'client_secret' ||
    normalizedKey === 'access_token' ||
    normalizedKey === 'id_token' ||
    normalizedKey === 'refresh_token' ||
    normalizedKey === 'client_assertion' ||
    normalizedKey === 'password' ||
    normalizedKey === 'requeststate' ||
    normalizedKey === 'privatekey' ||
    normalizedKey === 'certificate' ||
    normalizedKey === 'code' ||
    normalizedKey === 'code_verifier' ||
    normalizedKey === 'securitytoken' ||
    normalizedKey === 'cookie' ||
    normalizedKey === 'set-cookie'
  ) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, key, parentKey));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([name, item]) => [name, sanitizeForLog(item, name, normalizedKey)]),
    );
  }

  return value;
}

async function bridge(route, payload) {
  try {
    return await requestJson(
      config.bridgeUrl + route,
      payload || '',
      payload ? {} : { 'Content-Length': 0 },
      {},
      config.bridgeTimeoutMs,
    );
  } catch (error) {
    if (error.networkCode === 'ECONNREFUSED') {
      throw apiError(
        'Fingerprint bridge is unavailable. Start the Java bridge and reconnect the reader.',
        'BRIDGE_UNAVAILABLE',
        502,
        { retryable: true },
      );
    }
    if (error.code && error.code.startsWith('UPSTREAM_')) {
      error.publicMessage = 'The fingerprint bridge could not complete the request.';
      error.code =
        error.code === 'UPSTREAM_TIMEOUT'
          ? 'BRIDGE_TIMEOUT'
          : 'BRIDGE_REQUEST_FAILED';
    }
    throw error;
  }
}

function captureSummary(sample) {
  return {
    quality: sample.quality,
    livenessPassed: sample.livenessPassed,
    rawImageBytes: sample.rawImageBytes,
  };
}

function requestId() {
  return `fp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeApiError(error) {
  const statusCode =
    Number.isInteger(error && error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 502;

  return {
    statusCode,
    code: (error && error.code) || 'INTEGRATION_ERROR',
    message:
      (error && error.publicMessage) ||
      'The local integration could not complete the request.',
    retryable: Boolean(error && error.retryable),
    upstreamStatus: error && error.upstreamStatus,
    ecId: error && error.ecId,
    causeCodes: (error && error.causeCodes) || [],
  };
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10000) {
        reject(apiError('Request too large.', 'REQUEST_TOO_LARGE', 413));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(apiError('Invalid JSON request.', 'INVALID_JSON', 400));
      }
    });
  });
}

function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function sendFile(res, file, type) {
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(__dirname, file)).pipe(res);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) {
    return;
  }

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

if (require.main === module) {
  server.listen(config.port, '127.0.0.1', () => {
    console.log(
      `Fingerprint Reference App: http://localhost:${config.port} (${config.mock ? 'mock' : 'IAM OIDC + mTLS'} mode)`,
    );
  });
}

module.exports = {
  server,
  biometricData,
  debugBody,
  debugResponseBody,
  normalizeVerificationResult,
  requestJson,
  sanitizeForLog,
  upstreamHttpError,
};
