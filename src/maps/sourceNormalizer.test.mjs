import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGoogleResult,
  normalizeExternalResult,
  creationFailed,
  isCesium3DTileset,
} from './sourceNormalizer.js';

// --- Mock Cesium3DTileset-like objects for testing ---

function makeMockTileset(mse = 32) {
  return {
    maximumScreenSpaceError: mse,
    ready: true,
    readyPromise: Promise.resolve(),
    url: 'https://example.com/tileset',
  };
}

function makeError(msg = 'test error') {
  const e = new Error(msg);
  e.name = 'Error';
  return e;
}

// --- Tests isCesium3DTileset ---

test('isCesium3DTileset: valid tileset with number SSE', () => {
  assert.strictEqual(isCesium3DTileset(makeMockTileset(32)), true);
});

test('isCesium3DTileset: null', () => {
  assert.strictEqual(isCesium3DTileset(null), false);
});

test('isCesium3DTileset: plain object without SSE', () => {
  assert.strictEqual(isCesium3DTileset({ foo: 'bar' }), false);
});

test('isCesium3DTileset: object with string SSE', () => {
  assert.strictEqual(isCesium3DTileset({ maximumScreenSpaceError: '32' }), false);
});

// --- Tests normalizeCreationResult ---

test('normalizeCreationResult: success with valid tileset and no error', () => {
  const result = normalizeGoogleResult({
    tileset: makeMockTileset(),
    errors: [],
  });
  assert.strictEqual(result.success, true);
  assert.ok(result.tileset !== null);
  assert.strictEqual(result.error, null);
});

// --- Tests normalizeGoogleResult ---

test('normalizeGoogleResult: success', () => {
  const result = normalizeGoogleResult({
    tileset: makeMockTileset(),
    errors: [],
  });
  assert.strictEqual(result.success, true);
  assert.ok(result.tileset !== null);
  assert.strictEqual(result.error, null);
});

test('normalizeGoogleResult: failure with error', () => {
  const result = normalizeGoogleResult({
    tileset: null,
    errors: [makeError('Google key missing')],
  });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.tileset, null);
  assert.ok(result.error instanceof Error);
  assert.strictEqual(result.error.message, 'Google key missing');
});

test('normalizeGoogleResult: no tileset, no errors', () => {
  const result = normalizeGoogleResult({
    tileset: null,
    errors: [],
  });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.tileset, null);
  assert.ok(result.error instanceof Error);
});

// --- Tests normalizeExternalResult ---

test('normalizeExternalResult: success', () => {
  const result = normalizeExternalResult({ tileset: makeMockTileset() });
  assert.strictEqual(result.success, true);
  assert.ok(result.tileset !== null);
  assert.strictEqual(result.error, null);
});

test('normalizeExternalResult: failure (no tileset)', () => {
  const result = normalizeExternalResult({});
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.tileset, null);
  assert.ok(result.error instanceof Error);
});

test('normalizeExternalResult: null input', () => {
  const result = normalizeExternalResult(null);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.tileset, null);
  assert.ok(result.error instanceof Error);
});

// --- Tests creationFailed ---

test('creationFailed returns correct shape', () => {
  const result = creationFailed();
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.tileset, null);
  assert.ok(result.error instanceof Error);
  assert.strictEqual(result.error.message, 'Tileset creation failed');
});

// --- Integration: both normalizers produce compatible shapes ---

test('both normalizers have same shape fields', () => {
  const google = normalizeGoogleResult({
    tileset: makeMockTileset(),
    errors: [],
  });
  const external = normalizeExternalResult({ tileset: makeMockTileset() });

  assert.ok('success' in google);
  assert.ok('tileset' in google);
  assert.ok('error' in google);
  assert.ok('success' in external);
  assert.ok('tileset' in external);
  assert.ok('error' in external);
});