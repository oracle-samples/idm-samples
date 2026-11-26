'use strict';

const FINGERPRINT_METHOD = 'FINGERPRINT_BIOMETRIC';
const FACTOR_COLLECTION_KEYS = [
  'factors',
  'items',
  'Resources',
  'resources',
  'data',
];

function fingerprintFactorIds(response) {
  const factors = factorRecords(response);
  const ids = [];

  for (const factor of factors) {
    if (!factor || typeof factor !== 'object' || Array.isArray(factor)) {
      continue;
    }
    const methods = normalizedMethods(
      factor.methods ||
        factor.method ||
        factor.factorType ||
        factor.type ||
        factor.authenticationFactor,
    );
    if (!methods.includes(FINGERPRINT_METHOD)) {
      continue;
    }

    const id = stringValue(factor.factorId || factor.id || factor.value);
    if (!id) {
      throw invalidFactorResponse();
    }
    ids.push(id);
  }

  return [...new Set(ids)];
}

function chooseFingerprintFactor(response, preferredFactorId) {
  const ids = fingerprintFactorIds(response);
  const preferred = stringValue(preferredFactorId);
  if (preferred && ids.includes(preferred)) {
    return preferred;
  }
  if (ids.length === 0) {
    return null;
  }
  if (ids.length === 1) {
    return ids[0];
  }

  throw factorError(
    'Multiple fingerprint factors are enrolled. Select a fingerprint factor before verification.',
    'FINGERPRINT_FACTOR_AMBIGUOUS',
    409,
  );
}

function factorRecords(response) {
  if (Array.isArray(response)) {
    return response;
  }
  if (!response || typeof response !== 'object') {
    throw invalidFactorResponse();
  }

  for (const key of FACTOR_COLLECTION_KEYS) {
    if (Array.isArray(response[key])) {
      return response[key];
    }
  }

  if (response.factor && typeof response.factor === 'object') {
    return [response.factor];
  }
  if (response.data && typeof response.data === 'object') {
    return factorRecords(response.data);
  }
  if (Number(response.totalResults) === 0) {
    return [];
  }

  throw invalidFactorResponse();
}

function normalizedMethods(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((method) => stringValue(method).toUpperCase())
    .filter(Boolean);
}

function stringValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return stringValue(value.value);
  }
  return typeof value === 'string' ? value.trim() : '';
}

function invalidFactorResponse() {
  return factorError(
    'IAM returned an invalid factor-list response.',
    'IAM_FACTORS_RESPONSE_INVALID',
    502,
  );
}

function factorError(message, code, statusCode) {
  const error = new Error(message);
  error.publicMessage = message;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  chooseFingerprintFactor,
  fingerprintFactorIds,
};
