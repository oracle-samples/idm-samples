'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseDeviceMappings,
  resolveDeviceMetadata,
} = require('../src/device-mappings');

test('resolves mock and physical reader mappings', () => {
  const mappings = parseDeviceMappings({
    FINGERPRINT_DEVICE_MAPPING_1:
      'mock -> model=HID Lumidigm V521-01-01;version=V521;padLevel=L1',
    FINGERPRINT_DEVICE_MAPPING_2:
      'vendorId=8110;productId=1312;serial=36918 -> model=HID Lumidigm V521-01-01;version=V521;padLevel=L1',
  });

  const expected = {
    deviceModel: 'HID Lumidigm V521-01-01',
    deviceVersion: 'V521',
    devicePadLevel: 'L1',
  };
  assert.deepEqual(resolveDeviceMetadata(mappings, 'mock'), expected);
  assert.deepEqual(
    resolveDeviceMetadata(
      mappings,
      'vendorId=8110;productId=1312;serial=36918',
    ),
    expected,
  );
});

test('normalizes unsigned decimal reader identifiers', () => {
  const mappings = parseDeviceMappings({
    FINGERPRINT_DEVICE_MAPPING_1:
      'vendorId=08110;productId=01312;serial=036918 -> model=Reader;version=1;padLevel=L1',
  });
  assert.equal(
    resolveDeviceMetadata(
      mappings,
      'vendorId=8110;productId=1312;serial=36918',
    ).deviceModel,
    'Reader',
  );
});

test('rejects malformed, incomplete, duplicate, and unmatched mappings', () => {
  assert.throws(
    () => parseDeviceMappings({ FINGERPRINT_DEVICE_MAPPING_1: 'mock' }),
    /exactly one -> separator/,
  );
  assert.throws(
    () => parseDeviceMappings({
      FINGERPRINT_DEVICE_MAPPING_1:
        'mock -> model=Reader;version=1',
    }),
    /missing padLevel/,
  );
  assert.throws(
    () => parseDeviceMappings({
      FINGERPRINT_DEVICE_MAPPING_1:
        'mock -> model=Reader;version=1;padLevel=L1',
      FINGERPRINT_DEVICE_MAPPING_2:
        'mock -> model=Other;version=2;padLevel=L2',
    }),
    /duplicates another fingerprint device identity/,
  );

  const mappings = parseDeviceMappings({
    FINGERPRINT_DEVICE_MAPPING_1:
      'mock -> model=Reader;version=1;padLevel=L1',
  });
  assert.throws(
    () => resolveDeviceMetadata(
      mappings,
      'vendorId=8110;productId=1312;serial=36918',
    ),
    (error) => error.code === 'FINGERPRINT_DEVICE_MAPPING_NOT_FOUND',
  );
});
