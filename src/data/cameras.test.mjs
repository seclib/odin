// src/data/cameras.test.mjs — Schéma et catalogue des sources caméra (lot 01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_CATEGORIES,
  CAMERA_MEDIA_TYPES,
  CAMERA_LEGAL_STATUSES,
  CAMERA_TECHNICAL_STATUSES,
  CAMERA_LOCATION_ACCURACY,
  CAMERA_ACCESS_TYPES,
  validateCameraSource,
  hasVerifiedCoordinates,
  hasAnyCoordinates,
  validateUniqueIds,
  filterCameraSources,
  buildCameraCatalog,
  findCameraSourceById,
  CAMERA_SOURCES,
} from './cameras.js';

test('catalog contains the five Réunion network entries', () => {
  const catalog = buildCameraCatalog();
  assert.strictEqual(catalog.length, 5);
  const ids = catalog.map((s) => s.id);
  assert.ok(ids.includes('reunion-ovpf-ipgp'));
  assert.ok(ids.includes('reunion-irt-tourisme'));
  assert.ok(ids.includes('reunion-meteor-oi'));
  assert.ok(ids.includes('reunion-gigarun-port'));
  assert.ok(ids.includes('reunion-region-crgt-trafic'));
});

test('all catalog entries are valid against the schema', () => {
  const catalog = buildCameraCatalog();
  for (const source of catalog) {
    const errors = validateCameraSource(source);
    assert.deepStrictEqual(errors, [], `source ${source.id}: ${errors.join(', ')}`);
  }
});

test('all catalog ids are unique', () => {
  const catalog = buildCameraCatalog();
  const errors = validateUniqueIds(catalog);
  assert.deepStrictEqual(errors, []);
});

test('no catalog entry claims verified coordinates without them', () => {
  const catalog = buildCameraCatalog();
  for (const source of catalog) {
    assert.strictEqual(
      source.locationAccuracy,
      'none',
      `source ${source.id} should have locationAccuracy 'none' (no invented coordinates)`,
    );
    assert.strictEqual(hasVerifiedCoordinates(source), false);
    assert.strictEqual(hasAnyCoordinates(source), false);
  }
});

test('category values are from the allowed set', () => {
  assert.ok(CAMERA_CATEGORIES.includes('traffic'));
  assert.ok(CAMERA_CATEGORIES.includes('weather'));
  assert.ok(CAMERA_CATEGORIES.includes('volcanic'));
  assert.ok(CAMERA_CATEGORIES.includes('maritime'));
  assert.ok(CAMERA_CATEGORIES.includes('tourism'));
  assert.ok(CAMERA_CATEGORIES.includes('public_webcam'));
  assert.ok(CAMERA_CATEGORIES.includes('other'));
});

test('mediaType values are from the allowed set', () => {
  assert.ok(CAMERA_MEDIA_TYPES.includes('live_video'));
  assert.ok(CAMERA_MEDIA_TYPES.includes('periodic_image'));
  assert.ok(CAMERA_MEDIA_TYPES.includes('timelapse'));
  assert.ok(CAMERA_MEDIA_TYPES.includes('external_page'));
  assert.ok(CAMERA_MEDIA_TYPES.includes('unknown'));
});

test('legalStatus values are from the allowed set', () => {
  assert.ok(CAMERA_LEGAL_STATUSES.includes('approved'));
  assert.ok(CAMERA_LEGAL_STATUSES.includes('permission_required'));
  assert.ok(CAMERA_LEGAL_STATUSES.includes('external_only'));
  assert.ok(CAMERA_LEGAL_STATUSES.includes('unknown'));
  assert.ok(CAMERA_LEGAL_STATUSES.includes('prohibited'));
});

test('technicalStatus values are from the allowed set', () => {
  assert.ok(CAMERA_TECHNICAL_STATUSES.includes('online'));
  assert.ok(CAMERA_TECHNICAL_STATUSES.includes('offline'));
  assert.ok(CAMERA_TECHNICAL_STATUSES.includes('untested'));
  assert.ok(CAMERA_TECHNICAL_STATUSES.includes('unavailable'));
});

test('validateCameraSource rejects missing required fields', () => {
  const errors = validateCameraSource({});
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.startsWith('id:')));
  assert.ok(errors.some((e) => e.startsWith('name:')));
  assert.ok(errors.some((e) => e.startsWith('operator:')));
  assert.ok(errors.some((e) => e.startsWith('country:')));
  assert.ok(errors.some((e) => e.startsWith('region:')));
});

test('validateCameraSource rejects invalid category', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    category: 'not-a-category',
  });
  assert.ok(errors.some((e) => e.startsWith('category:')));
});

test('validateCameraSource rejects invalid legalStatus', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    legalStatus: 'not-a-status',
  });
  assert.ok(errors.some((e) => e.startsWith('legalStatus:')));
});

test('validateCameraSource rejects invalid technicalStatus', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    technicalStatus: 'not-a-status',
  });
  assert.ok(errors.some((e) => e.startsWith('technicalStatus:')));
});

