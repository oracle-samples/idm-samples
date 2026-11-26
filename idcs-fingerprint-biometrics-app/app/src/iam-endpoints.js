'use strict';

const MFA_PATH = '/mfa/v1';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function createMfaEndpoints(baseUrl) {
  const base = validatedMfaBaseUrl(baseUrl);

  function endpoint(...segments) {
    const url = new URL(base.toString());
    url.pathname = [MFA_PATH, ...segments.map(pathSegment)].join('/');
    return url.toString();
  }

  return Object.freeze({
    factors(userId) {
      return endpoint('users', requiredSegment(userId, 'userId'), 'factors');
    },
    factor(userId, factorId) {
      return endpoint(
        'users',
        requiredSegment(userId, 'userId'),
        'factors',
        requiredSegment(factorId, 'factorId'),
      );
    },
    requests() {
      return endpoint('requests');
    },
    request(requestId) {
      return endpoint('requests', requiredSegment(requestId, 'requestId'));
    },
  });
}

function validatedMfaBaseUrl(value) {
  const configured = typeof value === 'string' ? value.trim() : '';
  if (!configured) {
    throw endpointError(
      'IAM_MFA_BASE_URL is not configured.',
      'IAM_MFA_BASE_URL_NOT_CONFIGURED',
    );
  }
  if (/\/secure\/requests(?:[/?#]|$)/i.test(configured)) {
    throw endpointError(
      'IAM_MFA_BASE_URL must use the standard /mfa/v1 API, not the legacy secure-requests endpoint.',
      'IAM_MFA_BASE_URL_LEGACY',
    );
  }
  if (containsDotSegment(configured)) {
    throw invalidBaseUrl();
  }

  let url;
  try {
    url = new URL(configured);
  } catch {
    throw invalidBaseUrl();
  }

  if (url.username || url.password || url.search || url.hash) {
    throw invalidBaseUrl();
  }
  if (url.pathname !== MFA_PATH && url.pathname !== `${MFA_PATH}/`) {
    throw invalidBaseUrl();
  }
  if (url.protocol !== 'https:') {
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(host)) {
      throw endpointError(
        'IAM_MFA_BASE_URL must use HTTPS (HTTP is allowed only for a loopback test server).',
        'IAM_MFA_BASE_URL_INSECURE',
      );
    }
  }

  url.pathname = MFA_PATH;
  return url;
}

function containsDotSegment(address) {
  const match = String(address).match(
    /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i,
  );
  if (!match || !match[1]) return false;

  try {
    return match[1]
      .split('/')
      .map((segment) => decodeURIComponent(segment).toLowerCase())
      .some((segment) => segment === '.' || segment === '..');
  } catch {
    return true;
  }
}

function requiredSegment(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidSegment(name);
  }
  const segment = value.trim();
  if (
    /[\u0000-\u001f\u007f?#\\]/.test(segment) ||
    /^\/\//.test(segment) ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(segment)
  ) {
    throw invalidSegment(name);
  }

  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw invalidSegment(name);
  }
  if (
    decoded
      .split(/[\\/]/)
      .some((part) => part === '.' || part === '..')
  ) {
    throw invalidSegment(name);
  }
  return segment;
}

function pathSegment(value) {
  return encodeURIComponent(value);
}

function invalidBaseUrl() {
  return endpointError(
    'IAM_MFA_BASE_URL must be an absolute URL ending exactly in /mfa/v1 without credentials, query, fragment, or dot segments.',
    'IAM_MFA_BASE_URL_INVALID',
  );
}

function invalidSegment(name) {
  return endpointError(
    `The IAM ${name} path segment is invalid.`,
    'IAM_MFA_PATH_SEGMENT_INVALID',
  );
}

function endpointError(message, code) {
  const error = new Error(message);
  error.publicMessage = message;
  error.code = code;
  error.statusCode = 500;
  return error;
}

module.exports = {
  createMfaEndpoints,
};
