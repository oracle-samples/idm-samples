'use strict';

const FINGERPRINT_EXTENSION =
  'urn:ietf:params:scim:schemas:oracle:idcs:extension:fingerprint:mfa';
const FINGERPRINT_METHOD = 'FINGERPRINT_BIOMETRIC';
const USER_ID_TYPE = 'USER_GUID';
const ENROLLMENT_ACTIONS = new Set(['ACCEPTED', 'DECLINED']);
const FINGER_POSITIONS = new Set([
  'LEFT_THUMB',
  'LEFT_INDEX',
  'LEFT_MIDDLE',
  'LEFT_RING',
  'LEFT_LITTLE',
  'LEFT_EXTRA_1',
  'RIGHT_THUMB',
  'RIGHT_INDEX',
  'RIGHT_MIDDLE',
  'RIGHT_RING',
  'RIGHT_LITTLE',
  'RIGHT_EXTRA_1',
]);

function enrollmentInitiationPayload() {
  return { method: FINGERPRINT_METHOD };
}

function enrollmentContinuationPayload(
  request,
  biometric,
  continuation = {},
) {
  const { action } = continuation;
  if (!ENROLLMENT_ACTIONS.has(action)) {
    throw contractError('IAM enrollment action must be ACCEPTED or DECLINED.');
  }

  const payload = {
    action,
    requestState: requiredOpaqueState(continuation.requestState),
  };

  if (action === 'ACCEPTED') {
    payload[FINGERPRINT_EXTENSION] = fingerprintExtension(request, biometric);
  }

  return payload;
}

function verificationInitiationPayload(request = {}) {
  return {
    userId: requiredIdentifier(
      request.userId,
      'The signed-in IAM user GUID is missing.',
    ),
    userIdType: USER_ID_TYPE,
    factorId: requiredIdentifier(
      request.factorId,
      'The fingerprint factor identifier is missing.',
    ),
    method: FINGERPRINT_METHOD,
  };
}

function verificationCompletionPayload(
  request,
  biometric,
  continuation = {},
) {
  return {
    requestState: requiredOpaqueState(continuation.requestState),
    [FINGERPRINT_EXTENSION]: fingerprintExtension(request, biometric),
  };
}

function assertFingerPosition(finger) {
  if (!FINGER_POSITIONS.has(finger)) {
    const error = contractError(
      'Unsupported finger position.',
      'INVALID_FINGER_POSITION',
      400,
    );
    error.publicMessage = error.message;
    throw error;
  }

  return finger;
}

function fingerprintExtension(request = {}, biometric) {
  const template = requiredPayloadValue(
    request.template,
    'Fingerprint biometricData is missing.',
  );
  assertFingerPosition(request.finger);
  const clientReferenceId = requiredPayloadValue(
    request.transactionId,
    'Fingerprint clientReferenceId is missing.',
  );

  return {
    biometricData: template,
    fingerPosition: request.finger,
    btpClientVersion: requiredMetadata(
      biometric,
      'btpClientVersion',
      'IAM_BTP_CLIENT_VERSION',
    ),
    clientReferenceId,
    deviceModel: requiredMetadata(
      biometric,
      'deviceModel',
      'fingerprint device mapping model',
    ),
    deviceVersion: requiredMetadata(
      biometric,
      'deviceVersion',
      'fingerprint device mapping version',
    ),
    devicePadLevel: requiredMetadata(
      biometric,
      'devicePadLevel',
      'fingerprint device mapping padLevel',
    ),
  };
}

function requiredOpaqueState(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw contractError('IAM requestState is missing.');
  }
  return value;
}

function requiredIdentifier(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw contractError(message);
  }
  return value.trim();
}

function requiredPayloadValue(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw contractError(message);
  }
  return value;
}

function requiredMetadata(metadata, field, setting) {
  const value =
    metadata && typeof metadata[field] === 'string'
      ? metadata[field].trim()
      : '';
  if (!value) {
    throw contractError(`${setting} is not configured.`);
  }
  return value;
}

function contractError(message, code = 'IAM_PAYLOAD_INVALID', statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  FINGERPRINT_EXTENSION,
  FINGERPRINT_METHOD,
  assertFingerPosition,
  enrollmentContinuationPayload,
  enrollmentInitiationPayload,
  verificationCompletionPayload,
  verificationInitiationPayload,
};