test('validateCameraSource accepts valid coordinates with verified accuracy', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: -20.88, longitude: 55.45, locationAccuracy: 'verified',
  });
  assert.deepStrictEqual(errors, []);
});

test('validateCameraSource rejects coordinates without locationAccuracy', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: -20.88, longitude: 55.45,
  });
  assert.ok(errors.some((e) => e.startsWith('locationAccuracy:')));
});

test('validateCameraSource rejects out-of-range latitude', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: 91, longitude: 0, locationAccuracy: 'verified',
  });
  assert.ok(errors.some((e) => e.startsWith('latitude:')));
});

test('validateCameraSource rejects out-of-range longitude', () => {
  const errors = validateCameraSource({
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: 0, longitude: 181, locationAccuracy: 'verified',
  });
  assert.ok(errors.some((e) => e.startsWith('longitude:')));
});

test('hasVerifiedCoordinates returns false for entries without coordinates', () => {
  const source = CAMERA_SOURCES[0];
  assert.strictEqual(hasVerifiedCoordinates(source), false);
});

test('hasVerifiedCoordinates returns true for verified coordinates', () => {
  const source = {
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: -20.88, longitude: 55.45, locationAccuracy: 'verified',
  };
  assert.strictEqual(hasVerifiedCoordinates(source), true);
});

test('hasVerifiedCoordinates returns false for approx accuracy', () => {
  const source = {
    id: 'x', name: 'n', operator: 'o', country: 'FR', region: 'R',
    latitude: -20.88, longitude: 55.45, locationAccuracy: 'approx',
  };
  assert.strictEqual(hasVerifiedCoordinates(source), false);
});

test('filterCameraSources filters by category', () => {
  const catalog = buildCameraCatalog();
  const volcanic = filterCameraSources(catalog, { category: 'volcanic' });
  assert.strictEqual(volcanic.length, 1);
  assert.strictEqual(volcanic[0].id, 'reunion-ovpf-ipgp');
});

test('filterCameraSources filters by legalStatus', () => {
  const catalog = buildCameraCatalog();
  const perm = filterCameraSources(catalog, { legalStatus: 'permission_required' });
  assert.strictEqual(perm.length, 2);
  const ext = filterCameraSources(catalog, { legalStatus: 'external_only' });
  assert.strictEqual(ext.length, 1);
  assert.strictEqual(ext[0].id, 'reunion-region-crgt-trafic');
});

test('filterCameraSources filters by technicalStatus', () => {
  const catalog = buildCameraCatalog();
  const untested = filterCameraSources(catalog, { technicalStatus: 'untested' });
  assert.strictEqual(untested.length, 5);
});

test('filterCameraSources searches by name/operator/region', () => {
  const catalog = buildCameraCatalog();
  const byName = filterCameraSources(catalog, { query: 'OVPF' });
  assert.strictEqual(byName.length, 1);
  assert.strictEqual(byName[0].id, 'reunion-ovpf-ipgp');
  const byOperator = filterCameraSources(catalog, { query: 'Gigarun' });
  assert.strictEqual(byOperator.length, 1);
  assert.strictEqual(byOperator[0].id, 'reunion-gigarun-port');
  const byRegion = filterCameraSources(catalog, { query: 'Réunion' });
  assert.strictEqual(byRegion.length, 5);
});

test('filterCameraSources combines category and query', () => {
  const catalog = buildCameraCatalog();
  const result = filterCameraSources(catalog, {
    category: 'volcanic',
    query: 'Tourisme',
  });
  assert.strictEqual(result.length, 0);
});

test('findCameraSourceById returns the matching source', () => {
  const catalog = buildCameraCatalog();
  const source = findCameraSourceById(catalog, 'reunion-irt-tourisme');
  assert.ok(source);
  assert.strictEqual(source.name, 'IRT / Réunion Tourisme — Webcams touristiques');
  assert.strictEqual(findCameraSourceById(catalog, 'does-not-exist'), null);
});

test('OVPF entry has unknown legalStatus (not presumed approved)', () => {
  const catalog = buildCameraCatalog();
  const ovpf = findCameraSourceById(catalog, 'reunion-ovpf-ipgp');
  assert.strictEqual(ovpf.legalStatus, 'unknown');
});

test('IRT entry has permission_required legalStatus', () => {
  const catalog = buildCameraCatalog();
  const irt = findCameraSourceById(catalog, 'reunion-irt-tourisme');
  assert.strictEqual(irt.legalStatus, 'permission_required');
});

test('CRGT entry has external_only legalStatus', () => {
  const catalog = buildCameraCatalog();
  const crgt = findCameraSourceById(catalog, 'reunion-region-crgt-trafic');
  assert.strictEqual(crgt.legalStatus, 'external_only');
});

test('all catalog entries are enabled by default', () => {
  const catalog = buildCameraCatalog();
  for (const source of catalog) {
    assert.strictEqual(source.enabled, true);
  }
});
