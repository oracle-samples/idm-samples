'use strict';

const MAPPING_NAME = /^FINGERPRINT_DEVICE_MAPPING_([1-9][0-9]*)$/;
const IDENTITY_FIELDS = ['vendorId', 'productId', 'serial'];
const METADATA_FIELDS = ['model', 'version', 'padLevel'];

function parseDeviceMappings(environment = process.env) {
  const configured = Object.entries(environment)
    .map(([name, value]) => {
      const match = MAPPING_NAME.exec(name);
      return match ? { name, index: Number(match[1]), value } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index);

  const mappings = new Map();
  for (const entry of configured) {
    const value = String(entry.value || '').trim();
    const arrow = value.indexOf('->');
    if (arrow < 0 || value.indexOf('->', arrow + 2) >= 0) {
      throw mappingError(`${entry.name} must contain exactly one -> separator.`);
    }

    const identity = identityKey(value.slice(0, arrow).trim(), entry.name);
    const target = fields(value.slice(arrow + 2), METADATA_FIELDS, entry.name);
    if (mappings.has(identity)) {
      throw mappingError(`${entry.name} duplicates another fingerprint device identity.`);
    }
    mappings.set(identity, Object.freeze({
      deviceModel: target.model,
      deviceVersion: target.version,
      devicePadLevel: target.padLevel,
    }));
  }
  return mappings;
}

function resolveDeviceMetadata(mappings, readerIdentity) {
  let identity;
  try {
    identity = identityKey(String(readerIdentity || '').trim(), 'reader identity');
  } catch (error) {
    const invalid = mappingError(
      'The fingerprint bridge returned an invalid reader identity.',
      'FINGERPRINT_READER_IDENTITY_INVALID',
    );
    invalid.cause = error;
    throw invalid;
  }

  const metadata = mappings.get(identity);
  if (!metadata) {
    throw mappingError(
      'The captured fingerprint reader does not have a configured IAM device mapping.',
      'FINGERPRINT_DEVICE_MAPPING_NOT_FOUND',
    );
  }
  return metadata;
}

function identityKey(value, source) {
  if (value === 'mock') return 'mock';
  const identity = fields(value, IDENTITY_FIELDS, source);
  return `usb:${unsignedDecimal(identity.vendorId, source, 'vendorId')}`
    + `:${unsignedDecimal(identity.productId, source, 'productId')}`
    + `:${unsignedDecimal(identity.serial, source, 'serial')}`;
}

function fields(value, expected, source) {
  const parsed = Object.create(null);
  for (const segment of String(value || '').split(';')) {
    const item = segment.trim();
    const separator = item.indexOf('=');
    if (separator <= 0) {
      throw mappingError(`${source} contains an invalid field.`);
    }
    const name = item.slice(0, separator).trim();
    const fieldValue = item.slice(separator + 1).trim();
    if (!expected.includes(name) || !fieldValue || parsed[name] !== undefined) {
      throw mappingError(`${source} contains an invalid ${name || 'unnamed'} field.`);
    }
    parsed[name] = fieldValue;
  }
  for (const name of expected) {
    if (parsed[name] === undefined) {
      throw mappingError(`${source} is missing ${name}.`);
    }
  }
  return parsed;
}

function unsignedDecimal(value, source, field) {
  if (!/^[0-9]+$/.test(value)) {
    throw mappingError(`${source} ${field} must be an unsigned decimal number.`);
  }
  return BigInt(value).toString(10);
}

function mappingError(message, code = 'FINGERPRINT_DEVICE_MAPPING_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  parseDeviceMappings,
  resolveDeviceMetadata,
};
