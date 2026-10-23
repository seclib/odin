import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuebecRoadworks,
  viewIntersectsQuebec,
} from './disruptions.js';
import {
  createRoadDisruptionsSource,
  validateRoadDisruptionSnapshot,
} from './source.js';

const now = Date.parse('2026-10-23T12:00:00Z');
const feature = (overrides = {}) => ({
  type: 'Feature',
  id: 42,
  properties: {
    identifiant: '42',
    debut: '2026/10/01 08:00:00',
    fin: '2026/12/31 23:59:00',
    miseAJour: '2026/10/22 10:00:00',
    identificationDesTravaux: 'Bridge lane closure',
    entrave: 'One lane closed',
    municipalite: 'Montréal',
    ...overrides,
  },
  geometry: {
    type: 'LineString',
    coordinates: [
      [-73.56, 45.51],
      [-73.55, 45.52],
    ],
  },
});

test('Quebec feed keeps valid current and near-future work zones with source timestamps', () => {
  const payload = {
    type: 'FeatureCollection',
    features: [feature(), feature({ debut: '2026/10/24 08:00:00' })],
  };
  const rows = normalizeQuebecRoadworks(payload, { now });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[1].status, 'scheduled');
  assert.equal(rows[0].updatedAt, Date.parse('2026-10-22T14:00:00Z'));
  assert.equal(
    normalizeQuebecRoadworks(
      { type: 'FeatureCollection', features: [] },
      { now },
    ).length,
    0,
  );
});

test('expired, stale, malformed, and out-of-coverage rows are excluded', () => {
  const stale = feature({ miseAJour: '2026/08/01 00:00:00' });
  const expired = feature({ fin: '2026/10/01 00:00:00' });
  const remote = feature();
  remote.geometry.coordinates = [
    [-122.3, 47.6],
    [-122.2, 47.7],
  ];
  const bad = feature();
  bad.geometry.coordinates = [[NaN, 90]];
  assert.deepEqual(
    normalizeQuebecRoadworks(
      { type: 'FeatureCollection', features: [stale, expired, remote, bad] },
      { now },
    ),
    [],
  );
  assert.equal(
    normalizeQuebecRoadworks(
      { type: 'FeatureCollection', features: [feature()] },
      { now, maxFeatures: 0 },
    ),
    null,
  );
  assert.equal(
    normalizeQuebecRoadworks(
      { type: 'FeatureCollection', features: 'bad' },
      { now },
    ),
    null,
  );
});

test('coverage gate and response freshness preserve stale as a separate state', () => {
  assert.equal(
    viewIntersectsQuebec({ west: -74, east: -73, south: 45, north: 46 }),
    true,
  );
  assert.equal(
    viewIntersectsQuebec({ west: -123, east: -122, south: 47, north: 48 }),
    false,
  );
  assert.equal(
    viewIntersectsQuebec({ west: -180, east: 180, south: -80, north: 80 }),
    false,
  );
  const base = {
    features: [],
    fetchedAt: now - 60_000,
    sourceUpdatedAt: now - 1_000,
  };
  assert.equal(validateRoadDisruptionSnapshot(base, now).stale, false);
  assert.equal(
    validateRoadDisruptionSnapshot({ ...base, stale: true }, now).stale,
    true,
  );
  assert.equal(
    validateRoadDisruptionSnapshot(
      { ...base, fetchedAt: now - 11 * 60_000 },
      now,
    ).stale,
    true,
  );
  assert.equal(
    validateRoadDisruptionSnapshot({ ...base, fetchedAt: now + 120_000 }, now),
    null,
  );
});

test('road-disruption source reports HTTP failures and malformed payloads', async () => {
  const denied = createRoadDisruptionsSource({
    fetchImpl: async () => new Response('', { status: 403 }),
  });
  await assert.rejects(denied.getSnapshot(), /HTTP 403/);
  const malformed = createRoadDisruptionsSource({
    fetchImpl: async () => new Response('{}'),
  });
  await assert.rejects(malformed.getSnapshot(), /Malformed/);
  const network = createRoadDisruptionsSource({
    fetchImpl: async () => {
      throw new TypeError('offline');
    },
  });
  await assert.rejects(network.getSnapshot(), /offline/);
});
