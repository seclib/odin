/** Tests for the `filter_area` tool. */

import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCatalog, coreTools } from '../index.js';
import { filterArea } from './filter_area.js';

// --- Mock data ---

function makePointEntity(id, lat, lon, extra = {}) {
  return { id, lat, lon, ...extra };
}

// --- Mock services ---

function fullServices() {
  return {
    aircraft: {
      async getSnapshot() {
        return {
          records: [
            makePointEntity('a1', 37.7, -122.4),
            makePointEntity('a2', 37.78, -122.4), // ~8.8km north - inside 10km
            makePointEntity('a3', 40.0, -74.0),
          ],
          complete: true,
        };
      },
    },
    fires: { getSnapshot: () => ({ fires: [], complete: true }) },
    earthquakes: { getSnapshot: () => ({ events: [], complete: true }) },
  };
}

// --- Tests ---

test('filter_area: point at center retained', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [
      makePointEntity('p1', 37.7, -122.4), // at center - inside
      makePointEntity('p2', 37.78, -122.4), // ~8.8km north - inside 10km radius
    ],
  });
  // Both points should be within 10km radius
  assert.strictEqual(result.data.rows.length, 2, 'Should retain 2 entities within 10km radius');
  assert.strictEqual(result.data.total, 2, 'Total should be 2');
  assert.strictEqual(result.data.may_have_more, false);
});

test('filter_area: point outside radius filtered out', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 5 }, // 5km radius
    features: [
      makePointEntity('p1', 37.7, -122.4), // at center - inside
      makePointEntity('p2', 37.8, -122.4), // ~11.1km away - outside 5km radius
    ],
  });
  // Only p1 should be retained
  assert.strictEqual(result.data.rows.length, 1, 'Should retain 1 entity');
  assert.strictEqual(result.data.total, 2, 'Total should be 2');
  assert.strictEqual(result.data.may_have_more, false);
});

test('filter_area: limit applied', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 100 }, // large radius
    features: [
      makePointEntity('p1', 37.7, -122.4),
      makePointEntity('p2', 37.78, -122.4),
      makePointEntity('p3', 37.7, -122.3), // ~8km east - inside
      makePointEntity('p4', 38.5, -122.4), // ~83km north - outside 100km? 
      makePointEntity('p5', 37.7, -121.5), // ~85km south-east - inside 100km
    ],
    limit: 3,
  });
  // All 5 should be within 100km, limit of 3 applied
  assert.strictEqual(result.data.rows.length, 3, 'Should respect limit of 3');
  assert.strictEqual(result.data.total, 5, 'Total should be 5');
  assert.strictEqual(result.data.may_have_more, true);
});

test('filter_area: conservation des propriétés originales', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [
      makePointEntity('p1', 37.7, -122.4, { callsign: 'UAL123' }),
      makePointEntity('p2', 37.78, -122.4, { mag: 3.5 }),
    ],
  });
  assert.strictEqual(result.data.rows.length, 2, 'Should retain 2 entities');
  assert.strictEqual(result.data.rows[0].callsign, 'UAL123', 'callsign should be preserved');
  assert.strictEqual(result.data.rows[1].mag, 3.5, 'mag should be preserved');
});

test('filter_area: area required returns error', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  try {
    await catalog.call('filter_area', { features: [] });
    assert.fail('Should have thrown');
  } catch (error) {
    assert.strictEqual(error.code, 'invalid_arguments');
  }
});

test('filter_area: result structure', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [makePointEntity('p1', 37.7, -122.4)],
  });
  // Check that result has the expected top-level fields
  assert.ok('summary' in result, 'Result should have summary field');
  assert.ok('data' in result, 'Result should have data field');
  // Check nested data fields
  assert.ok('rows' in result.data, 'data should have rows field');
  assert.ok('total' in result.data, 'data should have total field');
  assert.ok('may_have_more' in result.data, 'data should have may_have_more field');
  assert.ok('area' in result.data, 'data should have area field');
  assert.ok('geometry_types_supported' in result.data, 'data should have geometry_types_supported field');
  assert.ok('limitations' in result.data, 'data should have limitations field');
  assert.ok('view' in result.data, 'data should have view field');
});

test('filter_area: works with minimal services', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: {} });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [makePointEntity('p1', 37.7, -122.4)],
  });
  assert.ok(Array.isArray(result.data.rows), 'rows should be an array');
  assert.strictEqual(result.data.summary.length > 0, true, 'Should have summary');
});

test('filter_area: empty features array', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [],
  });
  assert.strictEqual(result.data.rows.length, 0, 'Should return 0 rows');
  assert.strictEqual(result.data.total, 0, 'Total should be 0');
  assert.strictEqual(result.data.may_have_more, false);
});

test('filter_area: result contains area info', async () => {
  const catalog = composeCatalog({ tools: [filterArea], services: fullServices() });
  const result = await catalog.call('filter_area', {
    area: { lat: 37.7, lon: -122.4, radius_km: 10 },
    features: [makePointEntity('p1', 37.7, -122.4)],
  });
  assert.strictEqual(result.data.area.label.length > 0, true, 'Should have area label');
  assert.ok(Math.abs(result.data.area.center.lat - 37.7) < 0.01, 'Should have area center lat');
  assert.ok(Math.abs(result.data.area.center.lon - (-122.4)) < 0.01, 'Should have area center lon');
});
